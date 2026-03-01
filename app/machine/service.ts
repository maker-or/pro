import axios from "axios";
import { Data, Effect, Schedule } from "effect";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { modelRegister } from "../../model_register";
import { providers } from "./provider";
import type { BearerHeaders, ModelObject } from "./model";

class MissingAuthHeader extends Data.TaggedError("MissingAuthHeader")<{}> {}
class NetworkError extends Data.TaggedError("NetworkError")<{
	cause: unknown;
}> {}
class TokenValidationError extends Data.TaggedError("TokenValidationError")<{
	message: string;
	status?: number;
}> {}
class BodyParseError extends Data.TaggedError("BodyParseError")<{
	message: string;
}> {}
class UpstreamError extends Data.TaggedError("UpstreamError")<{
	message: string;
	status?: number;
}> {}
class RateLimitError extends Data.TaggedError("RateLimitError")<{
	message: string;
}> {}

export type MachineError =
	| MissingAuthHeader
	| NetworkError
	| TokenValidationError
	| BodyParseError
	| UpstreamError
	| RateLimitError;

const logger = logs.getLogger("my-app");
const tracer = trace.getTracer("machine-service", "1.0.0");

const INFO_SEVERITY_NUMBER = 9;
const WARN_SEVERITY_NUMBER = 13;
const ERROR_SEVERITY_NUMBER = 17;

type CanonicalContext = {
	requestId: string;
	traceId?: string;
	startedAt: number;
	outcome: "success" | "error";
	httpStatus?: number;
	errorType?: MachineError["_tag"];
	errorMessage?: string;
	tokenValidationStatus?: number;
	tokenValid?: boolean;
	modelId?: string;
	upstreamModel?: string;
	provider?: string;
	providerHost?: string;
	upstreamStatus?: number;
	stream?: boolean;
};

function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	}
	return hash;
}

function failureLevel(tag: MachineError["_tag"]): "warn" | "error" {
	if (
		tag === "MissingAuthHeader" ||
		tag === "TokenValidationError" ||
		tag === "BodyParseError" ||
		tag === "NetworkError" ||
		tag === "RateLimitError"
	) {
		return "warn";
	}
	return "error";
}

function statusFromError(error: MachineError): number {
	switch (error._tag) {
		case "MissingAuthHeader":
		case "TokenValidationError":
			return 401;
		case "BodyParseError":
			return 400;
		case "NetworkError":
			return 503;
		case "RateLimitError":
			return 429;
		case "UpstreamError":
			return 502;
	}
}

function messageFromError(error: MachineError): string {
	if (
		error._tag === "TokenValidationError" ||
		error._tag === "BodyParseError" ||
		error._tag === "RateLimitError" ||
		error._tag === "UpstreamError"
	) {
		return error.message;
	}
	if (error._tag === "MissingAuthHeader") return "Missing authorization header";
	return "Network request failed";
}

function emitCanonicalLog(context: CanonicalContext): void {
	const level =
		context.outcome === "success"
			? "info"
			: failureLevel(context.errorType ?? "UpstreamError");

	const durationMs = Date.now() - context.startedAt;
	const attributes: Record<string, string | number | boolean | null> = {
		"event.name": "machine.request",
		"event.kind": "canonical",
		"machine.request_id": context.requestId,
		"machine.trace_id": context.traceId ?? null,
		"machine.outcome": context.outcome,
		"machine.duration_ms": durationMs,
		"machine.status": context.httpStatus ?? null,
		"machine.error_type": context.errorType ?? null,
		"machine.error_message": context.errorMessage ?? null,
		"machine.token_validation_status": context.tokenValidationStatus ?? null,
		"machine.token_valid": context.tokenValid ?? null,
		"machine.model_id": context.modelId ?? null,
		"machine.upstream_model": context.upstreamModel ?? null,
		"machine.provider": context.provider ?? null,
		"machine.provider_host": context.providerHost ?? null,
		"machine.upstream_status": context.upstreamStatus ?? null,
		"machine.stream": context.stream ?? null,
	};

	logger.emit({
		severityText: level.toUpperCase(),
		severityNumber:
			level === "error"
				? ERROR_SEVERITY_NUMBER
				: level === "warn"
					? WARN_SEVERITY_NUMBER
					: INFO_SEVERITY_NUMBER,
		body: "machine.request",
		attributes,
	});
}

export abstract class MachineService {
	private static validateToken(
		header: BearerHeaders,
		context: CanonicalContext,
	): Effect.Effect<
		void,
		MissingAuthHeader | NetworkError | TokenValidationError
	> {
		const span = tracer.startSpan("machine.validate_token");
		span.setAttribute("machine.request_id", context.requestId);

		const effect = Effect.gen(function* () {
			if (!header.authorization?.startsWith("Bearer ")) {
				yield* Effect.fail(new MissingAuthHeader());
				return undefined as never;
			}

			const token = header.authorization.replace("Bearer ", "").trim();
			span.setAttribute("machine.token_hash", hashString(token).toString());

			const res = yield* Effect.tryPromise({
				try: () =>
					axios.post(
						"https://keen-guanaco-392.convex.site/verify-api-key",
						{ token },
						{
							headers: { "Content-Type": "application/json" },
							validateStatus: () => true,
						},
					),
				catch: (cause) => new NetworkError({ cause }),
			}).pipe(
				Effect.retry({
					while: (e) => e._tag === "NetworkError",
					schedule: Schedule.exponential("100 millis").pipe(
						Schedule.compose(Schedule.recurs(2)),
					),
				}),
			);

			const validationBody = res.data as { valid?: boolean } | undefined;
			const isTokenValid = validationBody?.valid === true;

			context.tokenValidationStatus = res.status;
			context.tokenValid = isTokenValid;

			span.setAttribute("machine.validation_status", res.status);
			if (res.status < 200 || res.status >= 300 || !isTokenValid) {
				yield* new TokenValidationError({
					message: "Invalid API key",
					status: res.status,
				});
			}
		});

		return effect.pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					span.setStatus({ code: SpanStatusCode.OK });
				}),
			),
			Effect.tapError((error) =>
				Effect.sync(() => {
					span.setStatus({ code: SpanStatusCode.ERROR, message: error._tag });
					span.recordException(new Error(error._tag));
				}),
			),
			Effect.ensuring(
				Effect.sync(() => {
					span.end();
				}),
			),
		);
	}

	private static resolveBody(
		body: unknown,
		context: CanonicalContext,
	): Effect.Effect<
		{
			model: string;
			providerName: string;
			providerurl: string;
			providerkey: string;
			messages: unknown[];
			stream: boolean;
			streamOptions?: unknown;
		},
		BodyParseError
	> {
		const span = tracer.startSpan("machine.resolve_body");
		span.setAttribute("machine.request_id", context.requestId);

		const effect = Effect.gen(function* () {
			if (typeof body !== "object" || body === null) {
				yield* Effect.fail(
					new BodyParseError({ message: "Body must be a JSON object" }),
				);
				return undefined as never;
			}

			const b = body as Record<string, unknown>;
			if (!b.model) {
				yield* Effect.fail(new BodyParseError({ message: "Missing model" }));
				return undefined as never;
			}

			function resolveModelID(model: string | ModelObject): string {
				if (typeof model === "string") return model;
				return model.modelID;
			}

			const modelID = resolveModelID(b.model as string | ModelObject);
			const router = modelRegister[modelID];
			if (!router) {
				yield* Effect.fail(
					new BodyParseError({ message: `Unknown model ID: ${modelID}` }),
				);
				return undefined as never;
			}

			const provider = providers[router.provider];
			if (!provider) {
				yield* Effect.fail(
					new BodyParseError({
						message: `Unknown provider for model: ${router.provider}`,
					}),
				);
				return undefined as never;
			}

			context.modelId = modelID;
			context.upstreamModel = router.upstreamModel;
			context.provider = router.provider;
			context.stream = b.stream === true;

			span.setAttribute("machine.model_id", modelID);
			span.setAttribute("machine.provider", router.provider);

			return {
				model: router.upstreamModel,
				providerName: router.provider,
				providerurl: provider.base_url,
				providerkey: provider.api_key,
				messages: (b.messages ?? []) as unknown[],
				stream: b.stream === true,
				streamOptions: b.stream_options,
			};
		});

		return effect.pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					span.setStatus({ code: SpanStatusCode.OK });
				}),
			),
			Effect.tapError((error) =>
				Effect.sync(() => {
					span.setStatus({ code: SpanStatusCode.ERROR, message: error._tag });
					span.recordException(new Error(error._tag));
				}),
			),
			Effect.ensuring(
				Effect.sync(() => {
					span.end();
				}),
			),
		);
	}

	static handleRequest(
		headers: BearerHeaders,
		body: unknown,
	): Effect.Effect<Response, MachineError> {
		const context: CanonicalContext = {
			requestId: crypto.randomUUID(),
			startedAt: Date.now(),
			outcome: "success",
		};

		const requestSpan = tracer.startSpan("machine.handle_request");
		context.traceId = requestSpan.spanContext().traceId;
		requestSpan.setAttribute("machine.request_id", context.requestId);
		requestSpan.setAttribute("machine.trace_id", context.traceId);

		const effect = Effect.gen(function* () {
			yield* MachineService.validateToken(headers, context);
			const resolved = yield* MachineService.resolveBody(body, context);
			return yield* MachineService.sendUpstream(resolved, context);
		});

		return effect.pipe(
			Effect.tap((response) =>
				Effect.sync(() => {
					context.outcome = "success";
					context.httpStatus = response.status;
					requestSpan.setAttribute("http.status_code", response.status);
					requestSpan.setStatus({ code: SpanStatusCode.OK });
				}),
			),
			Effect.tapError((error) =>
				Effect.sync(() => {
					context.outcome = "error";
					context.errorType = error._tag;
					context.errorMessage = messageFromError(error);
					context.httpStatus = statusFromError(error);

					requestSpan.setAttribute("http.status_code", context.httpStatus);
					requestSpan.setStatus({
						code:
							failureLevel(error._tag) === "error"
								? SpanStatusCode.ERROR
								: SpanStatusCode.UNSET,
						message: error._tag,
					});
					requestSpan.recordException(new Error(error._tag));
				}),
			),
			Effect.ensuring(
				Effect.sync(() => {
					emitCanonicalLog(context);
					requestSpan.end();
				}),
			),
		);
	}

	private static sendUpstream(
		body: {
			model: string;
			providerName: string;
			providerurl: string;
			providerkey: string;
			messages: unknown[];
			stream: boolean;
			streamOptions?: unknown;
		},
		context: CanonicalContext,
	): Effect.Effect<Response, NetworkError | UpstreamError | RateLimitError> {
		const span = tracer.startSpan("machine.send_upstream");
		span.setAttribute("machine.request_id", context.requestId);

		const effect = Effect.gen(function* () {
			const { providerurl, providerkey } = body;
			const providerHost = (() => {
				try {
					return new URL(providerurl).host;
				} catch {
					return providerurl;
				}
			})();

			context.providerHost = providerHost;
			context.provider = body.providerName;
			context.stream = body.stream;

			span.setAttribute("machine.provider_host", providerHost);
			span.setAttribute("machine.stream", body.stream);

			const res = yield* Effect.tryPromise({
				try: () =>
					axios.post(
						`${providerurl}/chat/completions`,
						{
							model: body.model,
							messages: body.messages,
							stream: body.stream,
							...(body.streamOptions !== undefined
								? { stream_options: body.streamOptions }
								: {}),
						},
						{
							headers: {
								authorization: `Bearer ${providerkey}`,
								"content-type": "application/json",
							},
							responseType: "stream",
							validateStatus: () => true,
						},
					),
				catch: (cause) => new NetworkError({ cause }),
			}).pipe(
				Effect.retry({
					while: (e) => e._tag === "NetworkError",
					schedule: Schedule.exponential("200 millis").pipe(
						Schedule.compose(Schedule.recurs(2)),
					),
				}),
			);

			context.upstreamStatus = res.status;
			span.setAttribute("machine.upstream_status", res.status);

			if (res.status === 429) {
				yield* new RateLimitError({ message: "Rate limited by provider" });
			}

			if (res.status < 200 || res.status >= 300) {
				yield* new UpstreamError({
					message: "Upstream request failed",
					status: res.status,
				});
			}

			const requestId = res.headers["x-request-id"] as string | undefined;
			const passthroughHeaders = new Headers(
				res.headers as Record<string, string>,
			);
			passthroughHeaders.set("x-accel-buffering", "no");
			passthroughHeaders.set("cache-control", "no-cache");
			if (requestId) passthroughHeaders.set("x-request-id", requestId);
			if (context.traceId)
				passthroughHeaders.set("x-trace-id", context.traceId);
			passthroughHeaders.set("x-machine-request-id", context.requestId);

			return new Response(res.data as ReadableStream, {
				status: res.status,
				headers: passthroughHeaders,
			});
		});

		return effect.pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					span.setStatus({ code: SpanStatusCode.OK });
				}),
			),
			Effect.tapError((error) =>
				Effect.sync(() => {
					span.setStatus({ code: SpanStatusCode.ERROR, message: error._tag });
					span.recordException(new Error(error._tag));
				}),
			),
			Effect.ensuring(
				Effect.sync(() => {
					span.end();
				}),
			),
		);
	}
}

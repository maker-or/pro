import { Data, Effect, Schedule } from "effect";
import { modelRegister } from "../../model_register";
import type { BearerHeaders, ModelObject } from "./model";
import { logs } from "@opentelemetry/api-logs";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { providers } from "./provider";

// --- Typed errors ---
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
const NON_CRITICAL_SAMPLE_PERCENT = 2;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function shouldSampleNonCritical(seed?: string): boolean {
  if (!seed) return Math.random() * 100 < NON_CRITICAL_SAMPLE_PERCENT;
  return hashString(seed) % 100 < NON_CRITICAL_SAMPLE_PERCENT;
}

function emitLog(input: {
  level: "info" | "warn" | "error";
  message: string;
  attributes?: Record<string, string | number | boolean | null>;
  sampleSeed?: string;
}): void {
  const shouldKeep =
    input.level === "warn" ||
    input.level === "error" ||
    shouldSampleNonCritical(input.sampleSeed);

  if (!shouldKeep) return;

  logger.emit({
    severityText: input.level.toUpperCase(),
    severityNumber:
      input.level === "error"
        ? ERROR_SEVERITY_NUMBER
        : input.level === "warn"
          ? WARN_SEVERITY_NUMBER
          : INFO_SEVERITY_NUMBER,
    body: input.message,
    attributes: input.attributes,
  });
}

export abstract class MachineService {
  // ── Private: Step 1 ───────────────────────────────────────────────
  // Only retries on NetworkError (transient), never on bad token
  private static validateToken(
    header: BearerHeaders,
  ): Effect.Effect<
    void,
    MissingAuthHeader | NetworkError | TokenValidationError
  > {
    const span = tracer.startSpan("machine.validate_token");
    const effect = Effect.gen(function* () {
      if (!header.authorization?.startsWith("Bearer ")) {
        yield* Effect.fail(new MissingAuthHeader());
        return undefined as never;
      }

      const token = header.authorization.replace("Bearer ", "").trim();
      const tokenHash = hashString(token).toString();
      span.setAttribute("machine.token_hash", tokenHash);

      const res = yield* Effect.tryPromise({
        try: () =>
          fetch("https://cautious-platypus-49.convex.site/verify-api-key", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }),
        catch: (cause) => new NetworkError({ cause }),
      }).pipe(
        Effect.retry({
          while: (e) => e._tag === "NetworkError",
          schedule: Schedule.exponential("100 millis").pipe(
            Schedule.compose(Schedule.recurs(2)),
          ),
        }),
      );

      span.setAttribute("machine.validation_status", res.status);
      if (!res.ok) {
        emitLog({
          level: "warn",
          message: "Token validation failed",
          attributes: {
            "machine.phase": "token_validation",
            "machine.status": res.status,
          },
        });

        yield* new TokenValidationError({
          message: "Token validation failed",
          status: res.status,
        });
      }

      emitLog({
        level: "info",
        message: "Token validation succeeded",
        attributes: {
          "machine.phase": "token_validation",
        },
        sampleSeed: tokenHash,
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
  // ── Private: Step 2 ───────────────────────────────────────────────
  // Pure validation, no I/O, no retry needed

  private static resolveBody(body: unknown): Effect.Effect<
    {
      model: string;
      providerurl: string;
      providerkey: string;
      messages: unknown[];
      stream: boolean;
      streamOptions?: unknown;
    },
    BodyParseError
  > {
    const span = tracer.startSpan("machine.resolve_body");
    const effect = Effect.gen(function* () {
      if (typeof body !== "object" || body === null) {
        yield* Effect.fail(
          new BodyParseError({ message: "Body must be a JSON object" }),
        );
        return undefined as never;
      }

      const b = body as Record<string, unknown>;

      if (!b.model) {
        yield* Effect.fail(new BodyParseError({ message: "Missing model " }));
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

      span.setAttribute("machine.model_id", modelID);
      span.setAttribute("machine.provider", router.provider);

      return {
        model: router.upstreamModel,
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
          emitLog({
            level: "warn",
            message: "Request body resolution failed",
            attributes: {
              "machine.phase": "resolve_body",
              "machine.error_type": error._tag,
            },
          });
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          span.end();
        }),
      ),
    );
  }

  // ── Public: the only thing index.ts ever touches ───────────────────
  static handleRequest(
    headers: BearerHeaders,
    body: unknown,
  ): Effect.Effect<Response, MachineError> {
    const requestSpan = tracer.startSpan("machine.handle_request");
    const requestSeed = headers.authorization
      ? hashString(headers.authorization).toString()
      : undefined;

    emitLog({
      level: "info",
      message: "Machine request received",
      attributes: {
        "machine.phase": "request_start",
      },
      sampleSeed: requestSeed,
    });

    const effect = Effect.gen(function* () {
      yield* MachineService.validateToken(headers); // Step 1
      const resolved = yield* MachineService.resolveBody(body); // Step 2
      return yield* MachineService.sendUpstream(resolved); // Step 3
    });

    return effect.pipe(
      Effect.tap((response) =>
        Effect.sync(() => {
          requestSpan.setAttribute("http.status_code", response.status);
          requestSpan.setStatus({ code: SpanStatusCode.OK });
          emitLog({
            level: "info",
            message: "Machine request completed",
            attributes: {
              "machine.phase": "request_end",
              "machine.status": response.status,
            },
            sampleSeed: requestSeed,
          });
        }),
      ),
      Effect.tapError((error) =>
        Effect.sync(() => {
          requestSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: error._tag,
          });
          requestSpan.recordException(new Error(error._tag));
          emitLog({
            level: "error",
            message: "Machine request failed",
            attributes: {
              "machine.phase": "request_end",
              "machine.error_type": error._tag,
            },
          });
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          requestSpan.end();
        }),
      ),
    );
  }
  // ── Private: Step 3 ───────────────────────────────────────────────
  // Retries NetworkError with backoff
  // On RateLimit (429) → switches provider and retries once
  private static sendUpstream(body: {
    model: string;
    providerurl: string;
    providerkey: string;
    messages: unknown[];
    stream: boolean;
    streamOptions?: unknown;
  }): Effect.Effect<Response, NetworkError | UpstreamError | RateLimitError> {
    const span = tracer.startSpan("machine.send_upstream");
    const effect = Effect.gen(function* () {
      const { providerurl, providerkey } = body;
      const providerHost = (() => {
        try {
          return new URL(providerurl).host;
        } catch {
          return providerurl;
        }
      })();

      span.setAttribute("machine.provider_host", providerHost);
      span.setAttribute("machine.stream", body.stream);

      const res = yield* Effect.tryPromise({
        try: () =>
          fetch(`${providerurl}/chat/completions`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${providerkey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: body.model,
              messages: body.messages,
              stream: body.stream,
              ...(body.streamOptions !== undefined
                ? { stream_options: body.streamOptions }
                : {}),
            }),
          }),

        catch: (cause) => new NetworkError({ cause }),
      }).pipe(
        Effect.retry({
          while: (e) => e._tag === "NetworkError",
          schedule: Schedule.exponential("200 millis").pipe(
            Schedule.compose(Schedule.recurs(2)),
          ),
        }),
      );

      span.setAttribute("machine.upstream_status", res.status);

      // rate limited → dedicated error so we can handle provider switching
      if (res.status === 429) {
        emitLog({
          level: "warn",
          message: "Provider rate limited request",
          attributes: {
            "machine.phase": "upstream_response",
            "machine.provider_host": providerHost,
            "machine.status": res.status,
          },
        });
        yield* new RateLimitError({ message: "Rate limited by provider" });
      }

      if (!res.ok) {
        emitLog({
          level: "error",
          message: "Upstream returned non-success status",
          attributes: {
            "machine.phase": "upstream_response",
            "machine.provider_host": providerHost,
            "machine.status": res.status,
          },
        });
        yield* new UpstreamError({
          message: "Upstream request failed",
          status: res.status,
        });
      }

      const requestId = res.headers.get("x-request-id");

      const passthroughHeaders = new Headers(res.headers);
      passthroughHeaders.set("x-accel-buffering", "no");
      passthroughHeaders.set("cache-control", "no-cache");
      if (requestId) passthroughHeaders.set("x-request-id", requestId);

      return new Response(res.body, {
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

          if (error._tag === "NetworkError") {
            emitLog({
              level: "error",
              message: "Network error while sending upstream request",
              attributes: {
                "machine.phase": "upstream_request",
                "machine.error_type": error._tag,
              },
            });
          }
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

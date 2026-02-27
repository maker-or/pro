import { Data, Effect, Schedule, Console } from "effect";
import { modelRegister } from "../../model_register";
import type { BearerHeaders, ModelObject } from "./model";
import { logs } from "@opentelemetry/api-logs";
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

export abstract class MachineService {
  // ── Private: Step 1 ───────────────────────────────────────────────
  // Only retries on NetworkError (transient), never on bad token
  private static validateToken(
    header: BearerHeaders,
  ): Effect.Effect<
    void,
    MissingAuthHeader | NetworkError | TokenValidationError
  > {
    const a = Effect.gen(function* () {
      if (!header.authorization?.startsWith("Bearer ")) {
        return yield* Effect.fail(new MissingAuthHeader());
      }
      Console.log("started the validation process");
      console.log("started the validation process");
      const token = header.authorization!.replace("Bearer ", "").trim();

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
      if (!res.ok) {
        yield* new TokenValidationError({
          message: "Token validation failed",
          status: res.status,
        });
      }
    });
    return a;
  }
  // ── Private: Step 2 ───────────────────────────────────────────────
  // Pure validation, no I/O, no retry needed

  private static resolveBody(body: unknown): Effect.Effect<
    {
      model: string;
      providerurl: string;
      providerkey: string;
      messages: unknown[];
    },
    BodyParseError
  > {
    return Effect.gen(function* () {
      if (typeof body !== "object" || body === null) {
        yield* Effect.fail(
          new BodyParseError({ message: "Body must be a JSON object" }),
        );
        return undefined as never;
      }
      Console.log("started the replacement process");
      console.log("started the replacement process");
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
      const provider = providers[router.provider];
      console.log("ended the replacement process");
      return {
        model: router.upstreamModel,
        providerurl: provider.base_url,
        providerkey: provider.api_key,
        messages: (b.messages ?? []) as unknown[],
      };
    });
  }

  // ── Public: the only thing index.ts ever touches ───────────────────
  static handleRequest(
    headers: BearerHeaders,
    body: unknown,
  ): Effect.Effect<Response, MachineError> {
    return Effect.gen(function* () {
      yield* MachineService.validateToken(headers); // Step 1
      const resolved = yield* MachineService.resolveBody(body); // Step 2
      return yield* MachineService.sendUpstream(resolved); // Step 3
    });
  }
  // ── Private: Step 3 ───────────────────────────────────────────────
  // Retries NetworkError with backoff
  // On RateLimit (429) → switches provider and retries once
  private static sendUpstream(body: {
    model: string;
    providerurl: string;
    providerkey: string;
    messages: unknown[];
  }): Effect.Effect<Response, NetworkError | UpstreamError | RateLimitError> {
    return Effect.gen(function* () {
      Console.log("the request is about to start ");
      console.log("started the validation process in the sendUpstream");
      const { providerurl, providerkey } = body;
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
      console.log(
        "the request is about to has already end from the NetworkError ",
        res,
      );

      // rate limited → dedicated error so we can handle provider switching
      if (res.status === 429) {
        yield* new RateLimitError({ message: "Rate limited by provider" });
      }

      if (!res.ok) {
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

      return new Response(res.body);
    });
  }
}

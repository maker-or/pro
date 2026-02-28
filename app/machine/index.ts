import { Effect } from "effect";
import { Elysia } from "elysia";
import type { OpenAIErrorBody } from "./model";
import { MachineModel } from "./model";
import { MachineService } from "./service";

function openAIError(
  message: string,
  type: OpenAIErrorBody["error"]["type"],
  code: OpenAIErrorBody["error"]["code"],
): OpenAIErrorBody {
  return {
    error: {
      message,
      type,
      code,
      param: null,
    },
  };
}

export const machine = new Elysia({ name: "machine" }).use(MachineModel).post(
  "/v1/chat/completions",
  ({ headers, body, status }) =>
    MachineService.handleRequest(headers, body).pipe(
      Effect.catchTags({
        MissingAuthHeader: () =>
          Effect.succeed(
            status(
              401,
              openAIError(
                "Missing authorization header",
                "invalid_request_error",
                "invalid_api_key",
              ),
            ),
          ),
        TokenValidationError: (e) =>
          Effect.succeed(
            status(
              401,
              openAIError(
                e.message,
                "invalid_request_error",
                "invalid_api_key",
              ),
            ),
          ),
        BodyParseError: (e) =>
          Effect.succeed(
            status(
              400,
              openAIError(
                e.message,
                "invalid_request_error",
                "invalid_request_error",
              ),
            ),
          ),
        NetworkError: () =>
          Effect.succeed(
            status(
              503,
              openAIError(
                "Could not reach upstream server",
                "api_error",
                "server_error",
              ),
            ),
          ),
        UpstreamError: (e) =>
          Effect.succeed(
            status(502, openAIError(e.message, "api_error", "server_error")),
          ),
        RateLimitError: (e) =>
          Effect.succeed(
            status(
              429,
              openAIError(e.message, "rate_limit_error", "rate_limit_exceeded"),
            ),
          ),
      }),
      Effect.runPromise,
    ),
  {
    headers: "machine.headers",
  },
);

import { Schema } from "effect";
import { Elysia, t } from "elysia";

// ── Elysia edge validation (TypeBox) ──────────────────────────────────────────
// Kept in TypeBox because Elysia needs this to reject malformed requests
// before they reach the handler
export const BearerHeaders = t.Object(
  {
    authorization: t.String({
      pattern: "^Bearer .+$",
      error: "Authorization header must be in the format: Bearer <token>",
    }),
  },
  { additionalProperties: true },
);

export type BearerHeaders = typeof BearerHeaders.static;

// ── Effect Schemas ─────────────────────────────────────────────────────────────

// OpenAI-compatible error shape
// https://platform.openai.com/docs/api-reference/errors
export const OpenAIErrorBody = Schema.Struct({
  error: Schema.Struct({
    message: Schema.String,
    type: Schema.Union(
      Schema.Literal("invalid_request_error"),
      Schema.Literal("api_error"),
      Schema.Literal("rate_limit_error"),
    ),
    code: Schema.Union(
      Schema.Literal("invalid_api_key"),
      Schema.Literal("invalid_request_error"),
      Schema.Literal("server_error"),
      Schema.Literal("rate_limit_exceeded"),
    ),
    param: Schema.NullOr(Schema.String),
  }),
});

export type OpenAIErrorBody = Schema.Schema.Type<typeof OpenAIErrorBody>;

// ModelObject — used in service.ts to resolve the upstream model
export const ModelObject = Schema.Struct({
  modelID: Schema.String,
  provider: Schema.String,
});

export type ModelObject = Schema.Schema.Type<typeof ModelObject>;

// ── Elysia model registry ──────────────────────────────────────────────────────
// Only BearerHeaders needs to be registered — it's the only schema
// Elysia uses for request validation on the route
export const MachineModel = new Elysia({ name: "machine.model" }).model({
  "machine.headers": BearerHeaders,
});

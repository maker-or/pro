# Endpoint test collection

This folder contains a Bruno collection to verify API-key validation behavior.

## Requests

- `01-api-auth-redirect.bru`: sends `Authorization: Bearer {{apiToken}}` and checks the route is not redirected by auth middleware.
- `02-chat-completions-with-session.bru`: sends request without bearer header and checks schema/header validation failure.
- `03-convex-url-from-service.bru`: checks reachability of the upstream validator URL used by `app/machine/service.ts`.

## Environment setup

Use `environments/local.bru` and set:

- `baseUrl` (default: `http://localhost:3000`)
- `apiToken` (token/publicId to validate)
- `convexBaseUrl` (default: `https://keen-guanaco-392.convex.site`)

## Run

Open Bruno and run the `endpoint_test` collection with the `local` environment.

# FlexiKit API Error Contract

> Status: S4.1 baseline
> Backend source of truth: `backend/src/common/errors/` + `GlobalHttpExceptionFilter`

## 1. Scope

This document defines **error responses only**. The S4.1 success-envelope task is complete: ordinary JSON responses are globally wrapped as `{ code: 0, message: "success", data }` by `ApiResponseInterceptor`; errors retain the separate contract below. See `docs/API_RESPONSE_CONTRACT.md`.

JSON API errors use:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "请求参数校验失败",
  "error": "Bad Request",
  "details": ["email must be an email"]
}
```

Fields:

- `statusCode`: HTTP status code.
- `code`: stable machine-readable error code.
- `message`: user-facing / business-readable summary.
- `error`: HTTP error label.
- `details`: optional string array, currently used for validation details.

Existing clients that only read `statusCode / message / error` remain compatible.

## 2. Built-in error codes

Current status mapping:

- 400 → `BAD_REQUEST`
- 401 → `UNAUTHORIZED`
- 403 → `FORBIDDEN`
- 404 → `NOT_FOUND`
- 405 → `METHOD_NOT_ALLOWED`
- 409 → `CONFLICT`
- 413 → `PAYLOAD_TOO_LARGE`
- 415 → `UNSUPPORTED_MEDIA_TYPE`
- 422 → `UNPROCESSABLE_ENTITY`
- 429 → `RATE_LIMITED`
- 500 → `INTERNAL_ERROR`
- 502 → `BAD_GATEWAY`
- 503 → `SERVICE_UNAVAILABLE`
- 504 → `GATEWAY_TIMEOUT`
- Other HTTP errors → `HTTP_ERROR`

Validation errors use `VALIDATION_ERROR`.

Business-specific codes may be added later, but custom codes must use uppercase `A-Z / 0-9 / _` and remain stable once consumed by clients.

## 3. Validation

The global `ValidationPipe` uses one exception factory.

Validation failure:

- HTTP 400.
- `code = VALIDATION_ERROR`.
- `message = 请求参数校验失败`.
- class-validator messages are flattened into a deduplicated `details[]`.
- nested DTO validation messages are included recursively.

The Web client prefers `details[]` when building a display message, then falls back to the legacy `message` field.

## 4. HttpException normalization

All Nest `HttpException` instances pass through `GlobalHttpExceptionFilter`.

The filter:

- trusts the HTTP status from the exception.
- preserves a non-empty string message.
- converts legacy `message: string[]` payloads into `VALIDATION_ERROR + details[]`.
- preserves a valid explicit business `code`.
- ignores malformed custom codes and falls back to the status-derived code.
- never relies on localized message text to determine an error type.

Existing service/controller `BadRequestException / UnauthorizedException / ForbiddenException / NotFoundException` calls therefore receive stable codes without requiring every call site to be rewritten.

## 5. Unknown exceptions

Non-`HttpException` errors are treated as internal failures:

```json
{
  "statusCode": 500,
  "code": "INTERNAL_ERROR",
  "message": "服务器内部错误，请稍后再试",
  "error": "Internal Server Error"
}
```

The response does **not** expose the original exception message or stack.

The server logger may record the stack internally. Request correlation and structured request/error logging belong to the later S4.1 logging task.

## 6. Binary endpoint exception

`GET /tools/favicon` is an image/binary probe endpoint.

Rules:

- Missing `url` is a normal API input error and now goes through the unified JSON error contract.
- “No favicon found” intentionally remains an empty HTTP 404 so image loaders can fall back without parsing JSON.

This is the only currently audited manual response-status exception in Backend source.

## 7. Regression

Run:

```bash
npm --prefix backend run build
npm --prefix backend run test:error-regression
npm --prefix apps/web run build
```

The dedicated regression covers:

- 400 / 401 / 403 / 404 stable codes.
- nested validation flattening.
- `VALIDATION_ERROR` contract.
- malformed custom code fallback.
- unknown 500 response sanitization.

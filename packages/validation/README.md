# @sports-bar/validation

**Purpose:** Input validation middleware + reusable Zod schemas for all API routes. Standardized error responses, type-safe results, body/query/path-param validation.

**Key exports** (`src/index.ts`):
- Middleware (`src/middleware.ts`):
  - `validateRequestBody(request, schema)` — POST/PUT/PATCH body validation
  - `validateQueryParams(request, schema)` — GET query string validation
  - `validatePathParams(params, schema)` — dynamic route param validation
  - `validateRequest(request, options)` — combined
  - `requireField`, `requireFields` — quick presence checks
  - `isValidationSuccess`, `isValidationError` — type guards
  - `ValidationMiddleware` (class), `ValidationResult`, `ValidationError`, `ValidatedResult`, `ValidationOptions`
- All schemas re-exported from `src/schemas.ts`
- `isValidCronExpression` (`src/cron-validation.ts`)
- Re-exports: `z`, `ZodSchema`, `ZodError` from `zod`

**Protocol / port:** N/A — Next.js middleware. Peer dep on `next >=14`.

**Used by:** Every API route in `apps/web/src/app/api/**/route.ts`. Standard pattern:
```ts
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data  // Use this — NEVER call request.json() again
```

**Gotchas:**
- **CRITICAL:** `validateRequestBody()` consumes the HTTP request body stream. **Never call `request.json()` after** — use `bodyValidation.data`. Calling `.json()` twice throws "Body Already Consumed" (CLAUDE.md Gotcha #1).
- GET requests have no body — use `validateQueryParams()`.
- All shared schemas live in `src/schemas.ts` — add new ones there rather than inlining `z.object({...})` in route files.

**See also:**
- CLAUDE.md → §"Validation & Security Architecture" + Gotcha #1
- `@sports-bar/rate-limiting` (paired in standard route pattern)

# @sports-bar/rate-limiting

**Purpose:** Sliding-window rate-limiting middleware for Next.js App Router API endpoints. Plus a `RequestThrottler` for outbound calls to rate-limited external APIs (ESPN, TheSportsDB, Ollama).

**Key exports** (`src/index.ts`):
- Rate limiter (`src/rate-limiter.ts`): `rateLimiter`, `RateLimitConfigs`, `RateLimitConfig`, `RateLimitResult`
- Middleware (`src/middleware.ts`): `withRateLimit`, `checkRateLimit`, `getClientIp`, `createRateLimitHeaders`, `createRateLimitResponse`, `addRateLimitHeaders`, `RateLimitCheckResult`
- Request throttler (`src/request-throttler.ts`): `RequestThrottler`, `ThrottleConfigs`, `espnThrottler`, `sportsDBThrottler`, `ollamaThrottler`, `defaultThrottler`, `ThrottleConfig`

**Protocol / port:** N/A — in-process middleware. Adds standard `X-RateLimit-*` response headers.

**Used by:** Every API route in `apps/web/src/app/api/**/route.ts` — canonical pattern at the top of each route:
```ts
const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
if (!rateLimit.allowed) return rateLimit.response
```
Also consumed by `@sports-bar/sports-apis` (outbound ESPN / SportsDB throttling).

**Gotchas:**
- Sliding-window algorithm with per-IP + per-endpoint tracking. Automatic cleanup of expired entries — no external store, in-memory only.
- Different `RateLimitConfigs` per endpoint type (DEFAULT, STRICT, RELAXED, etc.) — pick the right one rather than hand-rolling.
- Inbound `withRateLimit` (this package's middleware) is **separate** from outbound `RequestThrottler` (also in this package) — don't confuse them.

**See also:**
- CLAUDE.md → §"Validation & Security Architecture" / "API Route Patterns"
- `@sports-bar/circuit-breaker` (companion for resilient external calls)

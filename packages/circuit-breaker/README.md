# @sports-bar/circuit-breaker

**Purpose:** Reusable circuit breaker for external API / hardware calls to prevent cascading failures and resource exhaustion. Thin wrapper around `opossum`.

**Key exports** (`src/index.ts`):
- `CircuitBreakerOptions` — configuration interface (name, timeout, error-threshold %, reset timeout, rolling-count window, volume threshold)
- Factory + helper functions for creating named breakers with logging integration
- Fallback support for graceful degradation
- Event-logging hooks via `@sports-bar/logger`

**Protocol / port:** N/A — in-process library.

**Used by:** `@sports-bar/sports-apis` (ESPN, TheSportsDB, Rail Media clients), `apps/web` (anywhere we wrap an external HTTP/TCP call).

**Gotchas:**
- Defaults: 10s timeout, 50% error threshold, 30s reset, 60s rolling window, 10-request volume threshold. Tune per consumer in the options object.
- All circuit state changes log via the shared `@sports-bar/logger` so failures show up under the consumer's component tag.
- Underlying library: `opossum` v9 (see `package.json`).

**See also:**
- `packages/sports-apis/src/espn-api.ts` (canonical consumer example)
- CLAUDE.md → §"Validation & Security Architecture" (rate-limiting pairs with this for resilient external calls)

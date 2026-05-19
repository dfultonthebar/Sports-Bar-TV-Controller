# @sports-bar/auth

**Purpose:** PIN-based authentication and API-key authorization layer for the Sports Bar TV Controller. Built around NextAuth.js / Next.js middleware with database-backed sessions.

**Key exports** (`src/index.ts`):
- PIN: `hashPIN`, `verifyPIN`, `validatePIN`, `createPIN`, `deletePIN`, `listPINs` (`src/pin.ts`)
- Sessions: `createSession`, `validateSession`, `extendSession`, `destroySession`, `cleanupExpiredSessions` (`src/session.ts`)
- API keys: `generateApiKey`, `hashApiKey`, `verifyApiKey`, `createApiKey`, `revokeApiKey` (`src/api-key.ts`)
- Middleware: route-protection wrapper for Next.js App Router (`src/middleware.ts`)
- Audit logging (`src/audit.ts`)
- Config: `AUTH_CONFIG`, `AccessLevel`, `PUBLIC_ENDPOINT_PATTERNS`, `ADMIN_ENDPOINT_PATTERNS`, `matchesEndpointPattern`, `getEndpointAccessLevel`, `requiresConfirmation` (`src/config.ts`)

**Protocol / port:** N/A — server-side library. PINs hashed with `bcryptjs`.

**Used by:** `apps/web` (login page, session validation in middleware, ApiKey management UI).

**Gotchas:**
- Session storage is the **database** (not JWT) — backed by `Session` / `User` / `ApiKey` tables in `apps/web/src/db/schema.ts`.
- Per-location bootstrap requires seeding a `Location` row + `AuthPin` rows + setting `LOCATION_ID` in `.env`, else every login returns "Invalid PIN". Use `scripts/bootstrap-new-location.sh` (CLAUDE.md "Auth bootstrap" section).
- `AUTH_COOKIE_SECURE` must be `false` on HTTP-only LAN deployments — browsers silently drop `Secure` cookies on `http://` origins, so a `true` value on HTTP causes login to "succeed" but every subsequent request looks unauthenticated.

**See also:**
- `docs/AUTHENTICATION_GUIDE.md`
- `docs/NEW_LOCATION_SETUP.md`
- CLAUDE.md → "Authentication System"

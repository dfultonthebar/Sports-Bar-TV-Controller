# @sports-bar/data

**Purpose:** Shared data-layer utilities sitting on top of `@sports-bar/database`. Provides DI-friendly Drizzle helpers, pagination, and operation logging — the layer between raw Drizzle and app-level business logic.

**Key exports** (`src/index.ts`):
- `createDbHelpers(deps)` — factory that returns scoped CRUD helpers with injected dependencies (`src/db-helpers.ts`)
- `sanitizeData`, `serializeDrizzleResult` — output normalization for API responses
- Pagination: `parsePaginationParams`, `paginateArray`, `paginateArrayWithCursor`, `createCursor`, `decodeCursor`, `buildPaginationMetadata`, `createPaginationResponse`, `createCursorPaginationResponse`, `validatePaginationParams`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `MIN_PAGE_SIZE` (`src/pagination.ts`)
- `database-logger`, `operation-logger` — query + audit logging modules
- Re-exports common Drizzle operators (`eq`, `and`, `or`, `desc`, `asc`, `inArray`, `like`, `gte`, `lte`, `gt`, `lt`, `ne`, `sql`, `isNotNull`, `isNull`)

**Protocol / port:** N/A — in-process library.

**Used by:** `@sports-bar/services`, plus apps/web for query construction in API routes.

**Gotchas:**
- This package uses a **factory / DI pattern** (`createDbHelpers`) — for the direct singleton style (`db`, `schema`, `findFirst`, …) use `@sports-bar/database` instead.
- Operation logger is also used to capture AI-learning training data — see `src/operation-logger.ts`.

**See also:**
- `@sports-bar/database` (underlying Drizzle layer)
- CLAUDE.md → §"Database Architecture"

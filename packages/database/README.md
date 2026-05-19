# @sports-bar/database

**Purpose:** Drizzle ORM database layer for the Sports Bar TV Controller. Provides the shared SQLite connection, the full schema, and CRUD helpers used everywhere.

**Key exports** (`src/index.ts`):
- `db`, `schema`, `setDatabaseLogger`, `DatabaseLogger` (`src/db.ts`)
- Full schema re-export from `src/schema.ts` — every table type and definition
- CRUD helpers (`src/helpers.ts`): `findMany`, `findFirst`, `findUnique`, `count`, `create`, `createMany`, `update`, `updateMany`, `deleteRecord`, `deleteMany`, `upsert`, `executeRaw`, `transaction`, `serializeDrizzleResult`, `setDbHelperLogger`
- Drizzle operators re-exported: `eq`, `and`, `or`, `desc`, `asc`, `inArray`, `like`, `gte`, `lte`, `gt`, `lt`, `ne`, `not`, `sql`, `isNotNull`, `isNull`
- `transaction-wrapper.ts` — typed transaction helper

**Protocol / port:** SQLite via `better-sqlite3`. Production DB: `/home/ubuntu/sports-bar-data/production.db` (per CLAUDE.md).

**Used by:** Practically every package + `apps/web`. Anchor for the whole data layer.

**Gotchas:**
- Schema is **single-file** at `apps/web/src/db/schema.ts` (~85 tables), NOT inside this package — this package re-exports it. Edits go to the app-level schema file.
- Migrations via `drizzle-kit push` — see CLAUDE.md "Database Operations".
- **`drizzle-kit push` fails silently on pre-existing indexes** (Gotcha #6): always verify new columns/tables via `sqlite3 production.db "PRAGMA table_info(...)"` after a push.
- Drizzle operators are exposed here for convenience — no need to import directly from `drizzle-orm` in consumers.

**See also:**
- `apps/web/src/db/schema.ts` (canonical schema source)
- `apps/web/drizzle.config.ts` (config + DB path)
- CLAUDE.md → §"Database Architecture" and Gotcha #6

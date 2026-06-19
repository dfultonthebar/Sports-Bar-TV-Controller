# SOP: Drizzle Migration-Marker Drift Recovery (verify-install exit 20)

**Purpose:** fix a box whose `auto-update` rolls back every cycle because
verify-install's `migration_markers_consistent` layer fails (exit 20) — the
count of `drizzle/*.sql` files ≠ `__drizzle_migrations` marker rows. Graystone
was silently stuck on an old version for WEEKS because of this (2026-06-14).

**Audience:** operator / Claude Code. Prereq: [`../../CLAUDE.md`] Gotcha #6.

---

## Symptoms
- verify-install fails on `migration_markers_consistent`, trap fires with
  `exit code=20, step=verify`, auto-update rolls back. Box stays on an old version
  but keeps serving (rollback restores the old `.next`).
- Older boxes (< v2.54.1) are the usual victims: their auto-update runs
  `drizzle-kit push`, which on a schema conflict tries an interactive prompt and
  dies with `Error: Interactive prompts require a TTY terminal`, so migrations
  never apply → markers never advance → catch-22 (it can't update to the
  `migrate`-based fix because its old `push`-based update is broken).

## Diagnose (read-only — ALWAYS back up the DB first)
```bash
DB=/home/ubuntu/sports-bar-data/production.db
cp "$DB" "${DB}.pre-migfix-$(date +%s)"     # backup, non-negotiable
sqlite3 "$DB" "SELECT COUNT(*) FROM __drizzle_migrations;"          # marker count
ls drizzle/[0-9]*.sql | wc -l                                       # file count (mismatch = the bug)
```
Map which markers correspond to which migrations (decisive — tells you stamp vs apply):
```bash
git fetch origin main -q
MARKERS=$(sqlite3 "$DB" "SELECT hash FROM __drizzle_migrations;")
for f in $(git ls-tree -r origin/main --name-only | grep -E '^drizzle/[0-9].*\.sql$' | sort); do
  H=$(git show "origin/main:$f" | sha256sum | cut -d' ' -f1)
  echo "$MARKERS" | grep -q "$H" && echo "$f MARKED" || echo "$f UNMARKED"
done
```
The drizzle marker `hash` is the **sha256 of the `.sql` file content**. Markers
usually align to main's FIRST N migrations; the unmarked ones are the gap.

For each UNMARKED migration, check if its schema is **actually applied** (tables/
columns present) or genuinely missing:
```bash
sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name='<table_from_that_migration>';"
sqlite3 "$DB" "SELECT COUNT(*) FROM pragma_table_info('<table>') WHERE name='<new_column>';"
```
- **Tables/columns MISSING** → migrations genuinely unapplied → `drizzle-kit migrate`
  will apply them cleanly. (DO NOT use `bootstrap-drizzle-migrations.sh` alone — it
  only STAMPS markers without applying DDL, and it SKIPS when markers already exist;
  stamping unapplied migrations locks in the missing tables.)
- **Tables/columns PRESENT but unmarked** → applied-but-not-stamped → `drizzle-kit
  migrate` is still the right tool (it detects them applied and just stamps).

## Recovery procedure
The clean fix: get the box to main's drizzle set, then `drizzle-kit migrate`
(non-interactive — the right tool; `push` is the one that hits the TTY prompt).

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
# 1. merge main to get main's clean drizzle/ files + the migrate-based auto-update
git merge --no-commit --no-ff origin/main     # inspect conflicts:
git diff --name-only --diff-filter=U           # location data -> keep ours; code -> theirs
#   for code conflicts:  git checkout --theirs <file>
#   for apps/web/data/*: git checkout --ours <file>   (Gotcha #7 — never blank location data)
git add -A && git commit --no-edit

# 2. apply the missing migrations (NON-interactive; clean since the tables don't exist)
npx drizzle-kit migrate                        # "migrations applied successfully!"

# 3. verify markers == files AND the new tables/columns exist
sqlite3 "$DB" "SELECT COUNT(*) FROM __drizzle_migrations;"   # == ls drizzle/[0-9]*.sql | wc -l
sqlite3 "$DB" "PRAGMA integrity_check;"                       # ok
```

## Build + verify + reconcile
```bash
npm ci --include=dev
rm -rf apps/web/.next && npm run build
pm2 restart sports-bar-tv-controller --update-env && sleep 10
bash scripts/verify-install.sh --json   # MUST be PASS (migration_markers_consistent green)
```
Then reconcile origin per [`AUTO_UPDATE_RECOVERY.md`] §3 (`merge -X ours` + push).

## Verify (success signals)
- `markers == files`, all marker hashes match main's `.sql` files in order.
- The migration's tables/columns exist; `PRAGMA integrity_check` = `ok`;
  `PRAGMA foreign_key_check` empty.
- verify-install **PASS** (18/18), health 200.
- Cross-check the table set is identical to a known-good box: `sqlite3 box "SELECT
  name FROM sqlite_master WHERE type='table' ORDER BY name;"` should `diff` clean.

## Prevention
- Keep boxes current — the chronic drift only afflicts boxes far behind (their old
  `push`-based auto-update can't self-heal). Once on ≥ v2.61.0 the `migrate` flow
  (Gotcha #6 fix) prevents recurrence.
- Always back up the DB before any manual migration work. The backup is the rollback.

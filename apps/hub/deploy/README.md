# SBCC Hub Deploy (CT211)

The SBCC monitoring hub (`apps/hub`) runs on CT211 (`100.124.165.26`) as a Next.js
**standalone** bundle under pm2 (`sbcc-hub`, port 3010). It is built on a dev box, bundled,
scp'd to CT211, and installed by `deploy.sh`. The hub's own `npm build` is intentionally a
no-op stub (the fleet `turbo build` skips it) — these scripts are the real deploy path.

## Files (mirrors of `/root/*` on CT211 — version-controlled here)
- `deploy.sh` — runs on CT211. Snapshots the current app (`/opt/sbcc-hub.bak`), untars the
  bundle, runs the idempotent migration, restarts pm2, health-checks `:3010`. Secrets come
  from `/root/.sbcc-hub.env` (chmod 600, NOT in git): `HUB_ADMIN_TOKEN`, `HUB_DB_PATH`.
- `migrate.js` — execs `migration.sql` against `$HUB_DB_PATH` (better-sqlite3).
- `migration.sql` — hub schema. **All `CREATE TABLE`/`CREATE INDEX` use `IF NOT EXISTS`** so
  re-running on an existing DB is a no-op (2026-06-24 fix — previously raw `CREATE TABLE`
  threw `table error_events already exists` under `set -e`, aborting every deploy *before*
  the pm2 restart, which then required a manual restart).

## Ship a new build (from a dev box, e.g. Holmgren)
```bash
cd apps/hub && npx next build
mkdir -p .next/standalone/apps/hub/.next
cp -r .next/static .next/standalone/apps/hub/.next/static     # standalone omits static
tar czf /tmp/bundle.tgz -C .next/standalone .
scp /tmp/bundle.tgz root@100.124.165.26:/root/bundle.tgz
ssh root@100.124.165.26 'bash /root/deploy.sh'                # idempotent migrate + restart + health-check
```
`deploy.sh` exits non-zero + prints the rollback command if `:3010` isn't 200 after restart.

## Rollback
```bash
rm -rf /opt/sbcc-hub && mv /opt/sbcc-hub.bak /opt/sbcc-hub && pm2 restart sbcc-hub
```

## Follow-on (tech debt)
`migration.sql` is a hand-maintained snapshot of the hub schema. Ideally the deploy would
generate it from `apps/hub/src/db/schema.ts` via drizzle-kit (tracked migrations) instead of
replaying raw SQL. The `IF NOT EXISTS` fix makes the current approach safe to re-run.

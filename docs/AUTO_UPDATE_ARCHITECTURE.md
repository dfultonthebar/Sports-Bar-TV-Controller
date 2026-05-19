# Auto-Update Architecture — Design Rules + Patterns to Adopt

**Audience:** anyone modifying `scripts/auto-update.sh`, `scripts/checkpoint-deterministic.sh`, `scripts/verify-install.sh`, or any of the helper scripts that the auto-update flow chains.

**TL;DR:** the auto-update script grew organically over 2 months and accumulated 16 documented failure modes (see `docs/AUTO_UPDATE_TROUBLESHOOTING.md`), most of which require manual operator intervention. This doc codifies the design rules — and the patterns from mature CD systems (Helm, ArgoCD, Capistrano, systemd) we're systematically adopting — so future changes can't regress into the same fragility patterns.

---

## The Six Operating Principles

Every change to the auto-update flow MUST pass all six:

### 1. **Failure must keep the bar UP.**
A non-zero exit from any step beyond `preflight` must NOT take the running app down. The previous build's `.next/` artifact, current PM2 process, and live DB are all "known good" — leaving them in place while we abort the new build keeps the bar serving while we fix the problem. The cascading-rollback antipattern (2026-05-19 v2.51.4 fleet rollback caused by one TS compile error in `geocoder.ts`) shipped 6 simultaneous service interruptions for a problem that affected zero production traffic. Adopt **Helm `--atomic`** semantics: "ready" is a positive assertion (health probe passes within timeout), but failure means "leave the old release in service" — NOT "destroy the new and the old."

### 2. **Use structural checks, not regex against tool stdout.**
`git diff --name-status`, `git ls-tree`, `git diff --diff-filter=D` give us authoritative answers. Heuristic regex on tool log output (Checkpoint A's "critical script deleted", drizzle-kit's "delete X table with N items", PM2 log timestamp parsing) breaks on every upstream tool version bump. The `ensure-schema.sh` regex parser at lines 86-115 can't see multi-line column defs, templated table names, or `.references()` chains — silently drops genuinely-missing columns. If a check requires parsing tool output to make a safety decision, the check is wrong. Use the underlying primitive instead.

### 3. **Every lock has a PID-file companion + staleness sweep.**
`flock` alone is insufficient: orphan child processes inherit FD200 and keep the lock after the parent script exits (Mode 14, Holmgren 2026-05-19 02:50). Standard lock pattern: write `$$` to `${LOCK_FILE}.pid` immediately after `flock -n -E 75`; on lock-failed, read the PID file and `kill -0` check; if the recorded PID is dead, `rm` both files and retry once. Exit code **75** specifically means "lock held, retry later" — the watcher cron distinguishes it from real failures (per [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html) Restart=on-failure semantics).

### 4. **Schema changes use generated + reviewed SQL, NEVER runtime diff prompts.**
`drizzle-kit push` runs a diff engine at runtime and prompts on ambiguity (rename vs drop+add, data loss). In non-TTY mode it bails. There is **no `--yes`/`--ci`/`--auto-approve` flag that safely accepts** — `--force` is destructive (truncates on data loss). The correct architecture: dev runs `npm run db:generate` to produce explicit `drizzle/NNNN_*.sql`, commits it, fleet box runs `drizzle-kit migrate` (file-based, **no prompts ever**). Migration journal must be kept consistent across the fleet via `__drizzle_migrations` table. See [Drizzle migration docs](https://orm.drizzle.team/docs/migrations) and the [zero-downtime schema-change pattern](https://dev.to/whoffagents/drizzle-orm-migrations-in-production-zero-downtime-schema-changes-e71). NEVER add a new auto-update flow that calls `drizzle-kit push` against prod.

### 5. **Trap fires once. The failure-recovery hook is dedicated, not tangled into the happy path.**
Adopt **ArgoCD's SyncFail-phase pattern**: PreSync / Sync / PostSync / SyncFail are four discrete phases, where SyncFail is the dedicated cleanup hook that runs ONLY when Sync fails, and "if SyncFail itself fails, ArgoCD does NOT enter another failure loop" — bounded recursion. Currently `cleanup_on_error` at `auto-update.sh:343-386` calls `rollback.sh` for every non-zero exit beyond preflight, which then re-runs verify-install which has its own potential bugs (Mode 13's twin in `verify-install.sh:367`). Each failure step needs an explicit recovery action; they don't all share the same one.

### 6. **Canary gating is non-optional for breaking changes.**
The fleet ALL hit today's TS compile error at the same time because canary mode is `enabled=false` in `scripts/canary-config.json`. Canary is the difference between "one box rolled back" and "six boxes simultaneously rolled back." For any schema migration, any non-trivial dep bump, any code change that touches `instrumentation.ts` / `scheduler-service.ts` / hot paths: enable canary, soak for at least one full update cycle on Holmgren before non-canary boxes pull. See `scripts/canary-config.json` and the bless-write block at `auto-update.sh:1387-1413`. Pattern adopted from [Spinnaker stage-by-stage progression](https://spinnaker.io/docs/concepts/) — failures stop forward progress.

---

## Patterns we ARE adopting

| Pattern | Source | What we're stealing |
|---|---|---|
| **Capistrano symlink-swap** | [capistranorb.com](https://capistranorb.com/documentation/getting-started/structure/) | Each deploy goes into `releases/<sha-ts>/`. `current` symlink atomically flips only when fully prepared. Rollback = single rename syscall. Eliminates "build half-failed, partial files" entirely. **Planned for v2.53.0.** |
| **Helm --atomic positive readiness** | [helm.sh](https://helm.sh/docs/topics/charts_hooks/) | "Ready" = health probe passes within timeout, NOT "no exception thrown." **Adopted in v2.52.0 build-failure handler.** |
| **flock with -E exit code semantics** | [flock(1) man](https://man7.org/linux/man-pages/man1/flock.1.html) | Distinguish "lock held, retry later" (exit 75) from "real failure." Close FD 200 in any child that shouldn't extend lock lifetime. **Adopted in v2.52.0 lock-staleness sweep.** |
| **ArgoCD SyncFail phase** | [argo-cd sync-waves](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/) | Dedicated OnFail hook, bounded recursion. **Planned for v2.52.x cleanup refactor.** |
| **systemd Restart=on-failure + StartLimitBurst** | [systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html) | Retry transients but bound the loop. **Planned for v2.52.x — wrap PM2 in a systemd unit with the canonical knobs.** |
| **Drizzle generate+migrate, not push** | [orm.drizzle.team](https://orm.drizzle.team/docs/migrations) | Explicit SQL migration files in git. No runtime diff engine, no prompts ever. **Planned for v2.52.1 — requires one-time baseline reset.** |

---

## Patterns we ARE NOT adopting (and why)

- **Kubernetes / Helm / ArgoCD as runtime platforms** — we steal the *patterns* (--atomic, sync hooks, declarative reconciliation), but running k8s for a 6-box bare-metal LAN fleet would multiply ops surface by 10x with zero value-add. The pattern transplant is shell-script-level.

- **Container/Docker deployment** — doesn't fit. Our hardware-control packages talk to USB SDR dongles, Global Cache IR blasters, RS-232 USB serial, and Ollama on the iGPU via SYCL. All needs that pierce container boundaries.

- **Spinnaker canary traffic-shifting** — requires multiple replicas with fractional traffic. We have ONE box per location. The useful Spinnaker idea is *staged progression with typed nodes*, not deployment-strategy specifics.

- **PM2 cluster mode for "zero-downtime reload"** — breaks Gotcha #10 globalThis singletons (Atlas/Shure managers, RAG store handles). We accept ~5s downtime on restart; bartender remote auto-retries.

- **`drizzle-kit push --force`** — picks "truncate" on every data-loss diff. Destructive by design. Per [drizzle-orm #3209](https://github.com/drizzle-team/drizzle-orm/issues/3209), this is intentional but unsafe for prod.

---

## The Six Operating Principles, restated as a pre-merge checklist

Any PR or change that touches `scripts/auto-update.sh` or its helpers must answer YES to all six:

- [ ] **#1 Bar stays up on failure?** If this code path exits non-zero, does the live PM2 process and current `.next/` build keep serving? If the change replaces rollback with degraded-up, can the previous build safely handle the post-merge state?
- [ ] **#2 No regex on tool stdout?** Every safety decision uses git/sqlite/pm2 STRUCTURED output (json, exit codes, file existence) — not parsing log strings.
- [ ] **#3 Locks have PID companion + staleness sweep?** Any new lock-acquiring code writes its PID, checks staleness on lock-failed, exits 75 if held legit.
- [ ] **#4 Schema changes use `drizzle-kit migrate` (post-v2.52.1) or hand-applied SQL?** Never call `drizzle-kit push` in this flow.
- [ ] **#5 Failure recovery is a dedicated function, not commingled with happy-path?** Trap fires once, OnFail hook is explicit, bounded recursion.
- [ ] **#6 Canary-gated if breaking?** If the change touches schema/scheduler/instrumentation/hot-path code, `scripts/canary-config.json` must have `enabled=true` and the canary location must successfully install + soak before fleet rollout.

If any answer is NO, the change goes back to the drawing board.

---

## Related docs
- `docs/AUTO_UPDATE_TROUBLESHOOTING.md` — operational catalog of 16 known failure modes
- `docs/AUTO_UPDATE_SYSTEM_PLAN.md` — original architectural overview (predates this doc)
- `docs/AUTO_UPDATE_DESIGN_RULES.md` — concrete coding checklist for any auto-update change
- CLAUDE.md — Gotcha #11, Standing Rules #6 (always use auto-update.sh), #11 (RAG re-scan after every commit touching docs)

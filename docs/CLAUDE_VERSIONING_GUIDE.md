# Claude Versioning & Release Guide

**This document is REQUIRED READING for any Claude Code session before
committing to main. It is referenced from the READ FIRST block at the top
of `CLAUDE.md`.** The three documents in this family —
`docs/VERSION_SETUP_GUIDE.md`, `docs/LOCATION_UPDATE_NOTES.md`, and root
`CLAUDE.md` — interlock with specific rules about what goes where. Getting
this wrong means locations silently fail to update, or update without the
setup steps that make the new version actually work.

---

## Scope

This guide covers version bumping, commit strategy for releases, the
relationship between the three release-tracking documents, and Standing
Rule 8 (read + contribute to `VERSION_SETUP_GUIDE.md`). It complements
(does NOT replace) `CLAUDE.md`.

## Version Bumping (REQUIRED — every commit to main)

**Every commit pushed to `main` MUST include a version bump in root
`package.json`.** Do not push code changes and bump the version
separately — include it in the same commit, or at minimum the same
push.

A commit without a version bump means two locations can report the
same version while running different code — making debugging
impossible when a bug shows up at only one of them.

### Which bump to use

- **Major bump** (2.23.0 → 3.0.0): Breaking changes. Rare. Announce in
  `LOCATION_UPDATE_NOTES.md` with a `STOP` risk flag so auto-update
  doesn't land it unattended.
- **Minor bump** (2.23.0 → 2.24.0): Feature additions, schema
  migrations, significant behavior changes, new MCP servers, new
  plugins.
- **Patch bump** (2.23.0 → 2.23.1): Bug fixes, doc updates, small
  adjustments, config tweaks.

If unsure: default to patch. Minor bumps grow fast if every tweak
claims "feature."

### The bump is part of the diff

When you edit `package.json` for the bump, do it in the SAME commit
that makes the code change. Do NOT split into "code change" + "version
bump" commits — both must land on main atomically. Otherwise the
deployed version at one location can be N while the code matches
version N-1, breaking all debugging.

## The three release-tracking documents

| File | Purpose | Format | Reader |
|---|---|---|---|
| `docs/LOCATION_UPDATE_NOTES.md` | *Whether* to update. Per-release risk assessment, manual-step summary, affected-files list. | Newest entries at top. Each entry: Date + tip SHA + Risk (GO/CAUTION/STOP) + what-could-break + manual-steps + rollback. | Auto-update Checkpoint A. Claude at every location reads the top 3-5 entries since its last update. |
| `docs/VERSION_SETUP_GUIDE.md` | *What to do* so it works after updating. Per-release setup steps (env vars, seed data, DB patches, dependency installs) + "Known Errors & Fixes" catalog. | Newest at top. Each entry: version + date + what-changed + required-Claude-step + verification + rollback. | Auto-update Checkpoint B. Claude at every location reads the entry for the target version and EXECUTES the required steps before the build step. |
| `CLAUDE.md` (root) | Standing Rules + architecture + conventions. Universal across versions. | Stable reference. Update only when a rule/architecture changes, not per-release. | Every Claude Code session in the repo. |

These three documents have disjoint responsibilities. Don't mix them.
If you're describing WHETHER a version is safe to merge, it belongs in
`LOCATION_UPDATE_NOTES.md`. If you're describing WHAT to do so the
version actually works, it belongs in `VERSION_SETUP_GUIDE.md`. If
you're describing a permanent rule or convention, it belongs in
`CLAUDE.md`.

## Standing Rule 8 — Read and CONTRIBUTE to VERSION_SETUP_GUIDE.md

From `CLAUDE.md` Standing Rule 8. Full expansion:

### Reading (every version-changing update)

Before trusting a version bump at a location, scan the
`VERSION_SETUP_GUIDE.md` entry for the target version. Each entry
lists required manual setup — install a dependency, seed a DB row,
export a new env var, run a one-time SQL patch, configure a plugin.

**Auto-update Checkpoint B** must verify each "Required manual step":

- Already completed at this location → proceed.
- Not completed and safe to perform automatically → perform it, log it
  in the Checkpoint B decision body, proceed.
- Not completed and NOT safe to perform automatically (e.g., needs
  an API key the operator must obtain) → flag in the decision body
  and either: continue with a CAUTION (if the feature degrades but
  doesn't break), or STOP (if the missing step breaks a working
  feature).

`LOCATION_UPDATE_NOTES.md` tells you WHETHER to update.
`VERSION_SETUP_GUIDE.md` tells you WHAT TO DO so it works after
updating. Both are authoritative for their scope.

### Contributing (every location, every session)

The guide is a living knowledge base that every location improves.
You MUST contribute in two cases:

#### Case A: Bumping a version to main

Include an entry for that version in the same commit as
`package.json`. List:

- **What changed** — the actual code/config delta.
- **Required manual step** (or "None") — dependencies to install, DB
  patches to run, env vars to export, plugins to enable, UI steps.
  Write as Claude-executable instructions with exact bash/SQL
  commands, not prose.
- **Verification** — exact commands to confirm the step worked (e.g.,
  `sqlite3 .../production.db "SELECT ..."` expecting a specific
  result).
- **Rollback** — how to undo if the version proves bad. Specifically
  whether `git revert` is clean, or whether DB data must also be
  reverted.

Skipping this means the next location to auto-update will silently
miss required setup and report GO when the feature is actually
broken.

#### Case B: Fixing an error at a location

When you hit an error at a location and fix it, append an entry to
the "Known Errors & Fixes" section of
`docs/VERSION_SETUP_GUIDE.md` with:

- **Symptom** — what the operator/UI showed.
- **Root cause** — why it happened.
- **Fix** — the exact SQL/command/code change that resolved it.
- **Verification** — how to confirm the fix worked.
- **Applies to** — `all locations` or a specific location tag (Green
  Bay DMA, Madison, multi-card WP, etc.).
- **First seen** — YYYY-MM-DD at which location.

Other locations hitting the same error later will find the fix from
reading the guide instead of re-debugging. This includes: botched
schema pushes, missing seed rows, wrong-IP configs, stuck auto-update
steps, UI spinners, routing misroutes — anything where the path from
symptom → fix was non-obvious.

If you're not sure whether a fix is generally applicable or
location-specific, err on the side of documenting with a location
tag; future readers can filter.

**Commit target**: main for shared knowledge; a location branch only
if the fix is truly location-specific. After committing a fix entry
to a location branch, cherry-pick or promote to main so every other
location inherits it on their next update.

## Commit Strategy for Release Changes

This section expands `CLAUDE.md`'s "Commit Strategy" for
release-specific cases. The general rule (software to main, location
data to location branches, never merge location branches to main)
still applies — but for release changes specifically:

### Release commits MUST go to main first

A release is a version bump + the code change that justifies it. Never
commit a version bump on a location branch without cherry-picking
it to main immediately. If main is behind, the fleet diverges:

- Holmgren runs v2.23.5 (committed to location/holmgren-way only).
- Lucky's auto-updates and never sees v2.23.5 because main doesn't
  have it.
- Now Holmgren and Lucky's report different versions for the same
  logical state — debugging becomes impossible.

The correct flow (mirrors the generic one but emphasized for
releases):

```bash
# On the location branch, confirm the release is ready:
git status && git log -3

# Switch to main, pull, cherry-pick the release commit:
git checkout main
git pull --ff-only origin main
git cherry-pick <release-sha>
git push origin main

# Back to the location branch, merge the now-on-main release:
git checkout location/<name>
git merge main
git push origin location/<name>
```

### Pull before push to main

From `CLAUDE.md`: "Always pull before pushing to main — run `git fetch
origin main && git merge origin/main` before committing and pushing
to `main`. Other locations or sessions may have pushed changes while
you were working. Pushing without pulling risks rejected pushes or
overwrites."

This applies doubly to release commits. Another location or another
session may have landed a release while you were working. If you
push-force over it, you've deleted someone else's shipped change.

## Auto-update's use of these files

The `scripts/auto-update.sh` pipeline reads both `LOCATION_UPDATE_NOTES.md`
and `VERSION_SETUP_GUIDE.md` in Claude-driven checkpoints:

- **Checkpoint A** (pre-merge): reads top 3-5 entries of
  `LOCATION_UPDATE_NOTES.md` since the location's last version to
  assess overall risk. Decision: GO / CAUTION / STOP. If STOP, the
  merge never happens.

- **Checkpoint B** (post-merge, pre-build): reads the
  `VERSION_SETUP_GUIDE.md` entry for the target version, plus syncs
  CLAUDE.md ↔ memory per Rule 7, plus performs any required Claude
  steps (seeds, SQL patches, env-var checks). Decision: GO /
  CAUTION / STOP. If STOP, the pipeline rolls back.

- **Checkpoint C** (post-restart): holistic sanity check. Reads the
  deterministic `verify-install.sh` result and recent PM2/scheduler
  logs. Decision: GO / CAUTION / STOP. If STOP, rollback.

If your `VERSION_SETUP_GUIDE.md` entry is missing the `Required
manual step` section, Checkpoint B has nothing to execute and the
version ships with setup undone. That's almost always a broken
feature downstream. Always include the section — even if it's just
"None."

## Related Standing Rules

See `CLAUDE.md`:
- Rule 2 — commit+push after completing work
- Rule 6 — always use `scripts/auto-update.sh` for updates
- Rule 8 — read+contribute to `VERSION_SETUP_GUIDE.md`

See `docs/CLAUDE_MEMORY_GUIDE.md`:
- Rule 5 — version-bump when adding a universal rule via memory→CLAUDE.md
  promotion.

---

**Last updated:** 2026-04-18 (v2.23.5 — initial extraction from CLAUDE.md).

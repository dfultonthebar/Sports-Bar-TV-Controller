# Self-Updating Docs

**Purpose:** keep code-grounded docs (the bartender how-tos + runbooks that feed the
AI Hub chat and operators) correct as the system changes. A doc with *wrong* steps is
worse than no doc — a bartender follows it and it fails. This system flags a doc the
moment its underlying code changes, so it gets refreshed before it rots.

This automates **Standing Rule 1** (update docs after code changes) and chains into
**Standing Rule 11** (RAG rescan), instead of relying on anyone remembering.

---

## How it works

1. **The map — `docs/doc-source-map.json`.** Each doc declares which source files/globs
   it documents:
   ```json
   { "doc": "docs/bartender-help/change-channel-preset.md",
     "sources": [
       "apps/web/src/components/remotes/CableBoxRemote.tsx",
       "apps/web/src/app/api/channel-presets/tune/route.ts",
       "apps/web/src/app/api/ir/commands/send/route.ts"
     ] }
   ```
   Sources are exact paths or globs: `dir/**` (recursive), `dir/*` (direct children),
   `prefix*` (prefix match).

2. **The checker — `scripts/docs/check-stale-docs.mjs`.** Given a set of changed files,
   it reports every doc whose mapped sources were touched. Dependency-free Node ESM,
   always exits 0 (non-fatal).
   ```bash
   node scripts/docs/check-stale-docs.mjs --since <gitref>     # diff <ref>...HEAD
   node scripts/docs/check-stale-docs.mjs --files a.ts,b.tsx   # explicit files
   node scripts/docs/check-stale-docs.mjs --all                # flag every mapped doc
   node scripts/docs/check-stale-docs.mjs --since <ref> --file-todo   # also POST a TODO
   ```

3. **The trigger — `scripts/auto-update.sh`.** After every successful merge (right after
   the RAG rescan), auto-update runs the checker over the merge range with `--file-todo`.
   If any doc's sources changed, it files **one aggregated** "Refresh N stale doc(s)" TODO
   (category `documentation`, tags `docs-stale, self-updating-docs, auto`). Every fleet box
   self-flags on every update — no manual action.

4. **The refresh.** Someone (Claude in-session, or Hermes via `ask_claude_code` once its
   worker is fixed) works the TODO using the **learn-system-write-bartender-howtos** recipe:
   re-trace the changed code → rewrite the doc in place (same slug) → version bump →
   RAG rescan → verify against the chatbot. Then mark the TODO complete.

5. **Weekly backstop cron.** A catch-all in case the trigger misses something:
   ```cron
   # Sunday 04:30 — audit every mapped doc against current code, file a refresh TODO if any drifted
   30 4 * * 0  cd /home/ubuntu/Sports-Bar-TV-Controller && node scripts/docs/check-stale-docs.mjs --since "$(git rev-list -n1 --before='7 days ago' HEAD)" --file-todo >> /home/ubuntu/sports-bar-data/logs/doc-audit.log 2>&1
   ```
   (Install once per box via `crontab -e`. Pairs with the existing weekly-doc-maintenance review.)

---

## Adding a new doc to the system

When you write a new code-grounded doc, **add a row to `docs/doc-source-map.json` in the
same commit** — list every source file/glob the doc's steps depend on (the UI component,
the API route(s), the package that drives the hardware). That's the whole onboarding:
from then on the doc is born self-maintaining.

If you're unsure which files a doc depends on, the trace you did to write it *is* the
answer — the files `ask_claude_code` cited (component + route + hardware package) are
exactly the `sources` list.

---

## Drift detection

The checker warns (`⚠ doc missing on disk`) if the map references a doc that no longer
exists — catches a deleted/renamed doc whose map row was left behind. Keep the map and
`docs/bartender-help/` in sync.

---

## Why not git-hook frontmatter instead?

A central manifest (vs. per-doc frontmatter) keeps the mapping out of the bartender-facing
markdown (no raw YAML leaking into a plain viewer), and lets the trigger scan one file
instead of parsing 25. Trade-off: you must remember to add the map row — enforced by making
it part of the doc-writing recipe.

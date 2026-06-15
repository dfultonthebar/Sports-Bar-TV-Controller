# SOP: Auto-Update Recovery — stuck / diverged / rolled-back fleet box

**Purpose:** recover a location box whose `auto-update.sh` is failing silently —
stuck mid-rebase, frozen origin, or rolling back every cycle. This froze the
ENTIRE fleet for weeks (2026-06-14) before it was diagnosed; this SOP is the fix.

**Audience:** operator / Claude Code. Read [`../../CLAUDE.md`] Gotcha #6, #7, #11
and [`feedback-wolfpack-tcp-not-http-routing`] first for context.

---

## Symptoms (any of these = run this SOP)
- Fleet Dashboard shows a box stuck on an old version while it "looks healthy."
- `fleet-update-watch` (Hermes cron) alerts: `rebase-STUCK`, `DIVERGED`, `rolled-back`.
- A box's `git branch --show-current` is empty (detached HEAD) or it has
  `.git/rebase-merge` / `.git/rebase-apply`.
- Update logs show `Rollback SUCCESS` repeatedly, or the success marker
  (`.auto-update-last-success.json`) is weeks stale while the box runs newer code.

## Quick fleet audit (run from Holmgren or any box with Tailscale SSH)
For each location box, SSH in and check (read-only):
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git fetch origin -q
echo "v$(node -p 'require("./package.json").version') on $(git branch --show-current)"
echo "ahead $(git rev-list --count origin/$(git branch --show-current)..HEAD) / behind $(git rev-list --count HEAD..origin/$(git branch --show-current))"
[ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] && echo "REBASE-STUCK"
git show origin/$(git branch --show-current):package.json | grep version   # is origin frozen?
```
`fleet-update-monitor.sh` (Hermes) does this for the whole fleet automatically.

## Root cause (fixed in v2.61.0)
`auto-update.sh` used to run `git pull --rebase` before pushing. Against a
badly-diverged origin (frozen for weeks), the rebase replays the box's local
commits and gets STUCK in a 70+ commit interactive rebase, leaving the working
tree detached on old code. The box keeps SERVING (PM2 runs the built `.next`
regardless of git state), so it looks fine — but it never advances and never
pushes, so `origin/location/<branch>` freezes. Every later run re-tangles.
**Fix:** push first; on rejection reconcile by `git merge -X ours`, NEVER rebase.

## Recovery procedure (per stuck box)

### 1. Unstick (non-destructive)
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git rebase --abort 2>/dev/null            # clears the stuck rebase
git branch --show-current                  # must show location/<branch>, not empty
git status --porcelain                     # should be clean (untracked debug files are OK)
```
The box returns to its true pre-rebase HEAD (often an OLD version — that's
expected; it serves from the built `.next`).

### 2. Confirm the box has the v2.61.0 fix, then let it self-heal — OR reconcile manually
- If the box is already ≥ v2.61.0, its `auto-update.sh` has the `merge -X ours`
  fix: its **next cron run will self-reconcile** (push fails → merge -X ours →
  fast-forward push). Verify the next run with the fleet audit. Nothing else needed.
- If the box is BELOW v2.61.0 (old `push`/`pull --rebase` script), trigger one
  update so it pulls main (which re-execs the fixed script):
  ```bash
  nohup bash scripts/auto-update.sh --triggered-by=manual_cli > /tmp/upd.out 2>&1 &
  ```
  Watch by process name (it re-execs, so PID changes): `pgrep -f scripts/auto-update.sh`.
  Confirm the log shows `Push succeeded after merge-reconcile`.

### 3. If origin is badly frozen and you want it reconciled NOW (manual)
A plain push fails (behind N). Reconcile with merge (never rebase, never blind force):
```bash
git fetch origin -q
git merge --no-edit -X ours origin/location/<branch>   # keeps the box's content
git push origin location/<branch>                       # now fast-forwards
git rev-parse HEAD; git rev-parse origin/location/<branch>   # must MATCH
```
`-X ours` keeps the box's authoritative content and just records origin's history
so the push fast-forwards. A `merge-tree --write-tree HEAD origin/<branch>` returning
zero conflicts first confirms it'll be clean. **Prefer this over `--force-with-lease`**
(force-push is destructive + gated; this is non-destructive and reconciles history).

### 4. Verify
```bash
bash scripts/verify-install.sh --json | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['status'],d['passed'],'/',d['total'],d.get('failed'))"
curl -s localhost:3001/api/health -o /dev/null -w '%{http_code}\n'
```
verify-install must PASS (all layers). If it fails on `migration_markers_consistent`
(exit 20), see [`DRIZZLE_MIGRATION_DRIFT_RECOVERY.md`].

## Verify the fix worked (success signals)
- `local == origin` for the location branch (origin-match=YES).
- verify-install PASS, health 200, PM2 online, working tree clean.
- The update log contains `Push succeeded after merge-reconcile` (not a rollback).

## Prevention
- v2.61.0 `auto-update.sh` reconciles by merge, never rebase — this can't recur.
- `fleet-update-watch` Hermes cron (every 6h) catches stuck/diverged/rolled-back
  boxes and hands the diagnosis to Claude before it festers.
- Run the fleet audit after any manual fleet operation.

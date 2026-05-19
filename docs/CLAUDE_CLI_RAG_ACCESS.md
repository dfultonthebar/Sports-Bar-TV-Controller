# Claude CLI ↔ RAG Access — Cross-Location Knowledge Sharing

**Audience:** anyone debugging why the Claude CLI inside auto-update.sh checkpoints isn't using the local RAG, OR setting up cross-location knowledge sharing so Claude at location X can consult Holmgren's RAG (or vice versa).

**TL;DR:**
- The local `/api/rag/query` endpoint accepts unauthenticated POST from `localhost`. Claude CLI's Bash tool can `curl` it freely during checkpoints.
- Cross-location queries work over Tailscale: `curl http://hw-sports-bar-tv-controller:3001/api/rag/query` from any fleet box hits Holmgren's RAG. No auth on Tailscale-only network.
- Standing Rule 11 (v2.50.13+) wires `rag-rescan-if-needed.sh` into `auto-update.sh` finalize so every successful update self-heals the local RAG.

---

## How Claude CLI gets invoked at checkpoints

`scripts/auto-update.sh` invokes the Claude CLI at three checkpoints:

| Checkpoint | When | Question Claude answers |
|---|---|---|
| **A** (pre-merge) | After fetch, before merge | "Is this incoming diff safe to merge?" |
| **B** (post-schema/build) | After schema_push + build, before pm2_restart | "Is the merged tree still safe to restart with?" |
| **C** (post-verify) | After verify-install passes | "Did anything in the live state look wrong despite the green check?" |

Invocation pattern (auto-update.sh line ~488):
```bash
script -qfc "$claude_bin -p --dangerously-skip-permissions \"\$(cat $prompt_file_tmp)\"" /dev/null
```

`--dangerously-skip-permissions` means Claude can use Bash tool calls without per-call approval. So Claude can:
- Read git diffs
- Query the live PM2 / health endpoints  
- **Curl the local `/api/rag/query` endpoint to consult the location's RAG store**
- **Curl another location's RAG over Tailscale** (e.g. ask Holmgren's RAG from leglamp)

The prompt file at each checkpoint instructs Claude what to investigate, but the CLI itself doesn't restrict which endpoints it can hit — Bash tool has full network access.

---

## Local RAG query — no auth, works from any localhost process

The endpoint at `apps/web/src/app/api/rag/query/route.ts` accepts unauthenticated POST:

```bash
curl -s -X POST http://localhost:3001/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"how do I fix Linger=no on a stuck location","topK":3}' \
  -m 60
```

Response shape:
```json
{
  "success": true,
  "data": {
    "answer": "...generated answer from llama3.1:8b...",
    "sources": [
      {"filename": "AUTO_UPDATE_TROUBLESHOOTING.md", "score": 0.87, ...}
    ],
    "metadata": {
      "model": "llama3.1:8b",
      "tokensUsed": 0,
      "duration": 146,
      "chunksRetrieved": 3
    }
  }
}
```

**Limits:**
- `query`: 1-1000 chars
- `topK`: 1-20 (default 5)
- `temperature`: 0-2 (default ~0.3)
- `tech`: optional filter — string or array of tech tags (atlas, shure, cec, etc.)
- Rate-limited (DEFAULT bucket, 30 req/min)

**For Claude CLI to use this during checkpoints, the prompt template needs to mention it.** Without an explicit instruction, Claude won't think to query — it'll only use the tools/info in the prompt context. Add to the checkpoint prompts:

```text
You have a local RAG knowledge base reachable at POST http://localhost:3001/api/rag/query.
For any unfamiliar error, install gotcha, or "how does X work" question, query the RAG
FIRST before guessing. Example: curl -s -X POST http://localhost:3001/api/rag/query -H
'Content-Type: application/json' -d '{"query":"<your question>","topK":3}' -m 60
```

---

## Cross-location RAG query — peer knowledge sharing via Tailscale

Every fleet box runs the same `/api/rag/query` endpoint on port 3001, reachable across Tailscale by MagicDNS name. So Claude at location X (or any operator tool) can ask Holmgren's RAG directly:

```bash
# From any fleet location, ask Holmgren's RAG
curl -s -X POST http://hw-sports-bar-tv-controller:3001/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"why did my drizzle-kit push fail at schema_push","topK":3}' \
  -m 60
```

**Why ask Holmgren's RAG specifically:**
- Holmgren is the canary / dev box — its RAG store is usually 0-24 hours FRESHER than the fleet because new commits land + scan there first
- Holmgren has Claude CLI installed with Opus access, plus the full Anthropic API key — so its RAG store is the most complete + has had the most queries through it (the embedding cache + BM25 store are warm)

**When to ask a peer location's RAG instead of Holmgren:**
- The error is location-specific (e.g. "graystone single-card config" — graystone's RAG has its own `.claude/locations/graystone.md` chunks)
- Holmgren is unreachable (Tailscale down at Holmgren, or it's mid-update)

**Tailscale hostnames** (canonical list):

| Branch slug | Tailscale name | Use for RAG queries when |
|---|---|---|
| `holmgren-way` | `hw-sports-bar-tv-controller` | Default (freshest store) |
| `leg-lamp` | `leglamp-tvcontroller` | Leg Lamp-specific config questions |
| `lucky-s-1313` | `luckys1313` | Lucky's single-card WP-36X36 specifics |
| `graystone` | `graystone-tvcontroller` | Multi-card chassis + slower Ryzen hardware |
| `stoneyard-greenville` | `greenville-stoneyard` | Greenville layout (4 audio outputs) |
| `stoneyard-appleton` | `stoneyard-appleton` | Appleton specifics |

---

## Architecture: why this works without auth

The `/api/rag/query` endpoint deliberately omits the `requireAuth()` middleware that protects most admin endpoints:

1. **Localhost queries** — needed for the AI Hub chat in the browser, the auto-update Claude CLI, and `scripts/test-rag.ts`. Adding auth would force every consumer to bootstrap an API key first.
2. **Tailscale-only network** — the fleet boxes are NOT exposed to the public internet. Port 3001 is firewalled to LAN + Tailscale only. The Tailscale ACL restricts who can reach any node (only the operator's devices + the other fleet boxes). So the unauthenticated endpoint is reachable only by trusted parties.
3. **Read-only** — `/api/rag/query` only reads from the vector store. It can't mutate state, write files, or trigger any side effect. The worst a malicious caller could do is rate-limit-burn the Ollama instance.

If the threat model changes (e.g. the fleet ever runs on a network where Tailscale isn't the only path), add an API-key middleware that accepts either a session cookie OR a header API key. Until then: unauthenticated read access is intentional + low-risk.

---

## RAG freshness — Standing Rule 11, operationalized

Per CLAUDE.md Standing Rule 11, every commit touching RAG-indexed paths MUST trigger a re-scan. There are three layers of enforcement:

1. **Live session** (developer): manually kick off `nohup npx tsx scripts/scan-system-docs.ts > /tmp/rag-rescan.log 2>&1 &` after a doc commit on main.
2. **Auto-update path** (NEW v2.50.13): `scripts/auto-update.sh` finalize step calls `scripts/rag-rescan-if-needed.sh --since $PRE_MERGE_SHA`. The helper is path-aware — checks if any RAG-indexed paths changed between PRE and POST merge SHAs; if so, kicks off a background scan; if not, exits without touching Ollama. ~25-40 min on iGPU; non-blocking.
3. **Weekly cron** (backstop): `0 3 * * 0 cd /home/ubuntu/Sports-Bar-TV-Controller && npx tsx scripts/scan-system-docs.ts` runs every Sunday 3 AM regardless of update activity, so doc rot can't accumulate beyond 7 days even if 1 + 2 miss something.

With Layer 2 (v2.50.13) live, every fleet location's RAG self-heals on every successful auto-update. Operators (and the Claude CLI at checkpoints) querying `/api/rag/query` always see content no more stale than the last auto-update window.

---

## End-to-end test: did the rag-rescan-in-finalize actually fire?

After an auto-update completes:

```bash
ssh ubuntu@<host> "
  echo '== last auto-update log: did rag-rescan run? =='
  L=\$(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)
  grep -E 'RAG rescan|rag-rescan' \$L | tail -3
  echo '== was a scan actually queued? =='
  ls -lat /tmp/rag-rescan-*.log | head -3
  echo '== current vector-store mtime (proves it was touched) =='
  stat -c '%y %s bytes' ~/Sports-Bar-TV-Controller/apps/web/rag-data/vector-store.json
"
```

Expected:
- `RAG rescan: [rag-rescan] done — scan running in background...` line in the auto-update log
- `/tmp/rag-rescan-*.log` from the same minute as the auto-update finalize
- vector-store.json mtime within the last ~30 min (or older if no RAG-indexed paths changed in the merge — path-aware skip is correct behavior)

If the rag-rescan didn't fire, the log will say `⚠ RAG rescan: returned non-zero` — debug with the failure modes in `docs/AUTO_UPDATE_TROUBLESHOOTING.md` Mode 11 (RAG rescan reports idle).

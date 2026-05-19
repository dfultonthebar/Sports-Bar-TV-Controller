# QA Dataset Generation — runbook

**Owner:** AI / RAG track
**Status:** stage 1 of the local-LLM fine-tune pipeline
**Script:** `scripts/generate-qa-dataset.ts`
**Output:** `apps/web/rag-data/qa-dataset/qa-pairs.jsonl`

---

## What this script does + why

The Sports-Bar-TV-Controller AI Hub today is **RAG-grounded** — every
operator question goes through `nomic-embed-text` similarity search
across ~5,500 chunks of CLAUDE.md, package READMEs, location memory
files, vendor docs, and source code. The retrieval works, but each
answer pays an embedding lookup + Ollama generation tax (~2-5s).

For high-frequency operator queries ("what's outputOffset for Lucky's?",
"why isn't TX_MODEL populating on my Shure?", "Atlas drop spam — false
alarm?") we want the model to **natively know** those facts so it can
answer instantly without retrieval round-trips. That means LoRA
fine-tuning `llama3.1:8b` against a curated Q-A dataset distilled from
our docs.

This script is **step 1**: turn every RAG chunk into 3 high-quality
Q-A pairs using a stronger local instruct model (`qwen2.5:14b`) as the
synthetic-data teacher, write them out in Unsloth/Axolotl-compatible
chat-format JSONL.

Downstream steps (separate runbooks, not yet written):

1. **Manual curation** — load JSONL into a notebook, drop garbage, fix
   wrong answers, hand-author edge-case pairs. Target: 1,500-5,000
   verified pairs.
2. **Fine-tune** — Unsloth on a rented A100 (~$2/hr × ~2 hrs). LoRA
   rank 16, 3 epochs, eval on a 10% held-out split.
3. **Quantize + ship** — merge LoRA, export to GGUF Q4_K_M, drop the
   `.gguf` into `/usr/share/ollama/.ollama/models/`, register as
   `sports-bar:8b`, point AI Hub at it.

---

## How to run a small test pass first

**Always smoke-test with `--limit=10` before committing wall-clock.**
Validates Ollama is up, the chosen model produces parseable JSON, and
the output file format looks right.

```bash
# 1. Verify Ollama + model
curl -s http://localhost:11434/api/tags | jq '.models[].name'
ollama pull qwen2.5:14b      # if not already present

# 2. Tiny test pass — 10 chunks, ~3-5 minutes
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/generate-qa-dataset.ts --limit=10

# 3. Inspect output
wc -l apps/web/rag-data/qa-dataset/qa-pairs.jsonl
head -3 apps/web/rag-data/qa-dataset/qa-pairs.jsonl | jq .

# 4. Open in editor + eyeball every pair for the test set
less apps/web/rag-data/qa-dataset/qa-pairs.jsonl
```

If a test pass writes nothing, common causes:

| Symptom | Cause | Fix |
|---|---|---|
| `Ollama unreachable` | service down | `systemctl status ollama-ipex` |
| `model not in ollama list` | not pulled | `ollama pull qwen2.5:14b` |
| Every chunk → `no valid pairs` | model output not JSON | drop temperature to 0.1, or switch model |
| Every chunk → `TIMEOUT` | iGPU saturated | bump `OLLAMA_TIMEOUT_MS` or restart the IPEX unit |

---

## What good Q-A pairs look like vs bad

### Good

```json
{"messages":[
  {"role":"user","content":"What outputOffset value must single-card Wolf Pack matrices use?"},
  {"role":"assistant","content":"Single-card Wolf Pack chassis must have outputOffset=0. Any non-zero value silently routes outputs to wrong physical TVs because the offset is added to every output number before commands go to the matrix. Lucky's 1313 shipped with outputOffset=26 on a WP-36X36 and misrouted every 'output 1' to physical 27 for weeks before being caught."}
],"source":"/home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md","chunk_id":"abc123"}
```

Why it's good: question is specific, answer quotes the exact identifier
(`outputOffset`), cites a concrete failure mode, and references the
real incident from CLAUDE.md §4.

### Bad

```json
{"q":"What is Wolf Pack?","a":"Wolf Pack is a matrix switcher."}
```

Too generic — no value-add over a Wikipedia answer. Likely to appear
on chunks that are mostly headings. Drop during curation.

```json
{"q":"What does the code do?","a":"It routes audio."}
```

Vague question + answer; teaches nothing. Usually generated from
code-heavy chunks — that's why `--include-code` is off by default.

### Curation heuristics

Keep a pair if it:
- mentions a specific identifier verbatim (function, port, IP, table)
- describes a procedure with at least one command
- captures a gotcha or failure mode
- references a per-location value

Drop a pair if it:
- restates a heading
- describes the snippet ("this code initializes…") instead of the
  domain
- gives a wrong port/IP/table name (sanity-check against the source)

---

## How to manually curate the output

The JSONL is **append-only**, so editing in place is safe — re-running
`--resume` won't duplicate already-processed chunks.

```bash
# Open in a notebook / editor
code apps/web/rag-data/qa-dataset/qa-pairs.jsonl

# Or pipe through jq for filtering
jq -c 'select(.source | contains("atlas"))' \
   apps/web/rag-data/qa-dataset/qa-pairs.jsonl \
   > /tmp/atlas-only.jsonl

# Drop a malformed line (in vim: dd; in your editor: delete that line)
# Edit a wrong answer in place — keep the messages[].content valid JSON

# After curation, validate every line still parses
while IFS= read -r line; do
  echo "$line" | jq -e . > /dev/null || echo "BAD: $line"
done < apps/web/rag-data/qa-dataset/qa-pairs.jsonl
```

Hand-author pairs are welcome — just append a line in the same shape.
The `chunk_id` field is informational only; downstream training
ignores it.

---

## Expected time + cost for full pass

| Pass type | Chunks | Wall clock | Notes |
|---|---|---|---|
| Smoke test | 10 | ~3-5 min | `--limit=10` |
| Tag-filtered subset | ~200-800 | 1-3 hrs | `--filter-tag=atlas` etc. |
| Full corpus | ~5,500 | ~38 hrs (~1.6 days) | `--limit=99999 --resume` in tmux |

Hardware assumption: Holmgren-class i9-13900HK + Intel Iris Xe iGPU
running IPEX-LLM Ollama. `qwen2.5:14b` runs at ~6-8 tok/s on that
hardware, and each chunk needs ~150-300 tokens of output, so ~15-25s
per chunk plus the 10s throttle = ~25-35s wall per chunk.

**Cost: $0.** Everything runs locally on existing hardware. No API
charges, no data leaves the box.

To run the full pass safely:

```bash
# In a long-lived tmux session
tmux new -s qa-gen
cd /home/ubuntu/Sports-Bar-TV-Controller
npx tsx scripts/generate-qa-dataset.ts --limit=99999 --resume \
  2>&1 | tee -a apps/web/rag-data/qa-dataset/run.log
# Ctrl-B D to detach. Re-attach: tmux attach -t qa-gen
```

The ledger (`seen.json`) is written after every chunk, so killing the
process mid-run loses at most one chunk's work. `--resume` will pick
up exactly where it stopped.

---

## Where the output goes + how it's used downstream

**Output path:**
`apps/web/rag-data/qa-dataset/qa-pairs.jsonl`

**Format:** one JSON object per line, Unsloth/Axolotl chat schema:

```json
{"messages":[{"role":"user","content":"..."},{"role":"assistant","content":"..."}],"source":"docs/file.md","chunk_id":"abc123"}
```

**Ledger:**
`apps/web/rag-data/qa-dataset/seen.json` — array of chunk ids already
processed. Used by `--resume`. Delete to force a full re-run.

**Downstream consumer:** the not-yet-written fine-tune pipeline will:

1. Drop the `source` + `chunk_id` fields (they're for human curation,
   not training).
2. Split into 90/10 train/eval.
3. Feed `messages[]` into Unsloth's `apply_chat_template()` against the
   `llama3.1:8b` tokenizer.
4. LoRA train, merge, quantize, deploy.

When the fine-tuned model lands, this dataset is **versioned with the
release** — `apps/web/rag-data/qa-dataset/qa-pairs.jsonl` at the merge
commit IS the training set for that model version. Don't rewrite
history.

---

## CLI flag reference

| Flag | Default | Notes |
|---|---|---|
| `--limit=N` | 100 | Max chunks this run. Use `99999` + `--resume` for full corpus. |
| `--model=NAME` | `qwen2.5:14b` | Ollama model id. Must be pulled locally. |
| `--resume` | off | Skip chunks already in `seen.json`. |
| `--filter-tag=TAG` | (none) | Only process chunks whose `techTags` include TAG (e.g. `atlas`, `shure`, `cec`). |
| `--include-code` | off | Don't skip code-heavy chunks. Lower-quality pairs — only use if specifically training on code. |

Environment overrides:

- `OLLAMA_URL` — default `http://localhost:11434`. Override to target
  a remote Ollama (e.g. another fleet box's iGPU).

---

## Troubleshooting

**"chdir → /home/ubuntu/…/apps/web" then `Cannot find module`:**
You ran the script from inside `apps/web/`. Run it from the repo root
or via the script entry — the script auto-chdirs but expects the
launch cwd to be reachable from the repo.

**Output JSONL grows but pairs look identical across runs:**
You forgot `--resume`. The script writes to the same JSONL file every
run; without `--resume` it re-processes the same chunks (because no
ledger lookup), producing near-duplicate pairs with slight wording
variations. Always use `--resume` after the first pass.

**Output JSONL doesn't grow:**
Check `[qa-gen] queue:` line in stderr. If `0 chunks`, the filters
(tag / length / code / seen) excluded everything. Loosen with
`--filter-tag=` removed or `--include-code`.

**Ollama OOM mid-run:**
The 10s throttle is the floor — if generation takes 15s, total cycle is
15s and Ollama gets no idle gap. Bump `THROTTLE_MS` in the script if
you see OOM kills in `journalctl -u ollama-ipex`.

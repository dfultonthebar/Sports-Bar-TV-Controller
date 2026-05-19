# Fine-Tune Runbook — Building the Sports Bar Domain Expert Model

> **Status:** Planning + reference doc. Not yet executed on any fleet host.
> First run target: Holmgren Way (i9-13900HK + Iris Xe), late May 2026.
> Owner: Sports Bar TV Controller AI team.
> Last reviewed: 2026-05-18.

---

## Purpose + when to use this runbook

Use this runbook when you want to turn the Sports Bar TV Controller's
~5,500 RAG chunks into a **domain-expert fine-tuned model** named
`sportsbar-expert:8b` that natively understands terminology like
`TX_MODEL`, `outputOffset`, `atlasClientManager`, `shure-rf-watcher`,
`rf_induced_mic_active`, `WP-36X36 multi-card`, the per-location wiring
quirks, and the standing rules in `CLAUDE.md`. The model is intended to
**replace `llama3.1:8b` as the default** for the AI Hub chat endpoint
(`apps/web/src/app/api/chat/route.ts` line ~52), with the existing RAG
pipeline kept active as a freshness layer on top.

Trigger this work when (a) the RAG-only grilling suite is plateauing
below ~80% PASS rate, (b) operators report the chat answers feel
"generic" or miss bar-specific jargon, or (c) the system architecture
has stabilized enough that a fine-tuned snapshot will stay accurate for
30+ days. Do NOT trigger if there are big breaking schema changes in
flight — see the decision tree at the end of this doc.

---

## The big picture

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Sports Bar Fine-Tuning Pipeline                     │
└──────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐
  │  RAG store      │   ~5,500 chunks (docs/*.md, CLAUDE.md,
  │  (vector-store) │    packages/*/README.md, schema.ts comments)
  └────────┬────────┘
           │
           │  Stage 1 — Q-A generation  (qwen2.5:14b via IPEX-LLM Ollama)
           │  scripts/generate-qa-dataset.ts
           ▼
  ┌─────────────────┐
  │  qa-pairs.jsonl │   ~5,000 question-answer pairs in ChatML format
  │  (~20 MB)       │   covering terminology, gotchas, recipes
  └────────┬────────┘
           │
           │  Stage 2 — LoRA training  (Unsloth on Iris Xe via IPEX-LLM
           │                            OR rented A100/H100)
           ▼
  ┌─────────────────┐
  │  LoRA adapter   │   ~80-200 MB (rank-16 adapter for llama-3.1-8b)
  │  (safetensors)  │
  └────────┬────────┘
           │
           │  Stage 3 — Merge + quantize to GGUF
           │  unsloth's save_pretrained_gguf() OR llama.cpp convert.py
           ▼
  ┌─────────────────────┐
  │  sportsbar-expert   │   ~4.9 GB GGUF Q4_K_M (or 8.5 GB Q8_0)
  │  -8b.gguf           │
  └────────┬────────────┘
           │
           │  Stage 4 — Wrap in Ollama Modelfile
           │  ollama create sportsbar-expert:8b -f Modelfile
           ▼
  ┌─────────────────┐
  │  Ollama model   │   Tagged, ready to be pulled by IPEX-LLM Ollama
  │  registry       │   on each fleet box.
  └────────┬────────┘
           │
           │  Stage 5 — A/B grill vs base llama3.1:8b
           │  scripts/test-rag-grill.ts
           ▼
  ┌─────────────────┐
  │  Decision       │   PASS ≥80% → switch default + ship to fleet
  │                 │   FAIL       → iterate (more data / more epochs)
  └─────────────────┘
```

The flow is **one-way**: each artifact is consumed by the next stage
and you can rerun from any stage independently once the upstream
artifact exists. For example, retraining LoRA with a tweaked
hyperparameter does NOT require regenerating the Q-A dataset.

---

## Prerequisites

### Software
- **Python 3.11** (NOT 3.12 — Unsloth + bitsandbytes wheels lag on 3.12).
- **CUDA 12.1 toolkit** if training on a rented Nvidia GPU. Not needed
  on Iris Xe — IPEX-LLM provides the SYCL/oneAPI runtime.
- **IPEX-LLM Ollama** already running locally — verify via:
  ```bash
  journalctl -u ollama-ipex | grep "using Intel GPU"
  systemctl status ollama-ipex
  ```
  If missing, run `bash scripts/setup-iris-ollama.sh` (see
  CLAUDE.md §9 for the fleet-standard install).
- **llama.cpp** for GGUF conversion + quantization. Build:
  ```bash
  git clone https://github.com/ggerganov/llama.cpp ~/llama.cpp
  cd ~/llama.cpp && make -j8
  pip install -r requirements.txt
  ```
- **Unsloth** for LoRA training. Install AFTER setting up the Python venv:
  ```bash
  python3.11 -m venv ~/.venvs/unsloth
  source ~/.venvs/unsloth/bin/activate
  pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
  pip install --upgrade transformers peft trl accelerate bitsandbytes
  ```
  On Intel iGPU also install: `pip install --pre intel-extension-for-pytorch
  --extra-index-url https://pytorch-extension.intel.com/release-whl/stable/xpu/us/`

### Hardware
- **Local Iris Xe path** (recommended for first run, free):
  - i9-13900HK or comparable with Iris Xe iGPU.
  - 32 GB system RAM minimum (Iris Xe uses shared memory).
  - ~50 GB free disk for training artifacts + intermediate checkpoints + GGUF outputs.
- **Rented GPU path** (recommended for iteration speed):
  - RunPod / Vast.ai / Modal / Paperspace — pick one with hourly billing and SSH access.
  - A100 40 GB or H100 80 GB.
  - Mount a persistent volume so you don't re-upload Q-A data each session.

### Data
- ~5,000 Q-A pairs already generated. See
  `docs/runbooks/QA_DATASET_GENERATION.md` (sibling runbook produced by
  the parallel agent). The file should be at
  `data/training/qa-pairs.jsonl` and look like:
  ```json
  {"messages":[{"role":"system","content":"You are the AI Hub..."},
                {"role":"user","content":"What is outputOffset on a single-card WP-36X36?"},
                {"role":"assistant","content":"It MUST be 0. ..."}]}
  ```
- A held-out **validation set** of ~500 pairs (10% split, kept separate
  from training) at `data/training/qa-pairs-val.jsonl`.
- The **15-question grilling suite** at `data/training/grill-suite.jsonl`
  used for the Stage 4 A/B test.

### Time
- Q-A generation (Stage 1):     **2-4 hrs**   (qwen2.5:14b on iGPU)
- LoRA training (Stage 2):       **2-8 hrs**   (Iris Xe) / 1-2 hrs (A100)
- GGUF conversion (Stage 3):     **20-40 min**
- Ollama wrapping (Stage 4):     **5 min**
- A/B grilling (Stage 5):        **30-60 min**
- **Total: 6-14 hours** for a first run; 2-4 hours for delta retrains.

---

## Cost estimate

| Option | GPU | Wall time | $$ cost | When to use |
|--------|-----|-----------|---------|-------------|
| Local Iris Xe (free) | Intel Iris Xe via IPEX-LLM | ~8-12 hrs | $0 (your power) | First run, dev iteration, no rush |
| Rented A100 40GB | RunPod community cloud | ~2 hrs | ~$3-6 | Iteration loop, hyperparam sweep |
| Rented H100 80GB | RunPod / Modal | ~1 hr | ~$3-5 | "Need it done today" |
| Cloud TPU v3-8 | Google Cloud | ~2 hrs | ~$10-15 | Only if Unsloth has TPU path (not yet stable as of 2026-05) |
| Apple M3 Max | Local MLX-LM port | ~6 hrs | $0 | Operator's laptop has it |

**Recommendation:** Start with local Iris Xe to validate the pipeline
end-to-end. Once the recipe is proven, move iteration to a rented A100
for the hyperparameter sweeps, then push the final artifact back to
the local box for the production GGUF build.

---

## Stage 1: Generate Q-A dataset

> Full details in `docs/runbooks/QA_DATASET_GENERATION.md`. This is a summary.

Q-A pairs are generated by `scripts/generate-qa-dataset.ts`, which
walks every chunk in the RAG vector store and asks `qwen2.5:14b` (the
strongest local model) to produce 2-5 question/answer pairs per chunk.
Output is ChatML-formatted JSONL ready for Unsloth.

```bash
# From repo root
npm run rag:scan                              # ensure RAG is fresh
npx tsx scripts/generate-qa-dataset.ts \
    --model qwen2.5:14b \
    --out data/training/qa-pairs.jsonl \
    --val-out data/training/qa-pairs-val.jsonl \
    --val-split 0.10 \
    --per-chunk 3
```

Expected result:
- ~5,000 train pairs + ~500 val pairs.
- File size ~15-25 MB (text only).
- Wall time on Iris Xe (qwen2.5:14b): ~3-4 hours.

**Quality gate:** spot-check 20 random rows. Reject + regenerate if more
than 2 contain hallucinated terminology not present in any of the 5,500
source chunks. Common failure: the LLM invents API endpoints that don't
exist (e.g. fake `/api/atlas/foo` URLs). Filter those out with
`scripts/validate-qa-dataset.ts` (must reference a real RAG chunk).

---

## Stage 2: LoRA fine-tuning

### Why LoRA (not full fine-tune)?

| Property | Full fine-tune | LoRA |
|---|---|---|
| GPU memory needed | ~64 GB for 8B model | ~12-16 GB |
| Disk artifact size | ~16 GB | ~80-200 MB |
| Training time | 10x longer | baseline |
| Catastrophic forgetting | severe (model "forgets" general knowledge) | minimal (base weights frozen) |
| GGUF conversion | direct | merge adapter → base → convert |
| Iteration cost | high | low (~$3-6/run) |

**LoRA is the right choice for our scale.** We have ~5,000 Q-A pairs;
that's too small for full fine-tune (would overfit hard) and too narrow
domain-wise (would erase general reasoning). LoRA rank-16 with
alpha=16 hits a sweet spot.

### Tool choice: Unsloth vs Axolotl

| | Unsloth | Axolotl |
|---|---|---|
| Intel iGPU support | YES (via IPEX-LLM + custom kernels) | partial |
| Built-in GGUF export | YES (`save_pretrained_gguf`) | manual via llama.cpp |
| Speed on Iris Xe | ~14 tok/s training | ~8 tok/s |
| Config complexity | low (Python script) | medium (YAML config) |
| Community size | growing fast | larger / more mature |

**Use Unsloth.** It's faster on our hardware and exports GGUF
in-process.

### Step-by-step

#### 2.1 — Convert Q-A pairs to ChatML format

If `scripts/generate-qa-dataset.ts` already emitted ChatML (the default
since v2.46), skip this step. Otherwise:

```bash
python3.11 scripts/convert-to-chatml.py \
    --in data/training/qa-pairs.jsonl \
    --out data/training/qa-pairs-chatml.jsonl \
    --system-prompt "You are the AI Hub for the Sports Bar TV Controller. \
                     Answer technical questions about Atlas audio processors, \
                     Wolf Pack matrix routing, Shure SLX-D wireless mics, \
                     SDR spectrum monitoring, Fire TV deep-linking, and \
                     all per-location wiring quirks. Be concrete."
```

#### 2.2 — Mix in general-instruction data (catastrophic-forgetting mitigation)

LoRA on a narrow domain corpus can degrade the model's general reasoning.
Mix in ~10% (i.e. ~500 examples) from a high-quality general-purpose
instruction set:

```bash
python3.11 scripts/mix-general-data.py \
    --domain data/training/qa-pairs-chatml.jsonl \
    --general HuggingFaceH4/ultrachat_200k \
    --general-sample 500 \
    --out data/training/qa-pairs-mixed.jsonl
```

The script downloads ultrachat from HF Hub, samples 500 conversations,
filters anything over 2048 tokens, and merges into a shuffled file.

#### 2.3 — Write the training script

Save as `scripts/train-lora.py`:

```python
import os
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import load_dataset

MAX_SEQ_LENGTH = 2048
BASE_MODEL = "unsloth/llama-3.1-8b-instruct-bnb-4bit"
DATA_FILE = "data/training/qa-pairs-mixed.jsonl"
VAL_FILE = "data/training/qa-pairs-val.jsonl"
OUTPUT_DIR = "out/sportsbar-expert-lora"

# Load base model in 4-bit (reduces memory ~4x)
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=BASE_MODEL,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=None,            # auto: bf16 on Ampere+, fp16 elsewhere
    load_in_4bit=True,
)

# Apply LoRA adapters
model = FastLanguageModel.get_peft_model(
    model,
    r=16,                  # LoRA rank — 16 is the sweet spot for 8B
    target_modules=[
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj",
    ],
    lora_alpha=16,         # alpha == rank is a safe default
    lora_dropout=0,        # 0 is fastest; Unsloth's optimized path needs this
    bias="none",
    use_gradient_checkpointing="unsloth",  # 30% memory savings
    random_state=3407,
    use_rslora=False,
    loftq_config=None,
)

# Load data
train_ds = load_dataset("json", data_files=DATA_FILE, split="train")
val_ds   = load_dataset("json", data_files=VAL_FILE,  split="train")

# Format into single-string prompts for SFT
def format_chatml(example):
    return {"text": tokenizer.apply_chat_template(
        example["messages"], tokenize=False, add_generation_prompt=False)}

train_ds = train_ds.map(format_chatml)
val_ds   = val_ds.map(format_chatml)

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=train_ds,
    eval_dataset=val_ds,
    dataset_text_field="text",
    max_seq_length=MAX_SEQ_LENGTH,
    dataset_num_proc=2,
    packing=False,
    args=TrainingArguments(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,    # effective batch size = 8
        warmup_steps=20,
        num_train_epochs=3,               # 3 is the standard starting point
        learning_rate=2e-4,               # higher than full FT because LoRA
        fp16=False,
        bf16=True,                        # use bf16 if H/W supports it
        logging_steps=10,
        eval_steps=100,
        eval_strategy="steps",
        save_strategy="steps",
        save_steps=200,
        save_total_limit=3,
        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="cosine",
        seed=3407,
        output_dir=OUTPUT_DIR,
        report_to="none",                 # set to "wandb" if you've got a key
    ),
)

print("Trainable params:", sum(p.numel() for p in model.parameters() if p.requires_grad))

trainer.train()

# Save LoRA adapter (small — ~80-200 MB)
model.save_pretrained(f"{OUTPUT_DIR}/adapter")
tokenizer.save_pretrained(f"{OUTPUT_DIR}/adapter")

# Save merged GGUF directly (Unsloth handles merge + quantize + convert)
model.save_pretrained_gguf(
    f"{OUTPUT_DIR}/gguf",
    tokenizer,
    quantization_method="q4_k_m",
)
print(f"DONE. GGUF at {OUTPUT_DIR}/gguf/")
```

#### 2.4 — Run training

```bash
source ~/.venvs/unsloth/bin/activate
cd /home/ubuntu/Sports-Bar-TV-Controller
python3.11 scripts/train-lora.py 2>&1 | tee out/training.log
```

Monitor in another terminal:
```bash
# Iris Xe utilization
intel_gpu_top
# Nvidia (if rented)
watch -n 1 nvidia-smi
# Tail the loss curve
tail -f out/training.log | grep "loss"
```

**What healthy training looks like:**
- Initial train loss: ~1.5-2.5
- After 1 epoch: ~0.8-1.2
- After 3 epochs: ~0.4-0.7
- Eval loss should track train loss within ~0.1; gap >0.3 means overfitting.
- If train loss plateaus above ~1.0 after epoch 2: lr too low or data too small.
- If train loss spikes to NaN: lr too high — restart with `lr=1e-4`.

#### 2.5 — Expected outputs

After Stage 2 completes, you should have:
```
out/sportsbar-expert-lora/
├── adapter/                         # LoRA weights (~150 MB)
│   ├── adapter_config.json
│   ├── adapter_model.safetensors
│   └── tokenizer files
├── gguf/
│   └── sportsbar-expert-8b-q4_k_m.gguf   # ~4.9 GB — feed this to Ollama
├── training.log
└── checkpoint-{200,400,600}/        # delete after final GGUF is verified
```

---

## Stage 3: GGUF → Ollama

### 3.1 — Verify the GGUF loads in raw llama.cpp first

Before wrapping in Ollama, sanity-check the file directly:

```bash
~/llama.cpp/llama-cli \
    -m out/sportsbar-expert-lora/gguf/sportsbar-expert-8b-q4_k_m.gguf \
    -p "What is outputOffset on a single-card WP-36X36 Wolf Pack?" \
    -n 200 \
    --temp 0.3 \
    --top-p 0.9
```

Expected: a coherent answer mentioning `outputOffset MUST be 0` and
`MATRIX_SINGLE_CARD=true`. If it produces gibberish, the LoRA didn't
merge properly — re-run Stage 2 with `save_method="merged_16bit"`
before the GGUF export.

### 3.2 — Write the Modelfile

Save as `models/sportsbar-expert/Modelfile`:

```
FROM ./sportsbar-expert-8b-q4_k_m.gguf

# System prompt — sets the model's persona + scope
SYSTEM """You are the AI Hub for the Sports Bar TV Controller, a Next.js 16 \
monorepo that controls AV hardware at multiple sports bar locations. You \
have deep knowledge of: Atlas audio processors (AZMP4/8, JSON-RPC port 5321, \
UDP meters 3131), Wolf Pack HDMI matrix (outputOffset gotcha, single-card vs \
multi-card), Crestron DM switchers (output slot offset 17/33/65), Shure SLX-D \
wireless mics (TX_MODEL, GROUP_CHANNEL, RSSI ghost-carrier detection), \
RTL-SDR spectrum monitoring, Fire TV deep-linking via ADB (com.amazon.firebat \
launcher-hosted Prime Video), Drizzle ORM schema (~85 tables), per-location \
wiring quirks (Holmgren / Graystone / Lucky's / Stoneyard / Leg Lamp), and \
the standing rules from CLAUDE.md. Answer concretely. When unsure, say so \
and recommend running the relevant `scripts/*.sh` verifier."""

# Sampling defaults — low temperature for technical accuracy
PARAMETER temperature 0.3
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER repeat_penalty 1.1
PARAMETER num_ctx 4096

# Stop tokens — match the Llama 3.1 chat template
PARAMETER stop "<|eot_id|>"
PARAMETER stop "<|start_header_id|>"
PARAMETER stop "<|end_header_id|>"

# Use the Llama 3.1 chat template
TEMPLATE """<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{ .System }}<|eot_id|><|start_header_id|>user<|end_header_id|>

{{ .Prompt }}<|eot_id|><|start_header_id|>assistant<|end_header_id|>

"""
```

### 3.3 — Create the Ollama model

```bash
cd models/sportsbar-expert
ollama create sportsbar-expert:8b -f Modelfile
# Verify
ollama list | grep sportsbar-expert
# Smoke test
ollama run sportsbar-expert:8b "What does outputOffset do?"
```

If the smoke test answer is correct + concrete, Stage 3 is done.

### 3.4 — Push to a registry (optional, for fleet rollout)

Two options:

- **Hugging Face Hub (public or private repo):**
  ```bash
  huggingface-cli login
  huggingface-cli upload sgtfulton/sportsbar-expert-8b \
      out/sportsbar-expert-lora/gguf/sportsbar-expert-8b-q4_k_m.gguf
  ```
  Then each location:
  ```bash
  wget https://huggingface.co/sgtfulton/sportsbar-expert-8b/resolve/main/sportsbar-expert-8b-q4_k_m.gguf
  ollama create sportsbar-expert:8b -f Modelfile
  ```

- **Self-hosted GGUF mirror** (preferred for fleet privacy — no upload
  outside the organization):
  Push the GGUF to an internal S3 bucket / Tailscale-shared NFS / SFTP
  drop, then have each location pull via `scripts/pull-sportsbar-expert.sh`.

---

## Stage 4: A/B testing

The acceptance gate is the existing 15-question RAG grilling suite at
`data/training/grill-suite.jsonl`. The base model + RAG currently
passes ~50%. We need the fine-tuned model to pass **≥80%** to ship.

### 4.1 — Run the grill twice

```bash
# Baseline run
OLLAMA_MODEL=llama3.1:8b \
    npx tsx scripts/test-rag-grill.ts \
    --out out/grill-baseline.json

# Fine-tuned run
OLLAMA_MODEL=sportsbar-expert:8b \
    npx tsx scripts/test-rag-grill.ts \
    --out out/grill-finetuned.json
```

### 4.2 — Compare scorecards

```bash
npx tsx scripts/compare-grill-results.ts \
    --baseline out/grill-baseline.json \
    --candidate out/grill-finetuned.json
```

Expected output:
```
Question                              Baseline  Fine-tuned   Δ
─────────────────────────────────────────────────────────────────
TX_MODEL vs TX_TYPE                      FAIL     PASS       +1
outputOffset single-card WP-36X36        PARTIAL  PASS       +1
rf_induced_mic_active source             FAIL     PASS       +1
Atlas client singleton hoisting          PARTIAL  PASS       +1
Channel 308 alias suffix                 FAIL     PASS       +1
SDR sweep band auto mode                 FAIL     PASS       +1
... (9 more)
─────────────────────────────────────────────────────────────────
TOTAL                                    8/15     13/15
                                         53%      87%       +34 pp
```

### 4.3 — Decision matrix

| Fine-tuned score | Action |
|---|---|
| ≥80% (12/15+) | Ship — proceed to Stage 5 |
| 60-79% (9-11/15) | Iterate: more epochs (try 5) OR more data (regenerate Q-A with `--per-chunk 5`) OR LoRA rank 32 |
| <60% (0-8/15) | Investigate. Likely upstream: Q-A dataset quality bad, or base model wrong (try `llama-3.1-8b-instruct` not the bnb-4bit variant). DO NOT ship. |

### 4.4 — Switch the default in code

Once the candidate passes:

```bash
# Edit apps/web/src/app/api/chat/route.ts around line 52
# Change:
#   const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1:8b'
# To:
#   const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'sportsbar-expert:8b'
```

Commit with version bump:
```
v2.47.0: AI Hub default model → sportsbar-expert:8b (fine-tuned, 87% grill PASS)
```

---

## Stage 5: Production deployment

### 5.1 — Add a VERSION_SETUP_GUIDE.md entry

Per Standing Rule #8, every version bump that requires per-location
action gets an entry. This one needs each location to pull the new GGUF
and create the Ollama model.

Template entry (copy into `docs/VERSION_SETUP_GUIDE.md`):

```markdown
### v2.47.0 — sportsbar-expert:8b fine-tuned model

**Required manual steps per location:**

1. Pull the GGUF from the internal mirror:
   ```bash
   wget -O /tmp/sportsbar-expert-8b-q4_k_m.gguf \
       https://<mirror>/sportsbar-expert-8b-q4_k_m.gguf
   ```
2. Create the Ollama model:
   ```bash
   cd /tmp && cp /home/ubuntu/Sports-Bar-TV-Controller/models/sportsbar-expert/Modelfile .
   ollama create sportsbar-expert:8b -f Modelfile
   ```
3. Verify it loads on Iris Xe:
   ```bash
   ollama run sportsbar-expert:8b "What is outputOffset?"
   # Should answer in <5s with iGPU acceleration.
   journalctl -u ollama-ipex --since "1 minute ago" | grep "using Intel GPU"
   ```
4. (Optional) Override env if you want to A/B locally:
   ```bash
   echo "OLLAMA_MODEL=sportsbar-expert:8b" >> /home/ubuntu/Sports-Bar-TV-Controller/.env
   pm2 restart sports-bar-tv-controller --update-env
   ```
   Default is already `sportsbar-expert:8b` in code, so this only
   matters if you want to roll back to `llama3.1:8b`.

**Rollback:** `OLLAMA_MODEL=llama3.1:8b` in `.env`, then
`pm2 restart sports-bar-tv-controller --update-env`. The base model
stays installed; nothing is destructive.

**Disk impact:** +4.9 GB for the new GGUF. Keep `llama3.1:8b` for
rollback (+4.7 GB) until the fine-tuned model has 2 weeks of
production proof.
```

### 5.2 — Keep RAG indexing active

The fine-tuned model knows everything baked into the training corpus
**as of the day Q-A generation ran**. New docs, new commits, new
hardware quirks won't be in the weights. RAG fills that gap:

- The chat route still runs `queryDocs()` first to retrieve top-k
  chunks.
- Those chunks are injected as `context:` in the prompt.
- The fine-tuned model is BETTER at using the retrieved context because
  it speaks the same jargon natively — terminology like `TX_MODEL` no
  longer confuses it.

Empirically (in the literature and our limited testing): fine-tuned
model + RAG > fine-tuned alone > base + RAG > base alone.

---

## Re-training cadence

| Trigger | Effort | Process |
|---|---|---|
| **Monthly** | ~4 hrs | Regenerate Q-A from changed/new chunks only (delta), continue LoRA from latest adapter checkpoint, re-export GGUF. Push as `sportsbar-expert:8b-vYYYY-MM`. |
| **Quarterly** | ~8 hrs | Full rebuild from scratch — fresh Q-A from entire RAG store, train new LoRA from the base model, evaluate against expanded grill suite. Push as `sportsbar-expert:8b-vYYYY-QN`. |
| **Major architecture change** (new package, new device family, schema migration > 5 tables) | ~8 hrs | Immediate full rebuild. Don't let the fine-tuned model drift. |
| **CLAUDE.md gotcha addition** | ~30 min | Optional delta train, OR just rely on RAG until next monthly. The new gotcha will reach the operator via RAG retrieval regardless. |

Add a calendar reminder. The fleet auto-update can detect a stale
`sportsbar-expert:8b` tag (>35 days since creation) and post a Sync-tab
warning prompting "Time to re-train" — implement in
`scripts/auto-update.sh` Checkpoint C.

---

## Risks + mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Catastrophic forgetting (model forgets how to handle non-bar questions) | Medium | Medium | Mix in 10% UltraChat in Stage 2.2. Use LoRA (not full FT). Keep base model installed for fallback. |
| Overfitting on doc text (memorizes verbatim, can't generalize) | Medium | High | Use diverse Q-A phrasing (Stage 1 prompt asks for paraphrases). LoRA dropout=0 is fine because Unsloth's optimized kernels handle regularization; if seeing overfit, set dropout=0.05. Early stopping at eval_loss plateau. |
| Hallucination on out-of-distribution queries (operator asks something the docs never covered) | High | Medium | RAG still active as the freshness layer — even unknown queries get retrieved context. Add an "I'm not sure, run `scripts/X.sh` to check" pattern to the system prompt. |
| Quantization quality loss (Q4_K_M loses too much vs FP16) | Low | Medium | A/B test Q4_K_M vs Q5_K_M vs Q8_0 in Stage 4. Q4_K_M is usually fine for 8B models; Q5_K_M is the conservative fallback. Disk cost: Q4_K_M 4.9 GB, Q5_K_M 5.7 GB, Q8_0 8.5 GB. |
| Training OOM on Iris Xe (shared RAM exhausted) | Medium | Low | Reduce `per_device_train_batch_size` to 1, bump `gradient_accumulation_steps` to 8. Effective batch size unchanged, peak memory halved. |
| GGUF won't load in IPEX-LLM Ollama | Low | High | Test the GGUF with `llama.cpp` raw first (Stage 3.1). If it works there but Ollama rejects it, the Modelfile template is wrong — match the Llama 3.1 chat template exactly. |
| Per-location wiring quirk gets baked into a fact other locations would contradict | Medium | Medium | Q-A generator must scope per-location facts ("At Holmgren Way, X is Y") not as universal facts. Add a system-prompt sanity check: "ALWAYS qualify location-specific claims with the location name." |
| Operator at a different location runs the model and gets answers about Holmgren they shouldn't trust | Low | Medium | Document the per-location qualifier rule. Long-term: train per-location variants if needed (`sportsbar-expert:8b-holmgren`). |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Training OOM after a few steps | Batch size too big for shared RAM on Iris Xe | Reduce `per_device_train_batch_size` to 1 and bump `gradient_accumulation_steps` to 8. |
| Loss = NaN after a few steps | Learning rate too high; bf16 instability | Retry with `lr=1e-4`. If still NaN, switch to fp16 with loss scaling. |
| Model output is gibberish after training | LoRA didn't merge into base before GGUF export | Re-run with `model.save_pretrained_merged("...", tokenizer, save_method="merged_16bit")` before `save_pretrained_gguf`. |
| GGUF won't load in Ollama: "invalid magic" | Wrong llama.cpp version (older than the model's GGUF version) | Rebuild llama.cpp from latest main: `cd ~/llama.cpp && git pull && make clean && make -j8`. |
| GGUF loads but answers are off-topic | System prompt mismatch | Verify Modelfile SYSTEM block matches the system prompt used in Q-A generation. Inconsistency between training-time and inference-time system prompts confuses the model. |
| Chat template error from Ollama: "expected `<\|eot_id\|>`" | Modelfile TEMPLATE block is wrong | Copy the exact template from `ollama show llama3.1:8b --modelfile`. Don't write one from scratch. |
| iGPU not used during training (low intel_gpu_top busy %) | IPEX not installed or wrong PyTorch backend | Verify `python3.11 -c "import torch; print(torch.xpu.is_available())"` returns True. If False, reinstall the Intel PyTorch extension. |
| Eval loss diverges (train ↓, eval ↑) after epoch 2 | Overfitting | Reduce to 2 epochs, OR add `lora_dropout=0.05`, OR generate more diverse Q-A pairs in Stage 1. |
| Model "forgets" general knowledge ("what is 2+2") | Catastrophic forgetting | Mix in more UltraChat (try 20% instead of 10%) and retrain. |
| Ollama model runs on CPU not GPU | `ollama-ipex` service down or model loaded by wrong daemon | `systemctl status ollama-ipex`; if upstream `ollama.service` is also running, disable it: `systemctl disable --now ollama`. |
| A/B grill shows REGRESSION on some questions | Q-A dataset had wrong answers for those topics | Find the offending Q-A pairs (`grep` for the question keywords in qa-pairs.jsonl), fix them or remove them, retrain. |
| `ollama create` hangs at "creating model layer" | Disk full or wrong path in Modelfile FROM line | `df -h`; verify GGUF path is correct + readable; check `/usr/share/ollama/.ollama/models/` has space. |
| Inference latency higher than base llama3.1:8b | Different quantization (Q5_K_M vs Q4_K_M) | Re-quantize to Q4_K_M; should match base model speed within ~10%. |

---

## Decision tree: should we even fine-tune?

Walk through these gates in order. Stop at the first NO.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Is RAG-only grill score < 80%?                           │
│    Run: npx tsx scripts/test-rag-grill.ts                   │
│                                                              │
│    NO  → Fine-tune won't help. Spend the time fixing docs.  │
│    YES → Continue ↓                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Are the RAG misses BECAUSE the model doesn't know the    │
│    jargon, or because the docs themselves don't cover it?   │
│    (Read 5 failing answers. Did the retrieved context       │
│    contain the correct answer? If YES, fine-tune helps.     │
│    If NO, fix docs.)                                         │
│                                                              │
│    DOCS GAP → Fix docs, re-scan RAG, re-run grill. STOP.    │
│    JARGON GAP → Continue ↓                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Do we have ≥3000 high-quality Q-A pairs?                 │
│    Check: wc -l data/training/qa-pairs.jsonl                │
│                                                              │
│    NO  → Run Stage 1 first. Generate at least 3K pairs.     │
│    YES → Continue ↓                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Do we have GPU access?                                   │
│    Local Iris Xe (slow but free) OR rented A100/H100?       │
│                                                              │
│    NO  → Queue this task; check back when GPU available.    │
│    YES → Continue ↓                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Is the system stable (no breaking arch changes for       │
│    next 30 days)?                                           │
│    Check: git log --since="7 days ago" --oneline | wc -l    │
│    If >50 commits, system is churning fast — model would    │
│    go stale in days.                                        │
│                                                              │
│    NO  → Wait until things calm down. Fine-tune later.      │
│    YES → GO. Start at Stage 1.                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Appendix A: Useful resources

- **Unsloth notebooks + docs:** https://github.com/unslothai/unsloth — official LoRA + GGUF export examples for Llama 3.1.
- **llama.cpp GGUF tooling:** https://github.com/ggerganov/llama.cpp — `convert_hf_to_gguf.py`, `llama-quantize`, `llama-cli`.
- **Ollama Modelfile reference:** https://github.com/ollama/ollama/blob/main/docs/modelfile.md — full grammar for FROM, SYSTEM, TEMPLATE, PARAMETER, ADAPTER directives.
- **IPEX-LLM training docs:** https://ipex-llm.readthedocs.io/ — Intel's PyTorch extension for Iris Xe / Arc / Max GPUs.
- **HuggingFace PEFT (LoRA library Unsloth wraps):** https://huggingface.co/docs/peft
- **TRL (SFTTrainer from):** https://huggingface.co/docs/trl
- **bitsandbytes (4-bit quantization for training):** https://github.com/TimDettmers/bitsandbytes
- **RunPod community cloud (rented GPU):** https://www.runpod.io/console/gpu-cloud
- **Vast.ai (cheaper but flakier rented GPU):** https://vast.ai/
- **Modal (serverless GPU, billed per second):** https://modal.com/

---

## Appendix B: Related runbooks + docs

- `docs/runbooks/QA_DATASET_GENERATION.md` — Stage 1 in full detail (sibling runbook).
- `docs/AI_OPERATIONS_HUB_DESIGN.md` — overall AI Hub architecture this model plugs into.
- `docs/AI_MODELS_SETUP.md` — current model inventory (`llama3.1:8b`, `nomic-embed-text`, `qwen2.5:14b`).
- `scripts/setup-iris-ollama.sh` — IPEX-LLM Ollama install (Stage 0 prerequisite).
- `scripts/test-rag-grill.ts` — the 15-question A/B grilling suite.
- `apps/web/src/app/api/chat/route.ts` — where `OLLAMA_MODEL` is read (line ~52).
- `CLAUDE.md` §7 (RAG Documentation Server) — RAG architecture this fine-tune complements.
- `CLAUDE.md` §9 (AI Scheduling Intelligence — Ollama runtime) — IPEX-LLM Ollama context.
- `docs/VERSION_SETUP_GUIDE.md` — where the per-location rollout entry goes.

---

## Appendix C: Glossary

- **Base model:** the original `llama3.1:8b` from Meta, distributed via Ollama. ~4.7 GB.
- **LoRA (Low-Rank Adaptation):** trains a small "adapter" (a few hundred MB) on top of a frozen base model. Reduces training cost ~10x vs full fine-tune.
- **Rank (LoRA r):** dimensionality of the adapter. Higher = more capacity but more memory + risk of overfit. 16 is the sweet spot for 8B base models on ~5K examples.
- **Alpha (LoRA α):** scaling factor for the adapter. Common practice: alpha = rank.
- **GGUF:** binary format for quantized LLMs, consumed by llama.cpp + Ollama. Successor to GGML.
- **Q4_K_M:** 4-bit quantization with K-means clustering, medium variant. Best size/quality tradeoff for 8B models.
- **ChatML:** OpenAI's structured message format (`<|im_start|>user`...`<|im_end|>`). Unsloth uses Llama 3.1's variant (`<|begin_of_text|><|start_header_id|>...`).
- **Catastrophic forgetting:** when fine-tuning narrows the model so much it forgets general knowledge.
- **Grilling suite:** our 15-question regression test for the AI Hub. Lives at `data/training/grill-suite.jsonl`.
- **Delta-LoRA / delta retrain:** training a new LoRA from an existing LoRA checkpoint (not from base), as a cheap incremental update.

---

*End of runbook. Last updated 2026-05-18 alongside `docs/AI_OPERATIONS_HUB_DESIGN.md`.*

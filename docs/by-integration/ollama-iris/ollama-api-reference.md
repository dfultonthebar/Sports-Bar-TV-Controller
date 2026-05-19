# Ollama REST API Reference (with IPEX-LLM Intel iGPU notes)

- **Sources:**
  - https://github.com/ollama/ollama/blob/main/docs/api.md
  - https://github.com/intel-analytics/ipex-llm/blob/main/docs/mddocs/Quickstart/ollama_portable_zip_quickstart.md
  - IPEX-LLM release: https://github.com/ipex-llm/ipex-llm/releases/tag/v2.3.0-nightly
- **Fetched:** 2026-05-18

> The Sports Bar TV Controller fleet runs the **IPEX-LLM Ollama portable build** on Intel Iris Xe iGPU laptops for ~5x speedup over upstream CPU-only Ollama. Setup is one-shot via `scripts/setup-iris-ollama.sh`. See CLAUDE.md §9.

---

## Base URL

```
http://localhost:11434
```

No auth. Port-bound to localhost by default — DO NOT expose to LAN without putting an Nginx allow-list in front (same pattern as the `:3002` bartender proxy).

---

## POST /api/generate — single-turn completion

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

### Request

```jsonc
{
  "model": "llama3.1:8b",
  "prompt": "...",
  "suffix": "...",                 // optional text after model output
  "images": ["<base64>"],          // for multimodal models
  "format": "json",                // forces JSON output
  "raw": false,                    // skip template wrapping
  "stream": true,                  // default; set false for single response
  "keep_alive": "5m",              // how long to keep model in VRAM after request
  "options": {
    "temperature": 0.7,
    "top_p": 0.9,
    "top_k": 40,
    "num_predict": 128,            // max tokens
    "num_ctx": 4096,               // context window
    "seed": 42,
    "stop": ["\n\n"]
  }
}
```

### Response (streaming, newline-delimited JSON)

```
{"model":"llama3.1:8b","created_at":"...","response":"The","done":false}
{"model":"llama3.1:8b","response":" sky","done":false}
{"model":"llama3.1:8b","response":"","done":true,
 "total_duration":10706818083,"load_duration":6338219291,
 "prompt_eval_count":26,"prompt_eval_duration":130079000,
 "eval_count":259,"eval_duration":4232710000,
 "context":[1,2,3]}
```

All durations in **nanoseconds**. Divide by 1e9 for seconds. `eval_count / (eval_duration / 1e9)` = generation tok/s.

---

## POST /api/chat — multi-turn chat

```bash
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.1:8b",
  "messages": [
    {"role": "system", "content": "You are a sports bar manager."},
    {"role": "user",   "content": "What's on tonight?"}
  ]
}'
```

### Request

```jsonc
{
  "model": "llama3.1:8b",
  "messages": [
    { "role": "system" | "user" | "assistant" | "tool",
      "content": "...",
      "images": ["<base64>"]      // optional
    }
  ],
  "tools": [                       // optional function-calling
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "...",
        "parameters": { "type": "object", "properties": {...}, "required": [...] }
      }
    }
  ],
  "stream": true,
  "format": "json",
  "keep_alive": "5m",
  "options": { /* same as /api/generate */ }
}
```

### Response

```jsonc
{
  "model": "llama3.1:8b",
  "message": {
    "role": "assistant",
    "content": "...",
    "tool_calls": [
      { "function": { "name": "get_weather", "arguments": {"city":"GB"} } }
    ]
  },
  "done": true,
  "total_duration": ..., "eval_count": ..., "eval_duration": ...
}
```

---

## POST /api/embed — embeddings (current)

```bash
curl http://localhost:11434/api/embed -d '{
  "model": "nomic-embed-text",
  "input": "Why is the sky blue?"
}'
```

### Request

```jsonc
{
  "model": "nomic-embed-text",
  "input": "..." | ["str1", "str2"],
  "truncate": true,
  "dimensions": 768,
  "keep_alive": "5m"
}
```

### Response

```jsonc
{
  "model": "nomic-embed-text",
  "embeddings": [
    [0.0100, -0.0017, 0.0500, ...]
  ],
  "total_duration": 14143917,
  "load_duration": 1019500,
  "prompt_eval_count": 8
}
```

> Used by the RAG server (`apps/web/src/lib/rag-server/`) — model `nomic-embed-text`, 768-dim. See CLAUDE.md §7.

---

## POST /api/embeddings — DEPRECATED

Legacy single-string endpoint. Different response shape:

```jsonc
{ "embedding": [0.567, 0.009, ...] }
```

Prefer `/api/embed` for new code.

---

## GET /api/tags — list local models

```bash
curl http://localhost:11434/api/tags
```

```jsonc
{
  "models": [
    {
      "name": "llama3.1:8b",
      "model": "llama3.1:8b",
      "modified_at": "2026-05-04T17:37:44.706Z",
      "size": 2019393189,
      "digest": "a80c4f17...",
      "details": {
        "format": "gguf", "family": "llama", "families": ["llama"],
        "parameter_size": "8.0B", "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

---

## GET /api/ps — list models currently loaded in (V)RAM

```bash
curl http://localhost:11434/api/ps
```

```jsonc
{
  "models": [
    {
      "name": "llama3.1:8b",
      "size": 5137025024,
      "size_vram": 5137025024,    // bytes resident in GPU memory
      "expires_at": "2026-05-18T14:38:31Z",
      "details": { ... }
    }
  ]
}
```

> **IPEX-LLM quirk:** `size_vram` often reports `0` even when the model IS loaded on the Intel iGPU. Don't rely on this field for "is GPU acceleration working?". Use `intel_gpu_top` or check the server log for `using Intel GPU` instead. (See feedback memory: `feedback_ipex_llm_sycl_quirks.md`.)

---

## POST /api/show — model metadata

```bash
curl http://localhost:11434/api/show -d '{"model":"llama3.1:8b"}'
```

Returns Modelfile, parameters, template, capabilities (`completion`, `vision`, `embedding`, `tools`).

---

## POST /api/pull / push / DELETE /api/delete / POST /api/copy

```bash
curl http://localhost:11434/api/pull -d '{"model":"llama3.1:8b"}'        # streaming progress
curl http://localhost:11434/api/push -d '{"model":"user/model:tag"}'
curl -X DELETE http://localhost:11434/api/delete -d '{"model":"old:tag"}'
curl http://localhost:11434/api/copy -d '{"source":"a","destination":"b"}'
```

`pull` and `push` stream progress as newline-delimited JSON:

```
{"status":"pulling manifest"}
{"status":"pulling digestname","digest":"...","total":2142590208,"completed":241970}
{"status":"verifying sha256 digest"}
{"status":"writing manifest"}
{"status":"success"}
```

---

## Options reference

| Field | Type | Notes |
|---|---|---|
| `temperature` | float | 0.0–1.0+ |
| `top_p`, `top_k`, `min_p`, `typical_p` | sampling | |
| `num_predict` | int | Max tokens out (`-1` = unlimited until stop) |
| `num_ctx` | int | Context window — defaults to 2048, set higher for long docs |
| `num_keep` | int | Tokens of prompt to always keep on context overflow |
| `repeat_penalty`, `presence_penalty`, `frequency_penalty` | float | |
| `seed` | int | Reproducibility |
| `stop` | string[] | Stop sequences |
| `num_gpu` | int | Layers to offload to GPU |
| `num_thread`, `num_batch`, `use_mmap`, `numa` | perf | |

---

## IPEX-LLM (Intel iGPU) specifics

### Supported hardware

- Intel Core Ultra
- Intel Core 11th–14th gen (we use 13th gen Iris Xe on the fleet)
- Intel Arc A / B-series GPU

### One-time setup

Fleet uses `scripts/setup-iris-ollama.sh` which:
1. Downloads the IPEX-LLM portable `.tgz` from the v2.3.0-nightly release
2. Stops/disables upstream Ollama systemd unit
3. Installs `ollama-ipex` systemd unit pointing at the IPEX binary
4. Sets `OLLAMA_MODELS=/usr/share/ollama/.ollama/models` so existing models survive
5. Verifies `clinfo` shows an Intel platform; refuses on AMD/NVIDIA

### Key env vars (in the systemd unit)

| Var | Value | Why |
|---|---|---|
| `OLLAMA_MODELS` | `/usr/share/ollama/.ollama/models` | Reuse upstream model cache |
| `ONEAPI_DEVICE_SELECTOR` | `level_zero:0` | Pin to first Intel device |
| `SYCL_CACHE_PERSISTENT` | `1` | Persist SYCL JIT cache across restarts |
| `OLLAMA_NUM_PARALLEL` | `1` | Reduce VRAM pressure on shared iGPU |
| `OLLAMA_NUM_CTX` | `16384` | Larger default than upstream's 2048 |

### Verify GPU acceleration

```bash
journalctl -u ollama-ipex | grep -i "using Intel GPU"
# OR live:
intel_gpu_top                          # watch Render/3D usage spike during inference
```

### Performance (Iris Xe 13th gen, our fleet)

| Model | tok/s (IPEX iGPU) | tok/s (upstream CPU) |
|---|---|---|
| `llama3.1:8b` Q4 | ~14 | ~3 |
| `qwen2.5:14b` Q4 | ~6 | ~1 |
| `nomic-embed-text` | embeddings ~200ms for 750-token chunk | similar |

### Known IPEX limitations

- Based on Ollama v0.6.2 (some newer models backported, but not all)
- Default ctx is 2048 unless you set `OLLAMA_NUM_CTX`
- `ollama ps` `size_vram` field unreliable (see above)
- Some Q5/Q6 quants slower than Q4 on iGPU due to memory bandwidth — prefer Q4_K_M

---

## Notes for this codebase

- **AI Suggest** (`/api/scheduling/ai-suggest`): default model `llama3.1:8b`, 300s server-side timeout, ~100s typical on iGPU. The Nginx allow-list at `:3002` has `proxy_read_timeout 300s` to match — don't shorten it without also lowering the AI side.
- **RAG server** (`packages/lib/rag-server/`): embed with `nomic-embed-text`, generate with `llama3.1:8b`. 750-token chunks, 100-token overlap.
- **Streaming JSON parsing pitfall:** `fetch().body` in Node 22 doesn't auto-split newlines — you MUST buffer and split on `\n` yourself. Don't try to `JSON.parse(text)` mid-stream.
- **Model warmup:** first request after server start eats `load_duration` (~6s for 8B on iGPU). Send a 1-token `Hello` warmup at startup if your UX can't absorb that.

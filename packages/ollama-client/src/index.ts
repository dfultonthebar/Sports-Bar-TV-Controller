/**
 * Remote-first Ollama client with automatic local fallback.
 *
 * Policy:
 *  - 'remote-first' : use the central GPU Ollama when the breaker is open; fall
 *                     back to local on a connection-layer failure.
 *  - 'local-only'   : always the box's own Ollama (skips the breaker entirely).
 *  - 'local-first'  : treated as local-only here (reserved for future use).
 *
 * Fallback rule: we only fall back to local on a *connection* error (ECONNREFUSED,
 * ENOTFOUND, connect timeout, reset) — these fail fast. A slow but connected remote
 * (a long generation) is NOT a connection error and must NOT trigger fallback. For
 * streaming, the connection either fails before the first chunk (safe to fall back)
 * or it succeeds and we never fall back mid-stream (would corrupt the caller's SSE).
 *
 * SAFE DEFAULT: OLLAMA_REMOTE_BASE unset ⇒ everything resolves local (no behavior change).
 */
import { OLLAMA_LOCAL_BASE, OLLAMA_REMOTE_BASE, hasRemote } from './config'
import { remoteIsUp, tripRemote, probeRemote, circuitSnapshot } from './circuit-breaker'

export type OllamaPolicy = 'remote-first' | 'local-first' | 'local-only'

export interface OllamaCallOpts {
  policy?: OllamaPolicy
  timeoutMs?: number
  /** Tag for logging which feature made the call. */
  feature?: string
  /** Forwarded as `keep_alive` on the request body when set (e.g. -1 to pin a
   *  model resident locally). Omitted when undefined so callers that don't care
   *  keep Ollama's default idle timer. */
  keepAlive?: number
}

export interface GenerateResult {
  response: string
  eval_count?: number
  prompt_eval_count?: number
  done_reason?: string
}

/** Resolve the base URL to use right now for the given policy. */
export function resolveOllamaBase(policy: OllamaPolicy = 'remote-first'): string {
  if (policy === 'local-only' || policy === 'local-first' || !hasRemote()) return OLLAMA_LOCAL_BASE
  return remoteIsUp() ? OLLAMA_REMOTE_BASE : OLLAMA_LOCAL_BASE
}

/** True for fast connection-layer failures (not slow generations / HTTP errors). */
export function isConnectionError(e: unknown): boolean {
  const err = e as any
  // fetch() throws `TypeError: fetch failed` ONLY on network-layer failures
  // (DNS/refused/reset/TLS). HTTP 4xx/5xx return a Response, so a plain Error
  // from our rawFetch !res.ok check is NOT this — and must not trigger fallback.
  if (err instanceof TypeError && /fetch failed/i.test(String(err?.message))) return true
  const codes: string[] = []
  if (err?.code) codes.push(String(err.code))
  if (err?.cause?.code) codes.push(String(err.cause.code))
  if (Array.isArray(err?.cause?.errors)) for (const x of err.cause.errors) if (x?.code) codes.push(String(x.code))
  if (codes.some((c) => /ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ECONNRESET|EAI_AGAIN|UND_ERR_CONNECT/.test(c)))
    return true
  const name = String(err?.cause?.name || err?.name || '')
  return name === 'ConnectTimeoutError'
}

async function rawFetch(base: string, path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${base}${path}`, init)
  if (!res.ok) {
    const body = await res.text().catch(() => 'unknown')
    throw new Error(`Ollama ${res.status} @ ${base}${path}: ${body.slice(0, 200)}`)
  }
  return res
}

/**
 * POST a non-streaming JSON request, with remote→local fallback on connection error.
 * Returns the parsed JSON body plus which base actually served it.
 */
async function postJsonWithFallback(
  path: string,
  payload: Record<string, unknown>,
  opts: OllamaCallOpts,
): Promise<{ data: any; base: string }> {
  const policy = opts.policy ?? 'remote-first'
  const timeoutMs = opts.timeoutMs
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  }
  const useRemote = policy === 'remote-first' && hasRemote() && remoteIsUp()
  const primary = useRemote ? OLLAMA_REMOTE_BASE : OLLAMA_LOCAL_BASE
  try {
    const res = await rawFetch(primary, path, init)
    return { data: await res.json(), base: primary }
  } catch (e) {
    if (useRemote && isConnectionError(e)) {
      tripRemote()
      const res = await rawFetch(OLLAMA_LOCAL_BASE, path, {
        ...init,
        ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
      })
      return { data: await res.json(), base: OLLAMA_LOCAL_BASE }
    }
    throw e
  }
}

/** Non-streaming /api/generate. */
export async function ollamaGenerate(
  params: {
    model: string
    prompt: string
    format?: 'json'
    options?: Record<string, unknown>
    keep_alive?: number
  },
  opts: OllamaCallOpts = {},
): Promise<GenerateResult> {
  const { data } = await postJsonWithFallback('/api/generate', { ...params, stream: false }, opts)
  return {
    response: (data?.response ?? '').toString(),
    eval_count: typeof data?.eval_count === 'number' ? data.eval_count : undefined,
    prompt_eval_count: typeof data?.prompt_eval_count === 'number' ? data.prompt_eval_count : undefined,
    done_reason: data?.done_reason,
  }
}

/** Non-streaming /api/chat — returns the assistant message (native tool-call support). */
export async function ollamaChat(
  params: {
    model: string
    messages: Array<{ role: string; content: string }>
    tools?: unknown[]
    options?: Record<string, unknown>
    keep_alive?: number
  },
  opts: OllamaCallOpts = {},
): Promise<{ content: string; tool_calls?: unknown[] }> {
  const { data } = await postJsonWithFallback('/api/chat', { ...params, stream: false }, opts)
  const msg = data?.message ?? {}
  return {
    content: (msg?.content ?? '').toString(),
    tool_calls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : undefined,
  }
}

/** Batch embeddings via /api/embed (new) with /api/embeddings legacy fallback. */
export async function ollamaEmbed(
  texts: string[],
  model: string,
  opts: OllamaCallOpts = {},
): Promise<number[][]> {
  const ka = opts.keepAlive !== undefined ? { keep_alive: opts.keepAlive } : {}
  try {
    const { data } = await postJsonWithFallback('/api/embed', { model, input: texts, ...ka }, opts)
    if (Array.isArray(data?.embeddings)) return data.embeddings
  } catch {
    /* fall through to legacy single-input endpoint */
  }
  const out: number[][] = []
  for (const text of texts) {
    const { data } = await postJsonWithFallback('/api/embeddings', { model, prompt: text, ...ka }, opts)
    out.push(data?.embedding ?? [])
  }
  return out
}

async function* streamLines(res: Response): AsyncGenerator<any> {
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) {
        try {
          yield JSON.parse(line)
        } catch {
          /* skip partial/invalid line */
        }
      }
    }
  }
  if (buf.trim()) {
    try {
      yield JSON.parse(buf.trim())
    } catch {
      /* ignore */
    }
  }
}

/**
 * Open a streaming request with remote→local fallback ONLY before the first byte.
 * Once the response object is returned (connection established), we commit to it —
 * never switch hosts mid-stream.
 */
async function openStreamWithFallback(
  path: string,
  payload: Record<string, unknown>,
  opts: OllamaCallOpts,
): Promise<Response> {
  const policy = opts.policy ?? 'remote-first'
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
    ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
  }
  const useRemote = policy === 'remote-first' && hasRemote() && remoteIsUp()
  const primary = useRemote ? OLLAMA_REMOTE_BASE : OLLAMA_LOCAL_BASE
  try {
    return await rawFetch(primary, path, init)
  } catch (e) {
    if (useRemote && isConnectionError(e)) {
      tripRemote()
      return await rawFetch(OLLAMA_LOCAL_BASE, path, {
        ...init,
        ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
      })
    }
    throw e
  }
}

/** Streaming /api/generate — yields response token strings. */
export async function* ollamaStream(
  params: { model: string; prompt: string; options?: Record<string, unknown>; keep_alive?: number },
  opts: OllamaCallOpts = {},
): AsyncGenerator<string> {
  const res = await openStreamWithFallback('/api/generate', params, opts)
  for await (const obj of streamLines(res)) {
    if (typeof obj?.response === 'string' && obj.response) yield obj.response
  }
}

/** Streaming /api/chat — yields {content?, tool_calls?} deltas (native tool-call support). */
export async function* ollamaChatStream(
  params: {
    model: string
    messages: Array<{ role: string; content: string }>
    tools?: unknown[]
    options?: Record<string, unknown>
    keep_alive?: number
  },
  opts: OllamaCallOpts = {},
): AsyncGenerator<{ content?: string; tool_calls?: unknown[]; done?: boolean }> {
  const res = await openStreamWithFallback('/api/chat', params, opts)
  for await (const obj of streamLines(res)) {
    const msg = obj?.message
    yield {
      content: typeof msg?.content === 'string' ? msg.content : undefined,
      tool_calls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : undefined,
      done: obj?.done === true,
    }
  }
}

/** Which Ollama is active right now — for the System Admin widget. */
export function getOllamaStatus(): {
  remoteConfigured: boolean
  remote: { url: string; state: 'open' | 'closed'; lastProbeAt: number } | null
  local: string
  activeBase: string
} {
  const remoteConfigured = hasRemote()
  const snap = circuitSnapshot()
  return {
    remoteConfigured,
    remote: remoteConfigured ? { url: OLLAMA_REMOTE_BASE, state: snap.state, lastProbeAt: snap.lastProbeAt } : null,
    local: OLLAMA_LOCAL_BASE,
    activeBase: resolveOllamaBase('remote-first'),
  }
}

export { probeRemote }

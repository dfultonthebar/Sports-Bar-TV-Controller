/**
 * Ollama base-URL config for the remote-first-with-local-fallback client.
 *
 * SAFE DEFAULT: `OLLAMA_REMOTE_BASE` unset ⇒ every policy resolves to the local
 * Ollama, so behavior is identical to today until an operator opts a location in
 * by setting OLLAMA_REMOTE_BASE in its .env.
 */

/** The box's own Ollama. Honors the two historical env names used across the codebase. */
export const OLLAMA_LOCAL_BASE =
  process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434'

/** The central GPU Ollama (e.g. http://100.70.56.34:11434). Empty ⇒ remote disabled. */
export const OLLAMA_REMOTE_BASE = (process.env.OLLAMA_REMOTE_BASE || '').trim()

/** How often to re-probe a down remote for recovery. */
export const REMOTE_PROBE_INTERVAL_MS =
  Number(process.env.OLLAMA_REMOTE_PROBE_INTERVAL_MS) || 120_000

/** Max ms to wait for the remote /api/tags connectivity probe. */
export const REMOTE_CONNECT_TIMEOUT_MS =
  Number(process.env.OLLAMA_REMOTE_CONNECT_TIMEOUT_MS) || 3_000

export function hasRemote(): boolean {
  return OLLAMA_REMOTE_BASE.length > 0
}

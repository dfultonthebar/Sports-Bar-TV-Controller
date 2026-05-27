/**
 * uuid-safe.ts — context-safe UUID generator for client-side code.
 *
 * Why this exists: `crypto.randomUUID()` requires a "secure context"
 * (HTTPS or localhost). Bartender iPads hit the remote over plain HTTP
 * at http://<lan-ip>:3002/remote — INSECURE context — so calling
 * `crypto.randomUUID()` throws:
 *
 *   TypeError: crypto.randomUUID is not a function          (Safari < 15.4)
 *   DOMException: crypto.randomUUID() is only available...  (Chrome / iOS)
 *
 * That crash takes down the whole React subtree, which gets caught by
 * apps/web/src/app/remote/error.tsx ("Something hiccuped"). Tapping
 * "Try again" re-mounts and crashes again — infinite loop.
 *
 * `crypto.getRandomValues()` works fine in insecure contexts on every
 * browser since IE11, so we prefer it as the fallback. Math.random() is
 * the last-resort fallback for the extremely-degraded case (no Web
 * Crypto at all). Session IDs aren't crypto-grade — they only need to
 * be unique enough to key chatSessions rows.
 *
 * Server-side code (route handlers, scripts) can keep using
 * `crypto.randomUUID()` directly — Node always provides it.
 */

export function makeSessionId(): string {
  try {
    // Secure-context path (HTTPS / localhost)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // crypto.randomUUID throws in insecure contexts even when defined
    // on some browsers — fall through to getRandomValues path
  }
  try {
    // Insecure-context safe path — getRandomValues works on every browser
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {
    // Fall through to Math.random fallback
  }
  // Last-resort fallback — not crypto-grade but unique enough for session keying
  return `sess-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

/**
 * HMAC-SHA256 request signing shared by the agent (sign) and hub (verify).
 * The signature covers `${timestamp}.${body}` so a captured body can't be replayed
 * with a new timestamp.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export function signPayload(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyPayload(
  secret: string,
  timestamp: number,
  body: string,
  signature: string,
): boolean {
  const expected = signPayload(secret, timestamp, body)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature || '', 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Reject signatures whose timestamp is too old/future (replay window). */
export function timestampFresh(timestamp: number, nowMs: number, toleranceMs = 5 * 60_000): boolean {
  return Math.abs(nowMs - timestamp) <= toleranceMs
}

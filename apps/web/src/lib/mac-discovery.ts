/**
 * MAC auto-discovery for NetworkTVDevice rows.
 *
 * Why this exists: a network TV (Samsung/LG/etc.) needs its `macAddress` set or
 * Wake-on-LAN power-on can't work — and a missing MAC otherwise produces a
 * warning on every bulk-power cycle. Rather than hand-enter the MAC, the box can
 * read it straight off the LAN: ping the TV to populate the kernel ARP/neighbor
 * cache, then read the resolved hardware address back. Same-LAN only (ARP doesn't
 * cross subnets), Linux-only (the whole fleet is Linux). Deterministic — no LLM.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

const execFileAsync = promisify(execFile)

const MAC_RE = /(?:[0-9a-f]{2}:){5}[0-9a-f]{2}/i
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/

const normalizeMac = (mac: string): string => mac.trim().toLowerCase()

/**
 * Resolve a device's MAC from its IPv4 address via the local ARP/neighbor cache.
 * Returns a normalized lowercase MAC (aa:bb:cc:dd:ee:ff), or null if it can't be
 * resolved (TV powered off / not on this LAN / address not yet in the cache).
 */
export async function resolveMacForIp(ip: string): Promise<string | null> {
  const addr = (ip || '').trim()
  if (!IPV4_RE.test(addr)) return null

  // 1) Ping once to coax the TV into the kernel neighbor table. Best-effort:
  //    a failed ping doesn't prove there's no cached entry, so we still read below.
  try {
    await execFileAsync('ping', ['-c', '1', '-W', '1', addr], { timeout: 3000 })
  } catch {
    /* ignore — fall through to the cache read */
  }

  // 2) Preferred: `ip neigh show <addr>` (iproute2, present on every fleet box).
  try {
    const { stdout } = await execFileAsync('ip', ['neigh', 'show', addr], { timeout: 2000 })
    // Skip FAILED/INCOMPLETE entries (no usable lladdr).
    if (!/\b(FAILED|INCOMPLETE)\b/.test(stdout)) {
      const m = stdout.match(MAC_RE)
      if (m && m[0] !== '00:00:00:00:00:00') return normalizeMac(m[0])
    }
  } catch {
    /* fall through to /proc/net/arp */
  }

  // 3) Fallback: /proc/net/arp (IP Address | HW type | Flags | HW address | ...).
  try {
    const arp = await readFile('/proc/net/arp', 'utf8')
    for (const line of arp.split('\n')) {
      const cols = line.trim().split(/\s+/)
      if (cols[0] === addr && cols[3] && MAC_RE.test(cols[3]) && cols[3] !== '00:00:00:00:00:00') {
        return normalizeMac(cols[3])
      }
    }
  } catch {
    /* ignore */
  }

  return null
}

export interface MacBackfillResult {
  id: string
  name: string | null
  ipAddress: string
  mac: string | null
  status: 'filled' | 'unreachable'
}

/**
 * Find every NetworkTVDevice with no macAddress, resolve each via ARP, and
 * persist any we find. Pass a deviceId to target one device. Returns a per-device
 * summary. Safe to run on a schedule — does nothing when no device is missing a MAC.
 */
export async function backfillMissingMacs(
  targetDeviceId?: string
): Promise<{ checked: number; filled: number; results: MacBackfillResult[] }> {
  const rows = await db.select().from(schema.networkTVDevices)
  const candidates = rows.filter(
    r =>
      (!r.macAddress || r.macAddress.trim() === '') &&
      (!targetDeviceId || r.id === targetDeviceId)
  )

  const results: MacBackfillResult[] = []
  let filled = 0

  for (const dev of candidates) {
    const mac = await resolveMacForIp(dev.ipAddress)
    if (mac) {
      await db
        .update(schema.networkTVDevices)
        .set({ macAddress: mac, updatedAt: new Date() })
        .where(eq(schema.networkTVDevices.id, dev.id))
      filled++
      logger.info(`[MAC-DISCOVERY] Auto-filled MAC ${mac} for "${dev.name || dev.id}" (${dev.ipAddress})`)
      results.push({ id: dev.id, name: dev.name, ipAddress: dev.ipAddress, mac, status: 'filled' })
    } else {
      results.push({ id: dev.id, name: dev.name, ipAddress: dev.ipAddress, mac: null, status: 'unreachable' })
    }
  }

  if (filled > 0) {
    logger.info(`[MAC-DISCOVERY] Backfill complete: ${filled}/${candidates.length} MAC(s) resolved`)
  }
  return { checked: candidates.length, filled, results }
}

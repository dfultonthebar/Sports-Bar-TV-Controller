/**
 * GET /api/fleet/status
 *
 * Read-only snapshot of every Sports-Bar-TV-Controller location's git state.
 * Data source: the local clone of this repo on whichever host serves this
 * API (currently only this-host is queried). For each `location/*` remote
 * branch we report version, last-commit metadata, commits-behind-main,
 * last auto-update merge, and a staleness classification.
 *
 * Why git-as-source rather than an agent on each location: each bar is on
 * its own LAN, not reachable from this one. But every location pushes its
 * auto-update merge commits to GitHub (that's the contract of
 * scripts/auto-update.sh). So git is the only signal we can gather
 * centrally without an agent per-host.
 *
 * Caching: in-memory, 5-minute TTL. `?refresh=1` busts the cache. A full
 * fetch+probe of 6 branches takes ~3-5 seconds (git fetch + per-branch
 * git show/log calls); the cache prevents page reloads from hammering it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const execFileAsync = promisify(execFile)

// Resolve repo root one level above this file's `apps/web/...` path.
const REPO_ROOT = path.resolve(process.cwd(), '..', '..')

interface FleetLocation {
  branch: string
  displayName: string
  version: string | null
  versionsBehind: number | null
  lastCommitTimestamp: number
  lastCommitDate: string
  lastCommitSubject: string
  commitsBehindMain: number
  commitsAheadOfMain: number
  lastAutoUpdateTimestamp: number | null
  lastAutoUpdateDate: string | null
  staleness: 'healthy' | 'warning' | 'stuck' | 'unknown'
  stalenessReason: string
  // Heartbeat from .auto-update-last-success.json (v2.25.2+). Absent on
  // older locations or locations that have never had a successful auto-
  // update since v2.25.2 landed.
  heartbeat?: {
    successAtUnix: number
    runId: string
    verifyInstallStatus: string | null
    verifyInstallPassed: number | null
    verifyInstallTotal: number | null
  } | null
}

interface FleetStatus {
  locations: FleetLocation[]
  mainVersion: string | null
  mainLastCommitTimestamp: number
  mainLastCommitSubject: string
  generatedAt: string
  fromCache: boolean
  refreshedSecondsAgo: number
}

// ---- cache ----

let _cache: { snapshot: FleetStatus; ts: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

// ---- helpers ----

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: REPO_ROOT,
    timeout: 10_000,
    maxBuffer: 1_024 * 1_024, // 1 MB
  })
  return stdout.trim()
}

function branchDisplayName(branch: string): string {
  // "location/holmgren-way" -> "Holmgren Way"
  // "location/lucky-s-1313" -> "Lucky S 1313"
  // "location/stoneyard-appleton" -> "Stoneyard Appleton"
  const slug = branch.replace(/^origin\//, '').replace(/^location\//, '')
  return slug
    .split('-')
    .map(word => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ')
}

function versionAsTuple(v: string | null): [number, number, number] | null {
  if (!v) return null
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
}

// Count how many minor/patch bumps behind main a location is. Counts each
// distinct (minor, patch) pair between the location's version and main's
// version as one step, treating major bumps as weighted 100 (since a
// location going major-behind is an urgent thing to see).
function versionsBehind(locationVersion: string | null, mainVersion: string | null): number | null {
  const loc = versionAsTuple(locationVersion)
  const main = versionAsTuple(mainVersion)
  if (!loc || !main) return null
  const [la, lb, lc] = loc
  const [ma, mb, mc] = main
  if (ma > la) return (ma - la) * 100 + mb
  if (ma === la && mb > lb) return mb - lb
  if (ma === la && mb === lb && mc > lc) return Math.floor((mc - lc) / 1) // patch-level
  return 0
}

async function buildLocationEntry(branch: string, mainVersion: string | null): Promise<FleetLocation> {
  // Gather all location-branch data with parallel git calls.
  const [versionRaw, lastCommit, behindMain, aheadMain, lastAutoUpdate, heartbeatRaw] = await Promise.all([
    git(['show', `${branch}:package.json`]).catch(() => ''),
    git(['log', branch, '-1', '--format=%ct%x09%s']).catch(() => ''),
    git(['rev-list', '--count', `${branch}..origin/main`]).catch(() => '0'),
    git(['rev-list', '--count', `origin/main..${branch}`]).catch(() => '0'),
    git(['log', branch, '--grep=auto-update merge', '-1', '--format=%ct%x09%s']).catch(() => ''),
    git(['show', `${branch}:.auto-update-last-success.json`]).catch(() => ''),
  ])

  // Parse version from package.json JSON
  let version: string | null = null
  try {
    const parsed = JSON.parse(versionRaw)
    version = typeof parsed.version === 'string' ? parsed.version : null
  } catch { /* ignore */ }

  // Parse last commit "unix_ts\tsubject"
  let lastTs = 0
  let lastSubj = ''
  if (lastCommit) {
    const [tsPart, ...subjParts] = lastCommit.split('\t')
    lastTs = parseInt(tsPart, 10) || 0
    lastSubj = subjParts.join('\t')
  }

  // Parse last auto-update
  let autoTs: number | null = null
  if (lastAutoUpdate) {
    const parts = lastAutoUpdate.split('\t')
    const ts = parseInt(parts[0], 10)
    if (Number.isFinite(ts) && ts > 0) autoTs = ts
  }

  const commitsBehind = parseInt(behindMain, 10) || 0
  const commitsAhead = parseInt(aheadMain, 10) || 0

  // Staleness classification
  //
  // PRIMARY signal: version drift (location's package.json vs main's).
  // Cherry-picked commits produce different SHAs even when content
  // matches, so `commitsBehindMain` is NOT a reliable "is this location
  // up to date?" metric on its own — a location can share the same
  // version as main while showing dozens of "behind" commits because of
  // cherry-pick workflow. Version tuples fix that.
  //
  // SECONDARY signal: age of the last commit on the branch. If the
  // location's branch hasn't moved in 48h, even a version-match is
  // suspicious (auto-update should produce periodic merge commits).
  const now = Math.floor(Date.now() / 1000)
  const ageHours = lastTs > 0 ? (now - lastTs) / 3600 : Infinity
  const vBehind = versionsBehind(version, mainVersion)

  let staleness: FleetLocation['staleness'] = 'healthy'
  let stalenessReason = 'current with main'

  if (lastTs === 0) {
    staleness = 'unknown'
    stalenessReason = 'no commits found on branch'
  } else if (vBehind === null) {
    staleness = 'unknown'
    stalenessReason = 'could not parse version'
  } else if (vBehind >= 100 || vBehind >= 5 || ageHours > 72) {
    // Major-version drift OR 5+ minor bumps behind OR 3+ days stale
    staleness = 'stuck'
    const parts: string[] = []
    if (vBehind >= 100) parts.push('major version behind')
    else if (vBehind >= 5) parts.push(`${vBehind} minor versions behind main`)
    if (ageHours > 72) parts.push(`last commit ${Math.floor(ageHours / 24)}d ago`)
    stalenessReason = parts.join(', ') || `stuck at v${version}`
  } else if (vBehind >= 1 || ageHours > 48) {
    staleness = 'warning'
    const parts: string[] = []
    if (vBehind >= 1) parts.push(`${vBehind} version${vBehind === 1 ? '' : 's'} behind main (v${mainVersion})`)
    if (ageHours > 48) parts.push(`last commit ${Math.floor(ageHours)}h ago`)
    stalenessReason = parts.join(', ') || 'behind main'
  } else if (version && mainVersion && version === mainVersion && commitsBehind > 0) {
    // Version matches, but some cherry-pick SHA drift — informational only, still healthy.
    stalenessReason = `current with main (cherry-pick SHA drift, ${commitsBehind} commits)`
  } else if (version && mainVersion && version === mainVersion) {
    stalenessReason = 'current with main'
  }

  // Parse heartbeat file (v2.25.2+) if present
  let heartbeat: FleetLocation['heartbeat'] = null
  if (heartbeatRaw) {
    try {
      const hb = JSON.parse(heartbeatRaw)
      const vi = hb.verifyInstall ?? {}
      heartbeat = {
        successAtUnix: typeof hb.successAtUnix === 'number' ? hb.successAtUnix : 0,
        runId: typeof hb.runId === 'string' ? hb.runId : '',
        verifyInstallStatus: typeof vi.status === 'string' ? vi.status : null,
        verifyInstallPassed: typeof vi.passed === 'number' ? vi.passed : null,
        verifyInstallTotal: typeof vi.total === 'number' ? vi.total : null,
      }
    } catch { /* ignore malformed */ }
  }

  return {
    branch: branch.replace(/^origin\//, ''),
    displayName: branchDisplayName(branch),
    version,
    versionsBehind: versionsBehind(version, mainVersion),
    lastCommitTimestamp: lastTs,
    lastCommitDate: lastTs > 0 ? new Date(lastTs * 1000).toISOString() : '',
    lastCommitSubject: lastSubj,
    commitsBehindMain: commitsBehind,
    commitsAheadOfMain: commitsAhead,
    lastAutoUpdateTimestamp: autoTs,
    lastAutoUpdateDate: autoTs ? new Date(autoTs * 1000).toISOString() : null,
    staleness,
    stalenessReason,
    heartbeat,
  }
}

async function buildFleetSnapshot(): Promise<FleetStatus> {
  // Make sure our local mirror is current; swallow fetch errors so an
  // outage of GitHub doesn't take the dashboard down entirely.
  try {
    await git(['fetch', 'origin', '--quiet'])
  } catch (err: any) {
    logger.warn('[FLEET-STATUS] git fetch failed (using stale local refs):', err.message)
  }

  // Main branch version + last commit.
  const [mainPkg, mainLast] = await Promise.all([
    git(['show', 'origin/main:package.json']).catch(() => ''),
    git(['log', 'origin/main', '-1', '--format=%ct%x09%s']).catch(() => ''),
  ])
  let mainVersion: string | null = null
  try {
    const parsed = JSON.parse(mainPkg)
    mainVersion = typeof parsed.version === 'string' ? parsed.version : null
  } catch { /* ignore */ }
  let mainTs = 0
  let mainSubj = ''
  if (mainLast) {
    const [tsPart, ...subjParts] = mainLast.split('\t')
    mainTs = parseInt(tsPart, 10) || 0
    mainSubj = subjParts.join('\t')
  }

  // List all location/* remote branches
  const raw = await git(['branch', '-r'])
  const branches = raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('origin/location/'))

  const locations = await Promise.all(branches.map(b => buildLocationEntry(b, mainVersion)))

  // Sort: stuck first, then warning, then healthy; inside each group by displayName
  const stalenessRank: Record<FleetLocation['staleness'], number> = {
    stuck: 0,
    unknown: 1,
    warning: 2,
    healthy: 3,
  }
  locations.sort((a, b) => {
    const r = stalenessRank[a.staleness] - stalenessRank[b.staleness]
    if (r !== 0) return r
    return a.displayName.localeCompare(b.displayName)
  })

  return {
    locations,
    mainVersion,
    mainLastCommitTimestamp: mainTs,
    mainLastCommitSubject: mainSubj,
    generatedAt: new Date().toISOString(),
    fromCache: false,
    refreshedSecondsAgo: 0,
  }
}

// ---- handler ----

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const url = new URL(request.url)
  const forceRefresh = url.searchParams.get('refresh') === '1'

  const now = Date.now()
  if (!forceRefresh && _cache && now - _cache.ts < CACHE_TTL_MS) {
    return NextResponse.json({
      ..._cache.snapshot,
      fromCache: true,
      refreshedSecondsAgo: Math.floor((now - _cache.ts) / 1000),
    })
  }

  try {
    const snapshot = await buildFleetSnapshot()
    _cache = { snapshot, ts: Date.now() }
    return NextResponse.json(snapshot)
  } catch (err: any) {
    logger.error('[FLEET-STATUS] Build failed:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Fleet status build failed' },
      { status: 500 },
    )
  }
}

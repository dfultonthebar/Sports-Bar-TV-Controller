/**
 * GET /api/system/version
 *
 * Returns the currently-deployed version info so the UI (and operators
 * via direct URL) can see what's running without SSH'ing in. No auth
 * required — the point is visibility, and nothing here is sensitive.
 *
 * Response shape:
 *   {
 *     version: string            // from package.json
 *     branch: string             // git branch currently checked out
 *     commitSha: string          // full 40-char SHA
 *     commitShaShort: string     // 8-char short
 *     commitDate: string         // ISO 8601, when the commit was authored
 *     commitSubject: string      // one-line commit message
 *     buildDate: string          // when the .next build was produced (mtime)
 *     nodeVersion: string        // process.versions.node
 *     pid: number
 *     uptimeSecs: number
 *   }
 *
 * Values are cached for 60 seconds because they only change on
 * redeploy/restart.
 */

import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'
import { logger } from '@sports-bar/logger'

export const dynamic = 'force-dynamic'

const REPO_ROOT = '/home/ubuntu/Sports-Bar-TV-Controller'
const NEXT_BUILD_DIR = path.join(REPO_ROOT, 'apps/web/.next')
const execFileAsync = promisify(execFile)

interface VersionInfo {
  version: string
  branch: string
  commitSha: string
  commitShaShort: string
  commitDate: string
  commitSubject: string
  buildDate: string | null
  nodeVersion: string
  pid: number
  uptimeSecs: number
}

let _cache: { ts: number; data: VersionInfo } | null = null
const CACHE_TTL_MS = 60 * 1000

async function git(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd: REPO_ROOT, timeout: 3000 })
    return stdout.trim()
  } catch (e: any) {
    logger.warn('[VERSION] git command failed', { data: { args, error: e?.message } })
    return ''
  }
}

async function buildVersionInfo(): Promise<VersionInfo> {
  // Read package.json version
  let version = 'unknown'
  try {
    const pkgRaw = await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf-8')
    const pkg = JSON.parse(pkgRaw)
    version = pkg.version || 'unknown'
  } catch (e) {
    logger.warn('[VERSION] failed to read package.json', { data: { error: String(e) } })
  }

  // Git info
  const [branch, fullSha, shortSha, commitDate, commitSubject] = await Promise.all([
    git(['rev-parse', '--abbrev-ref', 'HEAD']),
    git(['rev-parse', 'HEAD']),
    git(['rev-parse', '--short=8', 'HEAD']),
    git(['log', '-1', '--format=%cI']),
    git(['log', '-1', '--format=%s']),
  ])

  // Build date from .next directory mtime
  let buildDate: string | null = null
  try {
    const stat = await fs.stat(NEXT_BUILD_DIR)
    buildDate = stat.mtime.toISOString()
  } catch {
    // .next missing — first-run state or dev mode
  }

  return {
    version,
    branch: branch || 'unknown',
    commitSha: fullSha || 'unknown',
    commitShaShort: shortSha || 'unknown',
    commitDate: commitDate || 'unknown',
    commitSubject: commitSubject || '',
    buildDate,
    nodeVersion: process.versions.node,
    pid: process.pid,
    uptimeSecs: Math.round(process.uptime()),
  }
}

export async function GET() {
  try {
    if (_cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
      return NextResponse.json(_cache.data)
    }
    const data = await buildVersionInfo()
    _cache = { ts: Date.now(), data }
    return NextResponse.json(data)
  } catch (error: any) {
    logger.error('[VERSION] failed to build version info', error)
    return NextResponse.json(
      { error: 'Failed to read version info', details: error?.message },
      { status: 500 }
    )
  }
}

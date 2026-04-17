import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

let cachedVersion: { version: string; sha: string; startedAt: number } | null = null

function resolveVersion(): { version: string; sha: string; startedAt: number } {
  if (cachedVersion) return cachedVersion

  let version = 'unknown'
  // Try repo-root package.json first (Turborepo monorepo — root version is
  // bumped on every commit per CLAUDE.md rule). Fall back to cwd package.json.
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ]
  for (const pkgPath of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.name === 'sports-bar-tv-controller' && pkg.version) {
        version = pkg.version
        break
      }
      if (version === 'unknown' && pkg.version) {
        version = pkg.version
      }
    } catch {
      // try next candidate
    }
  }

  let sha = 'unknown'
  try {
    sha = execSync('git rev-parse --short HEAD', {
      encoding: 'utf-8',
      cwd: process.cwd(),
      timeout: 1000,
    }).trim()
  } catch {
    // ignore
  }

  cachedVersion = { version, sha, startedAt: Date.now() }
  return cachedVersion
}

export async function GET() {
  const v = resolveVersion()
  return NextResponse.json(v, {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  })
}

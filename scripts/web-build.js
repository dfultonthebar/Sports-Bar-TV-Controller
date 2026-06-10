#!/usr/bin/env node
// scripts/web-build.js — wrapper for `next build` that sources the repo
// .env BEFORE deciding whether to pass --webpack.
//
// Background (closes task #334):
//   apps/web/package.json had `"build": "next build ${NEXT_USE_WEBPACK:+--webpack}"`.
//   The bash substitution happens at npm-script-parse time, BEFORE the
//   .env file is loaded. Graystone (15 GB RAM, can't run Turbopack
//   without OOM-killing at exit 137) had NEXT_USE_WEBPACK=1 in .env,
//   but the substitution didn't see it, so every fleet propagation
//   rebuilt with Turbopack and OOM'd. Workaround: rsync pre-built
//   .next from Holmgren — proven 4+ times but adds friction.
//
//   This wrapper reads the repo-root .env synchronously, decides
//   whether to append `--webpack`, then spawns `next build` with the
//   final arg list. Same behavior as the substitution on boxes that
//   DO export NEXT_USE_WEBPACK (the env var also wins if exported
//   pre-build), but now works on Graystone where the var lives only
//   in the .env file.
//
// Other supported env vars (read from .env or the parent shell):
//   NEXT_USE_WEBPACK=1   → append --webpack
//   NEXT_BUILD_ARGS=...  → additional space-separated args
//
// Errors propagate (exit code from `next build`); no try/catch shenanigans.

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const REPO_ROOT = path.resolve(__dirname, '..')
const APPS_WEB = path.join(REPO_ROOT, 'apps', 'web')

// Read repo-root .env (best effort — absence is fine; the parent shell may
// have already exported the vars). Don't overwrite vars the shell already
// set — they win.
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return 0
  const text = fs.readFileSync(envPath, 'utf8')
  let added = 0
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    const [, key, valRaw] = m
    if (process.env[key] !== undefined) continue
    let val = valRaw
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
    added += 1
  }
  return added
}

const added = loadEnvFile(path.join(REPO_ROOT, '.env'))
if (added > 0) {
  // Surface this so the build log says we sourced something — helps
  // diagnose why a downstream var did or didn't apply.
  console.log(`[web-build] sourced ${added} vars from ${REPO_ROOT}/.env`)
}

// Build args.
const args = ['build']
if (process.env.NEXT_USE_WEBPACK === '1' || process.env.NEXT_USE_WEBPACK === 'true') {
  args.push('--webpack')
  console.log('[web-build] NEXT_USE_WEBPACK=1 → next build --webpack (Graystone-style opt-in)')
}
if (process.env.NEXT_BUILD_ARGS) {
  const extra = process.env.NEXT_BUILD_ARGS.split(/\s+/).filter(Boolean)
  args.push(...extra)
}

// Invoke next from apps/web/ (the cwd `next build` expects so it picks
// up apps/web/next.config.js). Use stdio=inherit so the build's output
// streams to the parent's stdout/stderr like the original npm script.
const result = spawnSync('npx', ['next', ...args], {
  cwd: APPS_WEB,
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  console.error('[web-build] spawn failed:', result.error.message)
  process.exit(1)
}
process.exit(result.status ?? 1)

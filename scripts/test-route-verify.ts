#!/usr/bin/env node
/**
 * Unit test for the Wave 3/3b closed-loop route verifier
 * (packages/scheduler/src/route-verify.ts).
 *
 * Covers the off-by-one / outputOffset-free index math in checkRouteMatch
 * (the one place a wrong base silently false-alarms every route) plus the
 * five runVerifyLoop orchestration outcomes (match / unsupported /
 * mismatch-then-match / persistent-fail / resend-fail) with injected mocks —
 * no hardware needed.
 *
 * Run from repo root:
 *   npx tsx scripts/test-route-verify.ts
 *
 * Exit code 0 = all pass, non-zero = at least one failed.
 */

import { checkRouteMatch, runVerifyLoop } from '../packages/scheduler/src/route-verify'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean) {
  if (cond) pass++
  else {
    fail++
    console.log('  ✗ FAIL:', name)
  }
}

// Live Holmgren o2ox snapshot (0-based input values), outputOffset 0:
// out1->in1, out2->in11, out3->in2, out4->in3, out5->in4 ...
const live = [0, 10, 1, 2, 3, 2, 2, 1, 0, 0]

// --- checkRouteMatch: index correctness + off-by-one guard ---
ok('out1 carries in1 (match)', checkRouteMatch(live, 1, 1).matched === true)
ok('out1 actualInput=1', checkRouteMatch(live, 1, 1).actualInput === 1)
ok('out2 carries in11 (match)', checkRouteMatch(live, 11, 2).matched === true)
ok('out2 actualInput=11', checkRouteMatch(live, 11, 2).actualInput === 11)
ok('out2 carries in1 (MISMATCH)', checkRouteMatch(live, 1, 2).matched === false)
ok('out2 mismatch reports actual=11', checkRouteMatch(live, 1, 2).actualInput === 11)
ok('out3 carries in2 (match)', checkRouteMatch(live, 2, 3).matched === true)
ok('out5 carries in4 (match)', checkRouteMatch(live, 4, 5).matched === true)

// no-offset multi-card semantics: physical output 33 -> array index 32 directly
const big = new Array<number>(48).fill(-1)
big[32] = 5 // output 33 -> input 6
ok('out33 carries in6 (no-offset)', checkRouteMatch(big, 6, 33).matched === true)
ok('out33 actualInput=6', checkRouteMatch(big, 6, 33).actualInput === 6)

// disconnected (-1) + out-of-range never match
ok('disconnected out34 no match', checkRouteMatch(big, 1, 34).matched === false)
ok('disconnected actualInput null', checkRouteMatch(big, 1, 34).actualInput === null)
ok('out-of-range no match', checkRouteMatch(live, 1, 99).matched === false)
ok('out-of-range actualInput null', checkRouteMatch(live, 1, 99).actualInput === null)

// --- runVerifyLoop: orchestration ---
const matchRead = async () => ({ ok: true as const, matched: true, actualInput: 4 })
const missRead = async () => ({ ok: true as const, matched: false, actualInput: 9 })
const failRead = async () => ({ ok: false as const, error: 'HTTP unreachable' })
const okResend = async () => true
const badResend = async () => false

async function main() {
  // 1) first read matches -> verified, 0 attempts
  let r = await runVerifyLoop(4, 5, matchRead, okResend, { settleMs: 0 })
  ok('match: state verified', r.state === 'verified')
  ok('match: 0 attempts', r.attempts === 0)
  ok('match: no error', r.error === null)

  // 2) read unavailable -> unsupported, no resends
  r = await runVerifyLoop(4, 5, failRead, okResend, { settleMs: 0 })
  ok('unsupported state', r.state === 'unsupported')
  ok('unsupported 0 attempts', r.attempts === 0)

  // 3) mismatch then match after 1 resend -> verified, 1 attempt
  const reads = [missRead, matchRead]
  let i = 0
  const flip = async () => reads[Math.min(i++, reads.length - 1)]()
  r = await runVerifyLoop(4, 5, flip, okResend, { settleMs: 0, maxRetries: 2 })
  ok('mismatch->match verified', r.state === 'verified')
  ok('mismatch->match 1 attempt', r.attempts === 1)

  // 4) persistent mismatch -> failed after maxRetries, error populated
  r = await runVerifyLoop(4, 5, missRead, okResend, { settleMs: 0, maxRetries: 2 })
  ok('persistent failed', r.state === 'failed')
  ok('persistent 2 attempts', r.attempts === 2)
  ok('failed error mentions expected', !!r.error && r.error.includes('expected 4') && r.error.includes('input 9'))

  // 5) resend fails -> stops immediately, failed, 1 attempt
  r = await runVerifyLoop(4, 5, missRead, badResend, { settleMs: 0, maxRetries: 2 })
  ok('resend-fail state failed', r.state === 'failed')
  ok('resend-fail 1 attempt (stopped)', r.attempts === 1)

  console.log(`\n${fail === 0 ? '✅' : '❌'} route-verify: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main()

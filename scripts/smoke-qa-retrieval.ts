#!/usr/bin/env npx tsx
/**
 * v2.54.50 smoke test for QA pre-pass.
 * Verifies register detection + match scoring against the seeded 36 pairs.
 */
import { findBestQAMatch, looksLikeBartenderQuery } from '../apps/web/src/lib/qa-retrieval'

const CASES: Array<{ q: string; expect: 'confident' | 'moderate-or-confident' | 'none' }> = [
  { q: "The wireless mic isn't working", expect: 'confident' },
  { q: 'How do I change the channel on TV 5?', expect: 'confident' },
  { q: 'The music stopped in the patio', expect: 'confident' },
  { q: 'What does the yellow banner at the top of the Audio tab mean?', expect: 'confident' },
  { q: 'Where is the Packers game?', expect: 'confident' },
  { q: 'How do I dim the lights for trivia?', expect: 'confident' },
  { q: 'What should I check when I clock in?', expect: 'confident' },
  { q: "mic doesn't work", expect: 'moderate-or-confident' },
  { q: 'TV 7 wrong game', expect: 'moderate-or-confident' },
  { q: 'no music in patio', expect: 'moderate-or-confident' },
  { q: 'how do i swap mic batteries', expect: 'moderate-or-confident' },
  { q: 'fire alarm need lights on', expect: 'moderate-or-confident' },
  { q: "what's the weather", expect: 'none' },
  { q: 'tell me about the Atlas DSP architecture', expect: 'none' },
]

async function main() {
  let pass = 0
  let fail = 0
  for (const c of CASES) {
    const isB = looksLikeBartenderQuery(c.q)
    const m = isB ? await findBestQAMatch(c.q) : null
    const got = !m ? 'none' : m.matchType
    const matched = m?.question ?? '(none)'
    const sc = m?.score.toFixed(3) ?? '-'
    let ok = false
    if (c.expect === 'none' && got === 'none') ok = true
    if (c.expect === 'confident' && got === 'confident') ok = true
    if (c.expect === 'moderate-or-confident' && (got === 'moderate' || got === 'confident')) ok = true
    if (ok) pass++; else fail++
    console.log(`${ok ? '✓' : '✗'} "${c.q.padEnd(55)}" reg=${isB ? 'Y' : 'N'} got=${got.padEnd(10)} s=${sc} -> "${matched.slice(0, 50)}"`)
  }
  console.log(`\nSUMMARY: ${pass} pass, ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })

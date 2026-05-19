/**
 * One-off end-to-end test of the RAG-grounded SME pipeline.
 * Runs the same retrieval + prompt-build the pattern-digest does,
 * then sends the assembled prompt to Ollama and prints the answer.
 *
 *   cd apps/web && npx tsx scripts/test-rag-sme.ts
 */

import { retrieveContext } from '../src/lib/rag-server/query-engine'

async function main() {
  const result = await retrieveContext(
    'Shure SLX-D RF interference mitigation TX_MODEL GROUP_CHANNEL Holmgren Atlas priority custom volume fox and hound',
    6,
  )
  console.log('RAG retrieved', result.chunks.length, 'chunks:')
  for (const c of result.chunks.slice(0, 4)) {
    console.log('  -', c.source, '(score=' + c.score.toFixed(2) + ')')
  }
  console.log()

  const HOLMGREN = 'LOCATION: Holmgren Way, Green Bay WI. Shure Ch1=510.9 MHz G05/C28; Ch2=484.7 MHz G05/C10. Known interferer at 494.5 MHz. Atlas AZM8 fw 4.5.18.'
  const rag = result.chunks
    .map((c) => '[from ' + c.source + ']\n' + c.content.trim())
    .join('\n\n---\n\n')

  const prompt =
    'You are an RF coordination SME. Use the LOCATION CONTEXT + RAG SNIPPETS as ground truth. Frame unknown carriers as foxes per fox-and-hound model. 3 short paragraphs max.\n\n' +
    HOLMGREN +
    '\n\nRAG SNIPPETS:\n' +
    rag +
    '\n\nQUESTION: After our Atlas firmware 4.5 update we see zone gain drops on Upstairs zone — identical drop every 30 sec for 30 min. What caused it? What is the fix?'

  console.log('Sending', prompt.length, 'char prompt to Ollama...')
  const t0 = Date.now()
  const r = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3.1:8b',
      prompt,
      stream: false,
      options: { temperature: 0.3, num_ctx: 4096 },
    }),
  })
  const data: any = await r.json()
  console.log('Latency:', ((Date.now() - t0) / 1000).toFixed(1), 's')
  console.log()
  console.log('=== AI DIGEST OUTPUT ===')
  console.log(data.response)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})

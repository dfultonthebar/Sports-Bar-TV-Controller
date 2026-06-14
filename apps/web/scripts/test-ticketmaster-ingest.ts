/**
 * v2.53.1 ingestion verify — runs the full Ticketmaster sweep against
 * the live API + production DB. Confirms idempotency on re-run.
 *
 * Usage: TICKETMASTER_API_KEY=xxx npx tsx apps/web/scripts/test-ticketmaster-ingest.ts
 */
import { runTicketmasterIngestion } from '../../../packages/scheduler/src/ticketmaster-ingestion'

async function main() {
  const t0 = Date.now()
  const stats = await runTicketmasterIngestion()
  console.log(`\nFinished in ${Date.now() - t0}ms`)
  console.log('Stats:', JSON.stringify(stats, null, 2))
}

main().catch((e) => {
  console.error('FAIL:', e?.message ?? e)
  console.error(e?.stack)
  process.exit(1)
})

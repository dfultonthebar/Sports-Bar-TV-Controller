/**
 * v2.53.1 smoke test for the Ticketmaster scraper.
 * Run with TICKETMASTER_API_KEY unset (default OFF — should return []),
 * then re-run with TICKETMASTER_API_KEY=xxx to fetch real events.
 */
import { fetchTicketmasterEvents } from '@sports-bar/sports-apis'

async function main() {
  const keyState = process.env.TICKETMASTER_API_KEY ? 'SET' : 'UNSET'
  console.log(`\nTesting Ticketmaster scraper (TICKETMASTER_API_KEY=${keyState})\n`)
  const events = await fetchTicketmasterEvents({
    latlong: '44.5012,-88.0626',
    radiusMiles: 30,
    lookaheadDays: 14,
  })
  console.log(`\nReturned ${events.length} events`)
  for (const ev of events.slice(0, 5)) {
    console.log(`  - ${ev.eventType.padEnd(7)} | ${ev.venueName.padEnd(28)} | ${new Date(ev.startTimeUnix * 1000).toISOString()} | ${ev.name}`)
  }
}
main().catch(e => { console.error('FAIL:', e); process.exit(1) })

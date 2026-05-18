#!/usr/bin/env tsx
/**
 * Seed synthetic interference events into shure_rf_events so the Stage 1
 * pattern-digest endpoint has something to analyze BEFORE August 2026
 * preseason brings real game-day RF traffic.
 *
 * Events generated reflect plausible sports-bar-near-stadium patterns
 * (ENG truck activity clusters Sat 12-3pm, intermittent Sunday spillover,
 * random weekday spikes). Clearly labeled with note="SYNTHETIC ..." so
 * they're auditable + deletable.
 *
 *   npx tsx scripts/seed-shure-test-events.ts            # add ~80 events
 *   npx tsx scripts/seed-shure-test-events.ts --wipe     # delete prior synthetic rows + re-seed
 *   npx tsx scripts/seed-shure-test-events.ts --count=N  # generate N events
 *
 * Resulting events spread across the last 30 days. Safe to run multiple
 * times — uses --wipe to clean prior synthetic rows before re-seeding.
 */

import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

const DB_PATH = process.env.DATABASE_URL?.replace(/^file:/, '') ||
  '/home/ubuntu/sports-bar-data/production.db'

const RECEIVER_ID = '3d64443a-0ffc-4a61-a177-a40cd12347ff'
const RECEIVER_NAME = "Holmgren Mic's 1 and 2"
const IP_ADDRESS = '10.11.3.251'

const args = process.argv.slice(2)
const WIPE = args.includes('--wipe')
const countArg = args.find((a) => a.startsWith('--count='))
const COUNT = countArg ? parseInt(countArg.split('=')[1], 10) : 80

function gauss(mean: number, stddev: number): number {
  // Box-Muller, single value.
  const u1 = Math.random() || 1e-12
  const u2 = Math.random()
  return mean + stddev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

type SyntheticEvent = {
  detected_at: number
  channel: 1 | 2
  event_type: 'rf_interference' | 'rf_interference_heartbeat' | 'rf_cleared' | 'baseline_sample' | 'low_battery'
  rssi_dbm: number
  frequency_mhz: number
  tx_type: string | null
  note: string
}

function generateSyntheticEvents(count: number): SyntheticEvent[] {
  const events: SyntheticEvent[] = []
  const now = Math.floor(Date.now() / 1000)
  const thirtyDaysSec = 30 * 86_400

  // Pattern 1 — Recurring Saturday afternoon ENG truck clusters
  // (~40% of events). Each cluster: rf_interference rising edge + 2-4
  // heartbeats + rf_cleared. Most on Ch1 at 487 MHz, some bleed to Ch2.
  const satClusters = Math.floor(count * 0.4 / 5) // ~5 events per cluster
  for (let i = 0; i < satClusters; i++) {
    const daysAgo = Math.floor(Math.random() * 4) * 7 + Math.floor(Math.random() * 2) // last 4 Saturdays
    const baseTime = now - daysAgo * 86_400
    // Force the day-of-week to Saturday (6) by adjusting baseTime
    const d = new Date(baseTime * 1000)
    const offsetToSat = (6 - d.getDay() + 7) % 7
    const satMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetToSat).getTime() / 1000
    // Cluster start: noon - 3pm
    const clusterStart = Math.floor(satMidnight + 12 * 3600 + Math.random() * 3 * 3600)
    const channel: 1 | 2 = Math.random() < 0.8 ? 1 : 2
    const freq = channel === 1 ? 487.000 : 507.600
    const rssi = gauss(-72, 4)
    events.push({
      detected_at: clusterStart,
      channel,
      event_type: 'rf_interference',
      rssi_dbm: rssi,
      frequency_mhz: freq,
      tx_type: 'UNKNOWN',
      note: 'SYNTHETIC Sat afternoon ENG-pattern rising edge',
    })
    const heartbeats = 2 + Math.floor(Math.random() * 3)
    for (let h = 0; h < heartbeats; h++) {
      events.push({
        detected_at: clusterStart + (h + 1) * 25,
        channel,
        event_type: 'rf_interference_heartbeat',
        rssi_dbm: gauss(-70, 3),
        frequency_mhz: freq,
        tx_type: 'UNKNOWN',
        note: 'SYNTHETIC heartbeat',
      })
    }
    events.push({
      detected_at: clusterStart + (heartbeats + 1) * 25,
      channel,
      event_type: 'rf_cleared',
      rssi_dbm: gauss(-98, 2),
      frequency_mhz: freq,
      tx_type: 'UNKNOWN',
      note: 'SYNTHETIC cleared',
    })
  }

  // Pattern 2 — Sporadic weekday spikes (~20% of events) at random
  // freq drift values. Quick rise/fall, no recurrence.
  const weekdaySpikes = Math.floor(count * 0.2)
  for (let i = 0; i < weekdaySpikes; i++) {
    const daysAgo = Math.floor(Math.random() * thirtyDaysSec / 86_400)
    const baseTime = now - daysAgo * 86_400
    const d = new Date(baseTime * 1000)
    if (d.getDay() === 0 || d.getDay() === 6) continue // skip weekends for this pattern
    const hour = 9 + Math.floor(Math.random() * 12)
    const t = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, Math.floor(Math.random() * 60)).getTime() / 1000)
    const channel: 1 | 2 = Math.random() < 0.5 ? 1 : 2
    const freq = channel === 1 ? 487.000 : 507.600
    events.push({
      detected_at: t,
      channel,
      event_type: 'rf_interference',
      rssi_dbm: gauss(-78, 5),
      frequency_mhz: freq,
      tx_type: 'UNKNOWN',
      note: 'SYNTHETIC weekday spike',
    })
    events.push({
      detected_at: t + 8,
      channel,
      event_type: 'rf_cleared',
      rssi_dbm: gauss(-99, 2),
      frequency_mhz: freq,
      tx_type: 'UNKNOWN',
      note: 'SYNTHETIC cleared',
    })
  }

  // Pattern 3 — Hourly baseline_sample snapshots (~40% of events).
  // Always logged regardless of activity. Shows the floor noise.
  const baselineCount = Math.floor(count * 0.4)
  for (let i = 0; i < baselineCount; i++) {
    const hoursAgo = Math.floor(Math.random() * 30 * 24)
    const t = now - hoursAgo * 3600
    const channel: 1 | 2 = i % 2 === 0 ? 1 : 2
    const freq = channel === 1 ? 487.000 : 507.600
    events.push({
      detected_at: t,
      channel,
      event_type: 'baseline_sample',
      rssi_dbm: gauss(-100, 1.5),
      frequency_mhz: freq,
      tx_type: null,
      note: 'SYNTHETIC tx_off baseline',
    })
  }

  return events
}

function main() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')

  if (WIPE) {
    const result = db
      .prepare("DELETE FROM shure_rf_events WHERE note LIKE 'SYNTHETIC%'")
      .run()
    console.log(`Wiped ${result.changes} prior synthetic rows.`)
  }

  const events = generateSyntheticEvents(COUNT)
  events.sort((a, b) => a.detected_at - b.detected_at)

  const insert = db.prepare(`
    INSERT INTO shure_rf_events (
      id, receiver_id, receiver_name, ip_address, channel,
      event_type, rssi_dbm, frequency_mhz, tx_type, note, detected_at
    ) VALUES (
      @id, @receiver_id, @receiver_name, @ip_address, @channel,
      @event_type, @rssi_dbm, @frequency_mhz, @tx_type, @note, @detected_at
    )
  `)
  const tx = db.transaction((rows: SyntheticEvent[]) => {
    for (const ev of rows) {
      insert.run({
        id: randomUUID(),
        receiver_id: RECEIVER_ID,
        receiver_name: RECEIVER_NAME,
        ip_address: IP_ADDRESS,
        channel: ev.channel,
        event_type: ev.event_type,
        rssi_dbm: ev.rssi_dbm,
        frequency_mhz: ev.frequency_mhz,
        tx_type: ev.tx_type,
        note: ev.note,
        detected_at: ev.detected_at,
      })
    }
  })
  tx(events)

  console.log(`Seeded ${events.length} synthetic events spanning ${
    new Date(events[0].detected_at * 1000).toISOString()
  } → ${
    new Date(events[events.length - 1].detected_at * 1000).toISOString()
  }`)
  console.log('Run again with --wipe to remove all synthetic rows.')
  db.close()
}

main()

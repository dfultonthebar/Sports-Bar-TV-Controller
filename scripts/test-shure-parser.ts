#!/usr/bin/env node
/**
 * Integration test: drive the @sports-bar/shure-slxd client against a
 * locally-spawned mock-shure-receiver process across every scenario and
 * verify the parser/cache behave as the spec promises.
 *
 * Run from repo root:
 *   npx tsx scripts/test-shure-parser.ts
 *
 * Exit code 0 = all scenarios pass, non-zero = at least one failed.
 */

import { spawn, ChildProcess } from 'child_process'
import {
  ShureSlxdClient,
  type ShureChannelState,
} from '@sports-bar/shure-slxd'

const MOCK_PATH = `${__dirname}/mock-shure-receiver.ts`
const HOST = '127.0.0.1'

type ScenarioName =
  | 'clean'
  | 'interference-rising'
  | 'tx-battery-dying'
  | 'coalesced-frames'
  | 'partial-frames'
  | 'third-party-controls-disabled'

interface TestResult {
  scenario: ScenarioName
  port: number
  passed: boolean
  failures: string[]
  observed: Record<string, unknown>
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function spawnMock(scenario: ScenarioName, port: number): Promise<ChildProcess> {
  const proc = spawn('npx', ['tsx', MOCK_PATH, `--port=${port}`, `--scenario=${scenario}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  })
  let stderrBuf = ''
  proc.stderr!.on('data', (buf: Buffer) => { stderrBuf += buf.toString() })
  // Wait for the listen banner so we don't race the connect.
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`mock did not announce listen within 8s (stderr: ${stderrBuf.slice(0, 400)})`)), 8000)
    proc.stdout!.on('data', (buf: Buffer) => {
      if (buf.toString().includes('listening')) {
        clearTimeout(t)
        resolve()
      }
    })
    proc.on('exit', (code) => {
      clearTimeout(t)
      reject(new Error(`mock exited early: ${code} (stderr: ${stderrBuf.slice(0, 400)})`))
    })
  })
  return proc
}

async function runScenario(scenario: ScenarioName, port: number): Promise<TestResult> {
  const result: TestResult = { scenario, port, passed: false, failures: [], observed: {} }
  const mock = await spawnMock(scenario, port)
  const client = new ShureSlxdClient({
    ipAddress: HOST,
    port,
    receiverName: `mock-${scenario}`,
    autoReconnect: false,
  })

  const stateChanges: Array<{ ch: number; state: ShureChannelState }> = []
  client.on('stateChange', (ch, state) => stateChanges.push({ ch, state }))

  try {
    if (scenario === 'third-party-controls-disabled') {
      // Connect should succeed but no REPs should ever arrive.
      await client.connect()
      await client.startMetering(500)
      await delay(3000)
      const channel1 = client.getChannelState(1)
      if (channel1 !== undefined) {
        result.failures.push('channel state populated despite gate blocked — bad')
      }
      if (stateChanges.length !== 0) {
        result.failures.push(`got ${stateChanges.length} stateChange events but expected 0`)
      }
      result.observed = { stateChanges: stateChanges.length }
      result.passed = result.failures.length === 0
      return result
    }

    await client.connect()
    await client.startMetering(500)

    // Give the seed flood + first few SAMPLEs time to arrive.
    const settleMs = scenario === 'interference-rising' ? 20_000
      : scenario === 'tx-battery-dying' ? 25_000
      : 4_000
    await delay(settleMs)

    const ch1 = client.getChannelState(1)
    const ch2 = client.getChannelState(2)
    const rcv = client.getReceiverState()

    result.observed = {
      ch1Channel: ch1?.channelName,
      ch1Freq: ch1?.frequencyMhz,
      ch1Rssi: ch1?.rssiDbm,
      ch1TxType: ch1?.txType,
      ch1Battery: ch1?.txBattBars,
      ch1Mins: ch1?.txBattRuntimeMin,
      ch2Rssi: ch2?.rssiDbm,
      ch2TxType: ch2?.txType,
      model: rcv.model,
      firmware: rcv.firmwareVersion,
      rfBand: rcv.rfBand,
      stateChanges: stateChanges.length,
    }

    if (!ch1 || !ch2) {
      result.failures.push('channel cache empty after settle')
    }
    if (rcv.model !== 'SLXD4D') {
      result.failures.push(`expected model SLXD4D got ${rcv.model ?? 'undefined'}`)
    }
    if (rcv.firmwareVersion !== '2.1.5') {
      result.failures.push(`expected firmware 2.1.5 got ${rcv.firmwareVersion ?? 'undefined'}`)
    }
    if (rcv.rfBand !== 'G58') {
      result.failures.push(`expected rfBand G58 got ${rcv.rfBand ?? 'undefined'}`)
    }
    if (!ch1?.channelName) {
      result.failures.push(`ch1 channelName empty — braced-string parser likely broken`)
    }
    if (ch1?.frequencyMhz === undefined) {
      result.failures.push('ch1 frequencyMhz never populated')
    }
    if (ch1?.rssiDbm === undefined) {
      result.failures.push('ch1 rssiDbm never populated (SAMPLE parser may be broken)')
    }

    if (scenario === 'clean') {
      if (ch1?.txType !== 'SLXD2') {
        result.failures.push(`clean: expected txType SLXD2, got ${ch1?.txType}`)
      }
      if (ch1?.rssiDbm !== undefined && ch1.rssiDbm < -85) {
        result.failures.push(`clean: rssi too low (${ch1.rssiDbm})`)
      }
    }

    if (scenario === 'interference-rising') {
      if (ch1?.txType !== 'UNKNOWN') {
        result.failures.push(`interference: expected txType UNKNOWN, got ${ch1?.txType}`)
      }
      if (ch1?.rssiDbm === undefined || ch1.rssiDbm < -85) {
        result.failures.push(`interference: rssi should be ≥ -85, got ${ch1?.rssiDbm}`)
      }
    }

    if (scenario === 'tx-battery-dying') {
      if (ch1?.txBattBars === undefined || ch1.txBattBars > 4) {
        result.failures.push(`battery: expected battBars ≤ 4 by now, got ${ch1?.txBattBars}`)
      }
    }

    if (scenario === 'coalesced-frames' || scenario === 'partial-frames') {
      if (!ch1 || !ch2) {
        result.failures.push(`${scenario}: frame accumulator failed — channel state empty`)
      }
      if (stateChanges.length < 2) {
        result.failures.push(`${scenario}: expected ≥2 stateChange events, got ${stateChanges.length}`)
      }
    }

    result.passed = result.failures.length === 0
    return result
  } catch (err: any) {
    result.failures.push(`exception: ${err.message}`)
    return result
  } finally {
    try { client.disconnect() } catch { /* ignore */ }
    mock.kill('SIGTERM')
    await delay(200)
  }
}

async function main() {
  const scenarios: ScenarioName[] = [
    'clean',
    'coalesced-frames',
    'partial-frames',
    'interference-rising',
    'tx-battery-dying',
    'third-party-controls-disabled',
  ]
  const results: TestResult[] = []
  let basePort = 12202
  for (const sc of scenarios) {
    process.stdout.write(`\n[TEST] running scenario "${sc}" on port ${basePort}...\n`)
    const r = await runScenario(sc, basePort++)
    results.push(r)
    process.stdout.write(`[TEST] ${r.passed ? '✓ PASS' : '✗ FAIL'} (${sc})\n`)
    if (!r.passed) {
      for (const f of r.failures) process.stdout.write(`        - ${f}\n`)
    }
    process.stdout.write(`        observed: ${JSON.stringify(r.observed)}\n`)
  }

  const allPassed = results.every((r) => r.passed)
  process.stdout.write(`\n=== ${results.filter((r) => r.passed).length}/${results.length} scenarios passed ===\n`)
  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('[TEST] fatal:', err)
  process.exit(2)
})

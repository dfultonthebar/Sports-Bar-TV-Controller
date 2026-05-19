/**
 * @sports-bar/shure-slxd — Shure SLX-D Wireless Mic Receiver Control
 *
 * TypeScript Node.js client for Shure SLX-D family wireless microphone
 * receivers (SLXD4, SLXD4D, SLXD24, SLXD24D, SLXD14, SLXD14D). Speaks
 * Shure's ASCII line protocol on TCP port 2202.
 *
 * Use cases:
 * - Monitor RF level + interference (RSSI sampling at 1 Hz)
 * - Track TX battery, frequency, channel name, model
 * - Set frequency (software-side "Auto Scan" workaround — Shure does
 *   NOT expose network-triggered Group Scan)
 *
 * Spec: https://pubs.shure.com/command-strings/SLXD/en-US
 * See `packages/shure-slxd/README.md` for the SME briefing on RF
 * coordination, threshold tuning, and the operator playbook for
 * mid-event interference.
 */

export * from './config'
export * from './types'

export {
  ShureSlxdClient,
  createShureSlxdClient,
} from './shure-slxd-client'

export {
  shureSlxdClientManager,
  getShureSlxdClient,
  releaseShureSlxdClient,
  disconnectShureSlxdClient,
} from './shure-slxd-client-manager'

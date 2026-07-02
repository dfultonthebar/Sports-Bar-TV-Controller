/**
 * Sony-standard VISCA command byte sequences, confirmed to work day-1 on the
 * OBSBOT Tail 2 per docs/OBSBOT_TAIL_2_PLAN.md's protocol research (VISCA
 * over UDP, not the OBSBOT-specific extensions like AI tracking — those
 * require a vendor XLS command sheet we don't have; see the plan doc's
 * "Risk flag" section).
 *
 * Frame format: 0x8X <category bytes> FF, where X is the VISCA device
 * address (1 = the only/first device, standard for a single camera over
 * VISCA-over-IP — no daisy-chain in this deployment).
 */

const ADDRESS = 0x81 // device 1 — the only camera on this VISCA-over-IP link
const TERMINATOR = 0xff

export type PanDirection = 'left' | 'right' | 'stop'
export type TiltDirection = 'up' | 'down' | 'stop'
export type ZoomDirection = 'in' | 'out' | 'stop'

const PAN_BYTE: Record<PanDirection, number> = { left: 0x01, right: 0x02, stop: 0x03 }
const TILT_BYTE: Record<TiltDirection, number> = { up: 0x01, down: 0x02, stop: 0x03 }

/** Clamp a 1-24 speed value into VISCA's pan-speed range (0x01-0x18). */
function clampPanSpeed(speed: number): number {
  return Math.max(1, Math.min(0x18, Math.round(speed)))
}

/** Clamp a 1-20 speed value into VISCA's tilt-speed range (0x01-0x14). */
function clampTiltSpeed(speed: number): number {
  return Math.max(1, Math.min(0x14, Math.round(speed)))
}

/** Clamp a 1-8 speed value into VISCA's zoom-speed nibble range (1-7). */
function clampZoomSpeed(speed: number): number {
  return Math.max(1, Math.min(7, Math.round(speed)))
}

/**
 * CAM_PanTiltDrive — continuous pan/tilt move at the given speed + direction.
 * Send `panTiltStop()` to halt (not a separate command — same frame with
 * both directions set to 'stop').
 */
export function panTiltDrive(pan: PanDirection, tilt: TiltDirection, panSpeed = 12, tiltSpeed = 10): Buffer {
  return Buffer.from([
    ADDRESS, 0x01, 0x06, 0x01,
    clampPanSpeed(panSpeed), clampTiltSpeed(tiltSpeed),
    PAN_BYTE[pan], TILT_BYTE[tilt],
    TERMINATOR,
  ])
}

export function panTiltStop(): Buffer {
  return panTiltDrive('stop', 'stop')
}

/** CAM_Zoom — variable-speed zoom in/out, or stop. */
export function zoom(direction: ZoomDirection, speed = 4): Buffer {
  let byte: number
  if (direction === 'in') byte = 0x20 | clampZoomSpeed(speed)
  else if (direction === 'out') byte = 0x30 | clampZoomSpeed(speed)
  else byte = 0x00
  return Buffer.from([ADDRESS, 0x01, 0x04, 0x07, byte, TERMINATOR])
}

/** CAM_Home — recenter pan/tilt to the default position. */
export function home(): Buffer {
  return Buffer.from([ADDRESS, 0x01, 0x06, 0x04, TERMINATOR])
}

/** Gimbal reset (listed as native/day-1 in the plan doc's Sony-standard table). */
export function gimbalReset(): Buffer {
  return Buffer.from([ADDRESS, 0x01, 0x06, 0x05, TERMINATOR])
}

/** CAM_Memory Set — save the current position to preset slot (0-15). */
export function presetSave(slot: number): Buffer {
  const clamped = Math.max(0, Math.min(15, Math.round(slot)))
  return Buffer.from([ADDRESS, 0x01, 0x04, 0x3f, 0x01, clamped, TERMINATOR])
}

/** CAM_Memory Recall — move to a saved preset slot (0-15). */
export function presetRecall(slot: number): Buffer {
  const clamped = Math.max(0, Math.min(15, Math.round(slot)))
  return Buffer.from([ADDRESS, 0x01, 0x04, 0x3f, 0x02, clamped, TERMINATOR])
}

/**
 * CAM_VersionInq — a harmless, non-destructive inquiry used purely as a
 * connectivity/"is anyone home" check. Inquiries use address bits 0x9 (not
 * 0x8) per the VISCA spec's command/inquiry addressing split.
 */
export function versionInquiry(): Buffer {
  return Buffer.from([0x81 | 0x08, 0x09, 0x00, 0x02, TERMINATOR])
}

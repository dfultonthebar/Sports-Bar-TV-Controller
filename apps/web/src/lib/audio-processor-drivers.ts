/**
 * Audio-processor drivers — broken out by MANUFACTURER and MODEL (v2.82.44).
 *
 * Centralizes what used to be scattered per-type conditionals + duplicated model lists: each
 * manufacturer (AtlasIED, dbx, BSS, Shure) is one driver with its models, default TCP port,
 * connection type, and capabilities. Mirrors the streaming device-driver pattern
 * (`@/lib/device-drivers`).
 *
 * Also exports `resolveProcessorConnection()` — the fix for the "no IP even though I entered one"
 * config errors: Atlas config sub-routes required `processorIp` in the request, so a stale/empty
 * in-memory ipAddress in the UI produced "Processor IP is required" even though the processor was
 * saved with an IP. Callers can now pass the `processorId` (always known) and the IP is resolved
 * from the SAVED processor row.
 */
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'

export type AudioManufacturer = 'atlas' | 'dbx-zonepro' | 'bss-blu' | 'shure-slxd'

export interface AudioModel {
  value: string
  label: string
  zones: number
  inputs?: number
  outputs?: number
  hasEthernet?: boolean
  hasDante?: boolean
  hasCobraNet?: boolean
}

export interface AudioProcessorDriver {
  manufacturer: AudioManufacturer
  brand: string // display brand styling per CLAUDE.md terminology
  label: string
  defaultTcpPort: number
  /** 'ethernet' | 'rs232' | 'auto' (auto = decided per-model, e.g. dbx 'm'-suffix = ethernet) */
  connectionType: 'ethernet' | 'rs232' | 'auto'
  /** false for Shure SLX-D — it's an RF monitor, NOT an audio routing processor */
  isRoutingProcessor: boolean
  defaultModel: string
  models: AudioModel[]
}

const ATLAS_MODELS: AudioModel[] = [
  { value: 'AZM4', label: 'AZM4 - 4-Zone Processor', zones: 4 },
  { value: 'AZM8', label: 'AZM8 - 8-Zone Processor', zones: 8 },
  { value: 'AZMP4', label: 'AZMP4 - 4-Zone with 600W Amp', zones: 4 },
  { value: 'AZMP8', label: 'AZMP8 - 8-Zone with 1200W Amp', zones: 8 },
  { value: 'AZM4-D', label: 'AZM4-D - 4-Zone with Dante', zones: 4 },
  { value: 'AZM8-D', label: 'AZM8-D - 8-Zone with Dante', zones: 8 },
]

const DBX_MODELS: AudioModel[] = [
  { value: 'ZonePRO 640', label: 'ZonePRO 640 - 6x4 (RS-232)', zones: 4, hasEthernet: false },
  { value: 'ZonePRO 640m', label: 'ZonePRO 640m - 6x4 (Ethernet)', zones: 4, hasEthernet: true },
  { value: 'ZonePRO 641', label: 'ZonePRO 641 - 6x4 Mic (RS-232)', zones: 4, hasEthernet: false },
  { value: 'ZonePRO 641m', label: 'ZonePRO 641m - 6x4 Mic (Ethernet)', zones: 4, hasEthernet: true },
  { value: 'ZonePRO 1260', label: 'ZonePRO 1260 - 12x6 (RS-232)', zones: 6, hasEthernet: false },
  { value: 'ZonePRO 1260m', label: 'ZonePRO 1260m - 12x6 (Ethernet)', zones: 6, hasEthernet: true },
  { value: 'ZonePRO 1261', label: 'ZonePRO 1261 - 12x6 Mic (RS-232)', zones: 6, hasEthernet: false },
  { value: 'ZonePRO 1261m', label: 'ZonePRO 1261m - 12x6 Mic (Ethernet)', zones: 6, hasEthernet: true },
]

const BSS_MODELS: AudioModel[] = [
  { value: 'BLU-50', label: 'BLU-50 - 4x4 Signal Processor', inputs: 4, outputs: 4, zones: 4, hasDante: false, hasCobraNet: false },
  { value: 'BLU-100', label: 'BLU-100 - 12x8 Signal Processor', inputs: 12, outputs: 8, zones: 8, hasDante: false, hasCobraNet: false },
  { value: 'BLU-120', label: 'BLU-120 - Configurable I/O', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false },
  { value: 'BLU-160', label: 'BLU-160 - Configurable I/O (EN 54-16)', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: false },
  { value: 'BLU-320', label: 'BLU-320 - I/O Expander + CobraNet', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true },
  { value: 'BLU-800', label: 'BLU-800 - Signal Processor + CobraNet', inputs: 16, outputs: 16, zones: 8, hasDante: false, hasCobraNet: true },
  { value: 'BLU-806', label: 'BLU-806 - Signal Processor + Dante', inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false },
  { value: 'BLU-806DA', label: 'BLU-806DA - Signal Processor + Dante/AES67', inputs: 16, outputs: 16, zones: 8, hasDante: true, hasCobraNet: false },
]

// Shure SLX-D wireless mic receivers. "zones" = channel count. RF-monitor only (NOT routing).
const SHURE_SLXD_MODELS: AudioModel[] = [
  { value: 'SLXD4', label: 'SLXD4 - Single Channel Receiver', zones: 1 },
  { value: 'SLXD4D', label: 'SLXD4D - Dual Channel Receiver', zones: 2 },
  { value: 'SLXD24', label: 'SLXD24 - Handheld Combo (single)', zones: 1 },
  { value: 'SLXD24D', label: 'SLXD24D - Dual Handheld Combo', zones: 2 },
  { value: 'SLXD14', label: 'SLXD14 - Bodypack Combo (single)', zones: 1 },
  { value: 'SLXD14D', label: 'SLXD14D - Dual Bodypack Combo', zones: 2 },
]

export const AUDIO_PROCESSOR_DRIVERS: Record<AudioManufacturer, AudioProcessorDriver> = {
  atlas: {
    manufacturer: 'atlas', brand: 'AtlasIED', label: 'AtlasIED AZM / AZMP',
    defaultTcpPort: HARDWARE_CONFIG.atlas.tcpPort, connectionType: 'ethernet',
    isRoutingProcessor: true, defaultModel: 'AZM8', models: ATLAS_MODELS,
  },
  'dbx-zonepro': {
    manufacturer: 'dbx-zonepro', brand: 'dbx', label: 'dbx ZonePRO',
    defaultTcpPort: 3804, connectionType: 'auto',
    isRoutingProcessor: true, defaultModel: 'ZonePRO 640m', models: DBX_MODELS,
  },
  'bss-blu': {
    manufacturer: 'bss-blu', brand: 'BSS', label: 'BSS Soundweb London BLU',
    defaultTcpPort: 1023, connectionType: 'ethernet',
    isRoutingProcessor: true, defaultModel: 'BLU-100', models: BSS_MODELS,
  },
  'shure-slxd': {
    manufacturer: 'shure-slxd', brand: 'Shure', label: 'Shure SLX-D (RF monitor only)',
    defaultTcpPort: 2202, connectionType: 'ethernet',
    isRoutingProcessor: false, defaultModel: 'SLXD4D', models: SHURE_SLXD_MODELS,
  },
}

/** Resolve a driver by manufacturer key; defaults to Atlas (the installed base). */
export function getAudioProcessorDriver(processorType?: string | null): AudioProcessorDriver {
  const key = (processorType || 'atlas') as AudioManufacturer
  return AUDIO_PROCESSOR_DRIVERS[key] || AUDIO_PROCESSOR_DRIVERS.atlas
}

/** Look up a model spec within a manufacturer. */
export function getAudioModel(processorType: string | null | undefined, model: string): AudioModel | null {
  return getAudioProcessorDriver(processorType).models.find((m) => m.value === model) || null
}

export interface ProcessorConnection {
  id: string
  name: string
  ipAddress: string
  tcpPort: number
  processorType: AudioManufacturer
  model: string
  driver: AudioProcessorDriver
}

/**
 * Resolve a processor's connection (IP + port + driver) from either an explicit IP or — preferably
 * — a processorId looked up in the DB. THE FIX for "no IP": pass the processorId (always known by
 * the UI) and the IP comes from the saved row, so a stale/empty in-memory ipAddress no longer
 * produces "Processor IP is required". Returns null only when neither resolves.
 */
export async function resolveProcessorConnection(opts: {
  processorId?: string | null
  processorIp?: string | null
}): Promise<ProcessorConnection | null> {
  const { processorId, processorIp } = opts
  if (processorId) {
    try {
      const rows = await db.select().from(schema.audioProcessors)
        .where(eq(schema.audioProcessors.id, processorId)).limit(1)
      const p: any = rows?.[0]
      if (p?.ipAddress) {
        const driver = getAudioProcessorDriver(p.processorType)
        return {
          id: p.id, name: p.name, ipAddress: p.ipAddress,
          tcpPort: p.tcpPort || driver.defaultTcpPort,
          processorType: driver.manufacturer, model: p.model, driver,
        }
      }
    } catch { /* fall through to a directly-provided IP */ }
  }
  if (processorIp) {
    try {
      const rows = await db.select().from(schema.audioProcessors)
        .where(eq(schema.audioProcessors.ipAddress, processorIp)).limit(1)
      const p: any = rows?.[0]
      const driver = getAudioProcessorDriver(p?.processorType)
      return {
        id: p?.id || '', name: p?.name || '', ipAddress: processorIp,
        tcpPort: p?.tcpPort || driver.defaultTcpPort,
        processorType: driver.manufacturer, model: p?.model || driver.defaultModel, driver,
      }
    } catch {
      const driver = getAudioProcessorDriver('atlas')
      return { id: '', name: '', ipAddress: processorIp, tcpPort: driver.defaultTcpPort, processorType: 'atlas', model: driver.defaultModel, driver }
    }
  }
  return null
}

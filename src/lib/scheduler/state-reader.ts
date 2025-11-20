/**
 * State Reader Service
 *
 * Captures current system state for intelligent content distribution:
 * - What's playing on each matrix input
 * - Which outputs (TVs) are showing which inputs
 * - Available inputs by type (Cable, DirecTV, Fire TV, Atmosphere)
 * - TV zone assignments
 * - Channel information
 */

import { db } from '@/db'
import { schema } from '@/db'
import { eq, and, inArray } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export interface InputChannelState {
  inputNumber: number
  inputLabel: string
  deviceType: 'cable' | 'directv' | 'firetv' | 'atmosphere' | 'unknown'
  deviceId?: string
  channelNumber?: string
  channelName?: string | null
  showName?: string | null
  isLiveEvent: boolean
  lastUpdated?: string
}

export interface OutputState {
  outputNumber: number
  zoneName?: string
  zoneType?: 'main' | 'bar' | 'viewing-area' | 'side' | 'patio' | 'other'
  currentInput?: number
  currentChannel?: InputChannelState
}

export interface AvailableInput {
  inputNumber: number
  label: string
  deviceType: 'cable' | 'directv' | 'firetv' | 'atmosphere'
  deviceId?: string
  isAvailable: boolean
  capabilities: {
    canChangechannel: boolean
    hasGuideData: boolean
    supportsSports: boolean
  }
}

export interface SystemState {
  timestamp: string
  totalInputs: number
  totalOutputs: number
  inputs: InputChannelState[]
  outputs: OutputState[]
  availableInputs: AvailableInput[]
  summary: {
    activeGames: number
    idleInputs: number
    atmosphereInputs: number
    cableInputs: number
    directvInputs: number
    firetvInputs: number
  }
}

export class StateReader {
  /**
   * Get complete system state snapshot
   */
  async getSystemState(): Promise<SystemState> {
    const timestamp = new Date().toISOString()

    logger.info('[STATE_READER] Capturing system state snapshot...')

    // Parallel data fetch for performance
    const [inputs, routes, matrixInputs, matrixOutputs] = await Promise.all([
      this.getInputChannelStates(),
      this.getMatrixRoutes(),
      this.getMatrixInputs(),
      this.getMatrixOutputs()
    ])

    // Build available inputs list
    const availableInputs = await this.getAvailableInputs(matrixInputs)

    // Map outputs with current input/channel info
    const outputs = matrixOutputs.map(output => {
      const route = routes.find(r => r.outputNum === output.channelNumber)
      const currentInput = route?.inputNum
      const currentChannel = currentInput
        ? inputs.find(i => i.inputNumber === currentInput)
        : undefined

      return {
        outputNumber: output.channelNumber,
        zoneName: output.label || undefined,
        zoneType: this.inferZoneType(output.label),
        currentInput,
        currentChannel
      }
    })

    // Calculate summary stats
    const summary = {
      activeGames: inputs.filter(i => i.isLiveEvent).length,
      idleInputs: inputs.filter(i => !i.channelNumber).length,
      atmosphereInputs: inputs.filter(i => i.deviceType === 'atmosphere').length,
      cableInputs: inputs.filter(i => i.deviceType === 'cable').length,
      directvInputs: inputs.filter(i => i.deviceType === 'directv').length,
      firetvInputs: inputs.filter(i => i.deviceType === 'firetv').length
    }

    const state: SystemState = {
      timestamp,
      totalInputs: matrixInputs.length,
      totalOutputs: matrixOutputs.length,
      inputs,
      outputs,
      availableInputs,
      summary
    }

    logger.info(`[STATE_READER] State captured: ${state.totalInputs} inputs, ${state.totalOutputs} outputs, ${summary.activeGames} active games`)

    return state
  }

  /**
   * Get current channel state for all matrix inputs
   */
  private async getInputChannelStates(): Promise<InputChannelState[]> {
    try {
      const channelStates = await db
        .select()
        .from(schema.inputCurrentChannels)

      return channelStates.map(state => ({
        inputNumber: state.inputNumber,
        inputLabel: state.inputLabel,
        deviceType: this.normalizeDeviceType(state.deviceType),
        deviceId: state.deviceId || undefined,
        channelNumber: state.channelNumber || undefined,
        channelName: state.channelName,
        showName: state.showName,
        isLiveEvent: this.isLiveEvent(state.showName, state.channelName),
        lastUpdated: state.lastUpdated || undefined
      }))
    } catch (error) {
      logger.error('[STATE_READER] Error fetching input channel states:', error)
      return []
    }
  }

  /**
   * Get current matrix routing configuration
   */
  private async getMatrixRoutes() {
    try {
      return await db
        .select()
        .from(schema.matrixRoutes)
    } catch (error) {
      logger.error('[STATE_READER] Error fetching matrix routes:', error)
      return []
    }
  }

  /**
   * Get all matrix inputs
   */
  private async getMatrixInputs() {
    try {
      return await db
        .select()
        .from(schema.matrixInputs)
        .orderBy(schema.matrixInputs.channelNumber)
    } catch (error) {
      logger.error('[STATE_READER] Error fetching matrix inputs:', error)
      return []
    }
  }

  /**
   * Get all matrix outputs
   */
  private async getMatrixOutputs() {
    try {
      return await db
        .select()
        .from(schema.matrixOutputs)
        .orderBy(schema.matrixOutputs.channelNumber)
    } catch (error) {
      logger.error('[STATE_READER] Error fetching matrix outputs:', error)
      return []
    }
  }

  /**
   * Build list of available inputs with capabilities
   */
  private async getAvailableInputs(matrixInputs: any[]): Promise<AvailableInput[]> {
    const availableInputs: AvailableInput[] = []

    for (const input of matrixInputs) {
      const deviceType = this.normalizeDeviceType(input.deviceType || 'unknown')

      // Determine capabilities based on device type
      const capabilities = {
        canChangechannel: ['cable', 'directv'].includes(deviceType),
        hasGuideData: ['cable', 'directv'].includes(deviceType),
        supportsSports: ['cable', 'directv', 'firetv'].includes(deviceType)
      }

      availableInputs.push({
        inputNumber: input.channelNumber,
        label: input.label,
        deviceType: deviceType === 'unknown' ? 'cable' : deviceType,
        deviceId: input.deviceId || undefined,
        isAvailable: true, // Could check device online status here
        capabilities
      })
    }

    return availableInputs
  }

  /**
   * Normalize device type string
   */
  private normalizeDeviceType(type: string): 'cable' | 'directv' | 'firetv' | 'atmosphere' | 'unknown' {
    const normalized = type.toLowerCase().trim()

    if (normalized.includes('cable') || normalized.includes('spectrum')) return 'cable'
    if (normalized.includes('directv') || normalized.includes('direct tv')) return 'directv'
    if (normalized.includes('fire') || normalized.includes('amazon')) return 'firetv'
    if (normalized.includes('atmosphere')) return 'atmosphere'

    return 'unknown'
  }

  /**
   * Detect if current content is a live event
   */
  private isLiveEvent(showName?: string | null, channelName?: string | null): boolean {
    if (!showName && !channelName) return false

    const content = `${showName || ''} ${channelName || ''}`.toLowerCase()

    // Sport keywords
    const sportKeywords = [
      'game', 'vs', 'at ', ' @ ',
      'football', 'basketball', 'baseball', 'hockey', 'soccer',
      'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'mls',
      'playoff', 'championship', 'final', 'series',
      'live sports', 'sportscenter', 'nascar', 'ufc', 'boxing'
    ]

    return sportKeywords.some(keyword => content.includes(keyword))
  }

  /**
   * Infer zone type from label
   */
  private inferZoneType(label?: string): OutputState['zoneType'] {
    if (!label) return 'other'

    const lower = label.toLowerCase()

    if (lower.includes('main') || lower.includes('center')) return 'main'
    if (lower.includes('bar')) return 'bar'
    if (lower.includes('viewing') || lower.includes('watch')) return 'viewing-area'
    if (lower.includes('side') || lower.includes('wall')) return 'side'
    if (lower.includes('patio') || lower.includes('outdoor')) return 'patio'

    return 'other'
  }

  /**
   * Get inputs by device type
   */
  async getInputsByType(deviceType: 'cable' | 'directv' | 'firetv' | 'atmosphere'): Promise<AvailableInput[]> {
    const state = await this.getSystemState()
    return state.availableInputs.filter(input => input.deviceType === deviceType)
  }

  /**
   * Get outputs by zone
   */
  async getOutputsByZone(zone: OutputState['zoneType']): Promise<OutputState[]> {
    const state = await this.getSystemState()
    return state.outputs.filter(output => output.zoneType === zone)
  }

  /**
   * Find idle inputs (not showing live content)
   */
  async getIdleInputs(): Promise<InputChannelState[]> {
    const state = await this.getSystemState()
    return state.inputs.filter(input => !input.isLiveEvent)
  }

  /**
   * Get current games/events across all inputs
   */
  async getCurrentGames(): Promise<InputChannelState[]> {
    const state = await this.getSystemState()
    return state.inputs.filter(input => input.isLiveEvent)
  }

  /**
   * Check if specific input is available
   */
  async isInputAvailable(inputNumber: number): Promise<boolean> {
    const state = await this.getSystemState()
    const input = state.availableInputs.find(i => i.inputNumber === inputNumber)
    return input?.isAvailable || false
  }

  /**
   * Get recommended inputs for sports (prioritize cable/DirecTV)
   */
  async getSportsInputs(): Promise<AvailableInput[]> {
    const state = await this.getSystemState()
    return state.availableInputs
      .filter(input => input.capabilities.supportsSports)
      .sort((a, b) => {
        // Prioritize: cable, directv, firetv
        const order = { cable: 1, directv: 2, firetv: 3, atmosphere: 4 }
        return (order[a.deviceType] || 999) - (order[b.deviceType] || 999)
      })
  }
}

// Singleton instance
let readerInstance: StateReader | null = null

export function getStateReader(): StateReader {
  if (!readerInstance) {
    readerInstance = new StateReader()
  }
  return readerInstance
}

export function resetStateReader(): void {
  readerInstance = null
}

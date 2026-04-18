

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Tv,
  Power,
  Volume2,
  Zap,
  ListVideo,
  Music2,
  Radio,
  Lightbulb,
  Music,
  Monitor,
  Loader2,
  Clock,
  MoreHorizontal,
  X
} from 'lucide-react'
import EnhancedChannelGuideBartenderRemote from '@/components/EnhancedChannelGuideBartenderRemote'
import BartenderMusicControl from '@/components/BartenderMusicControl'
import BartenderRemoteAudioPanel from '@/components/BartenderRemoteAudioPanel'
import InteractiveBartenderLayout from '@/components/InteractiveBartenderLayout'
import BartenderRemoteSelector from '@/components/BartenderRemoteSelector'
import DMXLightingRemote from '@/components/dmx/DMXLightingRemote'
import DJControlPanel from '@/components/DJControlPanel'
import ScheduledGamesPanel from '@/components/ScheduledGamesPanel'
import RecoveryConfirmationPopup from '@/components/RecoveryConfirmationPopup'
import { CommercialLightingRemote } from '@/components/commercial-lighting'
import AtmosphereControl from '@/components/AtmosphereControl'
import ShiftBriefTile from '@/components/ai/ShiftBriefTile'

import { logger } from '@sports-bar/logger'
interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
  isCecPort: boolean
}

interface IRDevice {
  id: string
  name: string
  brand: string
  deviceType: string
  inputChannel: number
  matrixInput?: number
  controlMethod: 'IP' | 'GlobalCache'
  deviceIpAddress?: string
  ipControlPort?: number
  iTachAddress?: string
  iTachPort?: number
  codesetId?: string
  isActive: boolean
}

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType: string
  inputChannel?: number
  isOnline: boolean
  controlMethod: 'IP'
  deviceType: 'DirecTV'
}

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  deviceType: string
  inputChannel?: number
  isOnline: boolean
  controlMethod: 'IP'
}

type AllDeviceTypes = IRDevice | DirecTVDevice | FireTVDevice

interface TVLayoutZone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label?: string
}

interface TVLayout {
  id?: string
  name: string
  imageUrl?: string
  originalFileUrl?: string
  fileType?: string
  zones: TVLayoutZone[]
}

export default function BartenderRemotePage() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [directvDevices, setDirectvDevices] = useState<DirecTVDevice[]>([])
  const [firetvDevices, setFiretvDevices] = useState<FireTVDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<AllDeviceTypes | null>(null)
  const [, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [tvLayout, setTVLayout] = useState<TVLayout>({
    name: 'Bar Layout',
    zones: [] as any[]
  })
  const [isRouting, setIsRouting] = useState(false)
  const [matrixConfig, setMatrixConfig] = useState<any>(null)
  const [currentSources, setCurrentSources] = useState<Map<number, number>>(new Map()) // outputNumber -> inputNumber

  // Multi-view card state
  const [multiViewMode, setMultiViewMode] = useState<number>(0)
  const [multiViewCardId, setMultiViewCardId] = useState<string | null>(null)
  const [multiViewLoading, setMultiViewLoading] = useState(false)

  // Channel digit buffer for tracking manual channel entry
  const digitBufferRef = useRef<string>('')
  const digitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Audio processor state
  const [audioProcessorIp, setAudioProcessorIp] = useState<string>('')
  const [audioProcessorId, setAudioProcessorId] = useState<string | undefined>(undefined)
  const [audioProcessorType, setAudioProcessorType] = useState<string>('atlas')

  // Network TV state
  const [networkTVs, setNetworkTVs] = useState<{ id: string; name?: string | null; outputLabel?: string | null; outputNumber?: number | null; matrixOutputId?: string | null; ipAddress: string; brand: string; model?: string; port: number; macAddress?: string; authToken?: string | null; status: string; currentInput?: string | null; supportsPower: boolean; supportsInput: boolean }[]>([])
  const [editingTVName, setEditingTVName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState('')
  const [tvPowerLoading, setTvPowerLoading] = useState<string | null>(null)
  const [tvInputLoading, setTvInputLoading] = useState<string | null>(null)
  const [tvBulkLoading, setTvBulkLoading] = useState<string | null>(null)
  const [tvMessage, setTvMessage] = useState<string | null>(null)
  const [matrixOutputs, setMatrixOutputs] = useState<{ id: string; channelNumber: number; label: string }[]>([])
  const [assigningOutput, setAssigningOutput] = useState<string | null>(null)
  const [pairingTVId, setPairingTVId] = useState<string | null>(null)

  // Bartender remote visibility settings
  const [dmxLightingEnabled, setDmxLightingEnabled] = useState(false)
  const [commercialLightingEnabled, setCommercialLightingEnabled] = useState(false)
  const [djControlsEnabled, setDjControlsEnabled] = useState(false)
  const lightingEnabled = dmxLightingEnabled || commercialLightingEnabled

  // Tab state
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'power' | 'guide' | 'music' | 'remote' | 'routing' | 'dj' | 'lighting' | 'schedule'>('video')
  // "More" overflow sheet for admin tabs (Schedule, DJ) — Direction B keeps
  // the core + ambient + emergency (Power) tabs always visible; tapping
  // admin items auto-closes the sheet.
  const [moreOpen, setMoreOpen] = useState(false)

  // System time state - initialize with null to avoid hydration mismatch
  const [currentTime, setCurrentTime] = useState<string | null>(null)

  // Routing matrix state
  const [routingStatus, setRoutingStatus] = useState<string>('')
  const [loadingRoutes, setLoadingRoutes] = useState(false)

  // Channel tracking state
  const [currentChannels, setCurrentChannels] = useState<Record<number, {
    channelNumber: string
    channelName: string | null
    deviceType: string
    inputLabel: string
  }>>({})



  // Fetch lighting visibility settings
  const fetchLightingSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/lighting')
      const result = await response.json()
      if (result.success && result.data) {
        setDmxLightingEnabled(result.data.dmxLightingEnabled)
        setCommercialLightingEnabled(result.data.commercialLightingEnabled)
        setDjControlsEnabled(result.data.djControlsEnabled ?? false)
      }
    } catch (error) {
      logger.error('Failed to fetch lighting settings:', error)
    }
  }, [])

  // Update system time every second - only runs on client after hydration
  useEffect(() => {
    const formatTime = () => new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })

    // Set initial time after mount
    setCurrentTime(formatTime())

    const timeInterval = setInterval(() => {
      setCurrentTime(formatTime())
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  useEffect(() => {
    loadInputs()
    loadIRDevices()
    loadDirecTVDevices()
    loadFireTVDevices()
    loadNetworkTVs()
    loadTVLayout()
    loadAudioProcessor()
    fetchLightingSettings()
    // Also fetch matrix data on initial load
    fetchMatrixData()
    loadCurrentChannels()
    loadMultiViewCard()

    // Establish persistent connection on component mount
    establishPersistentConnection()

    // Poll connection status and channel data every 10 seconds
    const statusInterval = setInterval(() => {
      checkConnectionStatus()
      loadCurrentChannels()
    }, 10000)

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval)
    }
  }, [fetchLightingSettings])

  // Poll TV status every 30 seconds while on the Power tab
  useEffect(() => {
    if (activeTab !== 'power') return

    const interval = setInterval(() => {
      checkTVStatus()
    }, 30000)

    return () => clearInterval(interval)
  }, [activeTab])

  // Route state and channel data have different cost profiles and need
  // different poll strategies:
  //
  // - loadCurrentRoutes() → hits /api/matrix/routes → on cache miss that
  //   path queries the Wolf Pack over HTTP (login + index.php + o2ox), and
  //   the Wolf Pack firmware beeps on every authenticated HTTP request.
  //   With the iPad always on and the page always in the Video tab, a 15s
  //   background interval here means a beep every 30-something seconds
  //   (first poll misses cache, next hits, next misses...). Bartenders
  //   understandably hate this. Fix: NO interval. Load once on mount and
  //   on tab switch, then rely on:
  //     * `routeInputToOutput` updating local `currentSources` on a route
  //       click (no re-fetch needed),
  //     * the server-side `updateRoutesCache()` in the POST handler
  //       keeping the cache fresh when we know the new state,
  //     * the existing Refresh button in the Routing tab for explicit
  //       operator refreshes.
  //
  // - loadCurrentChannels() → hits /api/matrix/current-channels → pure
  //   SQLite read from the InputCurrentChannel table, no hardware I/O.
  //   Cheap, no beep. Polling every 15s here is fine — the bartender
  //   wants to see live channel changes for scheduled games.
  useEffect(() => {
    if (activeTab !== 'routing' && activeTab !== 'video') return

    loadCurrentRoutes()
    loadCurrentChannels()
    const interval = setInterval(() => {
      loadCurrentChannels()
    }, 15000)

    return () => clearInterval(interval)
  }, [activeTab])

  // Clear digit buffer when the selected input changes (user switches cable boxes)
  // to prevent stale digits from firing a tune on the newly selected device
  useEffect(() => {
    if (digitTimerRef.current) {
      clearTimeout(digitTimerRef.current)
      digitTimerRef.current = null
    }
    digitBufferRef.current = ''
  }, [selectedInput])

  useEffect(() => {
    // Re-fetch matrix data when layout zones change (but skip initial empty state)
    if (tvLayout.zones.length > 0) {
      fetchMatrixData()
    }
  }, [tvLayout.zones.length])

  const fetchMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.configs?.length > 0) {
          const activeConfig = data.configs[0]
          // Use ALL active inputs from Wolf Pack matrix, excluding CEC ports
          const matrixInputs = activeConfig.inputs?.filter((input: MatrixInput) =>
            input.isActive && !input.isCecPort
          ) || []
          
          // Always show matrix inputs if they exist, regardless of connection status
          setInputs(matrixInputs)
          
          // Set initial connection status from database, but this may be overridden by checkConnectionStatus
          setConnectionStatus(activeConfig.connectionStatus === 'connected' ? 'connected' : 'disconnected')
          setMatrixConfig(activeConfig)
          
          // Update TV layout zones with matrix output labels
          if (activeConfig.outputs && tvLayout.zones.length > 0) {
            const updatedZones = tvLayout.zones.map(zone => {
              const matchingOutput = activeConfig.outputs.find((output: any) => 
                output.channelNumber === zone.outputNumber
              )
              return {
                ...zone,
                label: matchingOutput?.label && !matchingOutput.label.match(/^Output \d+$/) 
                  ? matchingOutput.label 
                  : zone.label
              }
            })
            setTVLayout({ ...tvLayout, zones: updatedZones })
          }
        } else if (data.config) {
          // Fallback for direct config format
          const directInputs = data.inputs?.filter((input: MatrixInput) =>
            input.isActive && !input.isCecPort
          ) || []
          
          if (directInputs.length > 0) {
            setInputs(directInputs)
          }
          
          setConnectionStatus(data.config.connectionStatus === 'connected' ? 'connected' : 'disconnected')
          setMatrixConfig(data.config)
          
          if (data.outputs && tvLayout.zones.length > 0) {
            const updatedZones = tvLayout.zones.map(zone => {
              const matchingOutput = data.outputs.find((output: any) => 
                output.channelNumber === zone.outputNumber
              )
              return {
                ...zone,
                label: matchingOutput?.label && !matchingOutput.label.match(/^Output \d+$/) 
                  ? matchingOutput.label 
                  : zone.label
              }
            })
            setTVLayout({ ...tvLayout, zones: updatedZones })
          }
        }
      }
    } catch (error) {
      logger.error('Error fetching matrix data:', error)
    }
  }

  const loadInputs = async () => {
    // Matrix inputs are loaded via fetchMatrixData()
    // This function is kept for compatibility
  }

  const loadMultiViewCard = async () => {
    try {
      const response = await fetch('/api/wolfpack/multiview')
      if (response.ok) {
        const data = await response.json()
        if (data.cards?.length > 0) {
          setMultiViewCardId(data.cards[0].id)
          setMultiViewMode(data.cards[0].currentMode ?? 0)
        }
      }
    } catch (error) {
      logger.error('Error loading multi-view card:', error)
    }
  }

  const toggleMultiView = async () => {
    if (!multiViewCardId) return
    const newMode = multiViewMode === 0 ? 6 : 0 // Toggle between single and equal quad (mode 6)
    setMultiViewLoading(true)
    try {
      const response = await fetch(`/api/wolfpack/multiview/${multiViewCardId}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      })
      const data = await response.json()
      if (data.success) {
        setMultiViewMode(newMode)
        setCommandStatus(newMode === 7 ? 'Quad View enabled' : 'Single View enabled')
      } else {
        setCommandStatus(`Multi-view error: ${data.error}`)
      }
    } catch (error) {
      setCommandStatus('Failed to switch multi-view')
    } finally {
      setMultiViewLoading(false)
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const loadAudioProcessor = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      if (response.ok) {
        const data = await response.json()
        if (data.processors && data.processors.length > 0) {
          // Use the first audio processor found
          const processor = data.processors[0]
          setAudioProcessorIp(processor.ipAddress)
          setAudioProcessorId(processor.id)
          setAudioProcessorType(processor.processorType || 'atlas')
        }
      }
    } catch (error) {
      logger.error('Error loading audio processor:', error)
    }
  }

  const loadTVLayout = async () => {
    try {
      const response = await fetch('/api/bartender/layout')
      if (response.ok) {
        const data = await response.json()
        if (data.layout) {
          setTVLayout(data.layout)
        }
      }
    } catch (error) {
      logger.error('Error loading TV layout:', error)
    }
  }

  const loadIRDevices = async () => {
    try {
      const response = await fetch('/api/ir-devices')
      const data = await response.json()
      setIRDevices(data.devices || [])
    } catch (error) {
      logger.error('Error loading IR devices:', error)
    }
  }

  const loadDirecTVDevices = async () => {
    try {
      const response = await fetch('/api/directv-devices')
      const data = await response.json()
      if (data.devices) {
        const devices = data.devices.map((device: any) => ({
          ...device,
          controlMethod: 'IP' as const,
          deviceType: 'DirecTV' as const
        }))
        setDirectvDevices(devices)
      }
    } catch (error) {
      logger.error('Error loading DirecTV devices:', error)
    }
  }

  const loadFireTVDevices = async () => {
    try {
      const response = await fetch('/api/firetv-devices')
      const data = await response.json()
      if (data.devices) {
        const devices = data.devices.map((device: any) => ({
          ...device,
          controlMethod: 'IP' as const
        }))
        setFiretvDevices(devices)
      }
    } catch (error) {
      logger.error('Error loading Fire TV devices:', error)
    }
  }

  const pairNetworkTV = async (deviceId: string, deviceName: string) => {
    setPairingTVId(deviceId)
    setTvMessage('Pairing... Accept the popup on the TV screen')
    try {
      const response = await fetch(`/api/tv-control/${deviceId}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 30000 }),
      })
      const data = await response.json()
      if (data.success) {
        setTvMessage(`${deviceName} paired successfully!`)
        await loadNetworkTVs()
      } else {
        setTvMessage(data.error || `${deviceName} pairing failed`)
      }
    } catch (error) {
      setTvMessage(`${deviceName} pairing failed — device unreachable`)
    } finally {
      setPairingTVId(null)
      setTimeout(() => setTvMessage(null), 8000)
    }
  }

  const checkConnectionStatus = async () => {
    try {
      // Use the connection manager to get real-time status
      const response = await fetch('/api/matrix/connection-manager')
      const result = await response.json()
      if (result.success && result.connected) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const establishPersistentConnection = async () => {
    try {
      logger.info('Establishing persistent Wolf Pack connection...')
      const response = await fetch('/api/matrix/connection-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      })
      const result = await response.json()
      if (result.success && result.connected) {
        setConnectionStatus('connected')
        logger.info('✓ Wolf Pack connection established')
      } else {
        setConnectionStatus('disconnected')
        logger.info('✗ Failed to establish Wolf Pack connection:', result.error)
      }
    } catch (error) {
      setConnectionStatus('disconnected')
      logger.error('Error establishing connection:', error)
    }
  }

  const routeInputToOutput = async (inputNumber: number, outputNumber: number) => {
    // Allow routing attempt even if connection status shows disconnected
    // The actual routing API will handle connection failures gracefully

    setIsRouting(true)
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputNumber,
          output: outputNumber
        })
      })

      if (response.ok) {
        setCommandStatus(`✅ Routed to Output ${outputNumber}`)
        // Update current sources tracking
        const newSources = new Map(currentSources)
        newSources.set(outputNumber, inputNumber)
        setCurrentSources(newSources)
      } else {
        setCommandStatus('❌ Failed to route signal')
      }
    } catch (error) {
      logger.error('Error routing signal:', error)
      setCommandStatus('❌ Error routing signal')
    } finally {
      setIsRouting(false)
      // Clear status after 3 seconds
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const loadCurrentChannels = async () => {
    try {
      const response = await fetch('/api/matrix/current-channels')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.channels) {
          setCurrentChannels(data.channels)
        }
      }
    } catch (error) {
      logger.error('Error loading current channels:', error)
    }
  }

  const loadCurrentRoutes = async () => {
    setLoadingRoutes(true)
    try {
      const response = await fetch('/api/matrix/routes')
      if (response.ok) {
        const data = await response.json()
        // MERGE into the existing currentSources map rather than replacing.
        //
        // When /api/matrix/routes transiently drops an entry for an output —
        // which can happen if the Wolf Pack returns the 0xFFFF "settling"
        // sentinel during the ~500ms window right after a route command, and
        // the server-side filter strips that output from the response — a
        // plain map-replace would wipe the checkmark from the UI for one
        // poll cycle. Merging preserves the last-known-good value for any
        // output missing from this particular response, so the UI stays
        // stable while the hardware finishes settling.
        //
        // Trade-off: a genuinely-unrouted output (e.g., someone manually
        // clears a route via the Wolf Pack's own front panel) will show the
        // stale value until the next successful poll returns real data for
        // it. For a bar that's a strictly better UX than the checkmark
        // flicker this fixes — out-of-band unroutes are rare, transient
        // sentinels under bartender-driven poll cadence are common.
        setCurrentSources(prev => {
          const next = new Map(prev)
          data.routes?.forEach((route: any) => {
            next.set(route.outputNum, route.inputNum)
          })
          return next
        })
      }
    } catch (error) {
      logger.error('Error loading routes:', error)
    } finally {
      setLoadingRoutes(false)
    }
  }

  const loadNetworkTVs = async () => {
    try {
      const [devicesRes, outputsRes] = await Promise.all([
        fetch('/api/tv-discovery/devices'),
        fetch('/api/matrix/outputs'),
      ])
      if (devicesRes.ok) {
        const data = await devicesRes.json()
        setNetworkTVs(data.devices || [])
      }
      if (outputsRes.ok) {
        const data = await outputsRes.json()
        setMatrixOutputs((data.outputs || []).map((o: any) => ({ id: o.id, channelNumber: o.channelNumber, label: o.label })))
      }
    } catch (error) {
      logger.error('Error loading network TVs:', error)
    }
  }

  const checkTVStatus = async () => {
    try {
      const response = await fetch('/api/tv-discovery/status', { method: 'POST' })
      if (response.ok) {
        await loadNetworkTVs()
      }
    } catch (error) {
      logger.error('Error checking TV status:', error)
    }
  }

  const saveTVName = async (deviceId: string, name: string) => {
    try {
      await fetch('/api/tv-discovery/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId, name: name.trim() || null })
      })
      setEditingTVName(null)
      await loadNetworkTVs()
    } catch (error) {
      logger.error('Error saving TV name:', error)
    }
  }

  const assignTVOutput = async (deviceId: string, matrixOutputId: string | null) => {
    try {
      await fetch('/api/tv-discovery/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deviceId, matrixOutputId })
      })
      setAssigningOutput(null)
      await loadNetworkTVs()
    } catch (error) {
      logger.error('Error assigning TV output:', error)
    }
  }

  const sendTVPower = async (deviceId: string, action: 'on' | 'off' | 'toggle') => {
    setTvPowerLoading(`${deviceId}-${action}`)
    try {
      const response = await fetch(`/api/tv-control/${deviceId}/power`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await response.json()
      setTvMessage(data.success ? `Power ${action} sent` : (data.error || 'Failed'))
      setTimeout(() => setTvMessage(null), 3000)
    } catch {
      setTvMessage('Failed to send power command')
      setTimeout(() => setTvMessage(null), 3000)
    } finally {
      setTvPowerLoading(null)
    }
  }

  const sendTVBulkPower = async (action: 'on' | 'off' | 'toggle') => {
    setTvBulkLoading(action)
    try {
      const response = await fetch('/api/tv-control/bulk-power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await response.json()
      setTvMessage(data.message || `Bulk power ${action} complete`)
      setTimeout(() => setTvMessage(null), 5000)
    } catch {
      setTvMessage('Bulk power command failed')
      setTimeout(() => setTvMessage(null), 3000)
    } finally {
      setTvBulkLoading(null)
    }
  }

  const sendTVInput = async (deviceId: string, input: string) => {
    setTvInputLoading(`${deviceId}-${input}`)
    try {
      const response = await fetch(`/api/tv-control/${deviceId}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      })
      const data = await response.json()
      if (data.success) {
        // Optimistically update the current input in local state
        setNetworkTVs(prev => prev.map(tv => tv.id === deviceId ? { ...tv, currentInput: input } : tv))
      }
      setTvMessage(data.success ? `Switched to ${input.toUpperCase()}` : (data.error || 'Failed'))
      setTimeout(() => setTvMessage(null), 3000)
    } catch {
      setTvMessage('Failed to switch input')
      setTimeout(() => setTvMessage(null), 3000)
    } finally {
      setTvInputLoading(null)
    }
  }

  const handleRoutingMatrixClick = async (inputNum: number, outputNum: number) => {
    setRoutingStatus(`Routing input ${inputNum} to output ${outputNum}...`)
    setIsRouting(true)
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputNum, output: outputNum })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setRoutingStatus(`✓ Successfully routed input ${inputNum} to output ${outputNum}`)
        await loadCurrentRoutes() // Reload to show updated routing
        await loadCurrentChannels() // Reload channel info
      } else {
        setRoutingStatus(`✗ Failed to route: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      logger.error('Error routing:', error)
      setRoutingStatus('✗ Error routing signal')
    } finally {
      setIsRouting(false)
      // Clear status after 3 seconds
      setTimeout(() => setRoutingStatus(''), 3000)
    }
  }



  return (
    <div className="min-h-screen bg-sports-gradient">
      {/* Header */}
      <div className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-2">
              <h1 className="text-2xl font-bold text-slate-100">
                🏈 Bartender Remote Control
              </h1>
              <div className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-lg">
                <span className="text-lg font-mono font-semibold text-emerald-400">
                  {currentTime || '--:--:-- --'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-4">
              {/* Matrix connection status removed - technical info not needed for bartenders */}
              {commandStatus && (
                <div className="px-3 py-1 bg-primary-900/80 text-blue-200 border border-primary-800 rounded-full text-sm">
                  {commandStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - Changes based on active tab */}
      <div className="flex-1 px-4 pb-24 overflow-y-auto"> {/* pb-24 to make room for bottom tabs */}
        <RecoveryConfirmationPopup />
        {activeTab === 'video' && (
          <div className="w-full mx-auto space-y-4 px-1">
            <ShiftBriefTile />
            <InteractiveBartenderLayout
              layout={tvLayout}
              onInputSelect={routeInputToOutput}
              currentSources={currentSources}
              inputs={inputs}
              currentChannels={currentChannels}
              onRefreshRoutes={loadCurrentRoutes}
            />
            {selectedInput === 11 && <AtmosphereControl />}
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="max-w-7xl mx-auto">
            <BartenderRemoteAudioPanel
              processorIp={audioProcessorIp}
              processorId={audioProcessorId}
              processorType={audioProcessorType}
            />
          </div>
        )}

        {activeTab === 'power' && (
          <div className="max-w-7xl mx-auto pt-4 space-y-4">
            {/* Bulk Power Controls */}
            <div className="bg-slate-900/90 backdrop-blur rounded-lg p-4 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Power className="w-5 h-5 text-red-400" />
                    TV Power Control
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{networkTVs.length} TV{networkTVs.length !== 1 ? 's' : ''} available</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => sendTVBulkPower('toggle')}
                    disabled={!!tvBulkLoading || networkTVs.length === 0}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {tvBulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    Toggle All TVs
                  </button>
                </div>
              </div>
              {tvMessage && (
                <div className={`mt-3 p-2 rounded text-sm font-medium ${
                  tvMessage.toLowerCase().includes('fail') ? 'bg-red-900/40 text-red-300 border border-red-700/50' : 'bg-green-900/40 text-green-300 border border-green-700/50'
                }`}>
                  {tvMessage}
                </div>
              )}
            </div>

            {/* Individual TV Grid */}
            {networkTVs.length === 0 ? (
              <div className="bg-slate-800 rounded-lg p-8 text-center">
                <Tv className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No network TVs discovered yet.</p>
                <p className="text-slate-500 text-sm mt-1">Run a scan from Device Setup to find TVs.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...networkTVs].sort((a, b) => {
                  const aParts = a.ipAddress.split('.').map(Number)
                  const bParts = b.ipAddress.split('.').map(Number)
                  for (let i = 0; i < 4; i++) {
                    if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i]
                  }
                  return 0
                }).map((tv) => (
                  <div key={tv.id} className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/50">
                    {/* TV Header */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Tv className={`w-4 h-4 flex-shrink-0 ${tv.brand.toLowerCase() === 'samsung' ? 'text-blue-400' : tv.brand.toLowerCase() === 'roku' ? 'text-purple-400' : 'text-slate-400'}`} />
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tv.status === 'online' ? 'bg-green-500' : tv.status === 'standby' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      </div>
                      <span className="text-[10px] text-slate-500 uppercase">{tv.brand}</span>
                    </div>
                    {/* TV Name — uses Wolf Pack output label, custom name as override */}
                    {editingTVName === tv.id ? (
                      <div className="flex gap-1 mb-1">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTVName(tv.id, editNameValue)
                            if (e.key === 'Escape') setEditingTVName(null)
                          }}
                          autoFocus
                          className="flex-1 px-1.5 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs text-white focus:outline-none focus:border-blue-500 min-w-0"
                          placeholder="TV name..."
                        />
                        <button
                          onClick={() => saveTVName(tv.id, editNameValue)}
                          className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px]"
                        >OK</button>
                      </div>
                    ) : (
                      <p
                        onClick={() => { setEditingTVName(tv.id); setEditNameValue(tv.name || tv.outputLabel || '') }}
                        className="text-sm font-semibold text-white truncate mb-0.5 cursor-pointer hover:text-blue-300 transition-colors"
                        title="Click to rename"
                      >
                        {tv.name || tv.outputLabel || 'Unnamed TV'}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mb-3">
                      <p className="text-[10px] text-slate-500 font-mono">{tv.ipAddress}</p>
                      {assigningOutput === tv.id ? (
                        <select
                          value={tv.matrixOutputId || ''}
                          onChange={(e) => assignTVOutput(tv.id, e.target.value || null)}
                          autoFocus
                          onBlur={() => setAssigningOutput(null)}
                          className="text-[10px] bg-slate-700 border border-slate-600 text-white rounded px-1 py-0.5 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">None</option>
                          {matrixOutputs.map((o) => (
                            <option key={o.id} value={o.id}>Out {o.channelNumber}: {o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => setAssigningOutput(tv.id)}
                          className="text-[10px] text-slate-600 bg-slate-700/50 px-1 rounded cursor-pointer hover:text-blue-300 transition-colors"
                          title="Click to assign Wolf Pack output"
                        >
                          {tv.outputNumber ? `Out ${tv.outputNumber}` : 'Link output'}
                        </span>
                      )}
                    </div>

                    {/* Pair Button — Samsung TVs without auth token */}
                    {tv.brand.toLowerCase() === 'samsung' && !tv.authToken && (
                      <div className="mb-2">
                        <button
                          onClick={() => pairNetworkTV(tv.id, tv.name || tv.outputLabel || tv.ipAddress)}
                          disabled={pairingTVId === tv.id}
                          className="w-full py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {pairingTVId === tv.id ? <><Loader2 className="w-3 h-3 animate-spin" /> Waiting for TV...</> : <><Zap className="w-3 h-3" /> Pair</>}
                        </button>
                      </div>
                    )}

                    {/* Power Button */}
                    {tv.supportsPower && (
                      <div className="mb-2">
                        <button
                          onClick={() => sendTVPower(tv.id, 'toggle')}
                          disabled={tvPowerLoading === `${tv.id}-toggle`}
                          className={`w-full py-1.5 text-white rounded text-xs font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1 ${
                            tv.status === 'online' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {tvPowerLoading === `${tv.id}-toggle` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Power className="w-3 h-3" /> Power</>}
                        </button>
                      </div>
                    )}

                    {/* HDMI Input Buttons */}
                    {tv.supportsInput && (
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
                          <Monitor className="w-2.5 h-2.5" /> HDMI Input
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          {(['hdmi1', 'hdmi2', 'hdmi3', 'hdmi4'] as const).map((input) => (
                            <button
                              key={input}
                              onClick={() => sendTVInput(tv.id, input)}
                              disabled={tvInputLoading === `${tv.id}-${input}`}
                              className={`py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-50 ${
                                tv.currentInput === input
                                  ? 'bg-blue-600 text-white ring-1 ring-blue-400'
                                  : 'bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white'
                              }`}
                            >
                              {tvInputLoading === `${tv.id}-${input}` ? <Loader2 className="w-2.5 h-2.5 animate-spin mx-auto" /> : input.replace('hdmi', '')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {activeTab === 'music' && <BartenderMusicControl />}

        {activeTab === 'guide' && <EnhancedChannelGuideBartenderRemote />}

        {activeTab === 'remote' && <BartenderRemoteSelector />}

        {activeTab === 'routing' && (
          <div className="max-w-7xl mx-auto pt-4">
            <div className="bg-slate-900/90 backdrop-blur rounded-lg shadow-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Quick Routing Matrix</h3>
                  <p className="text-xs text-slate-400 mt-1">Tap a cell to route an input to an output</p>
                </div>
                {multiViewCardId && (
                  <button
                    onClick={toggleMultiView}
                    disabled={multiViewLoading}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                      multiViewMode === 6
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    } ${multiViewLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {multiViewLoading ? '...' : multiViewMode === 6 ? '■ Single View' : '⊞ Quad View'}
                  </button>
                )}
                <button
                  onClick={loadCurrentRoutes}
                  disabled={loadingRoutes}
                  className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:bg-slate-600"
                >
                  {loadingRoutes ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {/* Fixed-height status container to prevent layout shift */}
              <div className="mb-4 min-h-[52px]">
                {routingStatus && (
                  <div className={`p-3 rounded-md text-sm font-medium transition-opacity ${
                    routingStatus.includes('✓') ? 'bg-green-900/40 text-green-300 border border-green-700/50' :
                    routingStatus.includes('✗') ? 'bg-red-900/40 text-red-300 border border-red-700/50' :
                    'bg-blue-900/40 text-blue-300 border border-blue-700/50'
                  }`}>
                    {routingStatus}
                  </div>
                )}
              </div>

              <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-400px)] -mx-4 px-4">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="bg-slate-800 border border-slate-700 p-2 text-slate-200 font-semibold sticky left-0 z-30 text-xs">
                        Out \ In
                      </th>
                      {inputs.filter(input => input.isActive && !input.isCecPort).map((input) => {
                        const channelInfo = currentChannels[input.channelNumber]
                        const channelLabel = channelInfo
                          ? (channelInfo.channelName || `Ch ${channelInfo.channelNumber}`)
                          : null

                        return (
                          <th key={input.channelNumber} className="bg-slate-800 border border-slate-700 p-2 text-slate-200 text-xs min-w-[90px]">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-bold text-blue-400">IN {input.channelNumber}</span>
                              <span className="text-slate-400 text-[9px] truncate max-w-[80px]" title={input.label}>
                                {input.label}
                              </span>
                              {channelLabel && (
                                <span className="text-green-400 text-[9px] font-semibold truncate max-w-[80px]" title={channelLabel}>
                                  {channelLabel}
                                </span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixConfig?.outputs
                      ?.filter((output: any) => output.isActive)
                      .map((output: any) => {
                        const currentInput = currentSources.get(output.channelNumber)

                        return (
                          <tr key={output.channelNumber}>
                            <td className="bg-slate-800 border border-slate-700 p-2 font-semibold text-slate-200 sticky left-0 z-10 min-w-[100px]">
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="text-blue-400 font-bold text-xs">OUT {output.channelNumber}</span>
                                <span className="text-slate-300 text-[9px] truncate max-w-[90px]" title={output.label}>
                                  {output.label}
                                </span>
                              </div>
                            </td>
                            {inputs.filter(input => input.isActive && !input.isCecPort).map((input) => {
                              const isRouted = currentInput === input.channelNumber

                              return (
                                <td
                                  key={`${output.channelNumber}-${input.channelNumber}`}
                                  className={`border border-slate-700 p-2 text-center cursor-pointer transition-all active:scale-95 ${
                                    isRouted
                                      ? 'bg-green-600 hover:bg-green-700'
                                      : 'bg-slate-900 hover:bg-blue-700/50 active:bg-blue-600'
                                  } ${isRouting ? 'pointer-events-none opacity-50' : ''}`}
                                  onClick={() => handleRoutingMatrixClick(input.channelNumber, output.channelNumber)}
                                  title={`Route Input ${input.channelNumber} (${input.label}) to Output ${output.channelNumber} (${output.label})`}
                                >
                                  {isRouted && (
                                    <div className="flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <h4 className="font-semibold text-slate-200 mb-2 text-sm">Legend</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-slate-300">Active Route</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-slate-900 border border-slate-700 rounded flex-shrink-0"></div>
                    <span className="text-slate-300">Available Route</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dj' && djControlsEnabled && (
          <div className="max-w-7xl mx-auto pt-4">
            <DJControlPanel />
          </div>
        )}

        {activeTab === 'lighting' && lightingEnabled && (
          <div className="max-w-7xl mx-auto pt-4 space-y-4">
            {commercialLightingEnabled && <CommercialLightingRemote />}
            {dmxLightingEnabled && <DMXLightingRemote />}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="max-w-7xl mx-auto pt-4">
            <ScheduledGamesPanel />
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation — Direction B "Sky Signal" (v2.23.9)
       *
       * Single sky-400 accent for active state across all tiers.
       * Core tabs (Video / Guide / Routing / Remote): 52×60px, text-sm.
       * Ambient tabs (Audio / Music / Lighting): 44×52px, text-xs.
       * Emergency (Power): always visible, 44×44px.
       * Admin (Schedule / DJ): behind a "More" overflow sheet.
       *
       * Active = ring-1 ring-sky-400/50 + bg-sky-500/20 + text-sky-300 +
       * scale-[1.03]. The ring sits outside the box model so neighboring
       * tabs don't shift on activation.
       */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700/40 z-50">
        <div className="flex justify-around items-stretch gap-1 px-2 py-2">
          {/* Core tier — 52×60px, text-sm */}
          <button
            onClick={() => setActiveTab('video')}
            className={`min-h-[52px] min-w-[60px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3 rounded-xl transition-all ${
              activeTab === 'video'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tv className="h-5 w-5" />
            <span className="text-sm font-medium">Video</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`min-h-[52px] min-w-[60px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3 rounded-xl transition-all ${
              activeTab === 'guide'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListVideo className="h-5 w-5" />
            <span className="text-sm font-medium">Guide</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('routing')
              loadCurrentRoutes()
              loadCurrentChannels()
            }}
            className={`min-h-[52px] min-w-[60px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3 rounded-xl transition-all ${
              activeTab === 'routing'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="h-5 w-5" />
            <span className="text-sm font-medium">Routing</span>
          </button>

          <button
            onClick={() => setActiveTab('remote')}
            className={`min-h-[52px] min-w-[60px] flex flex-col items-center justify-center gap-1.5 px-2.5 py-3 rounded-xl transition-all ${
              activeTab === 'remote'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="h-5 w-5" />
            <span className="text-sm font-medium">Remote</span>
          </button>

          {/* Ambient tier — 44×52px, text-xs, text-slate-500 inactive */}
          {audioProcessorIp && (
            <button
              onClick={() => setActiveTab('audio')}
              className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all ${
                activeTab === 'audio'
                  ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Volume2 className="h-4 w-4" />
              <span className="text-xs font-medium">Audio</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('music')}
            className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all ${
              activeTab === 'music'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Music2 className="h-4 w-4" />
            <span className="text-xs font-medium">Music</span>
          </button>

          {lightingEnabled && (
            <button
              onClick={() => setActiveTab('lighting')}
              className={`min-h-[44px] min-w-[52px] flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all ${
                activeTab === 'lighting'
                  ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Lightbulb className="h-4 w-4" />
              <span className="text-xs font-medium">Lighting</span>
            </button>
          )}

          {/* Emergency — always visible, 44×44px */}
          <button
            onClick={() => {
              setActiveTab('power')
              checkTVStatus()
            }}
            className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all ${
              activeTab === 'power'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Power className="h-4 w-4" />
            <span className="text-xs font-medium">Power</span>
          </button>

          {/* Overflow — Schedule + DJ in a bottom sheet */}
          <button
            onClick={() => setMoreOpen(true)}
            className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-xl transition-all ${
              activeTab === 'schedule' || activeTab === 'dj'
                ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300 scale-[1.03]'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            aria-label="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="text-xs font-medium">More</span>
          </button>
        </div>
      </div>

      {/* More overflow sheet — Schedule + DJ (conditional) */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl px-4 pt-4 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-100">More options</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  setActiveTab('schedule')
                  setMoreOpen(false)
                }}
                className={`flex-1 min-w-[140px] min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700 transition-all ${
                  activeTab === 'schedule'
                    ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Clock className="h-5 w-5 flex-shrink-0" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Schedule</span>
                  <span className="text-xs opacity-70">Scheduled games</span>
                </div>
              </button>

              {djControlsEnabled && (
                <button
                  onClick={() => {
                    setActiveTab('dj')
                    setMoreOpen(false)
                  }}
                  className={`flex-1 min-w-[140px] min-h-[64px] flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700 transition-all ${
                    activeTab === 'dj'
                      ? 'ring-1 ring-sky-400/50 bg-sky-500/20 text-sky-300'
                      : 'bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <Music className="h-5 w-5 flex-shrink-0" />
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold">DJ Mode</span>
                    <span className="text-xs opacity-70">Assignment lock</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

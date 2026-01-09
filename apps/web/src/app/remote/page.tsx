

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Tv,
  Radio,
  Power,
  VolumeX,
  Volume2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Settings,
  MapPin,
  Zap,
  Volume1,
  VolumeIcon,
  Sliders,
  Speaker,
  Calendar,
  Music2,
  Gamepad2,
  Lightbulb
} from 'lucide-react'
import Image from 'next/image'
import SportsGuide from '@/components/SportsGuide'
import TVGuide from '@/components/TVGuide'
import EnhancedChannelGuideBartenderRemote from '@/components/EnhancedChannelGuideBartenderRemote'
import BartenderMusicControl from '@/components/BartenderMusicControl'
import BartenderRemoteAudioPanel from '@/components/BartenderRemoteAudioPanel'
import InteractiveBartenderLayout from '@/components/InteractiveBartenderLayout'
import FireTVAppShortcuts from '@/components/FireTVAppShortcuts'
import BartenderRemoteSelector from '@/components/BartenderRemoteSelector'
import DMXLightingRemote from '@/components/dmx/DMXLightingRemote'
import { CommercialLightingRemote } from '@/components/commercial-lighting'

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

interface RemoteCommand {
  display: string
  command: string
  icon?: any
  color?: string
}

const CHANNEL_COMMANDS: RemoteCommand[] = [
  { display: '1', command: '1' },
  { display: '2', command: '2' },
  { display: '3', command: '3' },
  { display: '4', command: '4' },
  { display: '5', command: '5' },
  { display: '6', command: '6' },
  { display: '7', command: '7' },
  { display: '8', command: '8' },
  { display: '9', command: '9' },
  { display: '0', command: '0' },
  { display: 'CH+', command: 'CH_UP', icon: ChevronUp },
  { display: 'CH-', command: 'CH_DOWN', icon: ChevronDown },
]

const CONTROL_COMMANDS: RemoteCommand[] = [
  { display: 'Power', command: 'POWER', icon: Power, color: 'bg-red-500' },
  { display: 'Vol+', command: 'VOL_UP', icon: Volume2, color: 'bg-blue-500' },
  { display: 'Vol-', command: 'VOL_DOWN', icon: VolumeX, color: 'bg-blue-500' },
  { display: 'Mute', command: 'MUTE', icon: VolumeX, color: 'bg-orange-500' },
]

export default function BartenderRemotePage() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [directvDevices, setDirectvDevices] = useState<DirecTVDevice[]>([])
  const [firetvDevices, setFiretvDevices] = useState<FireTVDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<AllDeviceTypes | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [tvLayout, setTVLayout] = useState<TVLayout>({
    name: 'Bar Layout',
    zones: [] as any[]
  })
  const [isRouting, setIsRouting] = useState(false)
  const [matrixConfig, setMatrixConfig] = useState<any>(null)
  const [currentSources, setCurrentSources] = useState<Map<number, number>>(new Map()) // outputNumber -> inputNumber

  // Audio processor state
  const [audioProcessorIp, setAudioProcessorIp] = useState<string>('192.168.5.101')
  const [audioProcessorId, setAudioProcessorId] = useState<string | undefined>(undefined)

  // Lighting visibility settings
  const [dmxLightingEnabled, setDmxLightingEnabled] = useState(false)
  const [commercialLightingEnabled, setCommercialLightingEnabled] = useState(false)
  const lightingEnabled = dmxLightingEnabled || commercialLightingEnabled

  // Tab state
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'power' | 'guide' | 'music' | 'remote' | 'routing' | 'lighting'>('video')

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
      }
    } catch (error) {
      logger.error('Failed to fetch lighting settings:', error)
    }
  }, [])

  useEffect(() => {
    loadInputs()
    loadIRDevices()
    loadDirecTVDevices()
    loadFireTVDevices()
    loadTVLayout()
    loadAudioProcessor()
    fetchLightingSettings()
    // Also fetch matrix data on initial load
    fetchMatrixData()
    loadCurrentChannels()

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

  const selectInput = async (inputNumber: number) => {
    setSelectedInput(inputNumber)
    
    // Find the corresponding device for this input from all device types
    let device: AllDeviceTypes | null = null

    // Check IR devices first
    device = irDevices.find(d => d.matrixInput === inputNumber && d.isActive) || null  // Fixed: use matrixInput for IR devices
    
    // Check DirecTV devices if no IR device found
    if (!device) {
      device = directvDevices.find(d => d.inputChannel === inputNumber) || null
    }
    
    // Check Fire TV devices if no other device found
    if (!device) {
      device = firetvDevices.find(d => d.inputChannel === inputNumber) || null
    }
    
    setSelectedDevice(device || null)
    
    const input = inputs.find(i => i.channelNumber === inputNumber)
    
    if (device) {
      const deviceBrand = 'brand' in device ? device.brand : (device.deviceType === 'DirecTV' ? 'DirecTV' : 'Amazon Fire TV')
      const controlType = device.controlMethod === 'IP' ? 'IP Control' : 'IR Control'
      setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`} → ${device.name} (${deviceBrand} - ${controlType})`)
    } else {
      setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`} ⚠️ No control device configured for this input`)
    }
    
    // Auto-clear status after 5 seconds
    setTimeout(() => {
      if (commandStatus.includes(input?.label || `Input ${inputNumber}`)) {
        setCommandStatus('')
      }
    }, 5000)
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

  const handleLabelUpdate = async (zoneId: string, newLabel: string) => {
    try {
      // Update local state immediately for responsive UI
      const updatedZones = tvLayout.zones.map(zone =>
        zone.id === zoneId ? { ...zone, label: newLabel } : zone
      )
      setTVLayout({ ...tvLayout, zones: updatedZones })

      // Save to backend if layout has an ID
      if (tvLayout.id) {
        await fetch('/api/bartender/layout', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layoutId: tvLayout.id,
            zones: updatedZones
          })
        })
      }
    } catch (error) {
      logger.error('Error updating label:', error)
    }
  }

  const handleZoneClick = (zone: TVLayoutZone) => {
    if (selectedInput && inputs.length > 0) {
      const input = inputs.find(i => i.channelNumber === selectedInput)
      if (input) {
        routeInputToOutput(input.channelNumber, zone.outputNumber)
      }
    } else {
      setCommandStatus('⚠️ Please select an input first')
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const sendIRCommand = async (command: string) => {
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    setLoading(true)
    setCommandStatus(`Sending ${command}...`)

    try {
      let response;
      
      // Handle DirecTV devices
      if (selectedDevice.deviceType === 'DirecTV') {
        const directvDevice = selectedDevice as DirecTVDevice
        response = await fetch('/api/directv-devices/send-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: directvDevice.id,
            command: command,
            ipAddress: directvDevice.ipAddress,
            port: directvDevice.port
          })
        })
      }
      // Handle Fire TV devices  
      else if ('deviceType' in selectedDevice && selectedDevice.deviceType !== 'DirecTV') {
        const firetvDevice = selectedDevice as FireTVDevice
        response = await fetch('/api/firetv-devices/send-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: firetvDevice.id,
            command: command,
            ipAddress: firetvDevice.ipAddress,
            port: firetvDevice.port
          })
        })
      }
      // Handle IR devices (original logic)
      else if (selectedDevice.controlMethod === 'IP' && 'deviceIpAddress' in selectedDevice && selectedDevice.deviceIpAddress) {
        const irDevice = selectedDevice as IRDevice
        response = await fetch('/api/ir-devices/send-ip-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: irDevice.id,
            command: command,
            ipAddress: irDevice.deviceIpAddress,
            port: irDevice.ipControlPort || 80
          })
        })
      } else if ('iTachAddress' in selectedDevice && selectedDevice.iTachAddress) {
        const irDevice = selectedDevice as IRDevice
        response = await fetch('/api/ir-devices/send-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: irDevice.id,
            command: command,
            iTachAddress: irDevice.iTachAddress
          })
        })
      } else {
        setCommandStatus('Device not configured')
        setLoading(false)
        return
      }

      const result = await response.json()
      
      if (response.ok) {
        setCommandStatus(`✓ Sent ${command} to ${selectedDevice.name}`)
      } else {
        setCommandStatus(`✗ Failed: ${result.error}`)
      }
    } catch (error) {
      logger.error('Error sending command:', error)
      setCommandStatus(`✗ Error sending ${command}`)
    } finally {
      setLoading(false)
    }
  }

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'gaming': return '🎮'
      default: return '📺'
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
        const routeMap = new Map<number, number>()
        data.routes?.forEach((route: any) => {
          routeMap.set(route.outputNum, route.inputNum)
        })
        setCurrentSources(routeMap)
      }
    } catch (error) {
      logger.error('Error loading routes:', error)
    } finally {
      setLoadingRoutes(false)
    }
  }

  const getInputLabelWithChannel = (inputNum: number): string => {
    const input = inputs.find(i => i.channelNumber === inputNum)
    if (!input) return `IN ${inputNum}`

    // Check if this input has current channel info
    const channelInfo = currentChannels[inputNum]
    if (channelInfo) {
      if (channelInfo.channelName) {
        // Show preset name if available (e.g., "ESPN")
        return channelInfo.channelName
      } else {
        // Show channel number if no preset name (e.g., "Ch 40")
        return `Ch ${channelInfo.channelNumber}`
      }
    }

    return input.label
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
            <h1 className="text-2xl font-bold text-slate-100 mb-2">
              🏈 Bartender Remote Control
            </h1>
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
        {activeTab === 'video' && (
          <div className="w-full max-w-7xl lg:max-w-full mx-auto space-y-4 px-2 sm:px-4 lg:px-8">
            <InteractiveBartenderLayout
              layout={tvLayout}
              onInputSelect={routeInputToOutput}
              currentSources={currentSources}
              inputs={inputs}
              currentChannels={currentChannels}
            />
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="max-w-7xl mx-auto">
            <BartenderRemoteAudioPanel 
              processorIp={audioProcessorIp}
              processorId={audioProcessorId}
            />
          </div>
        )}

        {activeTab === 'power' && (
          <div className="bg-slate-800 rounded-lg p-8 text-center">
            <Power className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Power Control</h3>
            <p className="text-slate-400">CEC-based power control has been removed. IR-based TV power control coming soon.</p>
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
                      ?.filter((output: any) => output.isActive && output.channelNumber <= 32)
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

        {activeTab === 'lighting' && lightingEnabled && (
          <div className="max-w-7xl mx-auto pt-4 space-y-4">
            {commercialLightingEnabled && <CommercialLightingRemote />}
            {dmxLightingEnabled && <DMXLightingRemote />}
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-700/10 z-50">
        <div className="flex justify-around items-center py-2">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'video'
                ? 'bg-blue-500/30 text-blue-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span className="text-xs font-medium">Video</span>
          </button>
          
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'audio'
                ? 'bg-purple-500/30 text-purple-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-xs font-medium">Audio</span>
          </button>
          
          <button
            onClick={() => setActiveTab('music')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'music'
                ? 'bg-indigo-500/30 text-indigo-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Music2 className="w-4 h-4" />
            <span className="text-xs font-medium">Music</span>
          </button>
          
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'guide'
                ? 'bg-green-500/30 text-green-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Guide</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('routing')
              loadCurrentRoutes()
              loadCurrentChannels()
            }}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'routing'
                ? 'bg-cyan-500/30 text-cyan-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium">Routing</span>
          </button>

          <button
            onClick={() => setActiveTab('remote')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'remote'
                ? 'bg-orange-500/30 text-orange-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="text-xs font-medium">Remote</span>
          </button>

          {lightingEnabled && (
            <button
              onClick={() => setActiveTab('lighting')}
              className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
                activeTab === 'lighting'
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span className="text-xs font-medium">Lighting</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('power')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'power'
                ? 'bg-red-500/30 text-red-300'
                : 'text-slate-500 hover:text-white hover:bg-sportsBar-800/5'
            }`}
          >
            <Power className="w-4 h-4" />
            <span className="text-xs font-medium">Power</span>
          </button>
        </div>
      </div>
    </div>
  )
}

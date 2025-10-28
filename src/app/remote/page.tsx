

'use client'

import { useState, useEffect } from 'react'
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
  Wifi,
  WifiOff,
  Volume1,
  VolumeIcon,
  Sliders,
  Speaker,
  Calendar,
  Music2
} from 'lucide-react'
import Image from 'next/image'
import CECPowerControl from '@/components/CECPowerControl'
import SportsGuide from '@/components/SportsGuide'
import TVGuide from '@/components/TVGuide'
import EnhancedChannelGuideBartenderRemote from '@/components/EnhancedChannelGuideBartenderRemote'
import BartenderMusicControl from '@/components/BartenderMusicControl'
import BartenderRemoteAudioPanel from '@/components/BartenderRemoteAudioPanel'
import TVLayoutView from '@/components/TVLayoutView'

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
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
  
  // Audio processor state
  const [audioProcessorIp, setAudioProcessorIp] = useState<string>('192.168.5.101')
  const [audioProcessorId, setAudioProcessorId] = useState<string | undefined>(undefined)
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'power' | 'guide' | 'music'>('video')



  useEffect(() => {
    loadInputs()
    loadIRDevices()
    loadDirecTVDevices()
    loadFireTVDevices()
    loadTVLayout()
    loadAudioProcessor()
    // Also fetch matrix data on initial load
    fetchMatrixData()
    
    // Establish persistent connection on component mount
    establishPersistentConnection()
    
    // Poll connection status every 10 seconds
    const statusInterval = setInterval(() => {
      checkConnectionStatus()
    }, 10000)
    
    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval)
    }
  }, [])

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
          // Use ALL active inputs from Wolf Pack matrix
          const matrixInputs = activeConfig.inputs?.filter((input: MatrixInput) => 
            input.isActive
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
            input.isActive
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
      console.error('Error fetching matrix data:', error)
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
      console.error('Error loading audio processor:', error)
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
      console.error('Error loading TV layout:', error)
    }
  }

  const loadIRDevices = async () => {
    try {
      const response = await fetch('/api/ir-devices')
      const data = await response.json()
      setIRDevices(data.devices || [])
    } catch (error) {
      console.error('Error loading IR devices:', error)
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
      console.error('Error loading DirecTV devices:', error)
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
      console.error('Error loading Fire TV devices:', error)
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
      console.log('Establishing persistent Wolf Pack connection...')
      const response = await fetch('/api/matrix/connection-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      })
      const result = await response.json()
      if (result.success && result.connected) {
        setConnectionStatus('connected')
        console.log('✓ Wolf Pack connection established')
      } else {
        setConnectionStatus('disconnected')
        console.log('✗ Failed to establish Wolf Pack connection:', result.error)
      }
    } catch (error) {
      setConnectionStatus('disconnected')
      console.error('Error establishing connection:', error)
    }
  }

  const selectInput = async (inputNumber: number) => {
    setSelectedInput(inputNumber)
    
    // Find the corresponding device for this input from all device types
    let device: AllDeviceTypes | null = null
    
    // Check IR devices first
    device = irDevices.find(d => d.inputChannel === inputNumber && d.isActive) || null
    
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
      } else {
        setCommandStatus('❌ Failed to route signal')
      }
    } catch (error) {
      console.error('Error routing signal:', error)
      setCommandStatus('❌ Error routing signal')
    } finally {
      setIsRouting(false)
      // Clear status after 3 seconds
      setTimeout(() => setCommandStatus(''), 3000)
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
      console.error('Error sending command:', error)
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
              <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${
                connectionStatus === 'connected' 
                  ? 'bg-green-900/80 text-green-200 border border-green-800'
                  : 'bg-red-900/80 text-red-200 border border-red-800'
              }`}>
                {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>Matrix: {connectionStatus}</span>
              </div>
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
          <div className="max-w-7xl mx-auto">
            <TVLayoutView />
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

        {activeTab === 'power' && <CECPowerControl />}

        {activeTab === 'music' && <BartenderMusicControl />}
        
        {activeTab === 'guide' && <EnhancedChannelGuideBartenderRemote />}
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

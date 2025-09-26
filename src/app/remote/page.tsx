

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
  WifiOff
} from 'lucide-react'
import Image from 'next/image'

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
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [tvLayout, setTVLayout] = useState<TVLayout>({
    name: 'Bar Layout',
    zones: []
  })
  const [isRouting, setIsRouting] = useState(false)
  const [matrixConfig, setMatrixConfig] = useState<any>(null)

  useEffect(() => {
    loadInputs()
    loadIRDevices()
    checkConnectionStatus()
    loadTVLayout()
  }, [])

  useEffect(() => {
    fetchMatrixData()
  }, [tvLayout.zones.length]) // Re-fetch when layout zones change

  const fetchMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.configs?.length > 0) {
          const activeConfig = data.configs[0]
          // Only show inputs with custom labels (not default "Input X" format)
          const customInputs = activeConfig.inputs?.filter((input: MatrixInput) => 
            input.label && !input.label.match(/^Input \d+$/) && input.isActive
          ) || []
          
          setInputs(customInputs)
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
        }
      }
    } catch (error) {
      console.error('Error fetching matrix data:', error)
    }
  }

  const loadInputs = async () => {
    // Matrix inputs are now loaded via fetchMatrixData()
    // Keep fallback inputs for demo purposes if no matrix is configured
    if (inputs.length === 0) {
      setInputs([
        { id: '1', channelNumber: 1, label: 'Cable Box 1', inputType: 'Cable', isActive: true },
        { id: '2', channelNumber: 2, label: 'DirecTV 1', inputType: 'Satellite', isActive: true },
        { id: '3', channelNumber: 3, label: 'Cable Box 2', inputType: 'Cable', isActive: true },
        { id: '4', channelNumber: 4, label: 'DirecTV 2', inputType: 'Satellite', isActive: true },
        { id: '5', channelNumber: 5, label: 'Streaming Box', inputType: 'Streaming', isActive: true },
        { id: '6', channelNumber: 6, label: 'Gaming Console', inputType: 'Gaming', isActive: true },
      ])
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

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/matrix/test-connection')
      if (response.ok) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const selectInput = async (inputNumber: number) => {
    setSelectedInput(inputNumber)
    
    // Find the corresponding IR device for this input
    const device = irDevices.find(d => d.inputChannel === inputNumber)
    setSelectedDevice(device || null)
    
    const input = inputs.find(i => i.channelNumber === inputNumber)
    setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`}`)
  }

  const routeInputToOutput = async (inputNumber: number, outputNumber: number) => {
    if (connectionStatus !== 'connected') {
      setCommandStatus('❌ Matrix not connected')
      return
    }

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
      
      if (selectedDevice.controlMethod === 'IP' && selectedDevice.deviceIpAddress) {
        response = await fetch('/api/ir-devices/send-ip-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDevice.id,
            command: command,
            ipAddress: selectedDevice.deviceIpAddress,
            port: selectedDevice.ipControlPort || 80
          })
        })
      } else if (selectedDevice.iTachAddress) {
        response = await fetch('/api/ir-devices/send-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDevice.id,
            command: command,
            iTachAddress: selectedDevice.iTachAddress
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            🏈 Bartender Remote Control
          </h1>
          <div className="flex items-center justify-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span>Matrix: {connectionStatus}</span>
            </div>
            {commandStatus && (
              <div className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm">
                {commandStatus}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Input Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Radio className="mr-2 w-5 h-5" />
                Input Sources
              </h2>
              <p className="text-sm text-blue-300 mb-4">
                {selectedInput 
                  ? 'Click on TVs in layout to route signal' 
                  : 'Select an input source first'
                }
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {inputs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No input sources configured.</p>
                    <p className="text-xs mt-1">Contact management to configure inputs.</p>
                  </div>
                ) : (
                  <>
                    {inputs.map((input) => (
                      <button
                        key={input.id}
                        onClick={() => selectInput(input.channelNumber)}
                        className={`w-full p-3 rounded-lg text-left transition-all ${
                          selectedInput === input.channelNumber
                            ? 'bg-blue-500 text-white shadow-lg'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{getInputIcon(input.inputType)}</span>
                            <div>
                              <div className="font-medium">{input.label}</div>
                              <div className="text-sm opacity-80">
                                Channel {input.channelNumber} • {input.inputType}
                              </div>
                            </div>
                          </div>
                          {selectedInput === input.channelNumber && (
                            <div className="text-blue-200">
                              <Zap className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                    
                    {selectedInput && (
                      <button
                        onClick={() => {
                          setSelectedInput(null)
                          setSelectedDevice(null)
                          setCommandStatus('')
                        }}
                        className="w-full mt-3 px-3 py-2 text-sm bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all"
                      >
                        Clear Selection
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* IR Device Control Panel */}
            {selectedInput && selectedDevice && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4">
                <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                  <Settings className="mr-2 w-4 h-4" />
                  Device Control
                </h3>
                <p className="text-blue-300 text-sm mb-3">
                  {selectedDevice.name} ({selectedDevice.brand})
                </p>
                
                {/* Power and Main Controls */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {CONTROL_COMMANDS.map((cmd) => (
                    <button
                      key={cmd.command}
                      onClick={() => sendIRCommand(cmd.command)}
                      disabled={loading}
                      className={`p-2 rounded-lg font-medium text-white text-sm transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                        cmd.color || 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-1">
                        {cmd.icon && <cmd.icon className="w-4 h-4" />}
                        <span className="text-xs">{cmd.display}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Channel Controls */}
                <div className="grid grid-cols-3 gap-1">
                  {CHANNEL_COMMANDS.slice(0, 12).map((cmd) => (
                    <button
                      key={cmd.command}
                      onClick={() => sendIRCommand(cmd.command)}
                      disabled={loading}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex flex-col items-center space-y-1">
                        {cmd.icon && <cmd.icon className="w-3 h-3" />}
                        <span>{cmd.display}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Panel - TV Layout */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <MapPin className="mr-2 w-5 h-5" />
                  Bar TV Layout
                </h2>
                <div className="text-sm">
                  {tvLayout.zones.length > 0 && (
                    <span className="text-blue-300">
                      {tvLayout.zones.length} TVs configured
                    </span>
                  )}
                </div>
              </div>
              
              {tvLayout.imageUrl ? (
                <div className="relative w-full h-96 border-2 border-dashed border-gray-500/30 rounded-lg overflow-hidden bg-gray-800/50">
                  {(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-6">
                      <div className="bg-red-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Tv className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2 text-center">PDF Layout</h3>
                      <p className="text-center mb-4 text-sm">
                        Interactive TV zones are available below.
                      </p>
                      <a 
                        href={tvLayout.imageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                      >
                        📄 View PDF Layout
                      </a>
                    </div>
                  ) : (
                    <Image
                      src={tvLayout.imageUrl}
                      alt="Bar Layout"
                      fill
                      className="object-contain"
                    />
                  )}
                  
                  {/* TV Zone Overlays */}
                  {!(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') && tvLayout.zones.map((zone) => (
                    <div
                      key={zone.id}
                      onClick={() => handleZoneClick(zone)}
                      className={`absolute border-2 rounded cursor-pointer transition-all ${
                        selectedInput 
                          ? 'border-blue-400 bg-blue-500/30 hover:bg-blue-500/50 hover:border-blue-300' 
                          : 'border-gray-500 bg-gray-500/20 cursor-not-allowed'
                      } ${isRouting ? 'animate-pulse' : ''}`}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`
                      }}
                      title={`Output ${zone.outputNumber}: ${zone.label}${selectedInput ? ' - Click to route' : ''}`}
                    >
                      <div className="flex items-center justify-center h-full">
                        <div className="bg-white/90 px-2 py-1 rounded text-xs font-bold text-gray-800">
                          {zone.outputNumber}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-500/30 rounded-lg">
                  <div className="text-center text-gray-400">
                    <Tv className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <h4 className="text-lg font-medium mb-2">No Layout Configured</h4>
                    <p className="text-sm">
                      Contact management to upload a bar layout
                    </p>
                  </div>
                </div>
              )}

              {/* TV Zone Grid for PDF layouts */}
              {(tvLayout.imageUrl?.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf' && tvLayout.zones.length > 0) && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-white mb-2">TV Zones:</h4>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                    {tvLayout.zones.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => handleZoneClick(zone)}
                        className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                          selectedInput 
                            ? 'border-blue-400 bg-blue-500/20 hover:bg-blue-500/40 text-blue-200' 
                            : 'border-gray-500 bg-gray-500/20 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <div className="font-medium">TV {zone.outputNumber}</div>
                        <div className="opacity-75">{zone.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

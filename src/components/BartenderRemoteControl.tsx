
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
  Wifi,
  WifiOff,
  Speaker,
  Play,
  Pause
} from 'lucide-react'

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
  // For IP control
  deviceIpAddress?: string
  ipControlPort?: number
  // For Global Cache control
  iTachAddress?: string
  iTachPort?: number
  codesetId?: string
  isActive: boolean
}

interface AudioProcessor {
  id: string
  name: string
  model: string
  ipAddress: string
  port: number
  zones: number
  status: 'online' | 'offline' | 'error'
}

interface AudioZone {
  id: string
  processorId: string
  zoneNumber: number
  name: string
  description?: string
  currentSource?: string
  volume: number
  muted: boolean
  enabled: boolean
}

interface AudioInput {
  id: string
  name: string
  isActive: boolean
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

export default function BartenderRemoteControl() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [commandStatus, setCommandStatus] = useState<string>('')
  
  // Audio-related state
  const [audioProcessors, setAudioProcessors] = useState<AudioProcessor[]>([])
  const [audioZones, setAudioZones] = useState<AudioZone[]>([])
  const [selectedProcessor, setSelectedProcessor] = useState<AudioProcessor | null>(null)
  const [selectedAudioZone, setSelectedAudioZone] = useState<AudioZone | null>(null)
  const [audioInputs] = useState<AudioInput[]>([
    { id: 'input1', name: 'Input 1', isActive: true },
    { id: 'input2', name: 'Input 2', isActive: true },
    { id: 'input3', name: 'Input 3', isActive: true },
    { id: 'input4', name: 'Input 4', isActive: true },
    { id: 'matrix1', name: 'Matrix Audio 1', isActive: true },
    { id: 'matrix2', name: 'Matrix Audio 2', isActive: true },
    { id: 'matrix3', name: 'Matrix Audio 3', isActive: true },
    { id: 'matrix4', name: 'Matrix Audio 4', isActive: true },
    { id: 'streaming', name: 'Streaming Input', isActive: true },
    { id: 'microphone', name: 'Microphone', isActive: true },
  ])
  const [audioCommandStatus, setAudioCommandStatus] = useState<string>('')

  useEffect(() => {
    loadInputs()
    loadIRDevices()
    checkConnectionStatus()
    loadAudioProcessors()
  }, [])

  useEffect(() => {
    if (selectedProcessor) {
      loadAudioZones(selectedProcessor.id)
    }
  }, [selectedProcessor])

  const loadInputs = async () => {
    try {
      // In a real implementation, this would load from an API
      // For now, we'll use mock data that represents typical sports bar setup
      setInputs([
        { id: '1', channelNumber: 1, label: 'Cable Box 1', inputType: 'Cable', isActive: true },
        { id: '2', channelNumber: 2, label: 'DirecTV 1', inputType: 'Satellite', isActive: true },
        { id: '3', channelNumber: 3, label: 'Cable Box 2', inputType: 'Cable', isActive: true },
        { id: '4', channelNumber: 4, label: 'DirecTV 2', inputType: 'Satellite', isActive: true },
        { id: '5', channelNumber: 5, label: 'Streaming Box', inputType: 'Streaming', isActive: true },
        { id: '6', channelNumber: 6, label: 'Gaming Console', inputType: 'Gaming', isActive: true },
        { id: '7', channelNumber: 7, label: 'Cable Box 3', inputType: 'Cable', isActive: true },
        { id: '8', channelNumber: 8, label: 'DirecTV 3', inputType: 'Satellite', isActive: true },
      ])
    } catch (error) {
      console.error('Error loading inputs:', error)
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
    
    setCommandStatus(`Selected Input ${inputNumber}`)

    // Log the operation
    try {
      await fetch('/api/logs/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'input_switch',
          action: 'select_input',
          device: `Input ${inputNumber}`,
          details: {
            inputNumber,
            deviceName: device?.name || 'Not configured',
            deviceBrand: device?.brand || 'Unknown',
            controlMethod: device?.controlMethod || 'None'
          },
          success: true
        })
      })
    } catch (error) {
      console.error('Failed to log input selection:', error)
    }
  }

  const sendIRCommand = async (command: string) => {
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      // Log failed attempt
      try {
        await fetch('/api/logs/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'error',
            action: 'IR command failed - no device selected',
            details: { command, selectedInput },
            success: false,
            errorMessage: 'No device selected'
          })
        })
      } catch (logError) {
        console.error('Failed to log error:', logError)
      }
      return
    }

    setLoading(true)
    setCommandStatus(`Sending ${command}...`)

    let success = false
    let errorMessage = ''

    try {
      let response;
      
      if (selectedDevice.controlMethod === 'IP' && selectedDevice.deviceIpAddress) {
        // Send IP command
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
        // Send Global Cache command
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
        errorMessage = 'Device not configured'
      }

      if (response) {
        const result = await response.json()
        
        if (response.ok) {
          setCommandStatus(`✓ Sent ${command} to ${selectedDevice.name}`)
          success = true
        } else {
          setCommandStatus(`✗ Failed: ${result.error}`)
          errorMessage = result.error || 'API call failed'
        }
      }
    } catch (error) {
      console.error('Error sending command:', error)
      setCommandStatus(`✗ Error sending ${command}`)
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      setLoading(false)

      // Log the operation with comprehensive details
      try {
        const operationType = command.includes('VOL') ? 'volume_change' : 
                           command.includes('CH') ? 'channel_change' : 
                           command === 'POWER' ? 'power_control' : 'matrix_control'

        await fetch('/api/logs/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: operationType,
            action: `IR Command: ${command}`,
            device: selectedDevice.name,
            details: {
              command,
              inputNumber: selectedInput,
              deviceId: selectedDevice.id,
              deviceBrand: selectedDevice.brand,
              controlMethod: selectedDevice.controlMethod,
              ipAddress: selectedDevice.deviceIpAddress,
              iTachAddress: selectedDevice.iTachAddress
            },
            success,
            errorMessage: success ? undefined : errorMessage
          })
        })
      } catch (logError) {
        console.error('Failed to log IR command:', logError)
      }

      // Clear status after 3 seconds
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const loadAudioProcessors = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      if (response.ok) {
        const data = await response.json()
        const processors = data.processors || []
        setAudioProcessors(processors)
        
        // Auto-select first online processor
        const onlineProcessor = processors.find((p: AudioProcessor) => p.status === 'online')
        if (onlineProcessor && !selectedProcessor) {
          setSelectedProcessor(onlineProcessor)
        }
      }
    } catch (error) {
      console.error('Error loading audio processors:', error)
    }
  }

  const loadAudioZones = async (processorId: string) => {
    try {
      const response = await fetch(`/api/audio-processor/zones?processorId=${processorId}`)
      if (response.ok) {
        const data = await response.json()
        setAudioZones(data.zones || [])
      }
    } catch (error) {
      console.error('Error loading audio zones:', error)
    }
  }

  const controlAudioZone = async (action: string, zone: AudioZone, value?: any) => {
    if (!selectedProcessor) return

    setAudioCommandStatus(`${action} Zone ${zone.zoneNumber}...`)

    let success = false
    let errorMessage = ''

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          command: {
            action,
            zone: zone.zoneNumber,
            value
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setAudioCommandStatus(`✓ ${action} Zone ${zone.zoneNumber}`)
        success = true
        // Refresh zones to get updated values
        loadAudioZones(selectedProcessor.id)
      } else {
        setAudioCommandStatus(`✗ Failed: ${result.error}`)
        errorMessage = result.error || 'Audio control failed'
      }
    } catch (error) {
      console.error('Error controlling audio zone:', error)
      setAudioCommandStatus(`✗ Error controlling zone`)
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      // Log the audio operation
      try {
        const operationType = action === 'volume' ? 'volume_change' : 
                            action === 'mute' ? 'volume_change' : 
                            action === 'setSource' ? 'input_switch' : 'audio_zone'

        await fetch('/api/logs/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: operationType,
            action: `Audio ${action}`,
            device: `${selectedProcessor.name} Zone ${zone.zoneNumber}`,
            details: {
              processorId: selectedProcessor.id,
              processorName: selectedProcessor.name,
              processorModel: selectedProcessor.model,
              processorIpAddress: selectedProcessor.ipAddress,
              zoneNumber: zone.zoneNumber,
              zoneName: zone.name,
              action,
              value,
              previousValue: action === 'volume' ? zone.volume : 
                           action === 'mute' ? zone.muted : 
                           action === 'setSource' ? zone.currentSource : null
            },
            success,
            errorMessage: success ? undefined : errorMessage
          })
        })
      } catch (logError) {
        console.error('Failed to log audio control:', logError)
      }

      // Clear status after 3 seconds
      setTimeout(() => setAudioCommandStatus(''), 3000)
    }
  }

  const setZoneSource = async (zone: AudioZone, source: string) => {
    await controlAudioZone('setSource', zone, source)
  }

  const adjustZoneVolume = async (zone: AudioZone, volumeChange: number) => {
    const newVolume = Math.max(0, Math.min(100, zone.volume + volumeChange))
    await controlAudioZone('volume', zone, newVolume)
  }

  const toggleZoneMute = async (zone: AudioZone) => {
    await controlAudioZone('mute', zone, !zone.muted)
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
    <div className="h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          🏈 Bartender Remote
        </h1>
        <div className="flex items-center justify-center space-x-4 text-sm">
          <div className={`px-3 py-1 rounded-full font-medium flex items-center space-x-1 ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{connectionStatus}</span>
          </div>
          {commandStatus && (
            <div className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
              TV: {commandStatus}
            </div>
          )}
          {audioCommandStatus && (
            <div className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
              Audio: {audioCommandStatus}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Left Panel - Input Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-fit">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center">
              <Tv className="mr-2 w-5 h-5" />
              TV Inputs
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getInputIcon(input.inputType)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">Input {input.channelNumber}</div>
                      <div className="text-xs opacity-80 truncate">{input.label}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Remote Control Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-fit">
            {selectedInput ? (
              <>
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-white mb-1">
                    Input {selectedInput} Control
                  </h2>
                  {selectedDevice && (
                    <p className="text-blue-300 text-sm">
                      {selectedDevice.name} ({selectedDevice.brand}) - {selectedDevice.controlMethod}
                    </p>
                  )}
                  {!selectedDevice && (
                    <p className="text-orange-300 text-sm">No device configured</p>
                  )}
                </div>

                {selectedDevice ? (
                  <div className="space-y-4">
                    {/* Power and Main Controls */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {CONTROL_COMMANDS.map((cmd) => (
                        <button
                          key={cmd.command}
                          onClick={() => sendIRCommand(cmd.command)}
                          disabled={loading}
                          className={`p-3 rounded-lg font-medium text-white transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                            cmd.color || 'bg-gray-600 hover:bg-gray-500'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-1">
                            {cmd.icon && <cmd.icon className="w-5 h-5" />}
                            <span className="text-xs">{cmd.display}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Number Pad and Channel Controls */}
                    <div>
                      <h3 className="text-lg font-medium text-white mb-2">Channels</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {CHANNEL_COMMANDS.map((cmd) => (
                          <button
                            key={cmd.command}
                            onClick={() => sendIRCommand(cmd.command)}
                            disabled={loading}
                            className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex flex-col items-center space-y-1">
                              {cmd.icon && <cmd.icon className="w-4 h-4" />}
                              <span className="text-sm">{cmd.display}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Settings className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">
                      This input needs device configuration.
                      <br />
                      Contact management to set up control.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Tv className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Select a TV Input</h3>
                <p className="text-gray-400">Choose an input from the left to control it</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Future Features */}
        <div className="lg:col-span-1 space-y-4">
          {/* TV Power Controls (Future) */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Power className="mr-2 w-4 h-4" />
              TV Power
            </h3>
            <div className="space-y-2">
              <button
                disabled
                className="w-full p-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg text-sm opacity-50 cursor-not-allowed"
              >
                All TVs ON
              </button>
              <button
                disabled
                className="w-full p-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-sm opacity-50 cursor-not-allowed"
              >
                All TVs OFF
              </button>
              <p className="text-xs text-gray-500">Coming Soon</p>
            </div>
          </div>

          {/* Audio Zone Controls */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Speaker className="mr-2 w-4 h-4" />
              Audio Zones
            </h3>
            
            {/* Processor Selection */}
            {audioProcessors.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-gray-300 block mb-1">Processor</label>
                <select
                  value={selectedProcessor?.id || ''}
                  onChange={(e) => {
                    const processor = audioProcessors.find(p => p.id === e.target.value)
                    setSelectedProcessor(processor || null)
                  }}
                  className="w-full p-2 bg-slate-700 text-white rounded text-sm border border-slate-600 focus:border-purple-500"
                >
                  <option value="">Select Processor</option>
                  {audioProcessors.map((processor) => (
                    <option key={processor.id} value={processor.id}>
                      {processor.name} ({processor.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedProcessor && audioZones.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {audioZones.filter(zone => zone.enabled).map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      selectedAudioZone?.id === zone.id
                        ? 'bg-purple-500/30 border-purple-400 text-white'
                        : 'bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                    onClick={() => setSelectedAudioZone(zone)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">Zone {zone.zoneNumber}: {zone.name}</span>
                      <div className="flex items-center space-x-1">
                        {zone.muted && <VolumeX className="w-3 h-3 text-red-400" />}
                        <span className="text-xs">{zone.volume}%</span>
                      </div>
                    </div>
                    <div className="text-xs opacity-75 flex items-center">
                      <Play className="w-2 h-2 mr-1" />
                      {zone.currentSource || 'No Source'}
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedProcessor ? (
              <div className="text-center text-gray-400 text-sm py-4">
                <Speaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No zones configured</p>
                <p className="text-xs">Set up zones in Audio Manager</p>
              </div>
            ) : (
              <div className="text-center text-gray-400 text-sm py-4">
                <Speaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No audio processors</p>
                <p className="text-xs">Configure in Audio Manager</p>
              </div>
            )}
          </div>

          {/* Audio Zone Controls */}
          {selectedAudioZone && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                <Volume2 className="mr-2 w-4 h-4" />
                Zone Control
              </h3>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-sm text-gray-300 mb-1">Zone {selectedAudioZone.zoneNumber}</div>
                  <div className="font-semibold text-white">{selectedAudioZone.name}</div>
                </div>

                {/* Volume Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Volume</span>
                    <span className="text-white font-mono">{selectedAudioZone.volume}%</span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => adjustZoneVolume(selectedAudioZone, -5)}
                      className="flex-1 p-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-all"
                    >
                      <ChevronDown className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => toggleZoneMute(selectedAudioZone)}
                      className={`flex-1 p-2 rounded text-sm transition-all ${
                        selectedAudioZone.muted 
                          ? 'bg-orange-600 hover:bg-orange-500' 
                          : 'bg-slate-600 hover:bg-slate-500'
                      } text-white`}
                    >
                      {selectedAudioZone.muted ? <Volume2 className="w-4 h-4 mx-auto" /> : <VolumeX className="w-4 h-4 mx-auto" />}
                    </button>
                    <button
                      onClick={() => adjustZoneVolume(selectedAudioZone, 5)}
                      className="flex-1 p-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-all"
                    >
                      <ChevronUp className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>

                {/* Audio Source Selection */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300 block">Audio Source</label>
                  <select
                    value={selectedAudioZone.currentSource || ''}
                    onChange={(e) => setZoneSource(selectedAudioZone, e.target.value)}
                    className="w-full p-2 bg-slate-700 text-white rounded text-sm border border-slate-600 focus:border-purple-500"
                  >
                    <option value="">Select Source</option>
                    {audioInputs.map((input) => (
                      <option key={input.id} value={input.name}>
                        {input.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedInput(null)
                  setSelectedDevice(null)
                  setCommandStatus('')
                }}
                className="w-full p-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Tv className="w-4 h-4" />
                <span>Reset TV</span>
              </button>
              
              <button
                onClick={() => {
                  setSelectedProcessor(null)
                  setSelectedAudioZone(null)
                  setAudioCommandStatus('')
                }}
                className="w-full p-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Speaker className="w-4 h-4" />
                <span>Reset Audio</span>
              </button>
              
              <button
                onClick={() => {
                  setSelectedInput(null)
                  setSelectedDevice(null)
                  setCommandStatus('')
                  setSelectedProcessor(null)
                  setSelectedAudioZone(null)
                  setAudioCommandStatus('')
                  loadInputs()
                  loadAudioProcessors()
                }}
                className="w-full p-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg text-sm hover:bg-gray-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

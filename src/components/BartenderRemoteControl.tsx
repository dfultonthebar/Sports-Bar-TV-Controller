
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
  WifiOff
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

  useEffect(() => {
    loadInputs()
    loadIRDevices()
    checkConnectionStatus()
  }, [])

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
      // Clear status after 3 seconds
      setTimeout(() => setCommandStatus(''), 3000)
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
              {commandStatus}
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

          {/* Audio Controls (Future) */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Radio className="mr-2 w-4 h-4" />
              Audio
            </h3>
            <div className="space-y-2">
              <button
                disabled
                className="w-full p-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm opacity-50 cursor-not-allowed"
              >
                Zone 1
              </button>
              <button
                disabled
                className="w-full p-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm opacity-50 cursor-not-allowed"
              >
                Zone 2  
              </button>
              <p className="text-xs text-gray-500">Coming Soon</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3">Actions</h3>
            <button
              onClick={() => {
                setSelectedInput(null)
                setSelectedDevice(null)
                setCommandStatus('')
              }}
              className="w-full p-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg text-sm hover:bg-gray-500/30 transition-all flex items-center justify-center space-x-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

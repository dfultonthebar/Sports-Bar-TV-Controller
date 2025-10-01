
'use client'

import { useState, useEffect } from 'react'
import { 
  Tv, 
  Power, 
  Volume2, 
  VolumeX, 
  ChevronUp, 
  ChevronDown,
  Monitor,
  Radio,
  Zap,
  Settings,
  Info,
  PlayCircle,
  StopCircle,
  FastForward,
  Rewind,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Menu,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react'

interface TVDevice {
  id: string
  name: string
  brand: string
  outputNumber: number
  supportsCEC: boolean
  supportsIR: boolean
  preferredMethod: 'CEC' | 'IR' | 'AUTO'
  isActive: boolean
  lastCommand?: string
  lastCommandTime?: string
  status?: 'on' | 'off' | 'unknown'
}

interface BrandConfig {
  brand: string
  cecPowerOnDelay: number
  cecPowerOffDelay: number
  cecVolumeDelay: number
  cecInputSwitchDelay: number
  supportsWakeOnCec: boolean
  supportsCecVolumeControl: boolean
  preferredControlMethod: 'CEC' | 'IR' | 'HYBRID'
  quirks: string[]
}

interface CommandResult {
  success: boolean
  method: 'CEC' | 'IR' | 'FALLBACK'
  message: string
  fallbackUsed?: boolean
}

export default function UnifiedTVControl() {
  const [devices, setDevices] = useState<TVDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<TVDevice | null>(null)
  const [brands, setBrands] = useState<Record<string, BrandConfig>>({})
  const [selectedBrand, setSelectedBrand] = useState<string>('Generic')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [commandHistory, setCommandHistory] = useState<Array<{
    device: string
    command: string
    result: CommandResult
    timestamp: string
  }>>([])

  useEffect(() => {
    loadDevices()
    loadBrands()
    checkConnection()
  }, [])

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        const outputs = data.outputs?.filter((o: any) => o.isActive) || []
        
        const tvDevices: TVDevice[] = outputs.map((output: any) => ({
          id: output.id,
          name: output.label || `TV ${output.channelNumber}`,
          brand: 'Generic', // You can add a brand field to your DB
          outputNumber: output.channelNumber,
          supportsCEC: true,
          supportsIR: false, // Check if device has IR config
          preferredMethod: 'AUTO',
          isActive: true,
          status: 'unknown'
        }))
        
        setDevices(tvDevices)
        if (tvDevices.length > 0) {
          setSelectedDevice(tvDevices[0])
        }
      }
    } catch (error) {
      console.error('Failed to load devices:', error)
    }
  }

  const loadBrands = async () => {
    try {
      const response = await fetch('/api/tv-brands')
      if (response.ok) {
        const data = await response.json()
        setBrands(data.configs || {})
      }
    } catch (error) {
      console.error('Failed to load brands:', error)
    }
  }

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/matrix/test-connection')
      setConnectionStatus(response.ok ? 'connected' : 'disconnected')
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const sendCommand = async (command: string, forceMethod?: 'CEC' | 'IR') => {
    if (!selectedDevice) {
      setStatus('❌ No device selected')
      return
    }

    setLoading(true)
    setStatus(`Sending ${command} to ${selectedDevice.name}...`)

    try {
      const response = await fetch('/api/unified-tv-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command,
          forceMethod
        })
      })

      const data = await response.json()
      
      if (data.success) {
        const result = data.result as CommandResult
        const methodIcon = result.method === 'CEC' ? '⚡' : result.method === 'IR' ? '📡' : '🔄'
        const fallbackText = result.fallbackUsed ? ' (fallback)' : ''
        setStatus(`✅ ${methodIcon} ${result.message}${fallbackText}`)
        
        // Update command history
        setCommandHistory(prev => [
          {
            device: selectedDevice.name,
            command,
            result,
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev.slice(0, 9) // Keep last 10 commands
        ])

        // Update device status
        if (command === 'power_on') {
          setSelectedDevice(prev => prev ? { ...prev, status: 'on' } : null)
        } else if (command === 'power_off') {
          setSelectedDevice(prev => prev ? { ...prev, status: 'off' } : null)
        }
      } else {
        setStatus(`❌ Command failed: ${data.result?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Command error:', error)
      setStatus(`❌ Error: ${error}`)
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(''), 5000)
    }
  }

  const sendBatchCommand = async (command: string, sequential: boolean = false) => {
    if (devices.length === 0) {
      setStatus('❌ No devices available')
      return
    }

    setLoading(true)
    const actionText = sequential ? 'Sequential' : 'Parallel'
    setStatus(`${actionText} ${command} to ${devices.length} devices...`)

    try {
      const response = await fetch('/api/unified-tv-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceIds: devices.map(d => d.id),
          command,
          sequential,
          delayBetween: sequential ? 1000 : undefined
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setStatus(`✅ ${command} sent to all devices successfully`)
      } else {
        const successCount = data.results?.filter((r: any) => r.success).length || 0
        setStatus(`⚠️ ${successCount}/${devices.length} devices responded`)
      }
    } catch (error) {
      console.error('Batch command error:', error)
      setStatus(`❌ Batch command error: ${error}`)
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(''), 5000)
    }
  }

  const getBrandConfig = (): BrandConfig | null => {
    if (!selectedDevice) return null
    return brands[selectedDevice.brand] || brands['Generic'] || null
  }

  const brandConfig = getBrandConfig()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header with status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            <span>System: {connectionStatus}</span>
          </div>
          
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm hover:bg-blue-500/30 transition-colors"
          >
            <Settings className="w-4 h-4 inline mr-2" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </button>
        </div>
        
        {status && (
          <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white border border-white/20">
            {status}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar - Device Selection */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Monitor className="mr-2 w-5 h-5" />
              TV Devices
            </h3>
            
            <div className="space-y-2">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => setSelectedDevice(device)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedDevice?.id === device.id
                      ? 'bg-blue-500/30 border-2 border-blue-500'
                      : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Tv className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-white">{device.name}</span>
                    </div>
                    {device.status === 'on' && (
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Output {device.outputNumber} • {device.brand}
                  </div>
                  <div className="mt-1 flex items-center space-x-1 text-xs">
                    {device.supportsCEC && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">CEC</span>
                    )}
                    {device.supportsIR && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">IR</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {devices.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No devices found</p>
              </div>
            )}
          </div>

          {/* Brand Info */}
          {brandConfig && showAdvanced && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h4 className="text-sm font-bold text-white mb-2 flex items-center">
                <Info className="mr-2 w-4 h-4" />
                Brand Info
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Preferred:</span>
                  <span className="text-white">{brandConfig.preferredControlMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CEC Wake:</span>
                  <span className={brandConfig.supportsWakeOnCec ? 'text-green-400' : 'text-red-400'}>
                    {brandConfig.supportsWakeOnCec ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CEC Volume:</span>
                  <span className={brandConfig.supportsCecVolumeControl ? 'text-green-400' : 'text-red-400'}>
                    {brandConfig.supportsCecVolumeControl ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="text-slate-500 mb-1">Timing (ms):</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Power On:</span>
                      <span className="text-white">{brandConfig.cecPowerOnDelay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Power Off:</span>
                      <span className="text-white">{brandConfig.cecPowerOffDelay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Volume:</span>
                      <span className="text-white">{brandConfig.cecVolumeDelay}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Control Panel */}
        <div className="lg:col-span-6 space-y-4">
          {selectedDevice ? (
            <>
              {/* Power Control */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Power className="mr-2 w-5 h-5" />
                  Power Control
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => sendCommand('power_on')}
                    disabled={loading}
                    className="py-3 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <Power className="w-5 h-5" />
                    <span>Power On</span>
                  </button>
                  <button
                    onClick={() => sendCommand('power_off')}
                    disabled={loading}
                    className="py-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <Power className="w-5 h-5" />
                    <span>Power Off</span>
                  </button>
                </div>
              </div>

              {/* Volume Control */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Volume2 className="mr-2 w-5 h-5" />
                  Volume Control
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => sendCommand('volume_up')}
                    disabled={loading}
                    className="py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <ChevronUp className="w-5 h-5" />
                    <span>Vol +</span>
                  </button>
                  <button
                    onClick={() => sendCommand('mute')}
                    disabled={loading}
                    className="py-3 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <VolumeX className="w-5 h-5" />
                    <span>Mute</span>
                  </button>
                  <button
                    onClick={() => sendCommand('volume_down')}
                    disabled={loading}
                    className="py-3 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <ChevronDown className="w-5 h-5" />
                    <span>Vol -</span>
                  </button>
                </div>
              </div>

              {/* Navigation Control */}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Menu className="mr-2 w-5 h-5" />
                  Navigation
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div></div>
                  <button
                    onClick={() => sendCommand('up')}
                    disabled={loading}
                    className="py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    <ArrowUp className="w-5 h-5 mx-auto" />
                  </button>
                  <div></div>
                  <button
                    onClick={() => sendCommand('left')}
                    disabled={loading}
                    className="py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="w-5 h-5 mx-auto" />
                  </button>
                  <button
                    onClick={() => sendCommand('select')}
                    disabled={loading}
                    className="py-2 bg-purple-500/30 text-purple-200 border border-purple-500/50 rounded-lg hover:bg-purple-500/40 transition-colors disabled:opacity-50 font-medium"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => sendCommand('right')}
                    disabled={loading}
                    className="py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    <ArrowRight className="w-5 h-5 mx-auto" />
                  </button>
                  <div></div>
                  <button
                    onClick={() => sendCommand('down')}
                    disabled={loading}
                    className="py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    <ArrowDown className="w-5 h-5 mx-auto" />
                  </button>
                  <div></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => sendCommand('root_menu')}
                    disabled={loading}
                    className="py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm"
                  >
                    Menu
                  </button>
                  <button
                    onClick={() => sendCommand('exit')}
                    disabled={loading}
                    className="py-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50 text-sm"
                  >
                    Exit
                  </button>
                </div>
              </div>

              {/* Playback Control */}
              {showAdvanced && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <PlayCircle className="mr-2 w-5 h-5" />
                    Playback
                  </h3>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      onClick={() => sendCommand('rewind')}
                      disabled={loading}
                      className="py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-colors disabled:opacity-50"
                    >
                      <Rewind className="w-5 h-5 mx-auto" />
                    </button>
                    <button
                      onClick={() => sendCommand('play')}
                      disabled={loading}
                      className="py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                    >
                      <PlayCircle className="w-5 h-5 mx-auto" />
                    </button>
                    <button
                      onClick={() => sendCommand('pause')}
                      disabled={loading}
                      className="py-2 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                    >
                      <StopCircle className="w-5 h-5 mx-auto" />
                    </button>
                    <button
                      onClick={() => sendCommand('stop')}
                      disabled={loading}
                      className="py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5 mx-auto" />
                    </button>
                    <button
                      onClick={() => sendCommand('fast_forward')}
                      disabled={loading}
                      className="py-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-colors disabled:opacity-50"
                    >
                      <FastForward className="w-5 h-5 mx-auto" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-12 text-center">
              <Tv className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
              <p className="text-slate-500">Select a device to begin</p>
            </div>
          )}
        </div>

        {/* Right Sidebar - Batch Control & History */}
        <div className="lg:col-span-3 space-y-4">
          {/* Batch Control */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Radio className="mr-2 w-5 h-5" />
              All TVs
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => sendBatchCommand('power_on', false)}
                disabled={loading || devices.length === 0}
                className="w-full py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
              >
                ⚡ Power On All (Fast)
              </button>
              <button
                onClick={() => sendBatchCommand('power_on', true)}
                disabled={loading || devices.length === 0}
                className="w-full py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 text-sm"
              >
                🔄 Power On All (Sequential)
              </button>
              <button
                onClick={() => sendBatchCommand('power_off', false)}
                disabled={loading || devices.length === 0}
                className="w-full py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm"
              >
                ⚡ Power Off All (Fast)
              </button>
              <button
                onClick={() => sendBatchCommand('mute', false)}
                disabled={loading || devices.length === 0}
                className="w-full py-2 bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50 text-sm"
              >
                🔇 Mute All
              </button>
            </div>
          </div>

          {/* Command History */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center">
              <Clock className="mr-2 w-4 h-4" />
              Recent Commands
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {commandHistory.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  No commands yet
                </div>
              ) : (
                commandHistory.map((entry, index) => (
                  <div 
                    key={index}
                    className="bg-white/5 rounded p-2 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium">{entry.device}</span>
                      <span className="text-slate-500">{entry.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{entry.command}</span>
                      <div className="flex items-center space-x-1">
                        {entry.result.success ? (
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-red-400" />
                        )}
                        <span className={`${
                          entry.result.method === 'CEC' ? 'text-green-400' : 
                          entry.result.method === 'IR' ? 'text-blue-400' : 
                          'text-yellow-400'
                        }`}>
                          {entry.result.method}
                        </span>
                        {entry.result.fallbackUsed && (
                          <span className="text-yellow-400 text-xs">(FB)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Brand Quirks */}
          {brandConfig && brandConfig.quirks.length > 0 && showAdvanced && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-yellow-300 mb-2 flex items-center">
                <AlertCircle className="mr-2 w-4 h-4" />
                {selectedDevice?.brand} Notes
              </h4>
              <ul className="text-xs text-yellow-200 space-y-1">
                {brandConfig.quirks.map((quirk, index) => (
                  <li key={index}>• {quirk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center">
          <Zap className="mr-2 w-4 h-4" />
          Unified Control Features
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-200">
          <div>
            <strong>⚡ CEC Control:</strong> Fast, direct HDMI-CEC commands for power, volume, and navigation
          </div>
          <div>
            <strong>📡 IR Control:</strong> Infrared commands via Global Cache iTach for maximum compatibility
          </div>
          <div>
            <strong>🔄 Smart Fallback:</strong> Automatically tries alternative method if primary fails
          </div>
        </div>
      </div>
    </div>
  )
}

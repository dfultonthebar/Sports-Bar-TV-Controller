
'use client'

import { useState, useEffect } from 'react'
import { 
  Power, 
  Settings, 
  Tv,
  Radio,
  Zap,
  Wifi,
  WifiOff,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Monitor
} from 'lucide-react'

interface CECConfig {
  id?: string
  cecInputChannel: number | null
  cecServerIP: string
  cecPort: number
  isEnabled: boolean
  powerOnDelay: number
  powerOffDelay: number
}

interface CECDevice {
  id: string
  deviceName: string
  deviceType: string
  devicePath: string
  matrixInputId: string | null
  isActive: boolean
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface MatrixOutput {
  id: string
  channelNumber: number
  label: string
  isActive: boolean
}

interface TVPowerStatus {
  outputNumber: number
  label: string
  isPoweredOn?: boolean
  isProcessing: boolean
  lastAction?: string
  lastActionTime?: string
}

export default function CECPowerControl() {
  const [cecConfig, setCecConfig] = useState<CECConfig>({
    cecInputChannel: null,
    cecServerIP: '192.168.1.100',
    cecPort: 8080,
    isEnabled: false,
    powerOnDelay: 2000,
    powerOffDelay: 1000
  })
  
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [outputs, setOutputs] = useState<MatrixOutput[]>([])
  const [tvStatuses, setTvStatuses] = useState<TVPowerStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [configLoading, setConfigLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [cecDevice, setCecDevice] = useState<CECDevice | null>(null)

  useEffect(() => {
    loadCECConfig()
    loadMatrixData()
    checkConnectionStatus()
    loadCECDevice()
  }, [])

  const loadCECConfig = async () => {
    try {
      const response = await fetch('/api/cec/config')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.config) {
          setCecConfig(data.config)
        }
      }
    } catch (error) {
      console.error('Error loading CEC config:', error)
    }
  }

  const loadMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        
        // Load inputs with custom labels
        const customInputs = data.inputs?.filter((input: MatrixInput) => 
          input.label && !input.label.match(/^Input \d+$/) && input.isActive
        ) || []
        setInputs(customInputs)
        
        // Load active outputs and initialize TV statuses
        const activeOutputs = data.outputs?.filter((output: MatrixOutput) => 
          output.isActive
        ) || []
        setOutputs(activeOutputs)
        
        // Initialize TV status tracking
        const statuses = activeOutputs.map(output => ({
          outputNumber: output.channelNumber,
          label: output.label || `TV ${output.channelNumber}`,
          isProcessing: false
        }))
        setTvStatuses(statuses)
      }
    } catch (error) {
      console.error('Error loading matrix data:', error)
    }
  }

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/matrix/test-connection')
      setConnectionStatus(response.ok ? 'connected' : 'disconnected')
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const loadCECDevice = async () => {
    try {
      const response = await fetch('/api/cec/devices')
      if (response.ok) {
        const data = await response.json()
        const tvPowerDevice = data.devices?.find((d: CECDevice) => d.deviceType === 'tv_power')
        if (tvPowerDevice) {
          setCecDevice(tvPowerDevice)
        }
      }
    } catch (error) {
      console.error('Error loading CEC device:', error)
    }
  }

  const saveCECInputChannel = async (inputChannel: number) => {
    setConfigLoading(true)
    setStatus('Saving CEC configuration...')

    try {
      const response = await fetch('/api/matrix/config/cec-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cecInputChannel: inputChannel })
      })

      if (response.ok) {
        setCecConfig(prev => ({ ...prev, cecInputChannel: inputChannel }))
        setStatus('✅ CEC configuration saved')
        // Reload matrix data to get the updated cecInputChannel
        await loadMatrixData()
      } else {
        setStatus('❌ Failed to save CEC configuration')
      }
    } catch (error) {
      console.error('Error saving CEC input:', error)
      setStatus('❌ Error saving CEC configuration')
    } finally {
      setConfigLoading(false)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const saveCECConfig = async () => {
    setConfigLoading(true)
    try {
      const response = await fetch('/api/cec/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cecConfig)
      })
      
      if (response.ok) {
        setStatus('✅ CEC configuration saved successfully')
      } else {
        setStatus('❌ Failed to save CEC configuration')
      }
    } catch (error) {
      console.error('Error saving CEC config:', error)
      setStatus('❌ Error saving CEC configuration')
    } finally {
      setConfigLoading(false)
      setTimeout(() => setStatus(''), 3000)
    }
  }

  const executePowerAction = async (action: 'power_on' | 'power_off', outputNumbers?: number[], individual = false) => {
    if (!cecConfig.isEnabled || !cecConfig.cecInputChannel) {
      setStatus('❌ CEC not configured or enabled')
      setTimeout(() => setStatus(''), 3000)
      return
    }

    setLoading(true)
    
    // Update processing status for affected TVs
    const targetOutputs = outputNumbers || outputs.map(o => o.channelNumber)
    setTvStatuses(prev => prev.map(tv => 
      targetOutputs.includes(tv.outputNumber) 
        ? { ...tv, isProcessing: true }
        : tv
    ))

    const actionText = action === 'power_on' ? 'Powering On' : 'Powering Off'
    const scope = individual ? 'Individual' : 'All'
    setStatus(`${actionText} ${scope} TVs...`)

    try {
      const response = await fetch('/api/cec/power-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          outputNumbers: outputNumbers,
          individual
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setStatus(`✅ ${actionText} completed successfully`)
        
        // Update TV statuses
        setTvStatuses(prev => prev.map(tv => {
          if (targetOutputs.includes(tv.outputNumber)) {
            return {
              ...tv,
              isProcessing: false,
              isPoweredOn: action === 'power_on',
              lastAction: action,
              lastActionTime: new Date().toLocaleTimeString()
            }
          }
          return tv
        }))
      } else {
        setStatus(`❌ ${actionText} failed: ${result.error || 'Unknown error'}`)
        
        // Reset processing status on failure
        setTvStatuses(prev => prev.map(tv => 
          targetOutputs.includes(tv.outputNumber) 
            ? { ...tv, isProcessing: false }
            : tv
        ))
      }
    } catch (error) {
      console.error('CEC power control error:', error)
      setStatus(`❌ ${actionText} error: ${error}`)
      
      // Reset processing status on error
      setTvStatuses(prev => prev.map(tv => 
        targetOutputs.includes(tv.outputNumber) 
          ? { ...tv, isProcessing: false }
          : tv
      ))
    } finally {
      setLoading(false)
      setTimeout(() => setStatus(''), 5000)
    }
  }

  const powerOnAll = () => executePowerAction('power_on')
  const powerOffAll = () => executePowerAction('power_off')
  const powerOnIndividual = (outputNumber: number) => executePowerAction('power_on', [outputNumber], true)
  const powerOffIndividual = (outputNumber: number) => executePowerAction('power_off', [outputNumber], true)

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'gaming': return '🎮'
      case 'server': return '🖥️'
      case 'cec': return '⚡'
      default: return '📺'
    }
  }

  const getTVStatusIcon = (tv: TVPowerStatus) => {
    if (tv.isProcessing) return <Clock className="w-4 h-4 animate-spin text-yellow-400" />
    if (tv.isPoweredOn === true) return <CheckCircle className="w-4 h-4 text-green-400" />
    if (tv.isPoweredOn === false) return <XCircle className="w-4 h-4 text-red-400" />
    return <Monitor className="w-4 h-4 text-slate-500" />
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-2 ${
          connectionStatus === 'connected' 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span>Matrix: {connectionStatus}</span>
        </div>
        
        {status && (
          <div className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm">
            {status}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System-Wide Power Control */}
        <div className="bg-slate-800 or bg-slate-900/10 backdrop-blur-sm rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Power className="mr-2 w-5 h-5" />
            System Power Control
          </h3>

          <div className="space-y-4">
            {/* All TVs Control */}
            <div className="bg-slate-800 or bg-slate-900/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Tv className="w-5 h-5 text-blue-400" />
                  <span className="font-medium text-white">All TVs</span>
                </div>
                <span className="text-xs text-slate-500">{outputs.length} active</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={powerOnAll}
                  disabled={loading || !cecConfig.isEnabled || !cecConfig.cecInputChannel}
                  className="py-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                >
                  <Power className="w-4 h-4" />
                  <span>Power On</span>
                </button>
                <button
                  onClick={powerOffAll}
                  disabled={loading || !cecConfig.isEnabled || !cecConfig.cecInputChannel}
                  className="py-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                >
                  <Power className="w-4 h-4" />
                  <span>Power Off</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Individual TV Control */}
        <div className="bg-slate-800 or bg-slate-900/10 backdrop-blur-sm rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <Monitor className="mr-2 w-5 h-5" />
            Individual TV Control
          </h3>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {tvStatuses.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Tv className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No active TV outputs found.</p>
                <p className="text-xs mt-1">Configure matrix outputs first.</p>
              </div>
            ) : (
              <>
                {tvStatuses.map((tv) => (
                  <div key={tv.outputNumber} className="bg-slate-800 or bg-slate-900/5 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getTVStatusIcon(tv)}
                        <div>
                          <div className="font-medium text-white text-sm">{tv.label}</div>
                          <div className="text-xs text-slate-500">Output {tv.outputNumber}</div>
                        </div>
                      </div>
                      {tv.lastActionTime && (
                        <div className="text-xs text-slate-500">
                          {tv.lastActionTime}
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => powerOnIndividual(tv.outputNumber)}
                        disabled={loading || tv.isProcessing || !cecConfig.isEnabled || !cecConfig.cecInputChannel}
                        className="py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {tv.isProcessing ? 'Processing...' : 'On'}
                      </button>
                      <button
                        onClick={() => powerOffIndividual(tv.outputNumber)}
                        disabled={loading || tv.isProcessing || !cecConfig.isEnabled || !cecConfig.cecInputChannel}
                        className="py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {tv.isProcessing ? 'Processing...' : 'Off'}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-300 mb-2 flex items-center">
          <Zap className="mr-2 w-4 h-4" />
          How CEC Power Control Works
        </h4>
        <div className="text-xs text-blue-200 space-y-1">
          <p>• <strong>Step 1:</strong> Matrix routes the CEC server input to target TV output(s)</p>
          <p>• <strong>Step 2:</strong> System waits for the configured delay (default: 2 seconds)</p>
          <p>• <strong>Step 3:</strong> CEC power command is sent to the connected TV(s)</p>
          <p>• <strong>Individual Mode:</strong> Each TV is controlled separately for precise power management</p>
          <p>• <strong>Batch Mode:</strong> All TVs are routed and then powered simultaneously</p>
        </div>
      </div>
    </div>
  )
}

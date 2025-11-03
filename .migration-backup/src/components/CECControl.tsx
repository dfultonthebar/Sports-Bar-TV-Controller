
'use client'

import { useState, useEffect } from 'react'
import { Power, Volume2, VolumeX, Monitor, RefreshCw, Zap, AlertCircle, CheckCircle } from 'lucide-react'

import { logger } from '@/lib/logger'
interface CECDevice {
  address: string
  name: string
  vendor: string
  osdName: string
  powerStatus: string
}

interface CECControlProps {
  tvAddress?: string
  onCommandSent?: (success: boolean, message: string) => void
  compact?: boolean
}

export default function CECControl({ tvAddress = '0', onCommandSent, compact = false }: CECControlProps) {
  const [devices, setDevices] = useState<CECDevice[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string>('unknown')
  const [lastCommand, setLastCommand] = useState<{ success: boolean; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    initializeCEC()
  }, [])

  const initializeCEC = async () => {
    try {
      const response = await fetch('/api/cec/initialize')
      const data = await response.json()
      setIsInitialized(data.success)

      // Skip automatic scan on load - user can click "Scan" button when needed
      // This makes the page load instantly instead of waiting 3-7 seconds
    } catch (error) {
      logger.error('Failed to initialize CEC:', error)
    }
  }

  const scanDevices = async () => {
    setIsScanning(true)
    try {
      const response = await fetch('/api/cec/scan?refresh=true')
      const data = await response.json()
      
      if (data.success) {
        setDevices(data.devices)
        
        // Update power status for the current TV
        const tv = data.devices.find((d: CECDevice) => d.address === tvAddress)
        if (tv) {
          setCurrentStatus(tv.powerStatus)
        }
      }
    } catch (error) {
      logger.error('Failed to scan CEC devices:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const sendCommand = async (action: string, params: any = {}) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/cec/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          tvAddress,
          params
        })
      })
      
      const result = await response.json()
      setLastCommand(result)
      
      if (onCommandSent) {
        onCommandSent(result.success, result.message)
      }
      
      // Refresh device status after command
      setTimeout(() => scanDevices(), 1000)
      
      return result
    } catch (error: any) {
      const errorResult = { success: false, message: error.message }
      setLastCommand(errorResult)
      return errorResult
    } finally {
      setIsLoading(false)
    }
  }

  const handlePowerToggle = () => sendCommand('toggle_power')
  const handlePowerOn = () => sendCommand('power_on')
  const handlePowerOff = () => sendCommand('power_off')
  const handleMute = () => sendCommand('mute')
  const handleSetInput = (inputNumber: number) => sendCommand('set_input', { inputNumber })

  if (!isInitialized) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 text-yellow-800">
          <AlertCircle className="w-5 h-5" />
          <div>
            <p className="font-medium">CEC Adapter Not Detected</p>
            <p className="text-sm">Connect the Pulse-Eight USB CEC adapter to enable TV control.</p>
          </div>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={handlePowerToggle}
          disabled={isLoading}
          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          title="Toggle TV Power"
        >
          <Power className="w-4 h-4" />
          <span className="text-xs">CEC</span>
        </button>
        
        <button
          onClick={handleMute}
          disabled={isLoading}
          className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Mute TV"
        >
          <VolumeX className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Zap className="w-6 h-6 text-indigo-400" />
          <h3 className="text-lg font-semibold text-slate-100">CEC TV Control</h3>
        </div>
        
        <button
          onClick={scanDevices}
          disabled={isScanning}
          className="px-3 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>Scan</span>
        </button>
      </div>

      {/* Device Status */}
      <div className="bg-slate-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">TV Status</span>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            currentStatus.toLowerCase().includes('on') 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-500 text-white'
          }`}>
            {currentStatus || 'Unknown'}
          </span>
        </div>
        
        {devices.length > 0 && (
          <div className="text-xs text-slate-400 mt-2">
            {devices.length} device(s) detected
          </div>
        )}
      </div>

      {/* Power Controls */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Power Control</h4>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handlePowerOn}
            disabled={isLoading}
            className="px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center space-y-1"
          >
            <Power className="w-5 h-5" />
            <span className="text-xs">On</span>
          </button>
          
          <button
            onClick={handlePowerOff}
            disabled={isLoading}
            className="px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center space-y-1"
          >
            <Power className="w-5 h-5" />
            <span className="text-xs">Off</span>
          </button>
          
          <button
            onClick={handlePowerToggle}
            disabled={isLoading}
            className="px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center space-y-1"
          >
            <Zap className="w-5 h-5" />
            <span className="text-xs">Toggle</span>
          </button>
        </div>
      </div>

      {/* Audio Controls */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Audio Control</h4>
        <button
          onClick={handleMute}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          <VolumeX className="w-5 h-5" />
          <span>Mute/Unmute</span>
        </button>
      </div>

      {/* Input Selection */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">HDMI Input</h4>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((input) => (
            <button
              key={input}
              onClick={() => handleSetInput(input)}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-700 text-slate-200 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center"
            >
              <Monitor className="w-4 h-4 mb-1" />
              <span className="text-xs">HDMI {input}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Last Command Result */}
      {lastCommand && (
        <div className={`p-3 rounded-md text-sm ${
          lastCommand.success 
            ? 'bg-green-900/50 border border-green-700 text-green-200' 
            : 'bg-red-900/50 border border-red-700 text-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {lastCommand.success ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{lastCommand.message}</span>
          </div>
        </div>
      )}

      {/* Detected Devices */}
      {devices.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Detected Devices</h4>
          <div className="space-y-2">
            {devices.map((device) => (
              <div key={device.address} className="bg-slate-700 rounded p-3 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-slate-200">{device.osdName || 'Unknown Device'}</span>
                  <span className="text-slate-400">Addr: {device.address}</span>
                </div>
                <div className="text-slate-400">
                  {device.vendor && <div>Vendor: {device.vendor}</div>}
                  <div>Power: {device.powerStatus}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

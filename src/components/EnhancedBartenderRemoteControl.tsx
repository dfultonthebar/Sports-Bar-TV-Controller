
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useBartenderLogging } from '@/hooks/useLogging'
import { 
  Power, 
  Volume2, 
  VolumeX, 
  ChevronUp, 
  ChevronDown, 
  Settings, 
  Tv, 
  Speaker, 
  Wifi,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

interface InputMapping {
  inputNumber: number
  inputLabel: string
  tvNumber?: number
  irDevices?: Array<{
    id: string
    name: string
    type: string
  }>
  directvDevices?: Array<{
    id: string
    name: string
    ip: string
    type: string
  }>
}

interface DeviceStatus {
  online: boolean
  lastResponse: string | null
  responseTime: number | null
}

export default function EnhancedBartenderRemoteControl() {
  const { 
    logUserAction, 
    logError, 
    logButtonClick, 
    logConfigChange, 
    logDeviceInteraction,
    logRemoteControlAction,
    startPerformanceTimer, 
    endPerformanceTimer,
    logInputSelection,
    logVolumeChange,
    logMatrixOperation 
  } = useBartenderLogging()

  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [inputMappings, setInputMappings] = useState<InputMapping[]>([])
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatus>>({})
  const [currentVolume, setCurrentVolume] = useState(50)
  const [isMuted, setIsMuted] = useState(false)
  const [activeTab, setActiveTab] = useState('control')
  const [loading, setLoading] = useState(false)
  const [lastOperationTime, setLastOperationTime] = useState<Date | null>(null)

  // Initialize component and load data
  useEffect(() => {
    logUserAction('component_init', { component: 'BartenderRemoteControl' })
    startPerformanceTimer('initial_load')
    
    const initializeComponent = async () => {
      try {
        await Promise.all([
          loadInputMappings(),
          loadDeviceStatuses(),
          loadSystemState()
        ])
        const loadTime = endPerformanceTimer('initial_load')
        logUserAction('component_loaded', { loadTime })
      } catch (error) {
        logError(error as Error, 'component_initialization')
      }
    }

    initializeComponent()
  }, [])

  // Load input mappings
  const loadInputMappings = async () => {
    try {
      startPerformanceTimer('load_input_mappings')
      const response = await fetch('/api/input-mappings')
      const data = await response.json()
      
      if (response.ok) {
        setInputMappings(data.mappings || [])
        const loadTime = endPerformanceTimer('load_input_mappings')
        logUserAction('input_mappings_loaded', { 
          count: data.mappings?.length || 0,
          loadTime 
        })
      } else {
        throw new Error(data.error || 'Failed to load input mappings')
      }
    } catch (error) {
      logError(error as Error, 'load_input_mappings')
      endPerformanceTimer('load_input_mappings')
    }
  }

  // Load device statuses
  const loadDeviceStatuses = async () => {
    try {
      startPerformanceTimer('load_device_statuses')
      const response = await fetch('/api/system/device-status')
      const data = await response.json()
      
      if (response.ok) {
        setDeviceStatuses(data.devices || {})
        const loadTime = endPerformanceTimer('load_device_statuses')
        logUserAction('device_statuses_loaded', { 
          deviceCount: Object.keys(data.devices || {}).length,
          loadTime 
        })
      } else {
        throw new Error(data.error || 'Failed to load device statuses')
      }
    } catch (error) {
      logError(error as Error, 'load_device_statuses')
      endPerformanceTimer('load_device_statuses')
    }
  }

  // Load system state
  const loadSystemState = async () => {
    try {
      const response = await fetch('/api/system/state')
      const data = await response.json()
      
      if (response.ok) {
        setCurrentVolume(data.volume || 50)
        setIsMuted(data.muted || false)
        setSelectedInput(data.activeInput || null)
        
        logUserAction('system_state_loaded', {
          volume: data.volume,
          muted: data.muted,
          activeInput: data.activeInput
        })
      }
    } catch (error) {
      logError(error as Error, 'load_system_state')
    }
  }

  // Handle input selection with comprehensive logging
  const handleInputChange = async (inputNumber: string) => {
    const inputNum = parseInt(inputNumber)
    const oldInput = selectedInput
    
    logButtonClick('input_select', `Input ${inputNum}`, { 
      from: oldInput, 
      to: inputNum,
      inputLabel: inputMappings.find(m => m.inputNumber === inputNum)?.inputLabel
    })
    
    setLoading(true)
    startPerformanceTimer('input_change')
    
    try {
      setSelectedInput(inputNum)
      setLastOperationTime(new Date())
      
      const mapping = inputMappings.find(m => m.inputNumber === inputNum)
      if (!mapping) {
        throw new Error(`No mapping found for input ${inputNum}`)
      }

      // Switch Wolf Pack matrix input
      const matrixResponse = await fetch('/api/matrix/switch-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputNum })
      })

      if (!matrixResponse.ok) {
        throw new Error('Failed to switch matrix input')
      }

      // Handle associated devices
      const deviceOperations = []

      // Switch IR devices
      if (mapping.irDevices && mapping.irDevices.length > 0) {
        for (const device of mapping.irDevices) {
          deviceOperations.push(
            switchIRDevice(device.id, device.name)
          )
        }
      }

      // Switch DirecTV devices
      if (mapping.directvDevices && mapping.directvDevices.length > 0) {
        for (const device of mapping.directvDevices) {
          deviceOperations.push(
            switchDirectTVDevice(device.id, device.ip)
          )
        }
      }

      // Wait for all device operations
      const results = await Promise.allSettled(deviceOperations)
      const failures = results.filter(r => r.status === 'rejected')
      
      const switchTime = endPerformanceTimer('input_change')
      
      logDeviceInteraction('wolf_pack', 'matrix', 'switch_input', true, await switchTime, {
        input: inputNum,
        deviceOperations: deviceOperations.length,
        failures: failures.length
      })

      logConfigChange('active_input', oldInput, inputNum)

      if (failures.length > 0) {
        logError(
          new Error(`${failures.length} device operations failed`), 
          'input_change_partial_failure',
          { failures: failures.map(f => f.reason) }
        )
      }

      logUserAction('input_changed_success', {
        from: oldInput,
        to: inputNum,
        switchTime,
        deviceOperations: deviceOperations.length,
        failures: failures.length
      })

    } catch (error) {
      endPerformanceTimer('input_change')
      setSelectedInput(oldInput) // Revert on failure
      
      logError(error as Error, 'input_change_failed')
      logDeviceInteraction('wolf_pack', 'matrix', 'switch_input', false, undefined, {
        input: inputNum,
        error: (error as Error).message
      })
      
      // Show user feedback (you might want to add a toast notification)
      console.error('Failed to switch input:', error)
    } finally {
      setLoading(false)
    }
  }

  // Switch IR device with logging
  const switchIRDevice = async (deviceId: string, deviceName: string) => {
    startPerformanceTimer(`ir_switch_${deviceId}`)
    
    try {
      const response = await fetch('/api/ir/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, command: 'power_on' })
      })

      if (!response.ok) {
        throw new Error(`IR device ${deviceName} switch failed`)
      }

      const switchTime = endPerformanceTimer(`ir_switch_${deviceId}`)
      
      logDeviceInteraction('ir_device', deviceId, 'switch', true, undefined, {
        deviceName,
        switchTime
      })

      return { success: true, deviceId, deviceName }
    } catch (error) {
      endPerformanceTimer(`ir_switch_${deviceId}`)
      
      logDeviceInteraction('ir_device', deviceId, 'switch', false, undefined, {
        deviceName,
        error: (error as Error).message
      })
      
      throw error
    }
  }

  // Switch DirecTV device with logging
  const switchDirectTVDevice = async (deviceId: string, deviceIP: string) => {
    startPerformanceTimer(`directv_switch_${deviceId}`)
    
    try {
      const response = await fetch('/api/directv/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, ip: deviceIP, command: 'activate' })
      })

      if (!response.ok) {
        throw new Error(`DirecTV device ${deviceId} switch failed`)
      }

      const switchTime = endPerformanceTimer(`directv_switch_${deviceId}`)
      
      logDeviceInteraction('directv', deviceId, 'switch', true, undefined, {
        ip: deviceIP,
        switchTime
      })

      return { success: true, deviceId, ip: deviceIP }
    } catch (error) {
      endPerformanceTimer(`directv_switch_${deviceId}`)
      
      logDeviceInteraction('directv', deviceId, 'switch', false, undefined, {
        ip: deviceIP,
        error: (error as Error).message
      })
      
      throw error
    }
  }

  // Volume control with logging
  const handleVolumeChange = async (newVolume: number) => {
    const oldVolume = currentVolume
    logButtonClick('volume_change', `Volume ${newVolume}`, { from: oldVolume, to: newVolume })
    
    try {
      setCurrentVolume(newVolume)
      startPerformanceTimer('volume_change')

      const response = await fetch('/api/audio/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volume: newVolume })
      })

      if (!response.ok) {
        throw new Error('Failed to change volume')
      }

      const changeTime = endPerformanceTimer('volume_change')
      
      logDeviceInteraction('audio_system', 'main', 'volume_change', true, undefined, {
        oldVolume,
        newVolume,
        changeTime
      })

      logConfigChange('volume', oldVolume, newVolume)
    } catch (error) {
      endPerformanceTimer('volume_change')
      setCurrentVolume(oldVolume) // Revert on failure
      
      logError(error as Error, 'volume_change_failed')
      logDeviceInteraction('audio_system', 'main', 'volume_change', false, undefined, {
        targetVolume: newVolume,
        error: (error as Error).message
      })
    }
  }

  // Mute toggle with logging
  const handleMuteToggle = async () => {
    const newMutedState = !isMuted
    logButtonClick('mute_toggle', `Mute ${newMutedState ? 'ON' : 'OFF'}`, { from: isMuted, to: newMutedState })
    
    try {
      setIsMuted(newMutedState)
      startPerformanceTimer('mute_toggle')

      const response = await fetch('/api/audio/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muted: newMutedState })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle mute')
      }

      const toggleTime = endPerformanceTimer('mute_toggle')
      
      logDeviceInteraction('audio_system', 'main', 'mute_toggle', true, undefined, {
        newState: newMutedState,
        toggleTime
      })

      logConfigChange('muted', isMuted, newMutedState)
    } catch (error) {
      endPerformanceTimer('mute_toggle')
      setIsMuted(isMuted) // Revert on failure
      
      logError(error as Error, 'mute_toggle_failed')
      logDeviceInteraction('audio_system', 'main', 'mute_toggle', false, undefined, {
        targetState: newMutedState,
        error: (error as Error).message
      })
    }
  }

  // Power control with logging
  const handlePowerControl = async (action: 'on' | 'off') => {
    logButtonClick('power_control', `Power ${action.toUpperCase()}`, { action })
    
    try {
      startPerformanceTimer(`power_${action}`)
      setLastOperationTime(new Date())

      const response = await fetch('/api/system/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action} system`)
      }

      const actionTime = endPerformanceTimer(`power_${action}`)
      
      logDeviceInteraction('tv', 'main_displays', `power_${action}`, true, undefined, {
        actionTime
      })

      logUserAction('power_control_success', { action, actionTime })
    } catch (error) {
      endPerformanceTimer(`power_${action}`)
      
      logError(error as Error, `power_${action}_failed`)
      logDeviceInteraction('tv', 'main_displays', `power_${action}`, false, undefined, {
        error: (error as Error).message
      })
    }
  }

  // Tab change logging
  const handleTabChange = (newTab: string) => {
    const oldTab = activeTab
    setActiveTab(newTab)
    
    logUserAction('tab_change', {
      from: oldTab,
      to: newTab
    })
  }

  // Device status indicator
  const getDeviceStatusIcon = (deviceId: string) => {
    const status = deviceStatuses[deviceId]
    if (!status) return <AlertCircle className="h-4 w-4 text-slate-500" />
    
    if (status.online) {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    } else {
      return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  // Render input option with device info
  const renderInputOption = (mapping: InputMapping) => (
    <div key={mapping.inputNumber} className="flex items-center justify-between p-2">
      <div className="flex-1">
        <span className="font-medium">{mapping.inputLabel}</span>
        <div className="text-sm text-muted-foreground mt-1">
          {mapping.irDevices && mapping.irDevices.length > 0 && (
            <div className="flex items-center gap-1 mb-1">
              <Tv className="h-3 w-3" />
              <span>IR: {mapping.irDevices.length} devices</span>
            </div>
          )}
          {mapping.directvDevices && mapping.directvDevices.length > 0 && (
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3" />
              <span>DirecTV: {mapping.directvDevices.length} devices</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1">
        {mapping.irDevices?.map(device => 
          <div key={device.id} title={`IR: ${device.name}`}>
            {getDeviceStatusIcon(`ir_${device.id}`)}
          </div>
        )}
        {mapping.directvDevices?.map(device => 
          <div key={device.id} title={`DirecTV: ${device.name} (${device.ip})`}>
            {getDeviceStatusIcon(`directv_${device.id}`)}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Bartender Remote Control</CardTitle>
            <p className="text-muted-foreground">Enhanced AV system control with comprehensive logging</p>
          </div>
          {lastOperationTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last operation: {lastOperationTime.toLocaleTimeString()}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="control">Control</TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="logs">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="control" className="space-y-6">
            {/* Input Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Select Input Source</label>
              <Select 
                value={selectedInput?.toString() || ""} 
                onValueChange={handleInputChange}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an input..." />
                </SelectTrigger>
                <SelectContent>
                  {inputMappings.map(mapping => (
                    <SelectItem key={mapping.inputNumber} value={mapping.inputNumber.toString()}>
                      {renderInputOption(mapping)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedInput && (
                <Badge variant="outline" className="mt-2">
                  Active Input: {inputMappings.find(m => m.inputNumber === selectedInput)?.inputLabel || selectedInput}
                </Badge>
              )}
            </div>

            {/* Volume Control */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Volume Control</label>
                <span className="text-sm text-muted-foreground">
                  {isMuted ? 'Muted' : `${currentVolume}%`}
                </span>
              </div>
              
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleMuteToggle}
                  disabled={loading}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                
                <div className="flex-1 flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleVolumeChange(Math.max(0, currentVolume - 5))}
                    disabled={loading || currentVolume <= 0}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex-1 bg-muted rounded-full h-2 relative">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${isMuted ? 0 : currentVolume}%` }}
                    />
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleVolumeChange(Math.min(100, currentVolume + 5))}
                    disabled={loading || currentVolume >= 100}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Power Controls */}
            <div className="space-y-3">
              <label className="text-sm font-medium">System Power</label>
              <div className="flex gap-4">
                <Button 
                  onClick={() => handlePowerControl('on')}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Power className="mr-2 h-4 w-4" />
                  Power On All
                </Button>
                <Button 
                  onClick={() => handlePowerControl('off')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                >
                  <Power className="mr-2 h-4 w-4" />
                  Power Off All
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inputMappings.map(mapping => (
                <Card key={mapping.inputNumber} className={
                  selectedInput === mapping.inputNumber 
                    ? 'border-primary bg-primary/5' 
                    : ''
                }>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {mapping.inputLabel}
                      <Badge variant="outline">Input {mapping.inputNumber}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* IR Devices */}
                      {mapping.irDevices && mapping.irDevices.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center">
                            <Tv className="mr-2 h-4 w-4" />
                            IR Devices
                          </h4>
                          {mapping.irDevices.map(device => (
                            <div key={device.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <span className="text-sm">{device.name}</span>
                              {getDeviceStatusIcon(`ir_${device.id}`)}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* DirecTV Devices */}
                      {mapping.directvDevices && mapping.directvDevices.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center">
                            <Wifi className="mr-2 h-4 w-4" />
                            DirecTV Devices
                          </h4>
                          {mapping.directvDevices.map(device => (
                            <div key={device.id} className="p-2 bg-muted/50 rounded">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{device.name}</span>
                                {getDeviceStatusIcon(`directv_${device.id}`)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                IP: {device.ip}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <div className="text-center py-8">
              <div className="mb-4">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Activity Logging Active</h3>
              <p className="text-muted-foreground mb-4">
                All interactions with the bartender remote are being logged for analysis and troubleshooting.
              </p>
              <Button 
                onClick={() => window.open('/logs', '_blank')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                View Full Logs Dashboard
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Loading indicator */}
        {loading && (
          <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
            <div className="bg-slate-800 or bg-slate-900 p-6 rounded-lg shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Processing request...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

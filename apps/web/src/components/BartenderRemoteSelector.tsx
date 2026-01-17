'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Cable, Satellite, Smartphone, Tv, CheckCircle, AlertCircle, Gamepad2, Zap, Radio } from 'lucide-react'
import CableBoxRemote from './remotes/CableBoxRemote'
import DirecTVRemote from './remotes/DirecTVRemote'
import FireTVRemote from './remotes/FireTVRemote'
import ChannelPresetGrid from './ChannelPresetGrid'
import FireTVStreamingGuide from './FireTVStreamingGuide'

import { logger } from '@sports-bar/logger'
interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
}

interface IRCommand {
  id: string
  deviceId: string
  functionName: string
  irCode: string
  category?: string
}

interface IRDevice {
  id: string
  name: string
  brand: string
  deviceType: string
  matrixInput?: number
  matrixInputLabel?: string
  irCodeSetId?: string
  irCodes?: string  // Legacy field - deprecated
  commands?: IRCommand[]  // New system - from IRCommand table
  globalCacheDeviceId?: string
  globalCachePortNumber?: number
  description?: string
  status: string
  createdAt?: string
  updatedAt?: string
  // Joined from GlobalCacheDevice
  iTachAddress?: string
}

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  receiverType: 'Genie HD DVR' | 'Genie Mini' | 'HR Series DVR' | 'C61K Mini' | 'HS17 Server'
  inputChannel?: number
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
}

interface FireTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  deviceType: 'Fire TV Cube' | 'Fire TV Stick' | 'Fire TV' | 'Fire TV Stick 4K Max'
  inputChannel?: number
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
  adbEnabled?: boolean
}

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: 'cable' | 'directv'
  order: number
  usageCount: number
  lastUsed: Date | null
}


type DeviceType = 'cable' | 'satellite' | 'streaming' | null

export default function BartenderRemoteSelector() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [direcTVDevices, setDirecTVDevices] = useState<DirecTVDevice[]>([])
  const [fireTVDevices, setFireTVDevices] = useState<FireTVDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | DirecTVDevice | FireTVDevice | null>(null)
  const [deviceType, setDeviceType] = useState<DeviceType>(null)
  const [channelPresets, setChannelPresets] = useState<ChannelPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [hoveredInput, setHoveredInput] = useState<number | null>(null)
  const [currentChannels, setCurrentChannels] = useState<Record<number, {
    channelNumber: string
    channelName: string | null
    deviceType: string
    inputLabel: string
  }>>({})

  useEffect(() => {
    loadAllDevices()
    loadChannelPresets()
    loadCurrentChannels()

    // Poll for device status updates every 10 seconds
    const pollInterval = setInterval(() => {
      loadAllDevices()
      loadCurrentChannels()
    }, 10000)

    return () => clearInterval(pollInterval)
  }, [])

  const loadAllDevices = async () => {
    try {
      const [matrixResponse, irResponse, direcTVResponse, fireTVResponse, globalCacheResponse] = await Promise.allSettled([
        fetch('/api/matrix/config'),
        fetch('/api/ir-devices'),
        fetch('/api/directv-devices'),
        fetch('/api/firetv-devices'),
        fetch('/api/globalcache/devices')
      ])

      // Load matrix inputs
      if (matrixResponse.status === 'fulfilled') {
        const matrixData = await matrixResponse.value.json()
        if (matrixData.configs?.length > 0) {
          const customInputs = matrixData.configs[0].inputs?.filter((input: MatrixInput) =>
            input.label && !input.label.match(/^Input \d+$/) && input.isActive
          ) || []
          setInputs(customInputs)
        } else if (matrixData.inputs) {
          const customInputs = matrixData.inputs.filter((input: MatrixInput) =>
            input.label && !input.label.match(/^Input \d+$/) && input.isActive
          )
          setInputs(customInputs)
        }
      }

      // Load GlobalCache devices for IR device lookup
      let globalCacheMap: Record<string, any> = {}
      if (globalCacheResponse.status === 'fulfilled') {
        const gcData = await globalCacheResponse.value.json()
        if (gcData.devices) {
          gcData.devices.forEach((gc: any) => {
            globalCacheMap[gc.id] = gc
          })
        }
      }

      // Load IR devices and enrich with GlobalCache IP addresses and commands
      if (irResponse.status === 'fulfilled') {
        const irData = await irResponse.value.json()
        const devices = irData.devices || []

        // Load commands for each IR device
        const devicesWithCommands = await Promise.all(
          devices.map(async (device: IRDevice) => {
            try {
              const commandsResponse = await fetch(`/api/ir/devices/${device.id}/commands`)
              const commandsData = await commandsResponse.json()

              let enrichedDevice = { ...device }

              // Add commands if successfully loaded
              if (commandsData.success && commandsData.commands) {
                enrichedDevice.commands = commandsData.commands
              }

              // Add iTach address if GlobalCache device is assigned
              if (device.globalCacheDeviceId && globalCacheMap[device.globalCacheDeviceId]) {
                enrichedDevice.iTachAddress = globalCacheMap[device.globalCacheDeviceId].ipAddress
              }

              return enrichedDevice
            } catch (error) {
              logger.error(`Error loading commands for device ${device.id}:`, error)
              // Return device without commands if loading fails
              if (device.globalCacheDeviceId && globalCacheMap[device.globalCacheDeviceId]) {
                return {
                  ...device,
                  iTachAddress: globalCacheMap[device.globalCacheDeviceId].ipAddress
                }
              }
              return device
            }
          })
        )

        setIRDevices(devicesWithCommands)
      }

      // Load DirecTV devices
      if (direcTVResponse.status === 'fulfilled') {
        const direcTVData = await direcTVResponse.value.json()
        setDirecTVDevices(direcTVData.devices || [])
      }

      // Load Fire TV devices
      if (fireTVResponse.status === 'fulfilled') {
        const fireTVData = await fireTVResponse.value.json()
        setFireTVDevices(fireTVData.devices || [])
      }
    } catch (error) {
      logger.error('Error loading devices:', error)
    }
  }

  const loadChannelPresets = async () => {
    try {
      const response = await fetch('/api/channel-presets')
      const data = await response.json()

      if (data.success) {
        setChannelPresets(data.presets || [])
      }
    } catch (error) {
      logger.error('Error loading channel presets:', error)
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

  // DEPRECATED: CEC cable box loading removed
  // Cable boxes are now configured as IR devices in the IR Devices admin panel

  const sendChannelCommand = async (channelNumber: string, presetId?: string) => {
    // For DirecTV, use server-side proxy API (direct fetch blocked by CORS)
    if (selectedDevice && 'receiverType' in selectedDevice) {
      const direcTV = selectedDevice as DirecTVDevice

      // Use the server-side API which proxies to the DirecTV device
      const response = await fetch(`/api/directv/${direcTV.id}/tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelNumber })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to tune channel')
      }
      return
    }

    // For IR devices (cable boxes), use the channel-presets/tune API
    // This ensures channel tracking is updated in inputCurrentChannels
    if (selectedDevice && 'matrixInput' in selectedDevice) {
      const response = await fetch('/api/channel-presets/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelNumber,
          deviceType: 'cable',
          cableBoxId: selectedDevice.id,
          presetId: presetId || 'manual'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to tune channel')
      }
      return
    }

    // Fallback: send digits directly (for any other device type)
    const digits = channelNumber.split('')
    for (const digit of digits) {
      await sendCommand(digit)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  const sendCommand = async (command: string) => {
    if (!selectedDevice) throw new Error('No device selected')

    if ('receiverType' in selectedDevice) {
      // DirecTV device
      const response = await fetch('/api/directv-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command: command,
          ipAddress: selectedDevice.ipAddress,
          port: selectedDevice.port
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
    } else if ('iTachAddress' in selectedDevice) {
      // IR Device
      const response = await fetch('/api/ir/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          commandName: command
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
    }
  }

  const handlePresetClick = async (preset: ChannelPreset) => {
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    // Don't show loading overlay - tuning is fast with direct API
    setCommandStatus(`Tuning to ${preset.name}...`)

    try {
      await sendChannelCommand(preset.channelNumber, preset.id)
      setCommandStatus(`✓ ${preset.name}`)
      // Refresh current channels to update the input label
      await loadCurrentChannels()
      setTimeout(() => setCommandStatus(''), 2000)
    } catch (error) {
      setCommandStatus(`✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const handleInputSelection = (inputNumber: number) => {
    setSelectedInput(inputNumber)

    // Find associated device
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === inputNumber)
    const irDevice = irDevices.find(d => d.matrixInput === inputNumber)

    const activeDevice = direcTVDevice || fireTVDevice || irDevice
    setSelectedDevice(activeDevice || null)

    // Determine device type
    if (direcTVDevice) {
      setDeviceType('satellite')
    } else if (fireTVDevice) {
      setDeviceType('streaming')
    } else if (irDevice) {
      setDeviceType('cable')
    } else {
      setDeviceType(null)
    }
  }

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return <Cable className="w-5 h-5" />
      case 'satellite': return <Satellite className="w-5 h-5" />
      case 'streaming': return <Smartphone className="w-5 h-5" />
      default: return <Tv className="w-5 h-5" />
    }
  }

  const getInputGradient = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return 'from-blue-500/20 to-cyan-500/20'
      case 'satellite': return 'from-purple-500/20 to-pink-500/20'
      case 'streaming': return 'from-orange-500/20 to-red-500/20'
      default: return 'from-slate-500/20 to-gray-500/20'
    }
  }

  const getDeviceStatusIcon = (inputNumber: number) => {
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === inputNumber)
    const irDevice = irDevices.find(d => d.matrixInput === inputNumber)

    const isOnline = direcTVDevice?.isOnline || fireTVDevice?.isOnline || (irDevice?.status === 'active')

    return isOnline ? (
      <div className="relative">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="absolute inset-0 animate-ping">
          <CheckCircle className="w-5 h-5 text-green-400 opacity-75" />
        </span>
      </div>
    ) : (
      <AlertCircle className="w-5 h-5 text-slate-500" />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 p-4 pb-20">
      {/* Animated Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header with Glassmorphism */}
      <div className="relative text-center mb-8">
        <div className="inline-block backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-8 py-4 shadow-2xl">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 flex items-center justify-center gap-3">
            <Gamepad2 className="w-8 h-8 text-blue-400 drop-shadow-lg" />
            Remote Control Center
          </h1>
          <p className="text-sm text-slate-300/80">Select an input to control your devices</p>
        </div>

        {commandStatus && (
          <div className="mt-4 inline-block backdrop-blur-xl bg-blue-500/20 border border-blue-400/30 rounded-full px-6 py-2 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-blue-300 font-medium">{commandStatus}</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {/* Left Panel - Input Selection */}
        <div className="lg:col-span-1">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg">
                <Tv className="w-5 h-5 text-blue-400" />
              </div>
              Select Source
            </h2>
            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
              {inputs.length > 0 ? (
                inputs.map((input) => {
                  const direcTVDevice = direcTVDevices.find(d => d.inputChannel === input.channelNumber)
                  const fireTVDevice = fireTVDevices.find(d => d.inputChannel === input.channelNumber)
                  const irDevice = irDevices.find(d => d.matrixInput === input.channelNumber)
                  const hasDevice = direcTVDevice || fireTVDevice || irDevice
                  const isSelected = selectedInput === input.channelNumber
                  const isHovered = hoveredInput === input.channelNumber

                  return (
                    <button
                      key={input.id}
                      onClick={() => handleInputSelection(input.channelNumber)}
                      onMouseEnter={() => setHoveredInput(input.channelNumber)}
                      onMouseLeave={() => setHoveredInput(null)}
                      disabled={!hasDevice}
                      className={`
                        group relative w-full p-4 rounded-xl text-left transition-all duration-300
                        ${isSelected
                          ? 'backdrop-blur-xl bg-gradient-to-r ' + getInputGradient(input.inputType) + ' border-2 border-white/30 shadow-2xl scale-105'
                          : hasDevice
                          ? 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-102 hover:shadow-xl'
                          : 'backdrop-blur-xl bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-50'
                        }
                      `}
                    >
                      {/* Selection Glow Effect */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-xl -z-10 animate-pulse"></div>
                      )}

                      <div className="flex items-center gap-3">
                        {/* Icon Container with Gradient Background */}
                        <div className={`
                          p-3 rounded-lg transition-all duration-300
                          ${isSelected
                            ? 'bg-gradient-to-br from-blue-500/30 to-purple-500/30 shadow-lg scale-110'
                            : 'bg-white/10 group-hover:bg-white/15'
                          }
                        `}>
                          {getInputIcon(input.inputType)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold truncate transition-colors ${
                            isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                          }`}>
                            {currentChannels[input.channelNumber]?.channelName
                              ? `${input.label} - ${currentChannels[input.channelNumber].channelName}`
                              : input.label}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-white/10 text-slate-400 group-hover:text-slate-300'
                            }`}>
                              {currentChannels[input.channelNumber]?.channelNumber
                                ? `Ch ${currentChannels[input.channelNumber].channelNumber}`
                                : `Input ${input.channelNumber}`}
                            </span>
                            <span className="text-xs text-slate-400 group-hover:text-slate-300">
                              {direcTVDevice ? 'DirecTV' :
                               fireTVDevice ? 'Fire TV' :
                               irDevice ? 'Cable (IR)' :
                               'No Device'}
                            </span>
                          </div>
                        </div>

                        {/* Status Indicator */}
                        <div className="shrink-0">
                          {getDeviceStatusIcon(input.channelNumber)}
                        </div>
                      </div>

                      {/* Hover Effect Border */}
                      {isHovered && !isSelected && hasDevice && (
                        <div className="absolute inset-0 rounded-xl border-2 border-blue-400/50 pointer-events-none"></div>
                      )}
                    </button>
                  )
                })
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Tv className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No inputs configured</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Remote Control */}
        <div className="lg:col-span-2">
          <div className="flex flex-col items-center">
            {!selectedDevice && deviceType !== 'cable' ? (
              <div className="bg-slate-800 rounded-lg p-8 text-center max-w-md w-full">
                <Gamepad2 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">No Device Selected</h3>
                <p className="text-slate-400">Select an input from the left panel to show its remote control</p>
              </div>
            ) : deviceType === 'cable' && selectedDevice && 'iTachAddress' in selectedDevice ? (
              <>
                {/* IR Cable Box Remote */}
                <div className="w-full flex justify-center">
                  <CableBoxRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    iTachAddress={(selectedDevice as IRDevice).iTachAddress || ''}
                    irCodes={
                      // Convert commands array to irCodes format for compatibility
                      'commands' in selectedDevice && selectedDevice.commands
                        ? selectedDevice.commands.reduce((acc: Record<string, string>, cmd: IRCommand) => {
                            if (cmd.irCode && cmd.irCode !== 'PLACEHOLDER') {
                              acc[cmd.functionName] = cmd.irCode
                            }
                            return acc
                          }, {})
                        : // Fallback to legacy irCodes field
                          'irCodes' in selectedDevice && typeof selectedDevice.irCodes === 'string' && selectedDevice.irCodes
                        ? JSON.parse(selectedDevice.irCodes)
                        : undefined
                    }
                  />
                </div>
                {/* Channel Presets for Cable */}
                <div className="w-full mt-4">
                  <ChannelPresetGrid
                    key={`cable-${selectedDevice?.id || 'none'}`}
                    deviceType="cable"
                    onPresetClick={handlePresetClick}
                    maxVisible={6}
                  />
                </div>
              </>
            ) : deviceType === 'satellite' && 'ipAddress' in selectedDevice ? (
              <>
                <div className="w-full flex justify-center">
                  <DirecTVRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={selectedDevice.ipAddress}
                    port={selectedDevice.port}
                  />
                </div>
                {/* Channel Presets for DirecTV */}
                <div className="w-full mt-4">
                  <ChannelPresetGrid
                    key={`directv-${selectedDevice?.id || 'none'}`}
                    deviceType="directv"
                    onPresetClick={handlePresetClick}
                    maxVisible={6}
                  />
                </div>
              </>
            ) : deviceType === 'streaming' && 'ipAddress' in selectedDevice ? (
              <>
                <div className="w-full flex justify-center">
                  <FireTVRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={selectedDevice.ipAddress}
                    port={selectedDevice.port}
                  />
                </div>
                {/* Streaming Guide for Fire TV */}
                <div className="w-full mt-4">
                  <FireTVStreamingGuide
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={selectedDevice.ipAddress}
                    port={selectedDevice.port}
                  />
                </div>
              </>
            ) : (
              <div className="bg-slate-800 rounded-lg p-8 text-center max-w-md w-full">
                <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Device Not Configured</h3>
                <p className="text-slate-400">This device is not properly configured for remote control</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-slate-300">Processing request...</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        .scale-102 {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  )
}

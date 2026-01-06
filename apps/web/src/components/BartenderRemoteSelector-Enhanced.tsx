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

// Cable boxes are now configured as IR devices, not CEC devices.
// All cable box control goes through IR endpoints.

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
  matrixInput?: number  // Fixed: use matrixInput to match database schema
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

export default function BartenderRemoteSelectorEnhanced() {
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

  // ... (keep all the original logic/functions)

  useEffect(() => {
    loadAllDevices()
    loadChannelPresets()
  }, [])

  const loadAllDevices = async () => {
    try {
      const [matrixResponse, irResponse, direcTVResponse, fireTVResponse] = await Promise.allSettled([
        fetch('/api/matrix/config'),
        fetch('/api/ir-devices'),
        fetch('/api/directv-devices'),
        fetch('/api/firetv-devices')
      ])

      if (matrixResponse.status === 'fulfilled') {
        const matrixData = await matrixResponse.value.json()
        if (matrixData.configs?.length > 0) {
          const customInputs = matrixData.configs[0].inputs?.filter((input: MatrixInput) =>
            input.label && !input.label.match(/^Input \d+$/) && input.isActive
          ) || []
          setInputs(customInputs)
        }
      }

      if (irResponse.status === 'fulfilled') {
        const irData = await irResponse.value.json()
        setIRDevices(irData.devices || [])
      }

      if (direcTVResponse.status === 'fulfilled') {
        const direcTVData = await direcTVResponse.value.json()
        setDirecTVDevices(direcTVData.devices || [])
      }

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

  const handleInputSelection = (inputNumber: number) => {
    setSelectedInput(inputNumber)
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === inputNumber)
    const irDevice = irDevices.find(d => d.matrixInput === inputNumber)  // Fixed: use matrixInput for IR devices

    const activeDevice = direcTVDevice || fireTVDevice || irDevice
    setSelectedDevice(activeDevice || null)

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
    const irDevice = irDevices.find(d => d.matrixInput === inputNumber)  // Fixed: use matrixInput for IR devices

    const isOnline = direcTVDevice?.isOnline || fireTVDevice?.isOnline || irDevice?.isActive

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
        {/* Left Panel - Enhanced Input Selection */}
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
                  const irDevice = irDevices.find(d => d.matrixInput === input.channelNumber)  // Fixed: use matrixInput
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
                            {input.label}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-white/10 text-slate-400 group-hover:text-slate-300'
                            }`}>
                              Ch {input.channelNumber}
                            </span>
                            <span className="text-xs text-slate-400 group-hover:text-slate-300">
                              {direcTVDevice ? 'DirecTV' :
                               fireTVDevice ? 'Fire TV' :
                               irDevice ? 'Cable' :
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
                <div className="text-center py-12">
                  <Radio className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500">No inputs configured</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Remote Control Display */}
        <div className="lg:col-span-2">
          {/* ... rest of the component ... */}
          {selectedDevice ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-2xl">
              {deviceType === 'streaming' && selectedDevice && 'deviceType' in selectedDevice && (
                <div className="space-y-4">
                  <FireTVRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={'ipAddress' in selectedDevice ? (selectedDevice as any).ipAddress : ''}
                    port={'port' in selectedDevice ? (selectedDevice as any).port : 0}
                  />
                  <FireTVStreamingGuide
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={'ipAddress' in selectedDevice ? (selectedDevice as any).ipAddress : ''}
                    port={'port' in selectedDevice ? (selectedDevice as any).port : 0}
                  />
                </div>
              )}
              {deviceType === 'satellite' && selectedDevice && 'receiverType' in selectedDevice && (
                <div className="space-y-4">
                  <DirecTVRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={selectedDevice.ipAddress}
                    port={selectedDevice.port}
                  />
                  {selectedInput && channelPresets.length > 0 && (
                    <ChannelPresetGrid
                      deviceType="directv"
                      onPresetClick={async (preset) => {
                        setLoading(true)
                        setCommandStatus(`Tuning to ${preset.name}...`)
                        // ... tune logic
                      }}
                    />
                  )}
                </div>
              )}
              {deviceType === 'cable' && selectedDevice && 'iTachAddress' in selectedDevice && (
                <div className="space-y-4">
                  <CableBoxRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    iTachAddress={selectedDevice.iTachAddress}
                  />
                  {selectedInput && channelPresets.length > 0 && (
                    <ChannelPresetGrid
                      deviceType="cable"
                      onPresetClick={async (preset) => {
                        setLoading(true)
                        setCommandStatus(`Tuning to ${preset.name}...`)
                        // ... tune logic
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-12 shadow-2xl text-center">
              <Gamepad2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No Device Selected</h3>
              <p className="text-slate-500">Select an input from the list to control its device</p>
            </div>
          )}
        </div>
      </div>

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

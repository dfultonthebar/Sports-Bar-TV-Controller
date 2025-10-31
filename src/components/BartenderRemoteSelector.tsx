'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Cable, Satellite, Smartphone, Tv, CheckCircle, AlertCircle, Gamepad2 } from 'lucide-react'
import CableBoxRemote from './remotes/CableBoxRemote'
import DirecTVRemote from './remotes/DirecTVRemote'
import FireTVRemote from './remotes/FireTVRemote'
import ChannelPresetGrid from './ChannelPresetGrid'
import FireTVStreamingGuide from './FireTVStreamingGuide'

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

interface CableBox {
  id: string
  name: string
  provider: string
  model: string
  isOnline: boolean
  devicePath?: string
  matrixInputId?: string
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
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>([])
  const [loading, setLoading] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string>('')

  useEffect(() => {
    loadAllDevices()
    loadChannelPresets()
    loadCableBoxes()
  }, [])

  const loadAllDevices = async () => {
    try {
      const [matrixResponse, irResponse, direcTVResponse, fireTVResponse] = await Promise.allSettled([
        fetch('/api/matrix/config'),
        fetch('/api/ir-devices'),
        fetch('/api/directv-devices'),
        fetch('/api/firetv-devices')
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

      // Load IR devices
      if (irResponse.status === 'fulfilled') {
        const irData = await irResponse.value.json()
        setIRDevices(irData.devices || [])
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
      console.error('Error loading devices:', error)
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
      console.error('Error loading channel presets:', error)
    }
  }

  const loadCableBoxes = async () => {
    try {
      const response = await fetch('/api/cec/cable-box')
      const data = await response.json()

      if (data.success && data.cableBoxes && data.cableBoxes.length > 0) {
        setCableBoxes(data.cableBoxes)
      }
    } catch (error) {
      console.error('Error loading cable boxes:', error)
    }
  }

  const getCableBoxForInput = (inputChannel: number): CableBox | null => {
    const matchingBox = cableBoxes.find((box) => {
      const input = inputs.find((inp) => inp.channelNumber === inputChannel)
      if (input && box.matrixInputId === input.id) {
        return true
      }
      const inputIndex = inputs.findIndex((inp) => inp.channelNumber === inputChannel)
      const boxNumber = parseInt(box.id.replace('cable-box-', ''), 10)
      return inputIndex + 1 === boxNumber
    })
    return matchingBox || cableBoxes[0] || null
  }

  const sendChannelCommand = async (channelNumber: string) => {
    const digits = channelNumber.split('')

    for (const digit of digits) {
      await sendCommand(digit)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    await new Promise(resolve => setTimeout(resolve, 500))
    await sendCommand('OK')
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
      const response = await fetch('/api/ir-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command: command,
          iTachAddress: selectedDevice.iTachAddress
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
    }
  }

  const handlePresetClick = async (preset: ChannelPreset) => {
    if (!selectedInput) return

    const cableBox = getCableBoxForInput(selectedInput)

    if (deviceType === 'cable' && cableBox && preset.deviceType === 'cable') {
      setLoading(true)
      setCommandStatus(`Tuning to ${preset.name} (${preset.channelNumber}) via CEC...`)

      try {
        const response = await fetch('/api/channel-presets/tune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presetId: preset.id,
            cableBoxId: cableBox.id,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setCommandStatus(`Now watching: ${preset.name}`)
        } else {
          setCommandStatus(`Failed: ${data.error || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Error tuning via CEC:', error)
        setCommandStatus('CEC tuning failed')
      } finally {
        setLoading(false)
        setTimeout(() => setCommandStatus(''), 5000)
      }
      return
    }

    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    setLoading(true)
    setCommandStatus(`Tuning to ${preset.name} (${preset.channelNumber})...`)

    try {
      await sendChannelCommand(preset.channelNumber)
      setCommandStatus(`Now watching: ${preset.name}`)
    } catch (error) {
      setCommandStatus(`Failed to tune: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setTimeout(() => setCommandStatus(''), 5000)
    }
  }

  const handleInputSelection = (inputNumber: number) => {
    setSelectedInput(inputNumber)

    // Find associated device
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === inputNumber)
    const irDevice = irDevices.find(d => d.inputChannel === inputNumber)

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
      case 'cable': return <Cable className="w-4 h-4" />
      case 'satellite': return <Satellite className="w-4 h-4" />
      case 'streaming': return <Smartphone className="w-4 h-4" />
      default: return <Tv className="w-4 h-4" />
    }
  }

  const getDeviceStatusIcon = (inputNumber: number) => {
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === inputNumber)
    const irDevice = irDevices.find(d => d.inputChannel === inputNumber)

    if (direcTVDevice?.isOnline || fireTVDevice?.isOnline || irDevice?.isActive) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }

    return <AlertCircle className="w-4 h-4 text-slate-500" />
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4 pb-20">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center justify-center">
          <Gamepad2 className="w-8 h-8 mr-2" />
          Remote Control
        </h1>
        <p className="text-sm text-slate-400">Select an input to control its device</p>
        {commandStatus && (
          <div className="mt-2 px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm">
            {commandStatus}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
        {/* Left Panel - Input Selection */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-lg p-4 h-fit">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center">
              <Tv className="mr-2 w-5 h-5" />
              Select Input
            </h2>
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              {inputs.length > 0 ? (
                inputs.map((input) => {
                  const direcTVDevice = direcTVDevices.find(d => d.inputChannel === input.channelNumber)
                  const fireTVDevice = fireTVDevices.find(d => d.inputChannel === input.channelNumber)
                  const irDevice = irDevices.find(d => d.inputChannel === input.channelNumber)
                  const hasDevice = direcTVDevice || fireTVDevice || irDevice

                  return (
                    <button
                      key={input.id}
                      onClick={() => handleInputSelection(input.channelNumber)}
                      disabled={!hasDevice}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedInput === input.channelNumber
                          ? 'bg-blue-500 text-white shadow-lg'
                          : hasDevice
                          ? 'bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-white'
                          : 'bg-slate-900 text-gray-600 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {getInputIcon(input.inputType)}
                          {getDeviceStatusIcon(input.channelNumber)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{input.label}</div>
                          <div className="text-xs opacity-80 truncate">
                            Ch {input.channelNumber} • {
                              direcTVDevice ? 'DirecTV' :
                              fireTVDevice ? 'Fire TV' :
                              irDevice ? 'Cable Box' :
                              'No Device'
                            }
                          </div>
                        </div>
                      </div>
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
            {!selectedDevice ? (
              <div className="bg-slate-800 rounded-lg p-8 text-center max-w-md w-full">
                <Gamepad2 className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">No Device Selected</h3>
                <p className="text-slate-400">Select an input from the left panel to show its remote control</p>
              </div>
            ) : deviceType === 'cable' && 'iTachAddress' in selectedDevice ? (
              <>
                <div className="w-full flex justify-center">
                  <CableBoxRemote
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    iTachAddress={selectedDevice.iTachAddress || ''}
                  />
                </div>
                {/* Channel Presets for Cable */}
                <div className="w-full mt-4">
                  <ChannelPresetGrid
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
    </div>
  )
}

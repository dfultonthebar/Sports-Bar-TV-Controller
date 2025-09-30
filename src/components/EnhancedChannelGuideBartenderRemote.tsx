

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useLogging } from '@/hooks/useLogging'
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
  Clock,
  Play,
  Calendar,
  Filter,
  Search,
  Monitor,
  Smartphone,
  Satellite,
  Cable,
  Radio,
  ExternalLink,
  Star
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

interface ChannelInfo {
  id: string
  name: string
  number?: string
  url?: string
  platforms: string[]
  type: 'cable' | 'streaming' | 'ota' | 'satellite'
  cost: 'free' | 'subscription' | 'premium'
  logoUrl?: string
  channelNumber?: string
  appCommand?: string
  packageName?: string
  deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming'
}

interface GameListing {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  startTime: string
  endTime: string
  channel: ChannelInfo
  description?: string
  venue?: string
  status?: string
  isSports: boolean
  isLive?: boolean
}

interface StreamingApp {
  packageName: string
  displayName: string
  category: 'Sports' | 'Entertainment' | 'News' | 'Premium'
  icon?: string
  sportsContent?: boolean
}

interface DeviceGuideData {
  type: 'cable' | 'satellite' | 'streaming'
  channels: ChannelInfo[]
  programs: GameListing[]
  apps?: StreamingApp[]
  lastUpdated: string
}

export default function EnhancedChannelGuideBartenderRemote() {
  const { 
    logUserAction, 
    logError, 
    logButtonClick, 
    logDeviceInteraction,
    startPerformanceTimer, 
    endPerformanceTimer,
  } = useLogging('EnhancedChannelGuide')

  // Device and Input State
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [direcTVDevices, setDirecTVDevices] = useState<DirecTVDevice[]>([])
  const [fireTVDevices, setFireTVDevices] = useState<FireTVDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | DirecTVDevice | FireTVDevice | null>(null)
  
  // Channel Guide State
  const [showChannelGuide, setShowChannelGuide] = useState(false)
  const [guideData, setGuideData] = useState<DeviceGuideData | null>(null)
  const [loadingGuide, setLoadingGuide] = useState(false)
  const [guideError, setGuideError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredPrograms, setFilteredPrograms] = useState<GameListing[]>([])
  
  // UI State
  const [loading, setLoading] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [lastOperationTime, setLastOperationTime] = useState<Date | null>(null)

  useEffect(() => {
    loadAllDeviceConfigurations()
  }, [])

  useEffect(() => {
    if (selectedInput && showChannelGuide) {
      loadChannelGuideForInput()
    }
  }, [selectedInput, showChannelGuide])

  useEffect(() => {
    if (guideData?.programs) {
      filterPrograms()
    }
  }, [searchQuery, guideData])

  const loadAllDeviceConfigurations = async () => {
    try {
      startPerformanceTimer('load_devices')
      
      const [matrixResponse, irResponse, direcTVResponse, fireTVResponse] = await Promise.allSettled([
        fetch('/api/matrix/config'),
        fetch('/api/ir-devices'),
        fetch('/api/directv-devices'),
        fetch('/api/firetv-devices')
      ])

      // Load matrix inputs
      if (matrixResponse.status === 'fulfilled') {
        const matrixData = await matrixResponse.value.json()
        if (matrixData.inputs) {
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

      const loadTime = endPerformanceTimer('load_devices')
      logUserAction('devices_loaded', { loadTime })
    } catch (error) {
      logError(error as Error, 'load_devices')
    }
  }

  const handleInputSelection = async (inputNumber: number) => {
    const oldInput = selectedInput
    setSelectedInput(inputNumber)
    setSelectedDevice(null)
    
    // Find associated device
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    const irDevice = irDevices.find(d => d.inputChannel === inputNumber)
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === inputNumber)
    
    const activeDevice = direcTVDevice || fireTVDevice || irDevice
    setSelectedDevice(activeDevice || null)
    
    const input = inputs.find(i => i.channelNumber === inputNumber)
    const deviceType = direcTVDevice ? 'DirecTV' : fireTVDevice ? 'Fire TV' : irDevice ? 'IR Device' : 'None'
    
    setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`} (${deviceType})`)
    setLastOperationTime(new Date())
    
    logButtonClick('input_select', `Input ${inputNumber}`, {
      from: oldInput,
      to: inputNumber,
      deviceType,
      inputLabel: input?.label
    })

    // If channel guide is open, reload data for new input
    if (showChannelGuide) {
      loadChannelGuideForInput()
    }

    setTimeout(() => setCommandStatus(''), 3000)
  }

  const loadChannelGuideForInput = async () => {
    if (!selectedInput) return

    setLoadingGuide(true)
    setGuideError(null)
    
    try {
      const input = inputs.find(i => i.channelNumber === selectedInput)
      const deviceType = getDeviceTypeForInput(selectedInput)
      
      startPerformanceTimer('load_channel_guide')
      
      let guideData: DeviceGuideData | null = null
      
      switch (deviceType) {
        case 'cable':
          guideData = await loadCableGuideData()
          break
        case 'satellite':
          guideData = await loadDirecTVGuideData()
          break
        case 'streaming':
          guideData = await loadFireTVGuideData()
          break
        default:
          throw new Error('Unsupported device type')
      }
      
      setGuideData(guideData)
      const loadTime = await endPerformanceTimer('load_channel_guide')
      
      logDeviceInteraction('channel_guide', selectedInput.toString(), 'load_guide', true, loadTime, {
        deviceType,
        inputLabel: input?.label,
        programCount: guideData?.programs.length || 0
      })
      
    } catch (error) {
      endPerformanceTimer('load_channel_guide')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setGuideError(`Failed to load channel guide: ${errorMessage}`)
      logError(error as Error, 'load_channel_guide')
    } finally {
      setLoadingGuide(false)
    }
  }

  const getDeviceTypeForInput = (inputNumber: number): 'cable' | 'satellite' | 'streaming' | null => {
    const input = inputs.find(i => i.channelNumber === inputNumber)
    if (!input) return null
    
    // Check for DirecTV device
    if (direcTVDevices.find(d => d.inputChannel === inputNumber)) {
      return 'satellite'
    }
    
    // Check for Fire TV device
    if (fireTVDevices.find(d => d.inputChannel === inputNumber)) {
      return 'streaming'
    }
    
    // Check input type for cable
    if (input.inputType.toLowerCase().includes('cable')) {
      return 'cable'
    }
    
    // Default to cable for IR devices (most likely cable boxes)
    return 'cable'
  }

  const loadCableGuideData = async (): Promise<DeviceGuideData> => {
    const response = await fetch('/api/channel-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputNumber: selectedInput,
        deviceType: 'cable',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    })

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load cable guide data')
    }

    return {
      type: data.type,
      channels: data.channels || [],
      programs: data.programs || [],
      lastUpdated: data.lastUpdated
    }
  }

  const loadDirecTVGuideData = async (): Promise<DeviceGuideData> => {
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === selectedInput)
    
    const response = await fetch('/api/channel-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputNumber: selectedInput!,
        deviceType: 'satellite',
        deviceId: direcTVDevice?.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    })

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load DirecTV guide data')
    }

    return {
      type: data.type,
      channels: data.channels || [],
      programs: data.programs || [],
      lastUpdated: data.lastUpdated
    }
  }

  const loadFireTVGuideData = async (): Promise<DeviceGuideData> => {
    const fireTVDevice = fireTVDevices.find(d => d.inputChannel === selectedInput)
    
    const response = await fetch('/api/channel-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputNumber: selectedInput!,
        deviceType: 'streaming',
        deviceId: fireTVDevice?.id,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    })

    const data = await response.json()
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to load Fire TV guide data')
    }

    return {
      type: data.type,
      channels: data.channels || [],
      programs: data.programs || [],
      apps: data.apps || [],
      lastUpdated: data.lastUpdated
    }
  }

  const filterPrograms = () => {
    if (!guideData?.programs) {
      setFilteredPrograms([])
      return
    }

    let filtered = guideData.programs

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(prog => 
        prog.league.toLowerCase().includes(query) ||
        prog.homeTeam.toLowerCase().includes(query) ||
        prog.awayTeam.toLowerCase().includes(query) ||
        prog.description?.toLowerCase().includes(query) ||
        prog.channel.name.toLowerCase().includes(query)
      )
    }

    // Filter for sports content only
    filtered = filtered.filter(prog => prog.isSports)

    setFilteredPrograms(filtered)
  }

  const handleGameClick = async (game: GameListing) => {
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    setLoading(true)
    setCommandStatus(`Switching to ${game.league}: ${game.awayTeam || 'Game'} ${game.homeTeam ? '@' : ''} ${game.homeTeam || ''}`)

    try {
      // First, switch to the appropriate input (already selected)
      
      // Then handle the specific device type
      const deviceType = getDeviceTypeForInput(selectedInput!)
      
      switch (deviceType) {
        case 'cable':
        case 'satellite':
          // Change channel
          if (game.channel.channelNumber) {
            await sendChannelCommand(game.channel.channelNumber)
          }
          break
          
        case 'streaming':
          // Launch streaming app
          if (game.channel.packageName) {
            await launchStreamingApp(game.channel.packageName, game.channel.name)
          }
          break
      }

      logDeviceInteraction('sports_guide', selectedDevice.id, 'watch_game', true, undefined, {
        game: {
          league: game.league,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          gameTime: game.gameTime
        },
        channel: game.channel,
        deviceType
      })

    } catch (error) {
      logError(error as Error, 'watch_game')
      setCommandStatus(`Failed to launch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setTimeout(() => setCommandStatus(''), 5000)
    }
  }

  const sendChannelCommand = async (channelNumber: string) => {
    const digits = channelNumber.split('')
    
    for (const digit of digits) {
      await sendCommand(digit)
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // Send OK/Enter to confirm
    await new Promise(resolve => setTimeout(resolve, 500))
    await sendCommand('OK')
  }

  const launchStreamingApp = async (packageName: string, appName: string) => {
    const fireTVDevice = selectedDevice as FireTVDevice
    
    const response = await fetch('/api/firetv-devices/send-command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: fireTVDevice.id,
        ipAddress: fireTVDevice.ipAddress,
        port: fireTVDevice.port,
        command: `monkey -p ${packageName} 1`
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to launch ${appName}: ${error.error}`)
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
    } else if ('adbEnabled' in selectedDevice) {
      // Fire TV device
      const response = await fetch('/api/firetv-devices/send-command', {
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
    } else {
      // IR Device
      const response = await fetch('/api/ir-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command: command
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
    }
  }

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return <Cable className="w-4 h-4" />
      case 'satellite': return <Satellite className="w-4 h-4" />
      case 'streaming': return <Smartphone className="w-4 h-4" />
      case 'gaming': return <Monitor className="w-4 h-4" />
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
    
    return <AlertCircle className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          🏈 Bartender Channel Guide
        </h1>
        <div className="flex items-center justify-center space-x-2 text-sm flex-wrap">
          {commandStatus && (
            <div className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
              {commandStatus}
            </div>
          )}
          {lastOperationTime && (
            <div className="px-3 py-1 bg-gray-500/20 text-gray-400 border border-gray-500/30 rounded-full flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{lastOperationTime.toLocaleTimeString()}</span>
            </div>
          )}
          <button
            onClick={() => setShowChannelGuide(!showChannelGuide)}
            className={`px-3 py-1 rounded-full font-medium flex items-center space-x-1 transition-all ${
              showChannelGuide 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Channel Guide</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Left Panel - Input Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-fit">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center">
              <Tv className="mr-2 w-5 h-5" />
              Select Input
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {inputs.map((input) => {
                const deviceType = getDeviceTypeForInput(input.channelNumber)
                
                return (
                  <button
                    key={input.id}
                    onClick={() => handleInputSelection(input.channelNumber)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedInput === input.channelNumber
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
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
                          Ch {input.channelNumber} • {deviceType || input.inputType}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Panel - Channel Guide */}
        <div className="lg:col-span-3">
          {!showChannelGuide ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Channel Guide</h3>
              <p className="text-gray-400 mb-4">Select an input and click "Channel Guide" to see available sports programming</p>
              <Button
                onClick={() => setShowChannelGuide(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Open Channel Guide
              </Button>
            </div>
          ) : !selectedInput ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center">
              <Tv className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Select an Input</h3>
              <p className="text-gray-400">Choose an input from the left panel to load its channel guide</p>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <Calendar className="mr-2 w-5 h-5" />
                    {inputs.find(i => i.channelNumber === selectedInput)?.label} Guide
                  </h2>
                  <p className="text-sm text-gray-300">
                    {getDeviceTypeForInput(selectedInput)?.toUpperCase()} • Sports Programming
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    onClick={() => loadChannelGuideForInput()}
                    disabled={loadingGuide}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loadingGuide ? 'Loading...' : 'Refresh'}
                  </Button>
                  <Button
                    onClick={() => setShowChannelGuide(false)}
                    variant="outline"
                    size="sm"
                  >
                    Close
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search games, teams, leagues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Guide Content */}
              <div className="max-h-96 overflow-y-auto">
                {loadingGuide ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading channel guide...</p>
                  </div>
                ) : guideError ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-400 mb-4">{guideError}</p>
                    <Button
                      onClick={() => loadChannelGuideForInput()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : filteredPrograms.length > 0 ? (
                  <div className="space-y-3">
                    {filteredPrograms.map((game) => (
                      <div
                        key={game.id}
                        className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                        onClick={() => handleGameClick(game)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                {game.league}
                              </Badge>
                              {game.isLive && (
                                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
                                  LIVE
                                </Badge>
                              )}
                            </div>
                            
                            <h4 className="font-medium text-white mb-1">
                              {game.awayTeam && game.homeTeam ? 
                                `${game.awayTeam} @ ${game.homeTeam}` : 
                                game.description
                              }
                            </h4>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-300">
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{game.gameTime}</span>
                              </span>
                              
                              <span className="flex items-center space-x-1">
                                {guideData?.type === 'streaming' ? (
                                  <Smartphone className="w-3 h-3" />
                                ) : guideData?.type === 'satellite' ? (
                                  <Satellite className="w-3 h-3" />
                                ) : (
                                  <Cable className="w-3 h-3" />
                                )}
                                <span>{game.channel.name}</span>
                                {game.channel.number && (
                                  <span className="text-xs">({game.channel.number})</span>
                                )}
                              </span>
                            </div>
                          </div>
                          
                          <div className="ml-4">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Watch
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : guideData ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Sports Programming Found</h3>
                    <p className="text-gray-400">Try adjusting your search or check again later</p>
                  </div>
                ) : null}
              </div>

              {/* Streaming Apps (for Fire TV) */}
              {guideData?.type === 'streaming' && guideData.apps && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <h3 className="text-lg font-medium text-white mb-3">Quick Access Sports Apps</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {guideData.apps.filter(app => app.sportsContent).map((app) => (
                      <button
                        key={app.packageName}
                        onClick={() => launchStreamingApp(app.packageName, app.displayName)}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-center"
                      >
                        <div className="text-xs font-medium text-white">{app.displayName}</div>
                        <div className="text-xs text-gray-400 mt-1">{app.category}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Processing request...</p>
          </div>
        </div>
      )}
    </div>
  )
}

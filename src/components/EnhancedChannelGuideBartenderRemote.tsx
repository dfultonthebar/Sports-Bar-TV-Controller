

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useLogging } from '@/hooks/useLogging'
import ChannelPresetGrid from './ChannelPresetGrid'
import RemoteControlPopup from './remotes/RemoteControlPopup'
import FireTVAppShortcuts from './FireTVAppShortcuts'
import { logger } from '@/lib/logger'
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
  Star,
  Gamepad2,
  Home,
  ArrowLeft
} from 'lucide-react'

interface CableBox {
  id: string
  name: string
  provider: string
  model: string
  isOnline: boolean
  devicePath?: string
}

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

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: 'cable' | 'directv'
  order: number
  usageCount: number
  lastUsed: Date | null
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
  
  // Channel Presets State
  const [channelPresets, setChannelPresets] = useState<ChannelPreset[]>([])

  // Cable Box State (for CEC control)
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>([])
  const [selectedCableBox, setSelectedCableBox] = useState<string | null>(null)

  // UI State
  const [loading, setLoading] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [lastOperationTime, setLastOperationTime] = useState<Date | null>(null)
  const [showRemotePopup, setShowRemotePopup] = useState(false)

  useEffect(() => {
    loadAllDeviceConfigurations()
    loadChannelPresets()
    loadCableBoxes()
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
  }, [searchQuery, guideData, channelPresets])

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

  const loadCableBoxes = async () => {
    try {
      const response = await fetch('/api/cec/cable-box')
      const data = await response.json()

      if (data.success && data.cableBoxes && data.cableBoxes.length > 0) {
        setCableBoxes(data.cableBoxes)
      }
    } catch (error) {
      logger.error('Error loading cable boxes:', error)
    }
  }

  // Auto-select cable box based on selected input
  const getCableBoxForInput = (inputChannel: number): CableBox | null => {
    // Find a cable box that matches this input's matrix channel
    const matchingBox = cableBoxes.find((box: any) => {
      // Try to match by matrix input ID if available
      const input = inputs.find((inp) => inp.channelNumber === inputChannel)
      if (input && box.matrixInputId === input.id) {
        return true
      }
      // Otherwise, use a simple mapping: Input 1 -> Cable Box 1, etc.
      const inputIndex = inputs.findIndex((inp) => inp.channelNumber === inputChannel)
      const boxNumber = parseInt(box.id.replace('cable-box-', ''), 10)
      return inputIndex + 1 === boxNumber
    })
    return matchingBox || cableBoxes[0] || null
  }

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

    // Filter out events past midnight of their scheduled day
    const now = new Date()
    filtered = filtered.filter(prog => {
      try {
        const startTime = new Date(prog.startTime)
        // Get midnight of the event's day (next day at 00:00)
        const eventDay = new Date(startTime)
        eventDay.setHours(0, 0, 0, 0)
        const nextDayMidnight = new Date(eventDay.getTime() + 24 * 60 * 60 * 1000)
        
        // Keep event if we haven't passed midnight of its scheduled day
        return now < nextDayMidnight
      } catch (error) {
        logger.error('Error parsing event date:', error)
        return true // Keep event if we can't parse the date
      }
    })

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

    // Map channel numbers from presets if available
    const deviceType = getDeviceTypeForInput(selectedInput!)
    const presetDeviceType = deviceType === 'satellite' ? 'directv' : deviceType === 'cable' ? 'cable' : null
    
    if (presetDeviceType) {
      filtered = filtered.map(prog => {
        // Find matching preset by channel name or number
        const matchingPreset = channelPresets.find(preset => 
          preset.deviceType === presetDeviceType && 
          (preset.name.toLowerCase() === prog.channel.name.toLowerCase() ||
           preset.channelNumber === prog.channel.number)
        )
        
        if (matchingPreset) {
          // Use preset's channel number instead of guide's channel number
          return {
            ...prog,
            channel: {
              ...prog.channel,
              number: matchingPreset.channelNumber,
              channelNumber: matchingPreset.channelNumber,
              _presetMapped: true  // Flag to indicate this was mapped from a preset
            }
          }
        }
        
        return prog
      })
    }

    setFilteredPrograms(filtered)
  }

  const handleGameClick = async (game: GameListing) => {
    const deviceType = getDeviceTypeForInput(selectedInput!)
    const cableBox = selectedInput ? getCableBoxForInput(selectedInput) : null

    // Use CEC control automatically for cable inputs
    if (deviceType === 'cable' && cableBox && game.channel.channelNumber) {
      setLoading(true)
      setCommandStatus(
        `Switching to ${game.league}: ${game.awayTeam || 'Game'} ${game.homeTeam ? '@' : ''} ${
          game.homeTeam || ''
        } via CEC...`
      )

      try {
        const response = await fetch('/api/cec/cable-box/tune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cableBoxId: cableBox.id,
            channel: game.channel.channelNumber,
          }),
        })

        const data = await response.json()

        if (data.success) {
          setCommandStatus(`Now watching: ${game.league}`)
          setLastOperationTime(new Date())
          logButtonClick('game_watch_cec', `${game.league}`, { game: game.league, cableBoxId: cableBox.id })
        } else {
          setCommandStatus(`Failed: ${data.error || 'Unknown error'}`)
          logError(new Error(data.error || 'Tune failed'), 'game_watch_cec')
        }
      } catch (error) {
        logger.error('Error tuning via CEC:', error)
        setCommandStatus('CEC tuning failed')
        logError(error as Error, 'game_watch_cec')
      } finally {
        setLoading(false)
        setTimeout(() => setCommandStatus(''), 5000)
      }
      return
    }

    // Fall back to IR/IP control for other inputs
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    setLoading(true)
    setCommandStatus(
      `Switching to ${game.league}: ${game.awayTeam || 'Game'} ${game.homeTeam ? '@' : ''} ${game.homeTeam || ''}`
    )

    try {
      // First, switch to the appropriate input (already selected)

      // Then handle the specific device type

      switch (deviceType) {
        case 'cable':
        case 'satellite':
          // Change channel via IR
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

  const handlePresetClick = async (preset: ChannelPreset) => {
    // Determine if this is a cable input and use CEC automatically
    const deviceType = getDeviceTypeForInput(selectedInput!)
    const cableBox = selectedInput ? getCableBoxForInput(selectedInput) : null

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
          setLastOperationTime(new Date())
          logButtonClick('preset_tune_cec', preset.name, { preset: preset.name, cableBoxId: cableBox.id })
        } else {
          setCommandStatus(`Failed: ${data.error || 'Unknown error'}`)
          logError(new Error(data.error || 'Tune failed'), 'preset_tune_cec')
        }
      } catch (error) {
        logger.error('Error tuning via CEC:', error)
        setCommandStatus('CEC tuning failed')
        logError(error as Error, 'preset_tune_cec')
      } finally {
        setLoading(false)
        setTimeout(() => setCommandStatus(''), 5000)
      }
      return
    }

    // Fall back to IR control for non-cable inputs
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    setLoading(true)
    setCommandStatus(`Tuning to ${preset.name} (${preset.channelNumber})...`)

    try {
      // Send channel command via IR
      await sendChannelCommand(preset.channelNumber)

      setCommandStatus(`Now watching: ${preset.name}`)
      setLastOperationTime(new Date())

      logDeviceInteraction('channel_preset', selectedDevice.id, 'tune_channel', true, undefined, {
        presetId: preset.id,
        presetName: preset.name,
        channelNumber: preset.channelNumber,
        deviceType: preset.deviceType
      })

    } catch (error) {
      logError(error as Error, 'preset_tune')
      setCommandStatus(`Failed to tune: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      setTimeout(() => setCommandStatus(''), 5000)
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
    
    return <AlertCircle className="w-4 h-4 text-slate-500" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950 relative overflow-hidden p-4 pb-20">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Navigation Help Banner */}
      <div className="relative z-10 mb-4 backdrop-blur-xl bg-blue-500/10 border border-blue-400/30 rounded-2xl shadow-2xl p-3 text-center">
        <p className="text-sm text-blue-300 flex items-center justify-center space-x-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Use the bottom navigation tabs to switch between Video, Audio, Music, Guide, and Power controls</span>
        </p>
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Bartender Channel Guide
        </h1>
        <div className="flex items-center justify-center space-x-2 text-sm flex-wrap">
          {commandStatus && (
            <div className="px-3 py-1 backdrop-blur-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded-full animate-pulse">
              {commandStatus}
            </div>
          )}
          {lastOperationTime && (
            <div className="px-3 py-1 backdrop-blur-xl bg-white/5 text-slate-400 border border-white/10 rounded-full flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{lastOperationTime.toLocaleTimeString()}</span>
            </div>
          )}
          <button
            onClick={() => setShowChannelGuide(!showChannelGuide)}
            className={`group relative px-3 py-1 backdrop-blur-xl rounded-full font-medium flex items-center space-x-1 transition-all duration-300 ${
              showChannelGuide
                ? 'bg-gradient-to-br from-orange-500/20 to-pink-500/20 text-orange-400 border border-orange-400/30 scale-105'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:scale-105'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Channel Guide</span>
          </button>
          {selectedDevice && (
            <button
              onClick={() => setShowRemotePopup(true)}
              className="group relative px-3 py-1 backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full font-medium flex items-center space-x-1 transition-all duration-300 border border-blue-400/30 hover:border-blue-400/50 hover:scale-105 shadow-xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
              <div className="relative z-10 flex items-center space-x-1 text-blue-400">
                <Gamepad2 className="w-3 h-3" />
                <span>Remote Control</span>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Left Panel - Input Selection */}
        <div className="lg:col-span-1">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-4 h-fit">
            <h2 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3 flex items-center">
              <Tv className="mr-2 w-5 h-5 text-blue-400" />
              Select Input
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {inputs.map((input) => {
                const deviceType = getDeviceTypeForInput(input.channelNumber)

                return (
                  <button
                    key={input.id}
                    onClick={() => handleInputSelection(input.channelNumber)}
                    className={`group relative w-full p-3 rounded-xl text-left transition-all duration-300 ${
                      selectedInput === input.channelNumber
                        ? 'backdrop-blur-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-blue-400/50 shadow-2xl scale-105'
                        : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {getInputIcon(input.inputType)}
                        {getDeviceStatusIcon(input.channelNumber)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium truncate ${selectedInput === input.channelNumber ? 'text-white' : 'text-gray-300'}`}>{input.label}</div>
                        <div className={`text-xs truncate ${selectedInput === input.channelNumber ? 'text-blue-200' : 'text-slate-400'}`}>
                          Ch {input.channelNumber} • {deviceType || input.inputType}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Channel Presets - Show when input with cable/DirecTV device is selected */}
          {selectedInput && selectedDevice && (
            <>
              {(getDeviceTypeForInput(selectedInput) === 'cable' ||
                getDeviceTypeForInput(selectedInput) === 'satellite') && (
                <ChannelPresetGrid
                  deviceType={getDeviceTypeForInput(selectedInput) === 'satellite' ? 'directv' : 'cable'}
                  onPresetClick={handlePresetClick}
                  maxVisible={6}
                />
              )}

              {/* Fire TV App Shortcuts - Show when Fire TV device is selected */}
              {getDeviceTypeForInput(selectedInput) === 'streaming' && 'ipAddress' in selectedDevice && (
                <div className="mt-4">
                  <FireTVAppShortcuts
                    deviceId={selectedDevice.id}
                    deviceName={selectedDevice.name}
                    ipAddress={selectedDevice.ipAddress}
                    port={selectedDevice.port}
                    onAppLaunch={(appId, appName) => {
                      setCommandStatus(`✅ Launching ${appName}...`)
                      setTimeout(() => setCommandStatus(''), 3000)
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Main Panel - Channel Guide */}
        <div className="lg:col-span-3">
          {!showChannelGuide ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <Calendar className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">Channel Guide</h3>
              <p className="text-slate-400 mb-4">Select an input and click "Channel Guide" to see available sports programming</p>
              <Button
                onClick={() => setShowChannelGuide(true)}
                className="group relative backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl border-2 border-blue-400/30 hover:border-blue-400/50 hover:scale-105 transition-all duration-300 shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="relative z-10 text-blue-400 font-medium">Open Channel Guide</div>
              </Button>
            </div>
          ) : !selectedInput ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <Tv className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">Select an Input</h3>
              <p className="text-slate-400">Choose an input from the left panel to load its channel guide</p>
            </div>
          ) : (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center">
                    <Calendar className="mr-2 w-5 h-5 text-blue-400" />
                    {inputs.find(i => i.channelNumber === selectedInput)?.label} Guide
                  </h2>
                  <p className="text-sm text-slate-400">
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
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search games, teams, leagues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:border-blue-400/50 focus:bg-white/10 focus:outline-none transition-all duration-300"
                  />
                </div>
              </div>

              {/* Guide Content */}
              <div className="max-h-96 overflow-y-auto">
                {loadingGuide ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading channel guide...</p>
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
                        className="group relative backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-400/20 rounded-xl p-4 hover:border-purple-400/40 hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl"
                        onClick={() => handleGameClick(game)}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge variant="outline" className="backdrop-blur-xl bg-blue-500/20 text-blue-400 border-blue-400/30">
                                {game.league}
                              </Badge>
                              {game.isLive && (
                                <Badge variant="outline" className="backdrop-blur-xl bg-red-500/20 text-red-400 border-red-400/30 animate-pulse">
                                  LIVE
                                </Badge>
                              )}
                            </div>
                            
                            <h4 className="font-medium text-white mb-1 group-hover:text-purple-200 transition-colors duration-300">
                              {game.awayTeam && game.homeTeam ?
                                `${game.awayTeam} @ ${game.homeTeam}` :
                                game.description
                              }
                            </h4>

                            <div className="flex items-center space-x-4 text-sm text-slate-400 flex-wrap">
                              {/* Date Display */}
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(game.startTime).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: new Date(game.startTime).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                })}</span>
                              </span>
                              
                              {/* Time Display */}
                              <span className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>{game.gameTime}</span>
                              </span>
                              
                              {/* Channel Display with Preset Mapping Indicator */}
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
                                  <span className="text-xs">
                                    ({game.channel.number})
                                    {(game.channel as any)._presetMapped && (
                                      <Star className="w-2 h-2 inline ml-0.5 text-yellow-400" />
                                    )}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>


                          <div className="ml-4">
                            <button className="group/btn relative backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border-2 border-green-400/30 hover:border-green-400/50 hover:scale-110 transition-all duration-300 shadow-xl px-3 py-2">
                              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                              <div className="relative z-10 flex items-center space-x-1 text-green-300 font-medium text-sm">
                                <Play className="w-3 h-3" />
                                <span>Watch</span>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : guideData ? (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Sports Programming Found</h3>
                    <p className="text-slate-500">Try adjusting your search or check again later</p>
                  </div>
                ) : null}
              </div>

              {/* Streaming Apps (for Fire TV) */}
              {guideData?.type === 'streaming' && guideData.apps && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <h3 className="text-lg font-medium bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-3">Quick Access Sports Apps</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {guideData.apps.filter(app => app.sportsContent).map((app) => (
                      <button
                        key={app.packageName}
                        onClick={() => launchStreamingApp(app.packageName, app.displayName)}
                        className="group relative p-2 backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/20 hover:border-green-400/40 rounded-xl transition-all duration-300 text-center hover:scale-105 shadow-xl"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                        <div className="relative z-10">
                          <div className="text-xs font-medium text-white">{app.displayName}</div>
                          <div className="text-xs text-green-400 mt-1">{app.category}</div>
                        </div>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 p-6 rounded-2xl shadow-2xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-sm text-slate-300">Processing request...</p>
          </div>
        </div>
      )}

      {/* Remote Control Popup */}
      {showRemotePopup && selectedDevice && selectedInput && (
        <RemoteControlPopup
          device={selectedDevice}
          deviceType={getDeviceTypeForInput(selectedInput)!}
          onClose={() => setShowRemotePopup(false)}
        />
      )}
    </div>
  )
}

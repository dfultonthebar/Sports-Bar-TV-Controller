

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { useLogging } from '@/hooks/useLogging'
import ChannelPresetGrid from './ChannelPresetGrid'
import RemoteControlPopup from './remotes/RemoteControlPopup'
import FireTVAppShortcuts from './FireTVAppShortcuts'
import AIGamePlanModal from './AIGamePlanModal'
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

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
  isSchedulingEnabled: boolean
}

interface IRDevice {
  id: string
  name: string
  brand: string
  deviceType: string
  matrixInput: number  // Fixed: was inputChannel, now matches database schema
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
  // Live game data
  homeScore?: number | null
  awayScore?: number | null
  timeRemaining?: string | null
  quarter?: string | null
  isAutoScheduled?: boolean
  allocatedInput?: string | null
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
  const [showAIGamePlan, setShowAIGamePlan] = useState(false)
  const [loadingGuide, setLoadingGuide] = useState(false)
  const [guideError, setGuideError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredPrograms, setFilteredPrograms] = useState<GameListing[]>([])
  
  // Channel Presets State
  const [channelPresets, setChannelPresets] = useState<ChannelPreset[]>([])

  // Live Game Status State
  const [liveGameData, setLiveGameData] = useState<Map<string, any>>(new Map())

  // UI State
  const [loading, setLoading] = useState(false)
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [lastOperationTime, setLastOperationTime] = useState<Date | null>(null)
  const [showRemotePopup, setShowRemotePopup] = useState(false)

  // Current Channel Tracking State
  const [currentChannels, setCurrentChannels] = useState<Record<number, {
    channelNumber: string
    channelName: string | null
    deviceType: string
    inputLabel: string
  }>>({})

  useEffect(() => {
    loadAllDeviceConfigurations()
    loadChannelPresets()
    loadCurrentChannels()
    loadLiveGameData()

    // Auto-refresh channel data and live game data every 30 seconds
    const interval = setInterval(() => {
      loadCurrentChannels()
      loadLiveGameData()
    }, 30000)

    // Check for midnight crossing every minute to refresh guide
    let lastDate = new Date().getDate()
    const midnightCheck = setInterval(() => {
      const currentDate = new Date().getDate()
      if (currentDate !== lastDate) {
        logger.info('[BARTENDER] Day changed - refreshing sports guide')
        lastDate = currentDate

        // Refresh guide data if currently showing
        if (selectedInput && showChannelGuide) {
          loadChannelGuideForInput()
        }
      }
    }, 60000) // Check every minute

    return () => {
      clearInterval(interval)
      clearInterval(midnightCheck)
    }
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
  }, [searchQuery, guideData, channelPresets, liveGameData])

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

  const loadLiveGameData = async () => {
    try {
      const response = await fetch('/api/scheduling/live-status')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.games) {
          // Create a map of ESPN game IDs to live game data
          const gameMap = new Map()
          data.games.forEach((game: any) => {
            // Key by both ESPN game ID and team names for matching
            gameMap.set(game.espnGameId, game)
            gameMap.set(`${game.awayTeam}-${game.homeTeam}`, game)
          })
          setLiveGameData(gameMap)
          logger.debug('[LIVE-GAME-DATA] Loaded live data for', data.games.length, 'games')
        }
      }
    } catch (error) {
      logger.error('Error loading live game data:', error)
    }
  }

  // Get input label with current channel info
  const getInputLabelWithChannel = (input: MatrixInput): string => {
    const channelInfo = currentChannels[input.channelNumber]
    if (!channelInfo) return input.label

    if (channelInfo.channelName) {
      return `${input.label} - ${channelInfo.channelName}`
    } else {
      return `${input.label} - Ch ${channelInfo.channelNumber}`
    }
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
    const irDevice = irDevices.find(d => d.matrixInput === inputNumber)  // Fixed: use matrixInput for IR devices
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
    const input = inputs.find(i => i.channelNumber === inputNumber) as any
    if (!input) return null

    // Check for DirecTV device
    if (direcTVDevices.find(d => d.inputChannel === inputNumber)) {
      return 'satellite'
    }

    // Check for Fire TV device - also check matrix input deviceType as fallback
    if (fireTVDevices.find(d => d.inputChannel === inputNumber) ||
        input.deviceType?.toLowerCase().includes('fire')) {
      return 'streaming'
    }

    // Check input type for cable
    if (input.inputType.toLowerCase().includes('cable')) {
      return 'cable'
    }

    // Check matrix input deviceType for satellite
    if (input.deviceType?.toLowerCase().includes('directv') ||
        input.deviceType?.toLowerCase().includes('satellite')) {
      return 'satellite'
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
    // For Fire TV devices, fetch Big Ten games from the dedicated API
    const response = await fetch('/api/sports/big-ten')
    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to load Fire TV streaming guide')
    }

    // Transform Big Ten games to our program format
    const programs: GameListing[] = (data.games || []).map((game: any) => ({
      id: game.id,
      league: `Big Ten ${game.sport}`,
      homeTeam: game.teams.home.name,
      awayTeam: game.teams.away.name,
      gameTime: game.startTime,
      startTime: game.date,
      endTime: new Date(new Date(game.date).getTime() + 3 * 60 * 60 * 1000).toISOString(),
      channel: {
        id: `streaming-${game.broadcast.network}`,
        name: game.broadcast.network,
        type: 'streaming' as const,
        cost: 'subscription' as const,
        platforms: ['Fire TV'],
        packageName: 'com.btn2go', // Big Ten Plus app
        deviceType: 'streaming' as const
      },
      description: `${game.teams.away.name} vs ${game.teams.home.name}`,
      venue: game.venue || '',
      status: game.status,
      isSports: true,
      isLive: game.isLive,
      homeScore: game.isLive ? parseInt(game.teams.home.score) || null : null,
      awayScore: game.isLive ? parseInt(game.teams.away.score) || null : null
    }))

    // Define streaming apps available on Fire TV
    const streamingApps: StreamingApp[] = [
      { packageName: 'com.btn2go', displayName: 'Big Ten+', category: 'Sports', sportsContent: true },
      { packageName: 'com.espn.gtv', displayName: 'ESPN', category: 'Sports', sportsContent: true },
      { packageName: 'com.peacocktv.peacockandroid', displayName: 'Peacock', category: 'Sports', sportsContent: true },
      { packageName: 'com.amazon.avod', displayName: 'Prime Video', category: 'Entertainment', sportsContent: true },
      { packageName: 'com.google.android.youtube.tv', displayName: 'YouTube TV', category: 'Sports', sportsContent: true },
      { packageName: 'com.fox.now', displayName: 'Fox Sports', category: 'Sports', sportsContent: true }
    ]

    return {
      type: 'streaming',
      channels: [],
      programs,
      apps: streamingApps,
      lastUpdated: data.timestamp || new Date().toISOString()
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

    // Map channel numbers from presets if available and filter out channels without presets
    // Only apply preset filtering for cable/satellite - streaming uses app-based content
    const deviceType = getDeviceTypeForInput(selectedInput!)
    const presetDeviceType = deviceType === 'satellite' ? 'directv' : deviceType === 'cable' ? 'cable' : null

    // Skip preset filtering for streaming devices - they show Big Ten games directly
    if (presetDeviceType && deviceType !== 'streaming') {
      // Filter and map - only show channels that have a preset configured
      filtered = filtered
        .map(prog => {
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

          return null  // Mark for filtering
        })
        .filter((prog): prog is GameListing => prog !== null)  // Remove channels without presets
    }

    // Merge live game data with filtered programs
    filtered = filtered.map(prog => {
      // Try to find live data by team names
      const liveData = liveGameData.get(`${prog.awayTeam}-${prog.homeTeam}`)

      if (liveData) {
        return {
          ...prog,
          homeScore: liveData.homeScore,
          awayScore: liveData.awayScore,
          timeRemaining: liveData.timeRemaining,
          quarter: liveData.quarter,
          isLive: liveData.isLive,
          isAutoScheduled: liveData.isAutoScheduled,
          allocatedInput: liveData.inputLabel,
          status: liveData.status
        }
      }

      return prog
    })

    // Sort: Today's events first, then future events
    // Get today's date boundaries
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)

    filtered.sort((a, b) => {
      const aStart = new Date(a.startTime)
      const bStart = new Date(b.startTime)

      const aIsToday = aStart >= todayStart && aStart < todayEnd
      const bIsToday = bStart >= todayStart && bStart < todayEnd

      // Both today: sort by start time (earliest first)
      if (aIsToday && bIsToday) {
        return aStart.getTime() - bStart.getTime()
      }

      // One is today, one is future: today comes first
      if (aIsToday) return -1
      if (bIsToday) return 1

      // Both future: sort by start time (earliest first)
      return aStart.getTime() - bStart.getTime()
    })

    setFilteredPrograms(filtered)
  }

  const handleGameClick = async (game: GameListing) => {
    const deviceType = getDeviceTypeForInput(selectedInput!)

    // Use IR control for cable inputs (all cable boxes now use IR control)
    if (deviceType === 'cable' && game.channel.channelNumber) {
      setLoading(true)
      setCommandStatus(
        `Switching to ${game.league}: ${game.awayTeam || 'Game'} ${game.homeTeam ? '@' : ''} ${
          game.homeTeam || ''
        }...`
      )

      try {
        // Find the cable box device for the selected input
        const cableBoxDevice = irDevices.find(d => d.matrixInput === selectedInput && d.deviceType === 'Cable Box')

        if (!cableBoxDevice) {
          setCommandStatus('No cable box configured for this input')
          logError(new Error('No cable box found for input'), 'game_watch_ir')
          setLoading(false)
          setTimeout(() => setCommandStatus(''), 5000)
          return
        }

        const response = await fetch('/api/channel-presets/tune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelNumber: game.channel.channelNumber,
            deviceType: 'cable',
            presetId: 'manual',
            cableBoxId: cableBoxDevice.id  // Fixed: always pass cable box ID
          }),
        })

        const data = await response.json()

        if (data.success) {
          setCommandStatus(`Now watching: ${game.league}`)
          setLastOperationTime(new Date())
          logButtonClick('game_watch_ir', `${game.league}`, { game: game.league, channel: game.channel.channelNumber, cableBoxId: cableBoxDevice.id })

          // Refresh current channel data to update input selector
          await loadCurrentChannels()
        } else {
          setCommandStatus(`Failed: ${data.error || 'Unknown error'}`)
          logError(new Error(data.error || 'Tune failed'), 'game_watch_ir')
        }
      } catch (error) {
        logger.error('Error tuning cable box:', error)
        setCommandStatus('Channel tuning failed')
        logError(error as Error, 'game_watch_ir')
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

      // Refresh current channel data to update input selector
      // Note: This fallback path doesn't update the database, but refresh anyway for consistency
      await loadCurrentChannels()

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
      await new Promise(resolve => setTimeout(resolve, 50)) // Reduced from 200ms
    }

    // Only send ENTER for cable boxes (IR devices)
    // DirecTV changes channels automatically after entering digits
    const deviceType = getDeviceTypeForInput(selectedInput!)
    if (deviceType === 'cable') {
      await new Promise(resolve => setTimeout(resolve, 100)) // Reduced from 500ms
      await sendCommand('OK')
    } else if (deviceType === 'satellite') {
      // DirecTV doesn't need ENTER - just wait for channel to change
      await new Promise(resolve => setTimeout(resolve, 300)) // Reduced from 1000ms
    }
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
    // Determine if this is a cable input and use IR control
    const deviceType = getDeviceTypeForInput(selectedInput!)

    if (deviceType === 'cable' && preset.deviceType === 'cable') {
      setLoading(true)
      setCommandStatus(`Tuning to ${preset.name} (${preset.channelNumber}) via IR...`)

      try {
        // Find the cable box device for the selected input
        const cableBoxDevice = irDevices.find(d => d.matrixInput === selectedInput && d.deviceType === 'Cable Box')

        if (!cableBoxDevice) {
          setCommandStatus('No cable box configured for this input')
          logError(new Error('No cable box found for input'), 'preset_tune_ir')
          setLoading(false)
          setTimeout(() => setCommandStatus(''), 5000)
          return
        }

        const response = await fetch('/api/channel-presets/tune', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            presetId: preset.id,
            cableBoxId: cableBoxDevice.id  // Fixed: always pass cable box ID
          }),
        })

        const data = await response.json()

        if (data.success) {
          setCommandStatus(`Now watching: ${preset.name}`)
          setLastOperationTime(new Date())
          logButtonClick('preset_tune_ir', preset.name, { preset: preset.name, cableBoxId: cableBoxDevice.id })

          // Refresh current channel data to update input selector
          await loadCurrentChannels()
        } else {
          setCommandStatus(`Failed: ${data.error || 'Unknown error'}`)
          logError(new Error(data.error || 'Tune failed'), 'preset_tune_ir')
        }
      } catch (error) {
        logger.error('Error tuning via IR:', error)
        setCommandStatus('IR tuning failed')
        logError(error as Error, 'preset_tune_ir')
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

      // Refresh current channel data to update input selector
      // Note: This fallback path doesn't update the database, but refresh anyway for consistency
      await loadCurrentChannels()

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
    const irDevice = irDevices.find(d => d.matrixInput === inputNumber)  // Fixed: use matrixInput for IR devices
    
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

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
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
                  <div key={input.id} className="relative">
                    <button
                      onClick={() => handleInputSelection(input.channelNumber)}
                      className={`group relative w-full p-3 rounded-xl text-left transition-all duration-300 ${
                        selectedInput === input.channelNumber
                          ? 'backdrop-blur-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/30 border-2 border-blue-400/50 shadow-2xl scale-105'
                          : 'backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:scale-105 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {getInputIcon(input.inputType)}
                            {getDeviceStatusIcon(input.channelNumber)}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className={`font-medium ${selectedInput === input.channelNumber ? 'text-white' : 'text-gray-300'}`}>{getInputLabelWithChannel(input)}</div>
                            <div className={`text-xs ${selectedInput === input.channelNumber ? 'text-blue-200' : 'text-slate-400'}`}>
                              Ch {input.channelNumber} • {deviceType || input.inputType}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
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
        <div className="lg:col-span-2">
          {!showChannelGuide ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <Calendar className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-medium bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">Channel Guide</h3>
              <p className="text-slate-400 mb-4">Select an input and click "Channel Guide" to see available sports programming</p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() => setShowChannelGuide(true)}
                  className="group relative backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl border-2 border-blue-400/30 hover:border-blue-400/50 hover:scale-105 transition-all duration-300 shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <div className="relative z-10 text-blue-400 font-medium">Open Channel Guide</div>
                </Button>
                <Button
                  onClick={() => setShowAIGamePlan(true)}
                  className="group relative backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl border-2 border-purple-400/30 hover:border-purple-400/50 hover:scale-105 transition-all duration-300 shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                  <div className="relative z-10 text-purple-400 font-medium flex items-center">
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    AI Game Plan
                  </div>
                </Button>
              </div>
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
                            
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-white group-hover:text-purple-200 transition-colors duration-300 flex-1">
                                {game.awayTeam && game.homeTeam ?
                                  `${game.awayTeam} @ ${game.homeTeam}` :
                                  game.description
                                }
                              </h4>
                              {/* Live Scores */}
                              {game.isLive && game.homeScore !== null && game.awayScore !== null && (
                                <div className="flex items-center space-x-2 text-sm font-bold">
                                  <span className={game.awayScore > game.homeScore ? "text-green-400" : "text-white"}>
                                    {game.awayScore}
                                  </span>
                                  <span className="text-slate-500">-</span>
                                  <span className={game.homeScore > game.awayScore ? "text-green-400" : "text-white"}>
                                    {game.homeScore}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-4 text-sm text-slate-400 flex-wrap">
                              {/* Auto-Schedule Indicator */}
                              {game.isAutoScheduled && (
                                <span className="flex items-center space-x-1 text-xs backdrop-blur-xl bg-green-500/20 text-green-400 border border-green-400/30 rounded-full px-2 py-0.5">
                                  <Star className="w-3 h-3" />
                                  <span>Auto-Scheduled{game.allocatedInput ? ` → ${game.allocatedInput}` : ''}</span>
                                </span>
                              )}

                              {/* Time Remaining (for live games) */}
                              {game.isLive && game.timeRemaining && (
                                <span className="flex items-center space-x-1 text-xs backdrop-blur-xl bg-red-500/20 text-red-400 border border-red-400/30 rounded-full px-2 py-0.5 animate-pulse">
                                  <Clock className="w-3 h-3" />
                                  <span>{game.timeRemaining}{game.quarter ? ` ${game.quarter}` : ''}</span>
                                </span>
                              )}

                              {/* Date Display */}
                              {!game.isLive && (
                                <span className="flex items-center space-x-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>{new Date(game.startTime).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: new Date(game.startTime).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                  })}</span>
                                </span>
                              )}

                              {/* Time Display */}
                              {!game.isLive && (
                                <span className="flex items-center space-x-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{game.gameTime}</span>
                                </span>
                              )}
                              
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

      {/* AI Game Plan Modal */}
      <AIGamePlanModal
        isOpen={showAIGamePlan}
        onClose={() => setShowAIGamePlan(false)}
      />
    </div>
  )
}

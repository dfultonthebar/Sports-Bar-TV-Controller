
'use client'

import { useState, useEffect } from 'react'
import { 
  Tv, 
  Radio, 
  Power, 
  VolumeX,
  Volume2,
  ChevronUp, 
  ChevronDown,
  RotateCcw,
  Settings,
  Wifi,
  WifiOff,
  Speaker,
  Play,
  Pause,
  Calendar,
  Clock,
  Star,
  ExternalLink,
  Filter,
  Search,
  Smartphone,
  Monitor
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
  // For IP control
  deviceIpAddress?: string
  ipControlPort?: number
  // For Global Cache control
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
  inputChannel?: number  // Associated matrix input channel
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
}

interface AudioProcessor {
  id: string
  name: string
  model: string
  ipAddress: string
  port: number
  zones: number
  status: 'online' | 'offline' | 'error'
}

interface AudioZone {
  id: string
  processorId: string
  zoneNumber: number
  name: string
  description?: string
  currentSource?: string
  volume: number
  muted: boolean
  enabled: boolean
}

interface AudioInput {
  id: string
  name: string
  isActive: boolean
}

interface RemoteCommand {
  display: string
  command: string
  icon?: any
  color?: string
}

interface League {
  id: string
  name: string
  description: string
  category: 'professional' | 'college' | 'international'
  season: string
  logo?: string
}

interface ChannelInfo {
  id: string
  name: string
  url?: string
  platforms: string[]
  type: 'cable' | 'streaming' | 'ota'
  cost: 'free' | 'subscription' | 'premium'
  logoUrl?: string
  channelNumber?: string
  appCommand?: string
  deviceType?: 'cable' | 'satellite' | 'streaming' | 'gaming'
}

interface GameListing {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  channel: ChannelInfo
  description?: string
}

const CHANNEL_COMMANDS: RemoteCommand[] = [
  { display: '1', command: '1' },
  { display: '2', command: '2' },
  { display: '3', command: '3' },
  { display: '4', command: '4' },
  { display: '5', command: '5' },
  { display: '6', command: '6' },
  { display: '7', command: '7' },
  { display: '8', command: '8' },
  { display: '9', command: '9' },
  { display: '0', command: '0' },
  { display: 'CH+', command: 'CH_UP', icon: ChevronUp },
  { display: 'CH-', command: 'CH_DOWN', icon: ChevronDown },
]

const CONTROL_COMMANDS: RemoteCommand[] = [
  { display: 'Power', command: 'POWER', icon: Power, color: 'bg-red-500' },
  { display: 'Vol+', command: 'VOL_UP', icon: Volume2, color: 'bg-blue-500' },
  { display: 'Vol-', command: 'VOL_DOWN', icon: VolumeX, color: 'bg-blue-500' },
  { display: 'Mute', command: 'MUTE', icon: VolumeX, color: 'bg-orange-500' },
]

export default function BartenderRemoteControl() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [direcTVDevices, setDirecTVDevices] = useState<DirecTVDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [selectedDirecTVDevice, setSelectedDirecTVDevice] = useState<DirecTVDevice | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [commandStatus, setCommandStatus] = useState<string>('')
  
  // Audio-related state
  const [audioProcessors, setAudioProcessors] = useState<AudioProcessor[]>([])
  const [audioZones, setAudioZones] = useState<AudioZone[]>([])
  const [selectedProcessor, setSelectedProcessor] = useState<AudioProcessor | null>(null)
  const [selectedAudioZone, setSelectedAudioZone] = useState<AudioZone | null>(null)
  const [audioInputs] = useState<AudioInput[]>([
    { id: 'input1', name: 'Input 1', isActive: true },
    { id: 'input2', name: 'Input 2', isActive: true },
    { id: 'input3', name: 'Input 3', isActive: true },
    { id: 'input4', name: 'Input 4', isActive: true },
    { id: 'matrix1', name: 'Matrix Audio 1', isActive: true },
    { id: 'matrix2', name: 'Matrix Audio 2', isActive: true },
    { id: 'matrix3', name: 'Matrix Audio 3', isActive: true },
    { id: 'matrix4', name: 'Matrix Audio 4', isActive: true },
    { id: 'streaming', name: 'Streaming Input', isActive: true },
    { id: 'microphone', name: 'Microphone', isActive: true },
  ])
  const [audioCommandStatus, setAudioCommandStatus] = useState<string>('')
  
  // Sports Guide related state
  const [showSportsGuide, setShowSportsGuide] = useState(false)
  const [sportsGuide, setSportsGuide] = useState<GameListing[]>([])
  const [availableLeagues, setAvailableLeagues] = useState<League[]>([])
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>(['nfl', 'nba']) // Default popular leagues
  const [isLoadingSportsGuide, setIsLoadingSportsGuide] = useState(false)
  const [sportsGuideStatus, setSportsGuideStatus] = useState<string>('')

  useEffect(() => {
    loadMatrixConfiguration()
    loadIRDevices()
    loadDirecTVDevices()
    checkConnectionStatus()
    loadAudioProcessors()
    loadAvailableLeagues()
  }, [])

  useEffect(() => {
    if (selectedProcessor) {
      loadAudioZones(selectedProcessor.id)
    }
  }, [selectedProcessor])

  useEffect(() => {
    // Auto-load sports guide when selected leagues change or when sports guide is opened
    if (selectedLeagues.length > 0 && showSportsGuide) {
      console.log('🏆 Auto-loading sports guide due to state change')
      generateSportsGuide()
    }
  }, [selectedLeagues, showSportsGuide])

  // Auto-load sports guide data on component mount
  useEffect(() => {
    if (selectedLeagues.length > 0) {
      console.log('🏆 Auto-loading sports guide data on mount')
      generateSportsGuide()
    }
  }, [])

  const loadMatrixConfiguration = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      const data = await response.json()
      
      if (data.inputs && data.inputs.length > 0) {
        // Filter for inputs with custom labels (not default "Input X" format) and that are active
        const customInputs = data.inputs.filter((input: MatrixInput) => 
          input.label && !input.label.match(/^Input \d+$/) && input.isActive
        )
        setInputs(customInputs)
      } else {
        // Fallback to default setup if no matrix config is available
        setInputs([
          { id: '1', channelNumber: 1, label: 'Cable Box 1', inputType: 'Cable', isActive: true },
          { id: '2', channelNumber: 2, label: 'DirecTV 1', inputType: 'Satellite', isActive: true },
          { id: '3', channelNumber: 3, label: 'Cable Box 2', inputType: 'Cable', isActive: true },
          { id: '4', channelNumber: 4, label: 'DirecTV 2', inputType: 'Satellite', isActive: true },
          { id: '5', channelNumber: 5, label: 'Streaming Box', inputType: 'Streaming', isActive: true },
          { id: '6', channelNumber: 6, label: 'Gaming Console', inputType: 'Gaming', isActive: true },
        ])
      }
    } catch (error) {
      console.error('Error loading matrix configuration:', error)
      // Use fallback data on error
      setInputs([
        { id: '1', channelNumber: 1, label: 'Cable Box 1', inputType: 'Cable', isActive: true },
        { id: '2', channelNumber: 2, label: 'DirecTV 1', inputType: 'Satellite', isActive: true },
        { id: '3', channelNumber: 3, label: 'Cable Box 2', inputType: 'Cable', isActive: true },
        { id: '4', channelNumber: 4, label: 'DirecTV 2', inputType: 'Satellite', isActive: true },
        { id: '5', channelNumber: 5, label: 'Streaming Box', inputType: 'Streaming', isActive: true },
        { id: '6', channelNumber: 6, label: 'Gaming Console', inputType: 'Gaming', isActive: true },
      ])
    }
  }

  const loadIRDevices = async () => {
    try {
      const response = await fetch('/api/ir-devices')
      const data = await response.json()
      setIRDevices(data.devices || [])
    } catch (error) {
      console.error('Error loading IR devices:', error)
    }
  }

  const loadDirecTVDevices = async () => {
    try {
      const response = await fetch('/api/directv-devices')
      const data = await response.json()
      setDirecTVDevices(data.devices || [])
    } catch (error) {
      console.error('Error loading DirecTV devices:', error)
    }
  }

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/matrix/test-connection')
      if (response.ok) {
        setConnectionStatus('connected')
      } else {
        setConnectionStatus('disconnected')
      }
    } catch (error) {
      setConnectionStatus('disconnected')
    }
  }

  const selectInput = async (inputNumber: number) => {
    setSelectedInput(inputNumber)
    
    // Find the corresponding IR device for this input
    const irDevice = irDevices.find(d => d.inputChannel === inputNumber)
    setSelectedDevice(irDevice || null)
    
    // Find the corresponding DirecTV device for this input
    const direcTVDevice = direcTVDevices.find(d => d.inputChannel === inputNumber)
    setSelectedDirecTVDevice(direcTVDevice || null)
    
    const input = inputs.find(i => i.channelNumber === inputNumber)
    
    // Determine which device is configured for this input
    let deviceInfo = ''
    if (direcTVDevice) {
      deviceInfo = `DirecTV: ${direcTVDevice.name} (${direcTVDevice.ipAddress})`
    } else if (irDevice) {
      deviceInfo = `IR: ${irDevice.name} (${irDevice.brand})`
    } else {
      deviceInfo = 'No device configured'
    }
    
    setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`} - ${deviceInfo}`)

    // Log the operation
    try {
      await fetch('/api/logs/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'input_switch',
          action: 'select_input',
          device: `Input ${inputNumber}`,
          details: {
            inputNumber,
            irDeviceName: irDevice?.name || 'Not configured',
            irDeviceBrand: irDevice?.brand || 'Unknown',
            irControlMethod: irDevice?.controlMethod || 'None',
            direcTVDeviceName: direcTVDevice?.name || 'Not configured',
            direcTVDeviceIP: direcTVDevice?.ipAddress || 'None',
            activeDevice: direcTVDevice ? 'DirecTV' : (irDevice ? 'IR' : 'None')
          },
          success: true
        })
      })
    } catch (error) {
      console.error('Failed to log input selection:', error)
    }
  }

  const sendIRCommand = async (command: string) => {
    // Prioritize DirecTV device over IR device for more reliable control
    const activeDevice = selectedDirecTVDevice || selectedDevice
    
    if (!activeDevice) {
      setCommandStatus('No device selected')
      // Log failed attempt
      try {
        await fetch('/api/logs/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'error',
            action: 'Command failed - no device selected',
            details: { command, selectedInput },
            success: false,
            errorMessage: 'No device selected'
          })
        })
      } catch (logError) {
        console.error('Failed to log error:', logError)
      }
      return
    }

    setLoading(true)
    setCommandStatus(`Sending ${command}...`)

    let success = false
    let errorMessage = ''

    try {
      let response;
      let deviceName = '';
      
      if (selectedDirecTVDevice) {
        // Send DirecTV IP command
        deviceName = selectedDirecTVDevice.name
        response = await fetch('/api/directv-devices/send-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: selectedDirecTVDevice.id,
            command: command,
            ipAddress: selectedDirecTVDevice.ipAddress,
            port: selectedDirecTVDevice.port
          })
        })
      } else if (selectedDevice) {
        // Send IR device command
        deviceName = selectedDevice.name
        if (selectedDevice.controlMethod === 'IP' && selectedDevice.deviceIpAddress) {
          // Send IP command to IR device
          response = await fetch('/api/ir-devices/send-ip-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: selectedDevice.id,
              command: command,
              ipAddress: selectedDevice.deviceIpAddress,
              port: selectedDevice.ipControlPort || 80
            })
          })
        } else if (selectedDevice.iTachAddress) {
          // Send Global Cache command
          response = await fetch('/api/ir-devices/send-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: selectedDevice.id,
              command: command,
              iTachAddress: selectedDevice.iTachAddress
            })
          })
        } else {
          setCommandStatus('Device not configured')
          setLoading(false)
          errorMessage = 'Device not configured'
        }
      } else {
        setCommandStatus('Device not configured')
        setLoading(false)
        errorMessage = 'Device not configured'
      }

      if (response) {
        const result = await response.json()
        
        if (response.ok) {
          setCommandStatus(`✓ Sent ${command} to ${deviceName}`)
          success = true
        } else {
          setCommandStatus(`✗ Failed: ${result.error}`)
          errorMessage = result.error || 'API call failed'
        }
      }
    } catch (error) {
      console.error('Error sending command:', error)
      setCommandStatus(`✗ Error sending ${command}`)
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      setLoading(false)

      // Log the operation with comprehensive details
      try {
        const operationType = command.includes('VOL') ? 'volume_change' : 
                           command.includes('CH') ? 'channel_change' : 
                           command === 'POWER' ? 'power_control' : 'device_control'

        const logDevice = selectedDirecTVDevice || selectedDevice
        const deviceType = selectedDirecTVDevice ? 'DirecTV' : 'IR'

        await fetch('/api/logs/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: operationType,
            action: `${deviceType} Command: ${command}`,
            device: logDevice?.name || 'Unknown device',
            details: {
              command,
              inputNumber: selectedInput,
              deviceType,
              deviceId: logDevice?.id,
              // DirecTV specific fields
              direcTVIP: selectedDirecTVDevice?.ipAddress,
              direcTVPort: selectedDirecTVDevice?.port,
              receiverType: selectedDirecTVDevice?.receiverType,
              // IR device specific fields
              deviceBrand: selectedDevice?.brand,
              controlMethod: selectedDevice?.controlMethod,
              ipAddress: selectedDevice?.deviceIpAddress,
              iTachAddress: selectedDevice?.iTachAddress
            },
            success,
            errorMessage: success ? undefined : errorMessage
          })
        })
      } catch (logError) {
        console.error('Failed to log device command:', logError)
      }

      // Clear status after 3 seconds
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const loadAudioProcessors = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      if (response.ok) {
        const data = await response.json()
        const processors = data.processors || []
        setAudioProcessors(processors)
        
        // Auto-select first online processor
        const onlineProcessor = processors.find((p: AudioProcessor) => p.status === 'online')
        if (onlineProcessor && !selectedProcessor) {
          setSelectedProcessor(onlineProcessor)
        }
      }
    } catch (error) {
      console.error('Error loading audio processors:', error)
    }
  }

  const loadAudioZones = async (processorId: string) => {
    try {
      const response = await fetch(`/api/audio-processor/zones?processorId=${processorId}`)
      if (response.ok) {
        const data = await response.json()
        setAudioZones(data.zones || [])
      }
    } catch (error) {
      console.error('Error loading audio zones:', error)
    }
  }

  const controlAudioZone = async (action: string, zone: AudioZone, value?: any) => {
    if (!selectedProcessor) return

    setAudioCommandStatus(`${action} Zone ${zone.zoneNumber}...`)

    let success = false
    let errorMessage = ''

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          command: {
            action,
            zone: zone.zoneNumber,
            value
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setAudioCommandStatus(`✓ ${action} Zone ${zone.zoneNumber}`)
        success = true
        // Refresh zones to get updated values
        loadAudioZones(selectedProcessor.id)
      } else {
        setAudioCommandStatus(`✗ Failed: ${result.error}`)
        errorMessage = result.error || 'Audio control failed'
      }
    } catch (error) {
      console.error('Error controlling audio zone:', error)
      setAudioCommandStatus(`✗ Error controlling zone`)
      errorMessage = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      // Log the audio operation
      try {
        const operationType = action === 'volume' ? 'volume_change' : 
                            action === 'mute' ? 'volume_change' : 
                            action === 'setSource' ? 'input_switch' : 'audio_zone'

        await fetch('/api/logs/operations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: operationType,
            action: `Audio ${action}`,
            device: `${selectedProcessor.name} Zone ${zone.zoneNumber}`,
            details: {
              processorId: selectedProcessor.id,
              processorName: selectedProcessor.name,
              processorModel: selectedProcessor.model,
              processorIpAddress: selectedProcessor.ipAddress,
              zoneNumber: zone.zoneNumber,
              zoneName: zone.name,
              action,
              value,
              previousValue: action === 'volume' ? zone.volume : 
                           action === 'mute' ? zone.muted : 
                           action === 'setSource' ? zone.currentSource : null
            },
            success,
            errorMessage: success ? undefined : errorMessage
          })
        })
      } catch (logError) {
        console.error('Failed to log audio control:', logError)
      }

      // Clear status after 3 seconds
      setTimeout(() => setAudioCommandStatus(''), 3000)
    }
  }

  const setZoneSource = async (zone: AudioZone, source: string) => {
    await controlAudioZone('setSource', zone, source)
  }

  const adjustZoneVolume = async (zone: AudioZone, volumeChange: number) => {
    const newVolume = Math.max(0, Math.min(100, zone.volume + volumeChange))
    await controlAudioZone('volume', zone, newVolume)
  }

  const toggleZoneMute = async (zone: AudioZone) => {
    await controlAudioZone('mute', zone, !zone.muted)
  }

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'gaming': return '🎮'
      default: return '📺'
    }
  }

  // Sports Guide Functions
  const loadAvailableLeagues = async () => {
    try {
      const response = await fetch('/api/leagues')
      const result = await response.json()
      
      if (result.success) {
        setAvailableLeagues(result.data)
      } else {
        // Fallback to default leagues
        const defaultLeagues = [
          { id: 'nfl', name: 'NFL', description: 'National Football League', category: 'professional' as const, season: '2024-25' },
          { id: 'nba', name: 'NBA', description: 'National Basketball Association', category: 'professional' as const, season: '2024-25' },
          { id: 'mlb', name: 'MLB', description: 'Major League Baseball', category: 'professional' as const, season: '2024' },
          { id: 'nhl', name: 'NHL', description: 'National Hockey League', category: 'professional' as const, season: '2024-25' },
          { id: 'ncaa-fb', name: 'NCAA Football', description: 'College Football', category: 'college' as const, season: '2024' },
          { id: 'ncaa-bb', name: 'NCAA Basketball', description: 'College Basketball', category: 'college' as const, season: '2024-25' }
        ]
        setAvailableLeagues(defaultLeagues)
      }
    } catch (error) {
      console.error('Error loading leagues:', error)
    }
  }

  const generateSportsGuide = async () => {
    setIsLoadingSportsGuide(true)
    setSportsGuideStatus('Loading games...')
    
    try {
      console.log('🏆 Requesting sports guide with leagues:', selectedLeagues)
      const response = await fetch('/api/sports-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedLeagues })
      })
      
      console.log('🏆 Sports guide response status:', response.status)
      const result = await response.json()
      console.log('🏆 Sports guide result:', result)
      
      if (result.success && result.data && result.data.games) {
        const games = result.data.games || []
        console.log('🏆 Setting', games.length, 'games to state')
        setSportsGuide(games)
        setSportsGuideStatus(`Found ${games.length} games`)
      } else {
        console.error('Failed to generate sports guide:', result.error || 'No games data')
        setSportsGuide([])
        setSportsGuideStatus(`Failed to load games: ${result.error || 'No data'}`)
      }
    } catch (error) {
      console.error('Error generating sports guide:', error)
      setSportsGuide([])
      setSportsGuideStatus(`Error: ${error.message}`)
    } finally {
      setIsLoadingSportsGuide(false)
      // Clear status after 5 seconds (extended for debugging)
      setTimeout(() => setSportsGuideStatus(''), 5000)
    }
  }

  const handleGameClick = async (game: GameListing) => {
    const channel = game.channel
    
    // Determine which device type this channel should use
    let targetInput: MatrixInput | null = null
    let targetDevice: IRDevice | null = null
    
    if (channel.type === 'cable' || channel.type === 'ota') {
      // Find a cable box or satellite device
      targetInput = inputs.find(input => 
        input.inputType.toLowerCase().includes('cable') || 
        input.inputType.toLowerCase().includes('satellite')
      ) || null
    } else if (channel.type === 'streaming') {
      // Find a streaming device 
      targetInput = inputs.find(input => 
        input.inputType.toLowerCase().includes('streaming') ||
        input.label.toLowerCase().includes('fire') ||
        input.label.toLowerCase().includes('roku') ||
        input.label.toLowerCase().includes('apple')
      ) || null
    }
    
    if (!targetInput) {
      setSportsGuideStatus(`No suitable device found for ${channel.name}`)
      setTimeout(() => setSportsGuideStatus(''), 3000)
      return
    }

    // Find the corresponding IR device
    targetDevice = irDevices.find(d => d.inputChannel === targetInput!.channelNumber) || null
    
    if (!targetDevice) {
      setSportsGuideStatus(`Device not configured for ${targetInput.label}`)
      setTimeout(() => setSportsGuideStatus(''), 3000)
      return
    }

    // Switch to the appropriate input first
    await selectInput(targetInput.channelNumber)
    
    // Wait a moment for input switch
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Now send the appropriate command based on device type
    if (channel.type === 'cable' || channel.type === 'ota') {
      // Send channel change command
      if (channel.channelNumber) {
        setSportsGuideStatus(`Changing to channel ${channel.channelNumber} on ${targetDevice.name}`)
        await sendChannelCommand(channel.channelNumber, targetDevice)
      } else {
        setSportsGuideStatus(`Channel number not available for ${channel.name}`)
      }
    } else if (channel.type === 'streaming') {
      // Send app launch command
      if (channel.appCommand) {
        setSportsGuideStatus(`Opening ${channel.name} app on ${targetDevice.name}`)
        await sendAppCommand(channel.appCommand, targetDevice)
      } else {
        setSportsGuideStatus(`App command not configured for ${channel.name}`)
      }
    }

    // Log the sports guide action
    try {
      await fetch('/api/logs/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sports_guide_action',
          action: `Watch ${game.league}: ${game.awayTeam} @ ${game.homeTeam}`,
          device: targetDevice.name,
          details: {
            game: {
              league: game.league,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
              gameTime: game.gameTime
            },
            channel: {
              name: channel.name,
              type: channel.type,
              channelNumber: channel.channelNumber,
              appCommand: channel.appCommand
            },
            targetInput: targetInput.channelNumber,
            targetDevice: targetDevice.name
          },
          success: true
        })
      })
    } catch (error) {
      console.error('Failed to log sports guide action:', error)
    }

    setTimeout(() => setSportsGuideStatus(''), 5000)
  }

  const sendChannelCommand = async (channelNumber: string, device: IRDevice) => {
    // Send individual digits for channel change
    const digits = channelNumber.split('')
    
    for (const digit of digits) {
      await sendIRCommand(digit)
      // Small delay between digits
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    // Send enter/OK command to confirm
    await new Promise(resolve => setTimeout(resolve, 500))
    await sendIRCommand('OK')
  }

  const sendAppCommand = async (appCommand: string, device: IRDevice) => {
    // Send app launch command - this could be a sequence of commands
    // For example, for Netflix: HOME -> Navigate to Netflix -> OK
    const commands = appCommand.split(',').map(cmd => cmd.trim())
    
    for (const command of commands) {
      await sendIRCommand(command)
      // Delay between commands
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const getCostIcon = (cost: string) => {
    switch (cost) {
      case 'free': return '🆓'
      case 'subscription': return '💳'
      case 'premium': return '💎'
      default: return '💳'
    }
  }

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          🏈 Bartender Remote
        </h1>
        <div className="flex items-center justify-center space-x-2 text-sm flex-wrap">
          <div className={`px-3 py-1 rounded-full font-medium flex items-center space-x-1 ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{connectionStatus}</span>
          </div>
          {commandStatus && (
            <div className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">
              TV: {commandStatus}
            </div>
          )}
          {audioCommandStatus && (
            <div className="px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
              Audio: {audioCommandStatus}
            </div>
          )}
          {sportsGuideStatus && (
            <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">
              Sports: {sportsGuideStatus}
            </div>
          )}
          <button
            onClick={() => setShowSportsGuide(!showSportsGuide)}
            className={`px-3 py-1 rounded-full font-medium flex items-center space-x-1 transition-all ${
              showSportsGuide 
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'bg-gray-500/20 text-gray-400 border border-gray-500/30 hover:bg-gray-500/30'
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>Sports Guide</span>
          </button>
        </div>
      </div>

      {/* Sports Guide Panel */}
      {showSportsGuide && (
        <div className="max-w-7xl mx-auto mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Calendar className="mr-2 w-5 h-5" />
                Sports Guide
              </h2>
              <div className="flex items-center space-x-3">
                <button
                  onClick={generateSportsGuide}
                  disabled={isLoadingSportsGuide}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center space-x-2"
                >
                  {isLoadingSportsGuide ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Loading...</span>
                    </>
                  ) : (
                    <>
                      <Star className="w-4 h-4" />
                      <span>Load Games</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowSportsGuide(false)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Sports Guide Games List */}
            {sportsGuide.length > 0 ? (
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {sportsGuide.map((game) => (
                  <div
                    key={game.id}
                    className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => handleGameClick(game)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-500/20 rounded-lg p-2">
                          <Star className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{game.league}</h4>
                          <p className="text-sm text-gray-300">{game.awayTeam} @ {game.homeTeam}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-1 text-sm text-gray-300">
                          <Clock className="w-4 h-4" />
                          <span>{game.gameTime}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-3 mt-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-white/10 rounded-lg p-2">
                          {game.channel.type === 'streaming' ? 
                            <Smartphone className="w-4 h-4 text-purple-400" /> : 
                            <Tv className="w-4 h-4 text-blue-400" />
                          }
                        </div>
                        <div>
                          <div className="font-medium text-white">{game.channel.name}</div>
                          <div className="text-sm text-gray-400">
                            {getCostIcon(game.channel.cost)} {game.channel.cost}
                            {game.channel.channelNumber && ` • Ch ${game.channel.channelNumber}`}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm text-green-400 font-medium">Click to Watch</div>
                        <div className="text-xs text-gray-400">
                          {game.channel.type === 'cable' ? 'Change Channel' : 'Open App'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="bg-gray-500/20 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-gray-400 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Games Loaded</h3>
                <p className="text-gray-400">Click "Load Games" to see current sports listings</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
        {/* Left Panel - Input Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-fit">
            <h2 className="text-lg font-bold text-white mb-3 flex items-center">
              <Tv className="mr-2 w-5 h-5" />
              TV Inputs
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {inputs.map((input) => {
                const direcTVDevice = direcTVDevices.find(d => d.inputChannel === input.channelNumber)
                const irDevice = irDevices.find(d => d.inputChannel === input.channelNumber)
                
                return (
                  <button
                    key={input.id}
                    onClick={() => selectInput(input.channelNumber)}
                    className={`w-full p-3 rounded-lg text-left transition-all ${
                      selectedInput === input.channelNumber
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getInputIcon(input.inputType)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{input.label}</div>
                        <div className="text-xs opacity-80 truncate">
                          Ch {input.channelNumber} • {input.inputType}
                          {direcTVDevice && (
                            <span className="ml-2 px-1 py-0.5 bg-green-500/20 text-green-400 rounded text-xs border border-green-500/30">
                              DirecTV IP
                            </span>
                          )}
                          {!direcTVDevice && irDevice && (
                            <span className="ml-2 px-1 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs border border-orange-500/30">
                              {irDevice.controlMethod}
                            </span>
                          )}
                          {!direcTVDevice && !irDevice && (
                            <span className="ml-2 px-1 py-0.5 bg-gray-500/20 text-gray-400 rounded text-xs border border-gray-500/30">
                              No Device
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Main Remote Control Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-fit">
            {selectedInput ? (
              <>
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold text-white mb-1">
                    {inputs.find(i => i.channelNumber === selectedInput)?.label || `Input ${selectedInput}`} Control
                  </h2>
                  {selectedDevice && (
                    <p className="text-blue-300 text-sm">
                      {selectedDevice.name} ({selectedDevice.brand}) - {selectedDevice.controlMethod}
                    </p>
                  )}
                  {!selectedDevice && (
                    <p className="text-orange-300 text-sm">No device configured</p>
                  )}
                </div>

                {selectedDevice ? (
                  <div className="space-y-4">
                    {/* Power and Main Controls */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {CONTROL_COMMANDS.map((cmd) => (
                        <button
                          key={cmd.command}
                          onClick={() => sendIRCommand(cmd.command)}
                          disabled={loading}
                          className={`p-3 rounded-lg font-medium text-white transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                            cmd.color || 'bg-gray-600 hover:bg-gray-500'
                          }`}
                        >
                          <div className="flex flex-col items-center space-y-1">
                            {cmd.icon && <cmd.icon className="w-5 h-5" />}
                            <span className="text-xs">{cmd.display}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Number Pad and Channel Controls */}
                    <div>
                      <h3 className="text-lg font-medium text-white mb-2">Channels</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {CHANNEL_COMMANDS.map((cmd) => (
                          <button
                            key={cmd.command}
                            onClick={() => sendIRCommand(cmd.command)}
                            disabled={loading}
                            className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex flex-col items-center space-y-1">
                              {cmd.icon && <cmd.icon className="w-4 h-4" />}
                              <span className="text-sm">{cmd.display}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Settings className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">
                      This input needs device configuration.
                      <br />
                      Contact management to set up control.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Tv className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">Select a TV Input</h3>
                <p className="text-gray-400">Choose an input from the left to control it</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Future Features */}
        <div className="lg:col-span-1 space-y-4">
          {/* TV Power Controls (Future) */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Power className="mr-2 w-4 h-4" />
              TV Power
            </h3>
            <div className="space-y-2">
              <button
                disabled
                className="w-full p-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg text-sm opacity-50 cursor-not-allowed"
              >
                All TVs ON
              </button>
              <button
                disabled
                className="w-full p-2 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-sm opacity-50 cursor-not-allowed"
              >
                All TVs OFF
              </button>
              <p className="text-xs text-gray-500">Coming Soon</p>
            </div>
          </div>

          {/* Audio Zone Controls */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center">
              <Speaker className="mr-2 w-4 h-4" />
              Audio Zones
            </h3>
            
            {/* Processor Selection */}
            {audioProcessors.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-gray-300 block mb-1">Processor</label>
                <select
                  value={selectedProcessor?.id || ''}
                  onChange={(e) => {
                    const processor = audioProcessors.find(p => p.id === e.target.value)
                    setSelectedProcessor(processor || null)
                  }}
                  className="w-full p-2 bg-slate-700 text-white rounded text-sm border border-slate-600 focus:border-purple-500"
                >
                  <option value="">Select Processor</option>
                  {audioProcessors.map((processor) => (
                    <option key={processor.id} value={processor.id}>
                      {processor.name} ({processor.status})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedProcessor && audioZones.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {audioZones.filter(zone => zone.enabled).map((zone) => (
                  <div
                    key={zone.id}
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      selectedAudioZone?.id === zone.id
                        ? 'bg-purple-500/30 border-purple-400 text-white'
                        : 'bg-slate-700/50 border-slate-600 text-gray-300 hover:bg-slate-700 hover:border-slate-500'
                    }`}
                    onClick={() => setSelectedAudioZone(zone)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">Zone {zone.zoneNumber}: {zone.name}</span>
                      <div className="flex items-center space-x-1">
                        {zone.muted && <VolumeX className="w-3 h-3 text-red-400" />}
                        <span className="text-xs">{zone.volume}%</span>
                      </div>
                    </div>
                    <div className="text-xs opacity-75 flex items-center">
                      <Play className="w-2 h-2 mr-1" />
                      {zone.currentSource || 'No Source'}
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedProcessor ? (
              <div className="text-center text-gray-400 text-sm py-4">
                <Speaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No zones configured</p>
                <p className="text-xs">Set up zones in Audio Manager</p>
              </div>
            ) : (
              <div className="text-center text-gray-400 text-sm py-4">
                <Speaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No audio processors</p>
                <p className="text-xs">Configure in Audio Manager</p>
              </div>
            )}
          </div>

          {/* Audio Zone Controls */}
          {selectedAudioZone && (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                <Volume2 className="mr-2 w-4 h-4" />
                Zone Control
              </h3>
              
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-sm text-gray-300 mb-1">Zone {selectedAudioZone.zoneNumber}</div>
                  <div className="font-semibold text-white">{selectedAudioZone.name}</div>
                </div>

                {/* Volume Controls */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">Volume</span>
                    <span className="text-white font-mono">{selectedAudioZone.volume}%</span>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => adjustZoneVolume(selectedAudioZone, -5)}
                      className="flex-1 p-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-all"
                    >
                      <ChevronDown className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => toggleZoneMute(selectedAudioZone)}
                      className={`flex-1 p-2 rounded text-sm transition-all ${
                        selectedAudioZone.muted 
                          ? 'bg-orange-600 hover:bg-orange-500' 
                          : 'bg-slate-600 hover:bg-slate-500'
                      } text-white`}
                    >
                      {selectedAudioZone.muted ? <Volume2 className="w-4 h-4 mx-auto" /> : <VolumeX className="w-4 h-4 mx-auto" />}
                    </button>
                    <button
                      onClick={() => adjustZoneVolume(selectedAudioZone, 5)}
                      className="flex-1 p-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-all"
                    >
                      <ChevronUp className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>

                {/* Audio Source Selection */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300 block">Audio Source</label>
                  <select
                    value={selectedAudioZone.currentSource || ''}
                    onChange={(e) => setZoneSource(selectedAudioZone, e.target.value)}
                    className="w-full p-2 bg-slate-700 text-white rounded text-sm border border-slate-600 focus:border-purple-500"
                  >
                    <option value="">Select Source</option>
                    {audioInputs.map((input) => (
                      <option key={input.id} value={input.name}>
                        {input.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-lg font-bold text-white mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedInput(null)
                  setSelectedDevice(null)
                  setCommandStatus('')
                }}
                className="w-full p-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg text-sm hover:bg-blue-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Tv className="w-4 h-4" />
                <span>Reset TV</span>
              </button>
              
              <button
                onClick={() => {
                  setSelectedProcessor(null)
                  setSelectedAudioZone(null)
                  setAudioCommandStatus('')
                }}
                className="w-full p-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Speaker className="w-4 h-4" />
                <span>Reset Audio</span>
              </button>
              
              <button
                onClick={() => {
                  setShowSportsGuide(false)
                  setSportsGuide([])
                  setSportsGuideStatus('')
                }}
                className="w-full p-2 bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Clear Sports</span>
              </button>
              
              <button
                onClick={() => {
                  setSelectedInput(null)
                  setSelectedDevice(null)
                  setCommandStatus('')
                  setSelectedProcessor(null)
                  setSelectedAudioZone(null)
                  setAudioCommandStatus('')
                  setShowSportsGuide(false)
                  setSportsGuide([])
                  setSportsGuideStatus('')
                  loadMatrixConfiguration()
                  loadAudioProcessors()
                }}
                className="w-full p-2 bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg text-sm hover:bg-gray-500/30 transition-all flex items-center justify-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

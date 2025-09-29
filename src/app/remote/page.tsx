

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
  MapPin,
  Zap,
  Wifi,
  WifiOff,
  Volume1,
  VolumeIcon,
  Sliders,
  Speaker,
  Calendar,
  Upload,
  FileImage,
  Brain,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
  Save,
  X
} from 'lucide-react'
import Image from 'next/image'
import CECPowerControl from '../../components/CECPowerControl'
import SportsGuide from '../../components/SportsGuide'

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

interface TVLayoutZone {
  id: string
  outputNumber: number
  x: number
  y: number
  width: number
  height: number
  label?: string
}

interface TVLayout {
  id?: string
  name: string
  imageUrl?: string
  originalFileUrl?: string
  fileType?: string
  zones: TVLayoutZone[]
}

interface RemoteCommand {
  display: string
  command: string
  icon?: any
  color?: string
}

interface AudioZone {
  id: string
  name: string
  volume: number
  currentInput?: number
  isMuted: boolean
}

interface AudioInput {
  id: string
  name: string
  channelNumber: number
  type: string
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

const AUDIO_INPUTS: AudioInput[] = [
  { id: '1', name: 'Main Audio', channelNumber: 1, type: 'Main' },
  { id: '2', name: 'Music Stream', channelNumber: 2, type: 'Streaming' },
  { id: '3', name: 'Game Audio', channelNumber: 3, type: 'Gaming' },
  { id: '4', name: 'Ambient Music', channelNumber: 4, type: 'Background' },
  { id: '5', name: 'Sports Audio', channelNumber: 5, type: 'Sports' },
  { id: '6', name: 'Announcements', channelNumber: 6, type: 'PA' },
]

export default function BartenderRemotePage() {
  const [inputs, setInputs] = useState<MatrixInput[]>([])
  const [irDevices, setIRDevices] = useState<IRDevice[]>([])
  const [selectedInput, setSelectedInput] = useState<number | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [commandStatus, setCommandStatus] = useState<string>('')
  const [tvLayout, setTVLayout] = useState<TVLayout>({
    name: 'Bar Layout',
    zones: []
  })
  const [isRouting, setIsRouting] = useState(false)
  const [matrixConfig, setMatrixConfig] = useState<any>(null)
  
  // New tab and audio states
  const [activeTab, setActiveTab] = useState<'video' | 'audio' | 'power' | 'guide' | 'layout'>('video')
  const [selectedAudioInput, setSelectedAudioInput] = useState<number | null>(null)
  const [audioZones, setAudioZones] = useState<AudioZone[]>([
    { id: '1', name: 'Main Bar', volume: 75, isMuted: false },
    { id: '2', name: 'Upper Level', volume: 60, currentInput: 1, isMuted: false },
    { id: '3', name: 'Lower Level', volume: 65, currentInput: 2, isMuted: false },
    { id: '4', name: 'South Section', volume: 70, currentInput: 3, isMuted: false },
    { id: '5', name: 'North Section', volume: 68, currentInput: 1, isMuted: false },
    { id: '6', name: 'Patio', volume: 55, isMuted: false },
  ])

  // Layout management states
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState<string>('')
  const [aiAnalysis, setAIAnalysis] = useState<any>(null)

  useEffect(() => {
    loadInputs()
    loadIRDevices()
    checkConnectionStatus()
    loadTVLayout()
    // Also fetch matrix data on initial load
    fetchMatrixData()
  }, [])

  useEffect(() => {
    // Re-fetch matrix data when layout zones change (but skip initial empty state)
    if (tvLayout.zones.length > 0) {
      fetchMatrixData()
    }
  }, [tvLayout.zones.length])

  const fetchMatrixData = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        if (data.configs?.length > 0) {
          const activeConfig = data.configs[0]
          // Use ALL active inputs from Wolf Pack matrix
          const matrixInputs = activeConfig.inputs?.filter((input: MatrixInput) => 
            input.isActive
          ) || []
          
          // Always show matrix inputs if they exist, regardless of connection status
          setInputs(matrixInputs)
          
          // Set initial connection status from database, but this may be overridden by checkConnectionStatus
          setConnectionStatus(activeConfig.connectionStatus === 'connected' ? 'connected' : 'disconnected')
          setMatrixConfig(activeConfig)
          
          // Update TV layout zones with matrix output labels
          if (activeConfig.outputs && tvLayout.zones.length > 0) {
            const updatedZones = tvLayout.zones.map(zone => {
              const matchingOutput = activeConfig.outputs.find((output: any) => 
                output.channelNumber === zone.outputNumber
              )
              return {
                ...zone,
                label: matchingOutput?.label && !matchingOutput.label.match(/^Output \d+$/) 
                  ? matchingOutput.label 
                  : zone.label
              }
            })
            setTVLayout({ ...tvLayout, zones: updatedZones })
          }
        } else if (data.config) {
          // Fallback for direct config format
          const directInputs = data.inputs?.filter((input: MatrixInput) => 
            input.isActive
          ) || []
          
          if (directInputs.length > 0) {
            setInputs(directInputs)
          }
          
          setConnectionStatus(data.config.connectionStatus === 'connected' ? 'connected' : 'disconnected')
          setMatrixConfig(data.config)
          
          if (data.outputs && tvLayout.zones.length > 0) {
            const updatedZones = tvLayout.zones.map(zone => {
              const matchingOutput = data.outputs.find((output: any) => 
                output.channelNumber === zone.outputNumber
              )
              return {
                ...zone,
                label: matchingOutput?.label && !matchingOutput.label.match(/^Output \d+$/) 
                  ? matchingOutput.label 
                  : zone.label
              }
            })
            setTVLayout({ ...tvLayout, zones: updatedZones })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching matrix data:', error)
    }
  }

  const loadInputs = async () => {
    // Matrix inputs are loaded via fetchMatrixData()
    // This function is kept for compatibility
  }

  const loadTVLayout = async () => {
    try {
      const response = await fetch('/api/bartender/layout')
      if (response.ok) {
        const data = await response.json()
        if (data.layout) {
          setTVLayout(data.layout)
        }
      }
    } catch (error) {
      console.error('Error loading TV layout:', error)
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

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/matrix/test-connection')
      const result = await response.json()
      if (result.success) {
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
    const device = irDevices.find(d => d.inputChannel === inputNumber && d.isActive)
    setSelectedDevice(device || null)
    
    const input = inputs.find(i => i.channelNumber === inputNumber)
    
    if (device) {
      setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`} → ${device.name} (${device.brand})`)
    } else {
      setCommandStatus(`Selected: ${input?.label || `Input ${inputNumber}`} ⚠️ No IR device configured for this input`)
    }
    
    // Auto-clear status after 5 seconds
    setTimeout(() => {
      if (commandStatus.includes(input?.label || `Input ${inputNumber}`)) {
        setCommandStatus('')
      }
    }, 5000)
  }

  const routeInputToOutput = async (inputNumber: number, outputNumber: number) => {
    // Allow routing attempt even if connection status shows disconnected
    // The actual routing API will handle connection failures gracefully

    setIsRouting(true)
    try {
      const response = await fetch('/api/matrix/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputNumber,
          output: outputNumber
        })
      })

      if (response.ok) {
        setCommandStatus(`✅ Routed to Output ${outputNumber}`)
      } else {
        setCommandStatus('❌ Failed to route signal')
      }
    } catch (error) {
      console.error('Error routing signal:', error)
      setCommandStatus('❌ Error routing signal')
    } finally {
      setIsRouting(false)
      // Clear status after 3 seconds
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const handleZoneClick = (zone: TVLayoutZone) => {
    if (selectedInput && inputs.length > 0) {
      const input = inputs.find(i => i.channelNumber === selectedInput)
      if (input) {
        routeInputToOutput(input.channelNumber, zone.outputNumber)
      }
    } else {
      setCommandStatus('⚠️ Please select an input first')
      setTimeout(() => setCommandStatus(''), 3000)
    }
  }

  const sendIRCommand = async (command: string) => {
    if (!selectedDevice) {
      setCommandStatus('No device selected')
      return
    }

    setLoading(true)
    setCommandStatus(`Sending ${command}...`)

    try {
      let response;
      
      if (selectedDevice.controlMethod === 'IP' && selectedDevice.deviceIpAddress) {
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
        return
      }

      const result = await response.json()
      
      if (response.ok) {
        setCommandStatus(`✓ Sent ${command} to ${selectedDevice.name}`)
      } else {
        setCommandStatus(`✗ Failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error sending command:', error)
      setCommandStatus(`✗ Error sending ${command}`)
    } finally {
      setLoading(false)
    }
  }

  // Audio functions
  const selectAudioInput = (inputNumber: number) => {
    setSelectedAudioInput(inputNumber)
    const input = AUDIO_INPUTS.find(i => i.channelNumber === inputNumber)
    setCommandStatus(`Selected audio input: ${input?.name || `Input ${inputNumber}`}`)
  }

  const assignInputToZone = async (zoneId: string, inputNumber: number) => {
    setAudioZones(zones => zones.map(zone => 
      zone.id === zoneId ? { ...zone, currentInput: inputNumber } : zone
    ))
    
    const zone = audioZones.find(z => z.id === zoneId)
    const input = AUDIO_INPUTS.find(i => i.channelNumber === inputNumber)
    setCommandStatus(`✅ Assigned "${input?.name}" to "${zone?.name}"`)
    
    // Clear status after 3 seconds
    setTimeout(() => setCommandStatus(''), 3000)
  }

  const updateZoneVolume = async (zoneId: string, volume: number) => {
    setAudioZones(zones => zones.map(zone => 
      zone.id === zoneId ? { ...zone, volume } : zone
    ))
  }

  const toggleZoneMute = async (zoneId: string) => {
    setAudioZones(zones => zones.map(zone => 
      zone.id === zoneId ? { ...zone, isMuted: !zone.isMuted } : zone
    ))
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

  const getAudioInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'main': return '🎵'
      case 'streaming': return '📻'
      case 'gaming': return '🎮'
      case 'background': return '🎶'
      case 'sports': return '⚽'
      case 'pa': return '📢'
      default: return '🎵'
    }
  }

  // Layout management functions
  const handleLayoutUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadStatus('Uploading floor plan...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/bartender/upload-layout', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setUploadStatus('✅ Upload successful!')
        
        // Update the layout with the new image
        const newLayout = {
          name: tvLayout.name,
          imageUrl: result.convertedImageUrl || result.imageUrl,
          originalFileUrl: result.imageUrl,
          fileType: result.fileType,
          zones: tvLayout.zones
        }
        
        setTVLayout(newLayout)

        // Save the layout
        await fetch('/api/bartender/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: newLayout })
        })

        // Start AI analysis if description is available
        if (result.description) {
          await analyzeLayoutWithAI(result.description, result.convertedImageUrl || result.imageUrl)
        }
      } else {
        setUploadStatus(`❌ ${result.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('❌ Upload failed')
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadStatus(''), 5000)
    }
  }

  const analyzeLayoutWithAI = async (description: string, imageUrl: string) => {
    setIsAnalyzing(true)
    setAnalysisStatus('🤖 AI analyzing layout...')

    try {
      // Fetch current matrix outputs
      const matrixResponse = await fetch('/api/matrix/config')
      let matrixOutputs = 36
      let availableOutputs = []

      if (matrixResponse.ok) {
        const matrixData = await matrixResponse.json()
        if (matrixData.configs?.length > 0) {
          const config = matrixData.configs[0]
          matrixOutputs = config.outputs?.length || 36
          availableOutputs = config.outputs || []
        }
      }

      const analysisResponse = await fetch('/api/ai/analyze-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layoutDescription: description,
          matrixOutputs,
          availableOutputs,
          imageUrl
        })
      })

      const result = await analysisResponse.json()

      if (analysisResponse.ok) {
        setAIAnalysis(result.analysis)
        setAnalysisStatus('✅ AI analysis complete!')
        
        // Auto-apply suggestions
        await applyAISuggestions(result.analysis)
      } else {
        setAnalysisStatus(`❌ Analysis failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setAnalysisStatus('❌ Analysis failed')
    } finally {
      setIsAnalyzing(false)
      setTimeout(() => setAnalysisStatus(''), 5000)
    }
  }

  const applyAISuggestions = async (analysis: any) => {
    if (!analysis || !analysis.suggestions) return

    const newZones = analysis.suggestions.map((suggestion: any) => ({
      id: `zone-${suggestion.outputNumber}`,
      outputNumber: suggestion.outputNumber,
      x: analysis.locations.find((loc: any) => loc.number === suggestion.tvNumber)?.position.x || 50,
      y: analysis.locations.find((loc: any) => loc.number === suggestion.tvNumber)?.position.y || 50,
      width: 8, // Standard TV zone size
      height: 6,
      label: suggestion.label
    }))

    const updatedLayout = {
      ...tvLayout,
      zones: newZones
    }

    setTVLayout(updatedLayout)
    
    // Save the updated layout
    await fetch('/api/bartender/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: updatedLayout })
    })

    setAnalysisStatus(`✅ Placed ${newZones.length} TV zones automatically!`)
  }

  const clearLayout = async () => {
    const confirmed = confirm('Are you sure you want to clear the current layout?')
    if (!confirmed) return

    const emptyLayout = {
      name: 'Bar Layout',
      zones: []
    }

    setTVLayout(emptyLayout)
    setAIAnalysis(null)

    // Save empty layout
    await fetch('/api/bartender/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: emptyLayout })
    })

    setCommandStatus('Layout cleared')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      {/* Header */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-white mb-2">
          🏈 Bartender Remote Control
        </h1>
        <div className="flex items-center justify-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-1 ${
            connectionStatus === 'connected' 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {connectionStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>Matrix: {connectionStatus}</span>
          </div>
          {commandStatus && (
            <div className="px-3 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-sm">
              {commandStatus}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Changes based on active tab */}
      <div className="flex-1 px-4 pb-20"> {/* pb-20 to make room for bottom tabs */}
        {activeTab === 'video' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {/* Video Inputs */}
            <div className="lg:col-span-1">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Radio className="mr-2 w-5 h-5" />
                  Input Sources
                </h2>
                <p className="text-sm text-blue-300 mb-4">
                  {selectedInput 
                    ? 'Click on TVs in layout to route signal' 
                    : 'Select an input source first'
                  }
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {inputs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No input sources configured.</p>
                      <p className="text-xs mt-1">Contact management to configure inputs.</p>
                    </div>
                  ) : (
                    <>
                      {inputs.map((input) => {
                        const hasIRDevice = irDevices.some(d => d.inputChannel === input.channelNumber && d.isActive)
                        const device = irDevices.find(d => d.inputChannel === input.channelNumber && d.isActive)
                        
                        return (
                          <button
                            key={input.id}
                            onClick={() => selectInput(input.channelNumber)}
                            className={`w-full p-3 rounded-lg text-left transition-all relative ${
                              selectedInput === input.channelNumber
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <span className="text-2xl">{getInputIcon(input.inputType)}</span>
                                <div className="flex-1">
                                  <div className="font-medium">{input.label}</div>
                                  <div className="text-sm opacity-80">
                                    Channel {input.channelNumber} • {input.inputType}
                                  </div>
                                  {device && (
                                    <div className="text-xs opacity-70 mt-1">
                                      📱 {device.name} ({device.controlMethod === 'IP' ? 'IP' : 'IR'})
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {hasIRDevice && (
                                  <div className="text-green-400" title="IR remote control available">
                                    <Settings className="w-4 h-4" />
                                  </div>
                                )}
                                {selectedInput === input.channelNumber && (
                                  <div className="text-blue-200">
                                    <Zap className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                      
                      {selectedInput && (
                        <button
                          onClick={() => {
                            setSelectedInput(null)
                            setSelectedDevice(null)
                            setCommandStatus('')
                          }}
                          className="w-full mt-3 px-3 py-2 text-sm bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all"
                        >
                          Clear Selection
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* IR Device Status Panel */}
              {selectedInput && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mt-4">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                    <Settings className="mr-2 w-4 h-4" />
                    Device Control
                  </h3>
                  
                  {selectedDevice ? (
                    <>
                      <div className="bg-green-500/20 text-green-300 border border-green-500/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{selectedDevice.name}</div>
                            <div className="text-sm opacity-80">{selectedDevice.brand} • {selectedDevice.deviceType}</div>
                          </div>
                          <div className="text-xs bg-green-600/30 px-2 py-1 rounded">
                            {selectedDevice.controlMethod === 'IP' ? '📡 IP Control' : '📻 IR Control'}
                          </div>
                        </div>
                        {selectedDevice.controlMethod === 'IP' ? (
                          <div className="text-xs mt-2 opacity-75">
                            {selectedDevice.deviceIpAddress}:{selectedDevice.ipControlPort || 'auto'}
                          </div>
                        ) : (
                          <div className="text-xs mt-2 opacity-75">
                            iTach: {selectedDevice.iTachAddress}:{selectedDevice.iTachPort || 1}
                          </div>
                        )}
                      </div>
                  
                      {/* Power and Main Controls */}
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {CONTROL_COMMANDS.map((cmd) => (
                          <button
                            key={cmd.command}
                            onClick={() => sendIRCommand(cmd.command)}
                            disabled={loading}
                            className={`p-2 rounded-lg font-medium text-white text-sm transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                              cmd.color || 'bg-gray-600 hover:bg-gray-500'
                            }`}
                          >
                            <div className="flex flex-col items-center space-y-1">
                              {cmd.icon && <cmd.icon className="w-4 h-4" />}
                              <span className="text-xs">{cmd.display}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Channel Controls */}
                      <div className="grid grid-cols-3 gap-1">
                        {CHANNEL_COMMANDS.slice(0, 12).map((cmd) => (
                          <button
                            key={cmd.command}
                            onClick={() => sendIRCommand(cmd.command)}
                            disabled={loading}
                            className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex flex-col items-center space-y-1">
                              {cmd.icon && <cmd.icon className="w-3 h-3" />}
                              <span>{cmd.display}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* No Device Configured */}
                      <div className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <div className="text-yellow-400">⚠️</div>
                          <div>
                            <div className="font-medium">No IR Device Configured</div>
                            <div className="text-sm opacity-80">
                              This input doesn't have a remote control device set up
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Show available IR devices for reference */}
                      {irDevices.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-sm font-medium text-white mb-2">Available IR Devices:</h4>
                          <div className="space-y-1">
                            {irDevices.filter(d => d.isActive).map(device => (
                              <div key={device.id} className="text-xs text-blue-200 bg-blue-500/10 px-2 py-1 rounded">
                                <span className="font-medium">{device.name}</span> 
                                <span className="opacity-75"> → Channel {device.inputChannel}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Contact management to configure IR control for this input
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* TV Layout */}
            <div className="lg:col-span-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 h-full">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center">
                    <MapPin className="mr-2 w-5 h-5" />
                    Bar TV Layout
                  </h2>
                  <div className="text-sm">
                    {tvLayout.zones.length > 0 && (
                      <span className="text-blue-300">
                        {tvLayout.zones.length} TVs configured
                      </span>
                    )}
                  </div>
                </div>
                
                {tvLayout.imageUrl ? (
                  <div className="relative w-full h-96 border-2 border-dashed border-gray-500/30 rounded-lg overflow-hidden bg-gray-800/50">
                    {(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-6">
                        <div className="bg-red-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                          <Tv className="w-8 h-8 text-red-400" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2 text-center">PDF Layout</h3>
                        <p className="text-center mb-4 text-sm">
                          Interactive TV zones are available below.
                        </p>
                        <a 
                          href={tvLayout.imageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                        >
                          📄 View PDF Layout
                        </a>
                      </div>
                    ) : (
                      <Image
                        src={tvLayout.imageUrl}
                        alt="Bar Layout"
                        fill
                        className="object-contain"
                      />
                    )}
                    
                    {/* TV Zone Overlays */}
                    {!(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') && tvLayout.zones.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => handleZoneClick(zone)}
                        className={`absolute border-2 rounded cursor-pointer transition-all ${
                          selectedInput 
                            ? 'border-blue-400 bg-blue-500/30 hover:bg-blue-500/50 hover:border-blue-300' 
                            : 'border-gray-500 bg-gray-500/20 cursor-not-allowed'
                        } ${isRouting ? 'animate-pulse' : ''}`}
                        style={{
                          left: `${zone.x}%`,
                          top: `${zone.y}%`,
                          width: `${zone.width}%`,
                          height: `${zone.height}%`
                        }}
                        title={`Output ${zone.outputNumber}: ${zone.label}${selectedInput ? ' - Click to route' : ''}`}
                      >
                        <div className="flex items-center justify-center h-full">
                          <div className="bg-white/90 px-2 py-1 rounded text-xs font-bold text-gray-800">
                            {zone.outputNumber}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-500/30 rounded-lg">
                    <div className="text-center text-gray-400">
                      <Tv className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <h4 className="text-lg font-medium mb-2">No Layout Configured</h4>
                      <p className="text-sm">
                        Contact management to upload a bar layout
                      </p>
                    </div>
                  </div>
                )}

                {/* TV Zone Grid for PDF layouts */}
                {(tvLayout.imageUrl?.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf' && tvLayout.zones.length > 0) && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-white mb-2">TV Zones:</h4>
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                      {tvLayout.zones.map((zone) => (
                        <div
                          key={zone.id}
                          onClick={() => handleZoneClick(zone)}
                          className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                            selectedInput 
                              ? 'border-blue-400 bg-blue-500/20 hover:bg-blue-500/40 text-blue-200' 
                              : 'border-gray-500 bg-gray-500/20 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <div className="font-medium">TV {zone.outputNumber}</div>
                          <div className="opacity-75">{zone.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {/* Audio Zones with Volume Sliders */}
            <div className="lg:col-span-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Sliders className="mr-2 w-5 h-5" />
                  Audio Zones
                </h2>
                <p className="text-sm text-blue-300 mb-4">
                  {selectedAudioInput 
                    ? 'Click on zone names to assign the selected input' 
                    : 'Select an audio input first, then click zone names to assign'
                  }
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {audioZones.map((zone) => {
                    const assignedInput = AUDIO_INPUTS.find(input => input.channelNumber === zone.currentInput)
                    
                    return (
                      <div key={zone.id} className="bg-white/5 rounded-lg p-3">
                        {/* Zone Assignment Area */}
                        <div 
                          className={`text-center p-2 rounded cursor-pointer transition-all mb-3 ${
                            selectedAudioInput 
                              ? 'bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400' 
                              : 'bg-gray-500/20 border border-gray-500/30'
                          }`}
                          onClick={() => selectedAudioInput && assignInputToZone(zone.id, selectedAudioInput)}
                          title={selectedAudioInput ? 'Click to assign input to this zone' : 'Select an input first'}
                        >
                          <div className="font-medium text-white text-sm">{zone.name}</div>
                          <div className="text-xs text-gray-300 mt-1">
                            {assignedInput ? `🎵 ${assignedInput.name}` : '⚪ No Input'}
                          </div>
                        </div>
                        
                        {/* Volume Slider */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-300">
                            <span>Volume</span>
                            <span>{zone.volume}%</span>
                          </div>
                          
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={zone.isMuted ? 0 : zone.volume}
                            onChange={(e) => updateZoneVolume(zone.id, parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                          />
                          
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleZoneMute(zone.id)}
                              className={`p-1 rounded text-xs transition-colors ${
                                zone.isMuted 
                                  ? 'bg-red-500/30 text-red-300 border border-red-500/50' 
                                  : 'bg-gray-500/30 text-gray-300 border border-gray-500/50 hover:bg-gray-500/50'
                              }`}
                            >
                              {zone.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Audio Input Selection - Right Side */}
            <div className="lg:col-span-1">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                  <Speaker className="mr-2 w-4 h-4" />
                  Audio Inputs
                </h2>
                
                <div className="space-y-2">
                  {AUDIO_INPUTS.map((input) => (
                    <button
                      key={input.id}
                      onClick={() => selectAudioInput(input.channelNumber)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedAudioInput === input.channelNumber
                          ? 'bg-purple-500 text-white shadow-lg'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getAudioInputIcon(input.type)}</span>
                        <div>
                          <div className="font-medium text-sm">{input.name}</div>
                          <div className="text-xs opacity-80">
                            Ch {input.channelNumber} • {input.type}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  
                  {selectedAudioInput && (
                    <button
                      onClick={() => {
                        setSelectedAudioInput(null)
                        setCommandStatus('')
                      }}
                      className="w-full mt-3 px-3 py-2 text-sm bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'power' && <CECPowerControl />}

        {activeTab === 'layout' && (
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Layout Upload Panel */}
              <div className="lg:col-span-1">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <FileImage className="mr-2 w-5 h-5" />
                    Floor Plan Upload
                  </h2>
                  
                  {/* Upload Section */}
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-blue-400/50 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleLayoutUpload}
                        disabled={isUploading}
                        className="hidden"
                        id="layout-upload"
                      />
                      <label
                        htmlFor="layout-upload"
                        className={`cursor-pointer flex flex-col items-center space-y-2 ${
                          isUploading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <Upload className="w-8 h-8 text-blue-400" />
                        <div className="text-white font-medium">
                          {isUploading ? 'Uploading...' : 'Upload Floor Plan'}
                        </div>
                        <div className="text-sm text-blue-200">
                          Supports images and PDFs up to 25MB
                        </div>
                      </label>
                    </div>

                    {/* Status Messages */}
                    {uploadStatus && (
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        uploadStatus.includes('❌') 
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}>
                        {uploadStatus}
                      </div>
                    )}

                    {analysisStatus && (
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
                        analysisStatus.includes('❌')
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : isAnalyzing
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}>
                        {analysisStatus}
                      </div>
                    )}
                  </div>

                  {/* Current Layout Info */}
                  {tvLayout.imageUrl && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <h4 className="font-medium text-white mb-2">Current Layout:</h4>
                      <div className="text-sm text-blue-200 space-y-1">
                        <div>📄 {tvLayout.name}</div>
                        <div>📺 {tvLayout.zones.length} TV zones configured</div>
                        {tvLayout.fileType === 'application/pdf' && (
                          <div>📋 PDF layout with AI analysis</div>
                        )}
                      </div>
                      <button
                        onClick={clearLayout}
                        className="mt-2 w-full px-3 py-2 text-sm bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-all flex items-center justify-center space-x-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Layout</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Analysis Results */}
                {aiAnalysis && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                      <Brain className="mr-2 w-4 h-4" />
                      AI Analysis Results
                    </h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-200">TVs Detected:</span>
                        <span className="text-white font-medium">{aiAnalysis.totalTVs}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-200">Zones Created:</span>
                        <span className="text-white font-medium">{aiAnalysis.suggestions?.length || 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-200">Auto-Mapping:</span>
                        <span className="text-green-300 font-medium">✅ Complete</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Layout Preview */}
              <div className="lg:col-span-2">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white flex items-center">
                      <MapPin className="mr-2 w-5 h-5" />
                      Layout Preview
                    </h2>
                    {tvLayout.zones.length > 0 && (
                      <div className="text-sm text-blue-300">
                        {tvLayout.zones.length} TV zones configured
                      </div>
                    )}
                  </div>

                  {tvLayout.imageUrl ? (
                    <div className="relative w-full h-96 border-2 border-dashed border-gray-500/30 rounded-lg overflow-hidden bg-gray-800/50">
                      {(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-6">
                          <div className="bg-blue-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                            <FileImage className="w-8 h-8 text-blue-400" />
                          </div>
                          <h3 className="text-lg font-semibold mb-2 text-center">PDF Layout Processed</h3>
                          <p className="text-center mb-4 text-sm">
                            AI has analyzed the PDF and placed TV zones automatically
                          </p>
                          <a 
                            href={tvLayout.originalFileUrl || tvLayout.imageUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-4 py-2 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
                          >
                            📄 View Original PDF
                          </a>
                        </div>
                      ) : (
                        <Image
                          src={tvLayout.imageUrl}
                          alt="Bar Layout"
                          fill
                          className="object-contain"
                        />
                      )}
                      
                      {/* TV Zone Overlays */}
                      {!(tvLayout.imageUrl.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf') && tvLayout.zones.map((zone) => (
                        <div
                          key={zone.id}
                          onClick={() => handleZoneClick(zone)}
                          className={`absolute border-2 rounded cursor-pointer transition-all ${
                            selectedInput 
                              ? 'border-blue-400 bg-blue-500/30 hover:bg-blue-500/50 hover:border-blue-300' 
                              : 'border-gray-500 bg-gray-500/20 cursor-not-allowed'
                          } ${isRouting ? 'animate-pulse' : ''}`}
                          style={{
                            left: `${zone.x}%`,
                            top: `${zone.y}%`,
                            width: `${zone.width}%`,
                            height: `${zone.height}%`
                          }}
                          title={`Output ${zone.outputNumber}: ${zone.label}${selectedInput ? ' - Click to route' : ''}`}
                        >
                          <div className="flex items-center justify-center h-full">
                            <div className="bg-white/90 px-2 py-1 rounded text-xs font-bold text-gray-800">
                              {zone.outputNumber}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-96 border-2 border-dashed border-gray-500/30 rounded-lg">
                      <div className="text-center text-gray-400">
                        <Upload className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <h4 className="text-lg font-medium mb-2">No Layout Uploaded</h4>
                        <p className="text-sm mb-4">
                          Upload a floor plan to get started with automatic TV zone placement
                        </p>
                        <div className="text-xs text-blue-200 bg-blue-500/10 px-3 py-2 rounded-lg inline-block">
                          💡 The AI will automatically detect and place TV zones for you
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TV Zone Grid for PDF layouts */}
                  {(tvLayout.imageUrl?.toLowerCase().endsWith('.pdf') && tvLayout.fileType === 'application/pdf' && tvLayout.zones.length > 0) && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-white mb-2">TV Zones (Click to route):</h4>
                      <div className="grid grid-cols-4 md:grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                        {tvLayout.zones.map((zone) => (
                          <div
                            key={zone.id}
                            onClick={() => handleZoneClick(zone)}
                            className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                              selectedInput 
                                ? 'border-blue-400 bg-blue-500/20 hover:bg-blue-500/40 text-blue-200' 
                                : 'border-gray-500 bg-gray-500/20 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            <div className="font-medium">TV {zone.outputNumber}</div>
                            <div className="opacity-75 truncate" title={zone.label}>{zone.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'guide' && (
          <div className="max-w-7xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              {/* Grid View Only - Channel Selection Grid */}
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl p-4 border border-blue-500/30">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-2">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Channel Guide Grid</h2>
                      <p className="text-blue-200 text-sm">Select an input first to view channel grid</p>
                    </div>
                  </div>
                </div>

                {/* Input Selection for Guide */}
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <h3 className="text-md font-semibold text-white mb-3">Select TV Input</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {inputs.map((input) => (
                      <button
                        key={input.id}
                        onClick={() => selectInput(input.channelNumber)}
                        className={`p-3 rounded-lg text-left transition-all ${
                          selectedInput === input.channelNumber
                            ? 'bg-blue-500 text-white shadow-lg'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getInputIcon(input.inputType)}</span>
                          <div>
                            <div className="font-medium text-sm">{input.label}</div>
                            <div className="text-xs opacity-80">Ch {input.channelNumber}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Channel Grid */}
                {selectedInput && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-semibold text-white">
                        Channel Grid - {inputs.find(i => i.channelNumber === selectedInput)?.label}
                      </h3>
                      <div className="text-sm text-blue-200">
                        Channel lineup for selected input
                      </div>
                    </div>
                    
                    {/* Sample Channel Grid */}
                    <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                      {Array.from({ length: 50 }, (_, i) => i + 1).map((channelNum) => (
                        <button
                          key={channelNum}
                          onClick={() => sendIRCommand(channelNum.toString())}
                          className="aspect-square bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg flex flex-col items-center justify-center text-white hover:text-blue-300 transition-colors"
                        >
                          <span className="font-bold text-sm">{channelNum}</span>
                          <span className="text-xs opacity-60">
                            {channelNum <= 10 ? 'HD' : channelNum <= 30 ? 'SD' : 'PPV'}
                          </span>
                        </button>
                      ))}
                    </div>
                    
                    <div className="mt-4 text-center">
                      <p className="text-sm text-blue-200">Click any channel number to tune directly</p>
                    </div>
                  </div>
                )}

                {/* No Input Selected */}
                {!selectedInput && (
                  <div className="text-center py-12">
                    <div className="bg-white/10 rounded-full p-4 w-16 h-16 mx-auto mb-4">
                      <Calendar className="w-8 h-8 text-blue-300 mx-auto" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Select an Input Source</h3>
                    <p className="text-blue-200">Choose a TV input above to view the channel grid</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-white/10">
        <div className="flex justify-around items-center py-2">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'video'
                ? 'bg-blue-500/30 text-blue-300'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span className="text-xs font-medium">Video</span>
          </button>
          
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'audio'
                ? 'bg-purple-500/30 text-purple-300'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span className="text-xs font-medium">Audio</span>
          </button>
          
          <button
            onClick={() => setActiveTab('layout')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'layout'
                ? 'bg-orange-500/30 text-orange-300'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span className="text-xs font-medium">Layout</span>
          </button>
          
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'guide'
                ? 'bg-green-500/30 text-green-300'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Guide</span>
          </button>
          
          <button
            onClick={() => setActiveTab('power')}
            className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all ${
              activeTab === 'power'
                ? 'bg-red-500/30 text-red-300'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Power className="w-4 h-4" />
            <span className="text-xs font-medium">Power</span>
          </button>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { 
  Tv, 
  Radio, 
  Volume2, 
  VolumeX, 
  Power, 
  ChevronUp, 
  ChevronDown, 
  Settings,
  Plus,
  Edit3,
  Trash2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Square
} from 'lucide-react'

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

interface IRCommand {
  function: string
  display: string
  icon?: string
  category: 'power' | 'channel' | 'volume' | 'navigation' | 'playback' | 'custom'
}

const COMMON_COMMANDS: IRCommand[] = [
  { function: 'POWER', display: 'Power', icon: 'power', category: 'power' },
  { function: 'POWER_ON', display: 'Power On', icon: 'power', category: 'power' },
  { function: 'POWER_OFF', display: 'Power Off', icon: 'power', category: 'power' },
  
  { function: 'CH_UP', display: 'CH+', icon: 'chevron-up', category: 'channel' },
  { function: 'CH_DOWN', display: 'CH-', icon: 'chevron-down', category: 'channel' },
  { function: '1', display: '1', category: 'channel' },
  { function: '2', display: '2', category: 'channel' },
  { function: '3', display: '3', category: 'channel' },
  { function: '4', display: '4', category: 'channel' },
  { function: '5', display: '5', category: 'channel' },
  { function: '6', display: '6', category: 'channel' },
  { function: '7', display: '7', category: 'channel' },
  { function: '8', display: '8', category: 'channel' },
  { function: '9', display: '9', category: 'channel' },
  { function: '0', display: '0', category: 'channel' },
  { function: 'ENTER', display: 'Enter', category: 'channel' },
  { function: 'LAST', display: 'Last', category: 'channel' },
  
  { function: 'VOL_UP', display: 'Vol+', icon: 'volume2', category: 'volume' },
  { function: 'VOL_DOWN', display: 'Vol-', icon: 'volume2', category: 'volume' },
  { function: 'MUTE', display: 'Mute', icon: 'volume-x', category: 'volume' },
  
  { function: 'UP', display: '↑', category: 'navigation' },
  { function: 'DOWN', display: '↓', category: 'navigation' },
  { function: 'LEFT', display: '←', category: 'navigation' },
  { function: 'RIGHT', display: '→', category: 'navigation' },
  { function: 'OK', display: 'OK', category: 'navigation' },
  { function: 'MENU', display: 'Menu', category: 'navigation' },
  { function: 'EXIT', display: 'Exit', category: 'navigation' },
  { function: 'GUIDE', display: 'Guide', category: 'navigation' },
  { function: 'INFO', display: 'Info', category: 'navigation' },
  
  { function: 'PLAY', display: 'Play', icon: 'play', category: 'playback' },
  { function: 'PAUSE', display: 'Pause', icon: 'pause', category: 'playback' },
  { function: 'STOP', display: 'Stop', icon: 'square', category: 'playback' },
  { function: 'REWIND', display: 'Rewind', icon: 'skip-back', category: 'playback' },
  { function: 'FAST_FORWARD', display: 'FF', icon: 'skip-forward', category: 'playback' },
  { function: 'RECORD', display: 'Record', category: 'playback' }
]

// Devices that support IP control
const IP_CONTROL_DEVICES = {
  'DirecTV': ['Genie HD DVR', 'Genie Mini', 'HR Series DVR'],
  'Apple TV': ['Apple TV 4K', 'Apple TV HD'],
  'Amazon Fire TV': ['Fire TV Stick', 'Fire TV Cube', 'Fire TV'],
  'Google Chromecast': ['Chromecast with Google TV', 'Chromecast Ultra'],
  'Roku': ['Roku Ultra', 'Roku Streaming Stick', 'Roku Express'],
  'NVIDIA Shield': ['Shield TV', 'Shield TV Pro'],
  'Samsung': ['Smart TV', 'Frame TV', 'QLED TV'],
  'LG': ['WebOS TV', 'OLED TV', 'NanoCell TV'],
  'Sony': ['Bravia TV', 'Android TV']
}

// Devices that typically require IR/Global Cache control
const IR_ONLY_DEVICES = {
  'Comcast': ['X1 Cable Box', 'XG1v3', 'Xi6'],
  'Cox': ['Contour Cable Box', 'Mini Box'],
  'Charter Spectrum': ['HD Cable Box', 'HD DVR', 'Legacy Cable Box', 'Digital Transport Adapter'],
  
  // Comprehensive Spectrum Cable Box Manufacturers
  'Samsung': ['SMT-C5320 (Spectrum HD)', 'SMT-H3272 (Spectrum DVR)', 'SMT-H4362 (Spectrum DVR)', 'SMT-I3105 (Spectrum)', 'SMT-I5150 (Spectrum HD)'],
  'Cisco': ['DTA271HD (Spectrum)', 'DTA170HD (Spectrum)', 'Explorer 4250HDC (Spectrum DVR)', 'Explorer 8300HDC (Spectrum DVR)', 'Explorer 3250HD (Spectrum HD)'],
  'Arris': ['DCT3416 (Spectrum DVR)', 'DCT6200 (Spectrum HD)', 'DCT6412 (Spectrum DVR)', 'DCX3200 (Spectrum HD)', 'DCX3400 (Spectrum DVR)', 'DX013ANM (Spectrum)'],
  'Motorola': ['DCH70 (Spectrum HD)', 'DCT3416 (Spectrum DVR)', 'DCT6200 (Spectrum HD)', 'DCT6412 (Spectrum DVR)'],
  'Pace': ['DC758D (Spectrum)', 'TDC575D (Spectrum HD)', 'TDC777D (Spectrum DVR)', 'MX011ANM (Spectrum)'],
  
  'Verizon FiOS': ['Set-top Box', 'DVR'],
  'AT&T U-verse': ['Receiver', 'DVR'],
  'DISH Network': ['Hopper', 'Joey', 'Wally'],
  'Generic Cable': ['Cable Box', 'Set-top Box'],
  'DVD/Blu-ray': ['DVD Player', 'Blu-ray Player'],
  'Audio Equipment': ['Receiver', 'Amplifier', 'Soundbar']
}

const DEVICE_BRANDS = [
  ...Object.keys(IP_CONTROL_DEVICES),
  ...Object.keys(IR_ONLY_DEVICES)
]

const getDeviceModels = (brand: string): string[] => {
  return IP_CONTROL_DEVICES[brand as keyof typeof IP_CONTROL_DEVICES] || 
         IR_ONLY_DEVICES[brand as keyof typeof IR_ONLY_DEVICES] || 
         []
}

const getRecommendedControlMethod = (brand: string): 'IP' | 'GlobalCache' => {
  return IP_CONTROL_DEVICES[brand as keyof typeof IP_CONTROL_DEVICES] ? 'IP' : 'GlobalCache'
}

// Default ports for IP control
const DEFAULT_IP_PORTS = {
  'DirecTV': 8080,
  'Apple TV': 3689,
  'Amazon Fire TV': 55443,
  'Roku': 8060,
  'Samsung': 8001,
  'LG': 3000,
  'Sony': 80
}

export default function IRDeviceControl() {
  const [devices, setDevices] = useState<IRDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<IRDevice | null>(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [newDevice, setNewDevice] = useState<Partial<IRDevice>>({
    name: '',
    brand: '',
    deviceType: '',
    inputChannel: 1,
    controlMethod: 'GlobalCache',
    deviceIpAddress: '',
    ipControlPort: 8080,
    iTachAddress: '192.168.1.100',
    iTachPort: 1
  })
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const [availableCodesets, setAvailableCodesets] = useState<any[]>([])
  const [isLearningMode, setIsLearningMode] = useState(false)
  const [quickChannel, setQuickChannel] = useState('')

  useEffect(() => {
    loadDevices()
    checkITachConnection()
  }, [])

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/ir-devices')
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
        if (data.devices?.length > 0) {
          setSelectedDevice(data.devices[0])
        }
      }
    } catch (error) {
      console.error('Failed to load devices:', error)
    }
  }

  const checkITachConnection = async () => {
    try {
      const response = await fetch('/api/ir-devices/test-connection')
      if (response.ok) {
        const data = await response.json()
        setConnectionStatus(data.connected ? 'connected' : 'disconnected')
      }
    } catch (error) {
      console.error('Failed to check iTach connection:', error)
    }
  }

  const searchCodesets = async (brand: string, deviceType: string) => {
    try {
      const response = await fetch(`/api/ir-devices/search-codes?brand=${brand}&type=${deviceType}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableCodesets(data.codesets || [])
        
        // Log search results for debugging
        console.log(`Found ${data.codesets?.length || 0} codesets for ${brand} ${deviceType}`)
        if (data.globalCacheApiUsed) {
          console.log('Using Global Cache IR Database API')
        }
      }
    } catch (error) {
      console.error('Failed to search codesets:', error)
    }
  }

  const searchAllSpectrumModels = async () => {
    try {
      const response = await fetch('/api/ir-devices/search-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'searchAllSpectrum' })
      })
      
      if (response.ok) {
        const data = await response.json()
        setAvailableCodesets(data.models || [])
        console.log(`Found ${data.totalModels} Spectrum cable box models across all manufacturers`)
      }
    } catch (error) {
      console.error('Failed to search all Spectrum models:', error)
    }
  }

  const addDevice = async () => {
    if (!newDevice.name || !newDevice.brand || !newDevice.deviceType || !newDevice.controlMethod) {
      alert('Please fill in all required fields')
      return
    }

    // Validate based on control method
    if (newDevice.controlMethod === 'IP' && !newDevice.deviceIpAddress) {
      alert('Please enter the device IP address')
      return
    }
    
    if (newDevice.controlMethod === 'GlobalCache' && !newDevice.iTachAddress) {
      alert('Please enter the iTach IP address')
      return
    }

    try {
      const response = await fetch('/api/ir-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDevice,
          id: `device_${Date.now()}`,
          isActive: true
        })
      })

      if (response.ok) {
        await loadDevices()
        setShowAddDevice(false)
        setNewDevice({
          name: '',
          brand: '',
          deviceType: '',
          inputChannel: 1,
          controlMethod: 'GlobalCache',
          deviceIpAddress: '',
          ipControlPort: 8080,
          iTachAddress: '192.168.1.100',
          iTachPort: 1
        })
      }
    } catch (error) {
      console.error('Failed to add device:', error)
      alert('Failed to add device')
    }
  }

  const deleteDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId)
    if (!device) return

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${device.name}"?\n\nThis action cannot be undone.`
    )
    
    if (!confirmDelete) return

    try {
      const response = await fetch(`/api/ir-devices?id=${deviceId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // If the deleted device was selected, clear selection
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(null)
        }
        await loadDevices()
        alert(`"${device.name}" has been deleted successfully.`)
      } else {
        const error = await response.json()
        alert(`Failed to delete device: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to delete device:', error)
      alert('Failed to delete device')
    }
  }

  const sendIRCommand = async (command: string) => {
    if (!selectedDevice) {
      alert('Please select a device first')
      return
    }

    try {
      const endpoint = selectedDevice.controlMethod === 'IP' 
        ? '/api/ir-devices/send-ip-command'
        : '/api/ir-devices/send-command'

      const requestBody = selectedDevice.controlMethod === 'IP' 
        ? {
            deviceId: selectedDevice.id,
            command,
            deviceIpAddress: selectedDevice.deviceIpAddress,
            ipControlPort: selectedDevice.ipControlPort,
            brand: selectedDevice.brand
          }
        : {
            deviceId: selectedDevice.id,
            command,
            iTachAddress: selectedDevice.iTachAddress,
            iTachPort: selectedDevice.iTachPort
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Command sent:', data.message)
      } else {
        const error = await response.json()
        alert(`Failed to send command: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to send command:', error)
      alert('Failed to send command')
    }
  }

  const sendQuickChannel = () => {
    if (quickChannel) {
      // Send each digit with a delay
      const digits = quickChannel.split('')
      digits.forEach((digit, index) => {
        setTimeout(() => {
          sendIRCommand(digit)
          if (index === digits.length - 1) {
            // Send ENTER after the last digit
            setTimeout(() => sendIRCommand('ENTER'), 200)
          }
        }, index * 200)
      })
      setQuickChannel('')
    }
  }

  const toggleLearningMode = async () => {
    try {
      const endpoint = isLearningMode ? '/api/ir-devices/stop-learning' : '/api/ir-devices/start-learning'
      const response = await fetch(endpoint, { method: 'POST' })
      
      if (response.ok) {
        setIsLearningMode(!isLearningMode)
      }
    } catch (error) {
      console.error('Failed to toggle learning mode:', error)
    }
  }

  const renderCommandButton = (command: IRCommand) => {
    const getIcon = () => {
      switch (command.icon) {
        case 'power': return <Power className="w-4 h-4" />
        case 'chevron-up': return <ChevronUp className="w-4 h-4" />
        case 'chevron-down': return <ChevronDown className="w-4 h-4" />
        case 'volume2': return <Volume2 className="w-4 h-4" />
        case 'volume-x': return <VolumeX className="w-4 h-4" />
        case 'play': return <Play className="w-4 h-4" />
        case 'pause': return <Pause className="w-4 h-4" />
        case 'square': return <Square className="w-4 h-4" />
        case 'skip-back': return <SkipBack className="w-4 h-4" />
        case 'skip-forward': return <SkipForward className="w-4 h-4" />
        default: return null
      }
    }

    return (
      <button
        key={command.function}
        onClick={() => sendIRCommand(command.function)}
        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-3 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 min-w-[60px] min-h-[45px]"
      >
        {getIcon()}
        <span className="text-sm">{command.display}</span>
      </button>
    )
  }

  const renderCommandCategory = (category: string, commands: IRCommand[]) => {
    return (
      <div key={category} className="mb-6">
        <h4 className="text-sm font-medium text-slate-200 mb-3 capitalize">{category}</h4>
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {commands.map(renderCommandButton)}
        </div>
      </div>
    )
  }

  const groupedCommands = COMMON_COMMANDS.reduce((acc, command) => {
    if (!acc[command.category]) acc[command.category] = []
    acc[command.category].push(command)
    return acc
  }, {} as Record<string, IRCommand[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
          <Radio className="w-6 h-6 text-blue-600" />
          <span>IR Device Control</span>
        </h2>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span>iTach {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Learning Mode Toggle */}
          <button
            onClick={toggleLearningMode}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isLearningMode 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                : 'bg-slate-800 or bg-slate-900 text-slate-200 hover:bg-gray-300'
            }`}
          >
            {isLearningMode ? 'Stop Learning' : 'Learn IR'}
          </button>

          {/* Add Device Button */}
          <button
            onClick={() => setShowAddDevice(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Device Selection */}
      <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg shadow-sm border">
        <h3 className="text-lg font-medium text-slate-100 mb-3">Select Device</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {devices.map((device) => (
            <button
              key={device.id}
              onClick={() => setSelectedDevice(device)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                selectedDevice?.id === device.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-700 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <Tv className="w-5 h-5 text-gray-600" />
                <div className="flex space-x-1">
                  <span className={`text-xs px-2 py-1 rounded ${
                    device.controlMethod === 'IP' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {device.controlMethod === 'IP' ? 'IP' : 'IR'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    device.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-800 or bg-slate-900 text-gray-600'
                  }`}>
                    Ch {device.inputChannel}
                  </span>
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteDevice(device.id)
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                    title="Delete device"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <h4 className="font-medium text-slate-100 mt-2">{device.name}</h4>
              <p className="text-sm text-slate-300">{device.brand} {device.deviceType}</p>
              <p className="text-xs text-slate-400 mt-1">
                {device.controlMethod === 'IP' 
                  ? `IP: ${device.deviceIpAddress}:${device.ipControlPort || 'auto'}`
                  : `iTach: ${device.iTachAddress}:${device.iTachPort || 1}`
                }
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Channel Change */}
      {selectedDevice && (
        <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-slate-100 mb-3">Quick Channel</h3>
          <div className="flex items-center space-x-3">
            <input
              type="text"
              placeholder="Enter channel number"
              value={quickChannel}
              onChange={(e) => setQuickChannel(e.target.value.replace(/\D/g, ''))}
              className="flex-1 px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && sendQuickChannel()}
            />
            <button
              onClick={sendQuickChannel}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Go to Channel
            </button>
          </div>
        </div>
      )}

      {/* IR Commands */}
      {selectedDevice && (
        <div className="bg-slate-800 or bg-slate-900 p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-slate-100 mb-4">
            Control: {selectedDevice.name}
          </h3>
          
          {Object.entries(groupedCommands).map(([category, commands]) =>
            renderCommandCategory(category, commands)
          )}
        </div>
      )}

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 or bg-slate-900 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Add New IR Device</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g., Main DirecTV Box"
                  value={newDevice.name || ''}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Brand</label>
                <select
                  value={newDevice.brand || ''}
                  onChange={(e) => {
                    const selectedBrand = e.target.value
                    const recommendedMethod = getRecommendedControlMethod(selectedBrand)
                    const defaultPort = DEFAULT_IP_PORTS[selectedBrand as keyof typeof DEFAULT_IP_PORTS] || 8080
                    
                    setNewDevice({ 
                      ...newDevice, 
                      brand: selectedBrand,
                      controlMethod: recommendedMethod,
                      deviceType: '', // Reset device type when brand changes
                      ipControlPort: defaultPort
                    })
                    
                    if (selectedBrand && newDevice.deviceType) {
                      searchCodesets(selectedBrand, newDevice.deviceType)
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Brand</option>
                  {DEVICE_BRANDS.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Device Model</label>
                <select
                  value={newDevice.deviceType || ''}
                  onChange={(e) => {
                    setNewDevice({ ...newDevice, deviceType: e.target.value })
                    if (newDevice.brand && e.target.value) {
                      searchCodesets(newDevice.brand, e.target.value)
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!newDevice.brand}
                >
                  <option value="">Select Model</option>
                  {newDevice.brand && getDeviceModels(newDevice.brand).map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Control Method</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="controlMethod"
                      value="IP"
                      checked={newDevice.controlMethod === 'IP'}
                      onChange={(e) => setNewDevice({ ...newDevice, controlMethod: e.target.value as 'IP' | 'GlobalCache' })}
                      className="mr-2"
                    />
                    <span className="text-sm">IP Control</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="controlMethod"
                      value="GlobalCache"
                      checked={newDevice.controlMethod === 'GlobalCache'}
                      onChange={(e) => setNewDevice({ ...newDevice, controlMethod: e.target.value as 'IP' | 'GlobalCache' })}
                      className="mr-2"
                    />
                    <span className="text-sm">Global Cache (IR)</span>
                  </label>
                </div>
                {newDevice.brand && (
                  <p className="text-xs text-blue-600 mt-1">
                    Recommended: {getRecommendedControlMethod(newDevice.brand)} Control
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Input Channel</label>
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={newDevice.inputChannel || 1}
                  onChange={(e) => setNewDevice({ ...newDevice, inputChannel: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* IP Control Settings */}
              {newDevice.controlMethod === 'IP' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Device IP Address *</label>
                    <input
                      type="text"
                      placeholder="192.168.1.150"
                      value={newDevice.deviceIpAddress || ''}
                      onChange={(e) => setNewDevice({ ...newDevice, deviceIpAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">IP address of the device you want to control</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">Control Port</label>
                    <input
                      type="number"
                      placeholder="8080"
                      value={newDevice.ipControlPort || ''}
                      onChange={(e) => setNewDevice({ ...newDevice, ipControlPort: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">Port for IP control (auto-detected if left empty)</p>
                  </div>
                </>
              )}

              {/* Global Cache Settings */}
              {newDevice.controlMethod === 'GlobalCache' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">iTach IP Address *</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100"
                      value={newDevice.iTachAddress || ''}
                      onChange={(e) => setNewDevice({ ...newDevice, iTachAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">IP address of your Global Cache iTach device</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-1">iTach Port</label>
                    <select
                      value={newDevice.iTachPort || 1}
                      onChange={(e) => setNewDevice({ ...newDevice, iTachPort: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>Port 1</option>
                      <option value={2}>Port 2</option>
                      <option value={3}>Port 3</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Which port on the iTach device is connected to this device</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAddDevice(false)}
                className="flex-1 bg-slate-800 or bg-slate-900 text-slate-100 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addDevice}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                Add Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

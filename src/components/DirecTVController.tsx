
'use client'

import { useState, useEffect } from 'react'
import { 
  Tv, 
  Satellite,
  Power, 
  VolumeX,
  Volume2,
  ChevronUp, 
  ChevronDown,
  Settings,
  Wifi,
  WifiOff,
  Calendar,
  Clock,
  Star,
  ExternalLink,
  Filter,
  Search,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  CirclePlay,
  List,
  Trophy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Edit,
  Trash2,
  X,
  Package,
  BarChart3
} from 'lucide-react'
import DeviceSubscriptionPanel from './DeviceSubscriptionPanel'

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  isOnline: boolean
  receiverType: 'Genie HD DVR' | 'Genie Mini' | 'HR Series DVR' | 'C61K Mini' | 'HS17 Server' | 'H24/H25 HD' | 'h24/100'
  inputChannel?: number  // Associated matrix input channel
  lastResponse?: string
  softwareVersion?: string
  serialNumber?: string
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  status: string
  isActive: boolean
}

interface SportsFavorite {
  channel: string
  channelNumber: string
  name: string
  category: 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'College' | 'Other'
}

const SPORTS_FAVORITES: SportsFavorite[] = [
  { channel: '212', channelNumber: '212', name: 'NFL RedZone', category: 'NFL' },
  { channel: '213', channelNumber: '213', name: 'NFL Network', category: 'NFL' },
  { channel: '206', channelNumber: '206', name: 'ESPN', category: 'Other' },
  { channel: '207', channelNumber: '207', name: 'ESPN2', category: 'Other' },
  { channel: '208', channelNumber: '208', name: 'ESPNU', category: 'College' },
  { channel: '209', channelNumber: '209', name: 'ESPNEWS', category: 'Other' },
  { channel: '220', channelNumber: '220', name: 'Fox Sports 1', category: 'Other' },
  { channel: '221', channelNumber: '221', name: 'Fox Sports 2', category: 'Other' },
  { channel: '215', channelNumber: '215', name: 'NBA TV', category: 'NBA' },
  { channel: '217', channelNumber: '217', name: 'MLB Network', category: 'MLB' },
  { channel: '219', channelNumber: '219', name: 'NHL Network', category: 'NHL' },
  { channel: '611', channelNumber: '611', name: 'TNT', category: 'Other' },
  { channel: '620', channelNumber: '620', name: 'TBS', category: 'Other' },
]

const ENHANCED_DIRECTV_COMMANDS = {
  // Power Commands
  'POWER': 'KEY_POWER',
  'POWER_ON': 'KEY_POWERON',
  'POWER_OFF': 'KEY_POWEROFF',
  
  // Navigation
  'UP': 'KEY_UP',
  'DOWN': 'KEY_DOWN',
  'LEFT': 'KEY_LEFT',
  'RIGHT': 'KEY_RIGHT',
  'OK': 'KEY_SELECT',
  'BACK': 'KEY_BACK',
  'EXIT': 'KEY_EXIT',
  
  // Channel Control
  'CH_UP': 'KEY_CHANUP',
  'CH_DOWN': 'KEY_CHANDOWN',
  'LAST': 'KEY_PREV',
  'ENTER': 'KEY_ENTER',
  
  // Volume Control
  'VOL_UP': 'KEY_VOLUMEUP',
  'VOL_DOWN': 'KEY_VOLUMEDOWN',
  'MUTE': 'KEY_MUTE',
  
  // Guide & Menu
  'GUIDE': 'KEY_GUIDE',
  'MENU': 'KEY_MENU',
  'INFO': 'KEY_INFO',
  'LIST': 'KEY_LIST',
  
  // Numbers
  '0': 'KEY_0', '1': 'KEY_1', '2': 'KEY_2', '3': 'KEY_3', '4': 'KEY_4',
  '5': 'KEY_5', '6': 'KEY_6', '7': 'KEY_7', '8': 'KEY_8', '9': 'KEY_9',
  
  // DVR Controls
  'PLAY': 'KEY_PLAY',
  'PAUSE': 'KEY_PAUSE',
  'STOP': 'KEY_STOP',
  'REWIND': 'KEY_REWIND',
  'FAST_FORWARD': 'KEY_FASTFORWARD',
  'RECORD': 'KEY_RECORD',
  'SKIP_BACK': 'KEY_REPLAY',
  'SKIP_FORWARD': 'KEY_ADVANCE',
  
  // DirecTV Specific
  'ACTIVE': 'KEY_ACTIVE',
  'FORMAT': 'KEY_FORMAT',
  'YELLOW': 'KEY_YELLOW',
  'BLUE': 'KEY_BLUE',
  'RED': 'KEY_RED',
  'GREEN': 'KEY_GREEN',
  'DASH': 'KEY_DASH'
}

export default function DirecTVController() {
  const [devices, setDevices] = useState<DirecTVDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DirecTVDevice | null>(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showEditDevice, setShowEditDevice] = useState(false)
  const [showDeleteDevice, setShowDeleteDevice] = useState(false)
  const [editingDevice, setEditingDevice] = useState<DirecTVDevice | null>(null)
  const [deletingDevice, setDeletingDevice] = useState<DirecTVDevice | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('disconnected')
  const [quickChannel, setQuickChannel] = useState('')
  const [showSportsFavorites, setShowSportsFavorites] = useState(false)
  const [selectedSportsCategory, setSelectedSportsCategory] = useState<string>('All')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [matrixInputs, setMatrixInputs] = useState<MatrixInput[]>([])
  const [loadingInputs, setLoadingInputs] = useState(false)
  const [newDevice, setNewDevice] = useState({
    name: '',
    ipAddress: '',
    port: 8080,
    receiverType: 'Genie HD DVR' as const,
    inputChannel: undefined as number | undefined
  })
  const [editDevice, setEditDevice] = useState({
    name: '',
    ipAddress: '',
    port: 8080,
    receiverType: 'Genie HD DVR' as DirecTVDevice['receiverType'],
    inputChannel: undefined as number | undefined
  })
  const [showSubscriptions, setShowSubscriptions] = useState(false)
  const [subscriptionDeviceId, setSubscriptionDeviceId] = useState<string | null>(null)

  useEffect(() => {
    loadDirecTVDevices()
  }, [])

  const loadDirecTVDevices = async () => {
    try {
      const response = await fetch('/api/directv-devices')
      if (response.ok) {
        const data = await response.json()
        setDevices(data.devices || [])
        if (data.devices?.length > 0) {
          setSelectedDevice(data.devices[0])
        }
      }
    } catch (error) {
      console.error('Failed to load DirecTV devices:', error)
    }
  }

  const loadMatrixInputs = async () => {
    setLoadingInputs(true)
    try {
      const response = await fetch('/api/matrix/config')
      if (response.ok) {
        const data = await response.json()
        setMatrixInputs(data.inputs || [])
      }
    } catch (error) {
      console.error('Failed to load matrix inputs:', error)
    } finally {
      setLoadingInputs(false)
    }
  }

  const testDirecTVConnection = async (device?: DirecTVDevice) => {
    const targetDevice = device || selectedDevice
    if (!targetDevice) return false

    setIsTestingConnection(true)
    setConnectionStatus('testing')

    try {
      const response = await fetch('/api/directv-devices/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress: targetDevice.ipAddress,
          port: targetDevice.port
        })
      })

      const data = await response.json()
      const isConnected = response.ok && data.connected

      setConnectionStatus(isConnected ? 'connected' : 'disconnected')
      
      if (isConnected && data.deviceInfo) {
        // Update device with info from receiver
        const updatedDevices = devices.map(d => 
          d.id === targetDevice.id 
            ? { ...d, isOnline: true, lastResponse: data.deviceInfo.model, softwareVersion: data.deviceInfo.version }
            : d
        )
        setDevices(updatedDevices)
      }

      return isConnected
    } catch (error) {
      console.error('Connection test failed:', error)
      setConnectionStatus('disconnected')
      return false
    } finally {
      setIsTestingConnection(false)
    }
  }

  const sendDirecTVCommand = async (command: string) => {
    if (!selectedDevice) {
      alert('Please select a DirecTV device first')
      return
    }

    try {
      const response = await fetch('/api/directv-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDevice.id,
          command,
          ipAddress: selectedDevice.ipAddress,
          port: selectedDevice.port
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('DirecTV command sent:', data.message)
        
        // Update connection status based on response
        if (data.success) {
          setConnectionStatus('connected')
        }
      } else {
        const error = await response.json()
        alert(`Failed to send command: ${error.message}`)
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          setConnectionStatus('disconnected')
        }
      }
    } catch (error) {
      console.error('Failed to send DirecTV command:', error)
      alert('Failed to send command')
      setConnectionStatus('disconnected')
    }
  }

  const changeToChannel = (channelNumber: string) => {
    if (!channelNumber) return

    // Send each digit with a delay
    const digits = channelNumber.split('')
    digits.forEach((digit, index) => {
      setTimeout(() => {
        sendDirecTVCommand(digit)
        if (index === digits.length - 1) {
          // Send ENTER after the last digit
          setTimeout(() => sendDirecTVCommand('ENTER'), 300)
        }
      }, index * 250)
    })
  }

  const sendQuickChannel = () => {
    if (quickChannel) {
      changeToChannel(quickChannel)
      setQuickChannel('')
    }
  }

  const addDirecTVDevice = async () => {
    if (!newDevice.name || !newDevice.ipAddress) {
      alert('Please fill in device name and IP address')
      return
    }

    if (!newDevice.inputChannel) {
      alert('Please select which matrix input this DirecTV box is connected to')
      return
    }

    const device: DirecTVDevice = {
      id: `directv_${Date.now()}`,
      name: newDevice.name,
      ipAddress: newDevice.ipAddress,
      port: newDevice.port,
      receiverType: newDevice.receiverType,
      inputChannel: newDevice.inputChannel,
      isOnline: false
    }

    try {
      // Test connection first
      const isConnected = await testDirecTVConnection(device)
      device.isOnline = isConnected

      const response = await fetch('/api/directv-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(device)
      })

      if (response.ok) {
        await loadDirecTVDevices()
        setShowAddDevice(false)
        setNewDevice({ name: '', ipAddress: '', port: 8080, receiverType: 'Genie HD DVR', inputChannel: undefined })
      }
    } catch (error) {
      console.error('Failed to add DirecTV device:', error)
      alert('Failed to add device')
    }
  }

  const openEditDevice = (device: DirecTVDevice) => {
    setEditingDevice(device)
    setEditDevice({
      name: device.name,
      ipAddress: device.ipAddress,
      port: device.port,
      receiverType: device.receiverType,
      inputChannel: device.inputChannel
    })
    setShowEditDevice(true)
    loadMatrixInputs()
  }

  const updateDirecTVDevice = async () => {
    if (!editingDevice) return

    if (!editDevice.name || !editDevice.ipAddress) {
      alert('Please fill in device name and IP address')
      return
    }

    if (!editDevice.inputChannel) {
      alert('Please select which matrix input this DirecTV box is connected to')
      return
    }

    const updatedDevice = {
      ...editingDevice,
      name: editDevice.name,
      ipAddress: editDevice.ipAddress,
      port: editDevice.port,
      receiverType: editDevice.receiverType,
      inputChannel: editDevice.inputChannel,
      isOnline: false // Reset connection status, will be tested
    }

    try {
      // Test connection with updated info
      const isConnected = await testDirecTVConnection(updatedDevice)
      updatedDevice.isOnline = isConnected

      const response = await fetch('/api/directv-devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDevice)
      })

      if (response.ok) {
        await loadDirecTVDevices()
        setShowEditDevice(false)
        setEditingDevice(null)
        setEditDevice({ name: '', ipAddress: '', port: 8080, receiverType: 'Genie HD DVR', inputChannel: undefined })
        
        // Update selected device if it's the one being edited
        if (selectedDevice?.id === editingDevice.id) {
          setSelectedDevice(updatedDevice)
        }
      } else {
        const error = await response.json()
        alert(`Failed to update device: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to update DirecTV device:', error)
      alert('Failed to update device')
    }
  }

  const openDeleteDevice = (device: DirecTVDevice) => {
    setDeletingDevice(device)
    setShowDeleteDevice(true)
  }

  const deleteDirecTVDevice = async () => {
    if (!deletingDevice) return

    try {
      const response = await fetch(`/api/directv-devices?id=${deletingDevice.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadDirecTVDevices()
        setShowDeleteDevice(false)
        setDeletingDevice(null)
        
        // Clear selected device if it's the one being deleted
        if (selectedDevice?.id === deletingDevice.id) {
          setSelectedDevice(null)
        }
      } else {
        const error = await response.json()
        alert(`Failed to delete device: ${error.message}`)
      }
    } catch (error) {
      console.error('Failed to delete DirecTV device:', error)
      alert('Failed to delete device')
    }
  }

  const openSubscriptionPanel = (device: DirecTVDevice) => {
    setSubscriptionDeviceId(device.id)
    setShowSubscriptions(true)
  }

  const filteredSportsFavorites = selectedSportsCategory === 'All' 
    ? SPORTS_FAVORITES 
    : SPORTS_FAVORITES.filter(fav => fav.category === selectedSportsCategory)

  const sportsCategories = ['All', ...Array.from(new Set(SPORTS_FAVORITES.map(fav => fav.category)))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
          <Satellite className="w-6 h-6 text-blue-600" />
          <span>DirecTV IP Control</span>
        </h2>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-800' 
              : connectionStatus === 'testing'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {connectionStatus === 'testing' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`} />
            )}
            <span>
              {connectionStatus === 'testing' ? 'Testing...' : 
               connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Test Connection Button */}
          <button
            onClick={() => testDirecTVConnection()}
            disabled={!selectedDevice || isTestingConnection}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
          >
            Test Connection
          </button>

          {/* Add Device Button */}
          <button
            onClick={() => {
              setShowAddDevice(true)
              loadMatrixInputs()
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            <Satellite className="w-4 h-4" />
            <span>Add DirecTV</span>
          </button>
        </div>
      </div>

      {/* Device Selection */}
      <div className="card p-4">
        <h3 className="text-lg font-medium text-slate-100 mb-3">DirecTV Receivers</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {devices.map((device) => (
            <div key={device.id} className="relative group">
              <button
                onClick={() => setSelectedDevice(device)}
                className={`w-full p-3 rounded-lg border-2 transition-all duration-200 text-left ${
                  selectedDevice?.id === device.id
                    ? 'border-blue-500 bg-blue-900/40'
                    : 'border-slate-700 hover:border-blue-500 bg-slate-800/50 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Satellite className="w-5 h-5 text-blue-400" />
                  <div className="flex space-x-1">
                    {device.isOnline ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
                <h4 className="font-medium text-slate-100 mt-2">{device.name}</h4>
                <p className="text-sm text-slate-300">{device.receiverType}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {device.ipAddress}:{device.port}
                </p>
                {device.inputChannel && (
                  <p className="text-xs text-blue-600 font-medium">Input: {device.inputChannel}</p>
                )}
                {device.softwareVersion && (
                  <p className="text-xs text-slate-500">v{device.softwareVersion}</p>
                )}
              </button>
              
              {/* Action buttons */}
              <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openSubscriptionPanel(device)
                  }}
                  className="p-1 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition-colors shadow-lg"
                  title="View Subscriptions"
                >
                  <Package className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openEditDevice(device)
                  }}
                  className="p-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors shadow-lg"
                  title="Edit device"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    openDeleteDevice(device)
                  }}
                  className="p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg"
                  title="Delete device"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Channel and Sports Favorites */}
      {selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Channel */}
          <div className="card p-4">
            <h3 className="text-lg font-medium text-slate-100 mb-3">Quick Channel</h3>
            <div className="flex items-center space-x-3">
              <input
                type="text"
                placeholder="Enter channel number"
                value={quickChannel}
                onChange={(e) => setQuickChannel(e.target.value.replace(/\D/g, ''))}
                className="flex-1 px-3 py-2 input-dark"
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

          {/* Sports Favorites */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-slate-100 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                <span>Sports Channels</span>
              </h3>
              <button
                onClick={() => setShowSportsFavorites(!showSportsFavorites)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                {showSportsFavorites ? 'Hide' : 'Show All'}
              </button>
            </div>
            
            {/* Quick Sports Access */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => changeToChannel('212')}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <Trophy className="w-4 h-4" />
                <span>NFL RedZone</span>
              </button>
              <button
                onClick={() => changeToChannel('206')}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ESPN
              </button>
            </div>

            {showSportsFavorites && (
              <>
                {/* Category Filter */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {sportsCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedSportsCategory(category)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        selectedSportsCategory === category
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-800 or bg-slate-900 text-slate-200 hover:bg-gray-300'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Sports Channel Grid */}
                <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                  {filteredSportsFavorites.map((favorite) => (
                    <button
                      key={favorite.channel}
                      onClick={() => changeToChannel(favorite.channelNumber)}
                      className="text-left p-2 hover:bg-slate-700 rounded text-sm border border-slate-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{favorite.name}</span>
                        <span className="text-blue-600 font-mono text-xs">{favorite.channelNumber}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Control Panels */}
      {selectedDevice && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Controls */}
          <div className="card p-4">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Basic Controls</h3>
            
            {/* Power */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">Power</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => sendDirecTVCommand('POWER')}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
                >
                  <Power className="w-4 h-4" />
                  <span>Power</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('POWER_ON')}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium"
                >
                  On
                </button>
                <button
                  onClick={() => sendDirecTVCommand('POWER_OFF')}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Off
                </button>
              </div>
            </div>

            {/* Channel */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">Channel</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => sendDirecTVCommand('CH_UP')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <ChevronUp className="w-4 h-4" />
                  <span>CH+</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('CH_DOWN')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>CH-</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('LAST')}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium"
                >
                  Last
                </button>
              </div>
            </div>

            {/* Volume */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">Volume</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => sendDirecTVCommand('VOL_UP')}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Vol+</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('VOL_DOWN')}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Vol-</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('MUTE')}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>Mute</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation & Menu */}
          <div className="card p-4">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Navigation & Menu</h3>
            
            {/* Menu Buttons */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">Menu</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => sendDirecTVCommand('GUIDE')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Guide</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('MENU')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-medium flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4" />
                  <span>Menu</span>
                </button>
                <button
                  onClick={() => sendDirecTVCommand('INFO')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-medium"
                >
                  Info
                </button>
                <button
                  onClick={() => sendDirecTVCommand('LIST')}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg font-medium flex items-center space-x-2"
                >
                  <List className="w-4 h-4" />
                  <span>List</span>
                </button>
              </div>
            </div>

            {/* D-Pad Navigation */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-200 mb-2">Navigation</h4>
              <div className="grid grid-cols-3 gap-1 max-w-[150px] mx-auto">
                <div></div>
                <button
                  onClick={() => sendDirecTVCommand('UP')}
                  className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg"
                >
                  ↑
                </button>
                <div></div>
                <button
                  onClick={() => sendDirecTVCommand('LEFT')}
                  className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg"
                >
                  ←
                </button>
                <button
                  onClick={() => sendDirecTVCommand('OK')}
                  className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg font-bold"
                >
                  OK
                </button>
                <button
                  onClick={() => sendDirecTVCommand('RIGHT')}
                  className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg"
                >
                  →
                </button>
                <div></div>
                <button
                  onClick={() => sendDirecTVCommand('DOWN')}
                  className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg"
                >
                  ↓
                </button>
                <div></div>
              </div>
              <div className="flex justify-center space-x-2 mt-2">
                <button
                  onClick={() => sendDirecTVCommand('BACK')}
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                >
                  Back
                </button>
                <button
                  onClick={() => sendDirecTVCommand('EXIT')}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DVR Controls */}
      {selectedDevice && (
        <div className="card p-4">
          <h3 className="text-lg font-medium text-slate-100 mb-4 flex items-center space-x-2">
            <CirclePlay className="w-5 h-5 text-red-600" />
            <span>DVR Controls</span>
          </h3>
          <div className="grid grid-cols-6 gap-2">
            <button
              onClick={() => sendDirecTVCommand('SKIP_BACK')}
              className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={() => sendDirecTVCommand('REWIND')}
              className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center"
            >
              ⏪
            </button>
            <button
              onClick={() => sendDirecTVCommand('PLAY')}
              className="bg-green-500 hover:bg-green-600 text-white p-3 rounded-lg flex items-center justify-center"
            >
              <Play className="w-5 h-5" />
            </button>
            <button
              onClick={() => sendDirecTVCommand('PAUSE')}
              className="bg-yellow-500 hover:bg-yellow-600 text-white p-3 rounded-lg flex items-center justify-center"
            >
              <Pause className="w-5 h-5" />
            </button>
            <button
              onClick={() => sendDirecTVCommand('FAST_FORWARD')}
              className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center"
            >
              ⏩
            </button>
            <button
              onClick={() => sendDirecTVCommand('SKIP_FORWARD')}
              className="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg flex items-center justify-center"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={() => sendDirecTVCommand('STOP')}
              className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg flex items-center justify-center space-x-2"
            >
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </button>
            <button
              onClick={() => sendDirecTVCommand('RECORD')}
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-medium"
            >
              ● Record
            </button>
          </div>
        </div>
      )}

      {/* Number Pad */}
      {selectedDevice && (
        <div className="card p-4">
          <h3 className="text-lg font-medium text-slate-100 mb-4">Number Pad</h3>
          <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DASH', '0', 'ENTER'].map((num) => (
              <button
                key={num}
                onClick={() => sendDirecTVCommand(num)}
                className={`p-3 rounded-lg font-bold transition-colors ${
                  num === 'ENTER' ? 'bg-green-500 hover:bg-green-600 text-white' :
                  num === 'DASH' ? 'bg-gray-500 hover:bg-gray-600 text-white' :
                  'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {num === 'DASH' ? '—' : num}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Add DirecTV Receiver</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g., Main Bar DirecTV"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  className="w-full px-3 py-2 input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">IP Address *</label>
                <input
                  type="text"
                  placeholder="192.168.1.150"
                  value={newDevice.ipAddress}
                  onChange={(e) => setNewDevice({ ...newDevice, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 input-dark"
                />
                <p className="text-xs text-slate-400 mt-1">Find this in your DirecTV receiver's network settings</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Port</label>
                <input
                  type="number"
                  value={newDevice.port}
                  onChange={(e) => setNewDevice({ ...newDevice, port: parseInt(e.target.value) || 8080 })}
                  className="w-full px-3 py-2 input-dark"
                />
                <p className="text-xs text-slate-400 mt-1">Default is 8080 (usually doesn't need to be changed)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Receiver Type</label>
                <select
                  value={newDevice.receiverType}
                  onChange={(e) => setNewDevice({ ...newDevice, receiverType: e.target.value as any })}
                  className="w-full px-3 py-2 input-dark"
                >
                  <option value="Genie HD DVR">Genie HD DVR (HR54, HR44)</option>
                  <option value="Genie Mini">Genie Mini (C61K, C51)</option>
                  <option value="HR Series DVR">HR Series DVR</option>
                  <option value="C61K Mini">C61K Mini</option>
                  <option value="HS17 Server">HS17 Server</option>
                  <option value="H24/H25 HD">H24/H25 HD Receiver</option>
                  <option value="h24/100">H24/100 HD Receiver</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Matrix Input Channel
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  placeholder="Enter channel number (e.g., 1, 2, 3...)"
                  value={newDevice.inputChannel || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setNewDevice({ ...newDevice, inputChannel: !isNaN(value) && value > 0 ? value : undefined });
                  }}
                  className="w-full px-3 py-2 input-dark"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter which matrix input channel this DirecTV box is connected to (typically 1-32).
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAddDevice(false)}
                className="flex-1 bg-slate-800 or bg-slate-900 text-slate-100 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addDirecTVDevice}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                Add Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {showEditDevice && editingDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-100">Edit DirecTV Receiver</h3>
              <button
                onClick={() => {
                  setShowEditDevice(false)
                  setEditingDevice(null)
                }}
                className="text-slate-500 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Device Name</label>
                <input
                  type="text"
                  placeholder="e.g., Main Bar DirecTV"
                  value={editDevice.name}
                  onChange={(e) => setEditDevice({ ...editDevice, name: e.target.value })}
                  className="w-full px-3 py-2 input-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">IP Address *</label>
                <input
                  type="text"
                  placeholder="192.168.1.150"
                  value={editDevice.ipAddress}
                  onChange={(e) => setEditDevice({ ...editDevice, ipAddress: e.target.value })}
                  className="w-full px-3 py-2 input-dark"
                />
                <p className="text-xs text-slate-400 mt-1">Find this in your DirecTV receiver's network settings</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Port</label>
                <input
                  type="number"
                  value={editDevice.port}
                  onChange={(e) => setEditDevice({ ...editDevice, port: parseInt(e.target.value) || 8080 })}
                  className="w-full px-3 py-2 input-dark"
                />
                <p className="text-xs text-slate-400 mt-1">Default is 8080 (usually doesn't need to be changed)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">Receiver Type</label>
                <select
                  value={editDevice.receiverType}
                  onChange={(e) => setEditDevice({ ...editDevice, receiverType: e.target.value as any })}
                  className="w-full px-3 py-2 input-dark"
                >
                  <option value="Genie HD DVR">Genie HD DVR (HR54, HR44)</option>
                  <option value="Genie Mini">Genie Mini (C61K, C51)</option>
                  <option value="HR Series DVR">HR Series DVR</option>
                  <option value="C61K Mini">C61K Mini</option>
                  <option value="HS17 Server">HS17 Server</option>
                  <option value="H24/H25 HD">H24/H25 HD Receiver</option>
                  <option value="h24/100">H24/100 HD Receiver</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Matrix Input Channel
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  placeholder="Enter channel number (e.g., 1, 2, 3...)"
                  value={editDevice.inputChannel || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setEditDevice({ ...editDevice, inputChannel: !isNaN(value) && value > 0 ? value : undefined });
                  }}
                  className="w-full px-3 py-2 input-dark"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Enter which matrix input channel this DirecTV box is connected to (typically 1-32).
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditDevice(false)
                  setEditingDevice(null)
                }}
                className="flex-1 bg-slate-800 or bg-slate-900 text-slate-100 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateDirecTVDevice}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              >
                Update Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteDevice && deletingDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="card rounded-lg max-w-sm w-full p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
            </div>
            
            <h3 className="text-lg font-medium text-slate-100 text-center mb-2">Delete DirecTV Receiver</h3>
            <p className="text-sm text-slate-300 text-center mb-6">
              Are you sure you want to delete "{deletingDevice.name}"? This action cannot be undone.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteDevice(false)
                  setDeletingDevice(null)
                }}
                className="flex-1 bg-slate-800 or bg-slate-900 text-slate-100 py-2 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteDirecTVDevice}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Delete Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Panel */}
      {showSubscriptions && subscriptionDeviceId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <DeviceSubscriptionPanel
              deviceId={subscriptionDeviceId}
              deviceType="directv"
              deviceName={devices.find(d => d.id === subscriptionDeviceId)?.name || 'DirecTV Device'}
              onClose={() => {
                setShowSubscriptions(false)
                setSubscriptionDeviceId(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

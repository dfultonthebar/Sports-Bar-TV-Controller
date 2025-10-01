
'use client'

import { useState, useEffect } from 'react'
import { 
  Settings, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Cable, 
  Satellite, 
  Smartphone, 
  Router,
  Check,
  X,
  ArrowLeft,
  Tv,
  MapPin,
  Clock,
  Users,
  Search,
  Star,
  Globe
} from 'lucide-react'
import Link from 'next/link'

interface Provider {
  id?: string
  name: string
  type: 'cable' | 'satellite' | 'streaming' | 'iptv'
  channels: string[]
  packages: string[]
  inputId?: string
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  deviceType: string
  isActive: boolean
}

interface LocationConfig {
  zipCode?: string
  city?: string
  state?: string
  timezone: string
}

interface HomeTeam {
  id?: string
  teamName: string
  league: string
  category: string
  sport: string
  location?: string
  conference?: string
  isPrimary: boolean
}

interface TeamSuggestion {
  name: string
  league: string
  category: string
  sport: string
  location: string
  conference?: string
}

const DEFAULT_PROVIDERS: Provider[] = [
  {
    id: 'spectrum-business',
    name: 'Spectrum Business & Sports Package',
    type: 'cable',
    channels: ['ESPN', 'ESPN2', 'Fox Sports', 'NBC Sports', 'CBS Sports', 'FS1', 'FS2', 'NFL Network', 'NBA TV', 'MLB Network'],
    packages: ['Business TV Select', 'Sports Package']
  },
  {
    id: 'directv-nfl',
    name: 'DirecTV with NFL Sunday Ticket',
    type: 'satellite',
    channels: ['ESPN', 'Fox Sports', 'NBC Sports', 'CBS Sports', 'NFL RedZone', 'NFL Network', 'Sunday Ticket Channels'],
    packages: ['Choice Package', 'NFL Sunday Ticket MAX']
  },
  {
    id: 'streaming-services',
    name: 'Premium Streaming Bundle',
    type: 'streaming',
    channels: ['Netflix', 'Hulu Live TV', 'YouTube TV', 'Amazon Prime Video', 'Peacock Premium', 'Paramount+'],
    packages: ['Premium Streaming Bundle']
  }
]

const POPULAR_CHANNELS = [
  'ESPN', 'ESPN2', 'ESPN Classic', 'Fox Sports', 'FS1', 'FS2', 'NBC Sports', 'CBS Sports', 
  'NFL Network', 'NFL RedZone', 'NBA TV', 'MLB Network', 'NHL Network', 'Tennis Channel',
  'Golf Channel', 'Big Ten Network', 'SEC Network', 'ACC Network', 'Pac-12 Network',
  'TNT', 'TBS', 'USA Network', 'FX', 'Comedy Central', 'Discovery Channel', 'History Channel',
  'Netflix', 'Hulu', 'Amazon Prime Video', 'Peacock', 'Paramount+', 'HBO Max', 'Disney+'
]

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' }
]

export default function SportsGuideConfigPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [matrixInputs, setMatrixInputs] = useState<MatrixInput[]>([])
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedStatus, setSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeTab, setActiveTab] = useState<'providers' | 'location' | 'teams'>('providers')
  
  // Location configuration state
  const [locationConfig, setLocationConfig] = useState<LocationConfig>({
    zipCode: '',
    city: '',
    state: '',
    timezone: 'America/New_York'
  })
  
  // Home teams state
  const [homeTeams, setHomeTeams] = useState<HomeTeam[]>([])
  const [teamSuggestions, setTeamSuggestions] = useState<TeamSuggestion[]>([])
  const [teamSearchQuery, setTeamSearchQuery] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)

  const [newProvider, setNewProvider] = useState<Omit<Provider, 'id'>>({
    name: '',
    type: 'cable',
    channels: [],
    packages: [],
    inputId: undefined
  })

  useEffect(() => {
    loadConfiguration()
    searchTeams('')
  }, [])

  useEffect(() => {
    if (teamSearchQuery.length > 0) {
      const timer = setTimeout(() => searchTeams(teamSearchQuery), 300)
      return () => clearTimeout(timer)
    } else {
      searchTeams('')
    }
  }, [teamSearchQuery])

  const loadConfiguration = async () => {
    try {
      const response = await fetch('/api/sports-guide-config')
      const result = await response.json()
      
      if (result.success) {
        const { configuration, providers, homeTeams, matrixInputs } = result.data
        
        setMatrixInputs(matrixInputs || [])
        setProviders(providers || DEFAULT_PROVIDERS)
        setHomeTeams(homeTeams || [])
        
        if (configuration) {
          setLocationConfig({
            zipCode: configuration.zipCode || '',
            city: configuration.city || '',
            state: configuration.state || '',
            timezone: configuration.timezone || 'America/New_York'
          })
        }
      }
    } catch (error) {
      console.error('Error loading configuration:', error)
      // Fallback to defaults
      setProviders(DEFAULT_PROVIDERS)
      loadMatrixInputs()
    }
  }

  const loadMatrixInputs = async () => {
    try {
      const response = await fetch('/api/matrix/config')
      const result = await response.json()
      
      if (result.configs?.length > 0) {
        const activeConfig = result.configs[0]
        const activeInputs = activeConfig.inputs?.filter((input: MatrixInput) => input.isActive) || []
        setMatrixInputs(activeInputs)
      }
    } catch (error) {
      console.error('Error loading matrix inputs:', error)
    }
  }

  const searchTeams = async (query: string) => {
    try {
      const response = await fetch(`/api/home-teams?q=${encodeURIComponent(query)}`)
      const result = await response.json()
      
      if (result.success) {
        setTeamSuggestions(result.data.teams || [])
      }
    } catch (error) {
      console.error('Error searching teams:', error)
    }
  }

  const saveConfiguration = async () => {
    setSavedStatus('saving')
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/sports-guide-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...locationConfig,
          providers,
          homeTeams
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSavedStatus('saved')
        setTimeout(() => setSavedStatus('idle'), 3000)
      } else {
        setSavedStatus('error')
        setTimeout(() => setSavedStatus('idle'), 3000)
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      setSavedStatus('error')
      setTimeout(() => setSavedStatus('idle'), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const addTeam = (suggestion: TeamSuggestion) => {
    const newTeam: HomeTeam = {
      teamName: suggestion.name,
      league: suggestion.league,
      category: suggestion.category,
      sport: suggestion.sport,
      location: suggestion.location,
      conference: suggestion.conference,
      isPrimary: homeTeams.length === 0 // First team becomes primary
    }
    
    setHomeTeams(prev => [...prev, newTeam])
    setTeamSearchQuery('')
    setAddingTeam(false)
  }

  const removeTeam = (index: number) => {
    setHomeTeams(prev => {
      const updated = prev.filter((_, i) => i !== index)
      // If we removed the primary team, make the first remaining team primary
      if (updated.length > 0 && !updated.some(team => team.isPrimary)) {
        updated[0].isPrimary = true
      }
      return updated
    })
  }

  const setPrimaryTeam = (index: number) => {
    setHomeTeams(prev => prev.map((team, i) => ({
      ...team,
      isPrimary: i === index
    })))
  }

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'cable': return Cable
      case 'satellite': return Satellite
      case 'streaming': return Smartphone
      case 'iptv': return Router
      default: return Tv
    }
  }

  const getProviderEmoji = (type: string) => {
    switch (type) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'iptv': return '🌐'
      default: return '📺'
    }
  }

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'professional': return '🏆'
      case 'college': return '🎓'
      case 'high-school': return '🏫'
      case 'international': return '🌍'
      default: return '⚽'
    }
  }

  const getSportEmoji = (sport: string) => {
    switch (sport) {
      case 'football': return '🏈'
      case 'basketball': return '🏀'
      case 'baseball': return '⚾'
      case 'hockey': return '🏒'
      case 'soccer': return '⚽'
      default: return '🏃'
    }
  }

  const addProvider = () => {
    if (!newProvider.name.trim()) return
    
    const provider: Provider = {
      id: `provider-${Date.now()}`,
      ...newProvider
    }
    
    setProviders(prev => [...prev, provider])
    setNewProvider({
      name: '',
      type: 'cable',
      channels: [],
      packages: [],
      inputId: undefined
    })
    setIsAdding(false)
  }

  const updateProvider = (id: string, updates: Partial<Provider>) => {
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const deleteProvider = (id: string) => {
    setProviders(prev => prev.filter(p => p.id !== id))
  }

  const toggleChannel = (providerId: string, channel: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return

    const hasChannel = provider.channels.includes(channel)
    const updatedChannels = hasChannel 
      ? provider.channels.filter(c => c !== channel)
      : [...provider.channels, channel]
    
    updateProvider(providerId, { channels: updatedChannels })
  }

  const addCustomChannel = (providerId: string, channelName: string) => {
    if (!channelName.trim()) return
    
    const provider = providers.find(p => p.id === providerId)
    if (!provider || provider.channels.includes(channelName)) return
    
    updateProvider(providerId, { channels: [...provider.channels, channelName.trim()] })
  }

  const removeChannel = (providerId: string, channel: string) => {
    const provider = providers.find(p => p.id === providerId)
    if (!provider) return
    
    updateProvider(providerId, { 
      channels: provider.channels.filter(c => c !== channel) 
    })
  }

  // Map provider types to compatible device types - FIXED VERSION
  const getCompatibleDeviceTypes = (providerType: string): string[] => {
    switch (providerType) {
      case 'cable':
        return ['Cable Box', 'HDMI', 'Component', 'Composite']
      case 'satellite':
        return ['DirecTV Receiver', 'Dish Network Receiver', 'Satellite Box', 'Satellite', 'HDMI']
      case 'streaming':
        return ['Fire TV', 'Apple TV', 'Roku', 'Chromecast', 'Streaming Box', 'Smart TV', 'HDMI']
      case 'iptv':
        return ['Streaming Box', 'Fire TV', 'Apple TV', 'Roku', 'Computer', 'HDMI']
      default:
        return []
    }
  }

  // Filter inputs based on provider compatibility - IMPROVED VERSION
  const getCompatibleInputs = (providerType: string): MatrixInput[] => {
    const compatibleTypes = getCompatibleDeviceTypes(providerType)
    return matrixInputs.filter(input => {
      if (!input.isActive) return false
      
      // Check both deviceType and inputType for compatibility
      const deviceTypeMatch = compatibleTypes.includes(input.deviceType)
      const inputTypeMatch = compatibleTypes.includes(input.inputType)
      const labelMatch = input.label.toLowerCase().includes(providerType)
      
      return deviceTypeMatch || inputTypeMatch || labelMatch
    })
  }

  const assignInputToProvider = (providerId: string, inputId: string) => {
    // Clear input from other providers first
    setProviders(prev => prev.map(p => 
      p.inputId === inputId ? { ...p, inputId: undefined } : p
    ))
    // Assign to selected provider
    updateProvider(providerId, { inputId })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Main</span>
            </Link>
            
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Sports Guide Configuration</h1>
                <p className="text-blue-200">Configure providers, location, and favorite teams</p>
              </div>
            </div>
          </div>

          <button
            onClick={saveConfiguration}
            disabled={isSaving}
            className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors font-medium ${
              savedStatus === 'saved' 
                ? 'bg-green-600 text-white' 
                : savedStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {savedStatus === 'saving' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : savedStatus === 'saved' ? (
              <Check className="w-4 h-4" />
            ) : savedStatus === 'error' ? (
              <X className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {savedStatus === 'saving' ? 'Saving...' : 
               savedStatus === 'saved' ? 'Saved!' :
               savedStatus === 'error' ? 'Error!' : 'Save All Configuration'}
            </span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'providers'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-blue-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>TV Providers</span>
          </button>
          
          <button
            onClick={() => setActiveTab('location')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'location'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-blue-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Location & Timezone</span>
          </button>
          
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${
              activeTab === 'teams'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-blue-200 hover:text-white hover:bg-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Home Teams</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Add Provider Form */}
        {isAdding && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Add New Provider</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Provider Name</label>
                <input
                  type="text"
                  value={newProvider.name}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Spectrum Business Premium"
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Provider Type</label>
                <select
                  value={newProvider.type}
                  onChange={(e) => setNewProvider(prev => ({ ...prev, type: e.target.value as Provider['type'] }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="cable" className="bg-slate-800">Cable Provider</option>
                  <option value="satellite" className="bg-slate-800">Satellite Provider</option>
                  <option value="streaming" className="bg-slate-800">Streaming Service</option>
                  <option value="iptv" className="bg-slate-800">IPTV Service</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={addProvider}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Provider
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Provider List */}
        <div className="space-y-4">
          {providers.map((provider) => {
            const IconComponent = getProviderIcon(provider.type)
            const assignedInput = matrixInputs.find(input => input.id === provider.inputId)
            const compatibleInputs = getCompatibleInputs(provider.type)
            
            return (
              <div key={provider.id} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <div className="p-6 border-b border-white/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-500/20 rounded-lg p-3">
                        <IconComponent className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                        <div className="flex items-center space-x-3 text-sm text-blue-200">
                          <span>{getProviderEmoji(provider.type)} {provider.type.charAt(0).toUpperCase() + provider.type.slice(1)}</span>
                          <span>•</span>
                          <span>{provider.channels.length} channels</span>
                          <span>•</span>
                          <span>{provider.packages.length} packages</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingProvider(editingProvider === provider.id ? null : provider.id)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteProvider(provider.id)}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Input Assignment */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2">
                      Assigned TV Input
                      <span className="text-xs text-slate-500 ml-2">
                        (Showing {compatibleInputs.length} compatible inputs)
                      </span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <select
                        value={provider.inputId || ''}
                        onChange={(e) => assignInputToProvider(provider.id, e.target.value)}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      >
                        <option value="" className="bg-slate-800">No input assigned</option>
                        {compatibleInputs.map(input => (
                          <option key={input.id} value={input.id} className="bg-slate-800">
                            {input.label} (Ch {input.channelNumber}) - {input.deviceType}
                          </option>
                        ))}
                      </select>
                      {assignedInput && (
                        <div className="text-sm">
                          <span className="text-green-400">✓ {assignedInput.label}</span>
                          <div className="text-xs text-slate-500">
                            {assignedInput.deviceType} • Ch {assignedInput.channelNumber}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {compatibleInputs.length === 0 && (
                      <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <div className="text-sm text-yellow-300">
                          ⚠️ No compatible inputs found for {provider.type} provider.
                        </div>
                        <div className="text-xs text-yellow-200 mt-1">
                          Configure Wolf Pack inputs with device types: {getCompatibleDeviceTypes(provider.type).join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {editingProvider === provider.id && (
                  <div className="p-6 space-y-6">
                    {/* Packages */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Service Packages</label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {provider.packages.map((pkg, index) => (
                          <span 
                            key={index}
                            className="flex items-center space-x-1 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-sm"
                          >
                            <span>{pkg}</span>
                            <button
                              onClick={() => updateProvider(provider.id, { 
                                packages: provider.packages.filter((_, i) => i !== index) 
                              })}
                              className="text-purple-400 hover:text-purple-200"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="Add package name..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement
                              if (input.value.trim() && !provider.packages.includes(input.value.trim())) {
                                updateProvider(provider.id, { 
                                  packages: [...provider.packages, input.value.trim()] 
                                })
                                input.value = ''
                              }
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>

                    {/* Available Channels */}
                    <div>
                      <label className="block text-sm font-medium text-white mb-3">Available Channels</label>
                      
                      {/* Popular Channels Grid */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Popular Channels</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {POPULAR_CHANNELS.map((channel) => (
                            <button
                              key={channel}
                              onClick={() => toggleChannel(provider.id, channel)}
                              className={`p-2 rounded-lg text-sm transition-all ${
                                provider.channels.includes(channel)
                                  ? 'bg-blue-600 text-white shadow-lg'
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {channel}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Channel Input */}
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Add Custom Channel</h4>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            placeholder="Channel name..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                addCustomChannel(provider.id, input.value)
                                input.value = ''
                              }
                            }}
                            className="flex-1 px-3 py-2 bg-white/10 border border-white/20 text-white placeholder-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>

                      {/* Selected Channels */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">
                          Selected Channels ({provider.channels.length})
                        </h4>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {provider.channels.map((channel) => (
                            <span
                              key={channel}
                              className="flex items-center space-x-1 bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-sm"
                            >
                              <span>{channel}</span>
                              <button
                                onClick={() => removeChannel(provider.id, channel)}
                                className="text-blue-400 hover:text-blue-200"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {providers.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white/10 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Settings className="w-8 h-8 text-blue-300 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Providers Configured</h3>
            <p className="text-blue-200 mb-4">Add TV providers to configure your sports guide</p>
            <button
              onClick={() => setIsAdding(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Provider</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Tv, 
  Smartphone, 
  Monitor, 
  ExternalLink, 
  Download, 
  Calendar,
  Clock,
  Star,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Grid3X3,
  List,
  Settings,
  Zap,
  Radio,
  Cable,
  Satellite,
  Router
} from 'lucide-react'
import ProgrammingScheduler from '../../components/ProgrammingScheduler'
import EnhancedChannelGrid from '../../components/EnhancedChannelGrid'

interface League {
  id: string
  name: string
  description: string
  category: 'professional' | 'college' | 'international' | 'high-school'
  season: string
  logo?: string
}

interface ChannelInfo {
  id: string
  name: string
  url?: string
  platforms: string[]
  type: 'cable' | 'streaming' | 'ota' | 'satellite'
  cost: 'free' | 'subscription' | 'premium'
  logoUrl?: string
  channelNumber?: string
  providerId?: string // Link to provider
}

interface GameListing {
  id: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  gameDate: string
  channel: ChannelInfo
  description?: string
  priority?: 'high' | 'medium' | 'low'
  status?: 'upcoming' | 'live' | 'completed'
  inputId?: string // Which input this is available on
}

interface MatrixInput {
  id: string
  channelNumber: number
  label: string
  inputType: string
  isActive: boolean
  provider?: string // Associated provider
}

interface Provider {
  id: string
  name: string
  type: 'cable' | 'satellite' | 'streaming' | 'iptv'
  channels: string[]
  packages: string[]
  inputId?: string // Which matrix input this provider uses
}

interface ScheduledRoutine {
  id: string
  name: string
  time: string
  enabled: boolean
  lastRun?: string
  nextRun: string
}

const SAMPLE_LEAGUES: League[] = [
  { id: 'nfl', name: 'NFL', description: 'National Football League', category: 'professional', season: '2024-25' },
  { id: 'nba', name: 'NBA', description: 'National Basketball Association', category: 'professional', season: '2024-25' },
  { id: 'mlb', name: 'MLB', description: 'Major League Baseball', category: 'professional', season: '2024' },
  { id: 'nhl', name: 'NHL', description: 'National Hockey League', category: 'professional', season: '2024-25' },
  { id: 'ncaa-fb', name: 'NCAA Football', description: 'College Football', category: 'college', season: '2024' },
  { id: 'ncaa-bb', name: 'NCAA Basketball', description: 'College Basketball', category: 'college', season: '2024-25' },
  { id: 'premier', name: 'Premier League', description: 'English Premier League', category: 'international', season: '2024-25' },
  { id: 'champions', name: 'Champions League', description: 'UEFA Champions League', category: 'international', season: '2024-25' },
  { id: 'high-school', name: 'High School Sports', description: 'Local high school athletics', category: 'high-school', season: '2024-25' },
  { id: 'nfhs', name: 'NFHS Network', description: 'High school sports streaming', category: 'high-school', season: '2024-25' }
]

const SAMPLE_PROVIDERS: Provider[] = [
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
    id: 'streaming-box',
    name: 'Streaming Services (Roku/Apple TV)',
    type: 'streaming',
    channels: ['Netflix', 'Hulu Live TV', 'YouTube TV', 'Amazon Prime Video', 'Peacock Premium', 'Paramount+'],
    packages: ['Premium Streaming Bundle']
  },
  {
    id: 'cable-box-premium',
    name: 'Premium Cable Package',
    type: 'cable',
    channels: ['ESPN', 'ESPN2', 'Fox Sports', 'NBC Sports', 'CBS Sports', 'TNT', 'TBS', 'USA Network'],
    packages: ['Premium Sports', 'Entertainment Package']
  }
]

const SAMPLE_CHANNELS: ChannelInfo[] = [
  { 
    id: 'espn', 
    name: 'ESPN', 
    platforms: ['DirecTV', 'Spectrum', 'Hulu Live', 'YouTube TV'], 
    type: 'cable', 
    cost: 'subscription',
    providerId: 'spectrum-business'
  },
  { 
    id: 'fox-sports', 
    name: 'Fox Sports', 
    platforms: ['DirecTV', 'Spectrum', 'Sling TV', 'FuboTV'], 
    type: 'cable', 
    cost: 'subscription',
    providerId: 'spectrum-business'
  },
  { 
    id: 'nfl-network', 
    name: 'NFL Network', 
    platforms: ['DirecTV Sunday Ticket'], 
    type: 'satellite', 
    cost: 'premium',
    providerId: 'directv-nfl'
  },
  { 
    id: 'nfl-redzone', 
    name: 'NFL RedZone', 
    platforms: ['DirecTV Sunday Ticket'], 
    type: 'satellite', 
    cost: 'premium',
    providerId: 'directv-nfl'
  },
  { 
    id: 'amazon-prime', 
    name: 'Amazon Prime Video', 
    platforms: ['Fire TV', 'Roku', 'Apple TV'], 
    type: 'streaming', 
    cost: 'premium',
    providerId: 'streaming-box',
    url: 'https://www.amazon.com/gp/video/storefront'
  },
  { 
    id: 'netflix', 
    name: 'Netflix', 
    platforms: ['All Smart TVs', 'Fire TV', 'Roku'], 
    type: 'streaming', 
    cost: 'subscription',
    providerId: 'streaming-box',
    url: 'https://www.netflix.com'
  },
  { 
    id: 'paramount-plus', 
    name: 'Paramount+', 
    platforms: ['All Smart TVs', 'Fire TV', 'Roku'], 
    type: 'streaming', 
    cost: 'subscription',
    providerId: 'streaming-box',
    url: 'https://www.paramountplus.com'
  },
  { 
    id: 'nfhs-network', 
    name: 'NFHS Network', 
    platforms: ['NFHS Network App', 'Web Browser', 'Roku'], 
    type: 'streaming', 
    cost: 'subscription',
    providerId: 'streaming-box',
    url: 'https://www.nfhsnetwork.com'
  },
  { 
    id: 'sunday-ticket', 
    name: 'NFL Sunday Ticket', 
    platforms: ['DirecTV', 'DirecTV Stream', 'Sunday Ticket App'], 
    type: 'satellite', 
    cost: 'premium',
    providerId: 'directv-nfl',
    url: 'https://nflst.directv.com'
  }
]

export default function SportsGuide() {
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([])
  const [sportsGuide, setSportsGuide] = useState<GameListing[]>([])
  const [availableLeagues, setAvailableLeagues] = useState<League[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedLeagues, setExpandedLeagues] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [scheduledRoutines, setScheduledRoutines] = useState<ScheduledRoutine[]>([])
  const [showScheduler, setShowScheduler] = useState(false)
  const [activeTab, setActiveTab] = useState<'sports-guide' | 'tv-programming' | 'scheduler'>('sports-guide')
  const [selectedDay, setSelectedDay] = useState(0) // 0 = today, 1 = tomorrow, etc.
  
  // New state for input and provider management
  const [matrixInputs, setMatrixInputs] = useState<MatrixInput[]>([])
  const [selectedInput, setSelectedInput] = useState<string | null>(null)
  const [providers, setProviders] = useState<Provider[]>(SAMPLE_PROVIDERS)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)

  useEffect(() => {
    // Load available leagues on component mount
    loadAvailableLeagues()
    loadScheduledRoutines()
    loadMatrixInputs()
    
    // Auto-expand professional and college leagues for better UX
    setExpandedLeagues(new Set(['professional', 'college']))
  }, [])

  useEffect(() => {
    if (selectedLeagues.length > 0) {
      generateSportsGuide()
    }
  }, [selectedLeagues])

  const loadAvailableLeagues = async () => {
    try {
      console.log('Loading leagues...')
      const response = await fetch('/api/leagues')
      const result = await response.json()
      
      console.log('Leagues API response:', result)
      
      if (result.success && result.data) {
        setAvailableLeagues(result.data)
        console.log('Successfully loaded leagues:', result.data.length)
        
        // Auto-select popular leagues for immediate content
        if (selectedLeagues.length === 0) {
          const popularLeagues = result.data.filter((league: League) => 
            ['nfl', 'nba', 'mlb'].includes(league.id)
          ).map((league: League) => league.id)
          
          if (popularLeagues.length > 0) {
            setSelectedLeagues(popularLeagues.slice(0, 2)) // Select first 2 popular leagues
            console.log('Auto-selected popular leagues:', popularLeagues.slice(0, 2))
          }
        }
      } else {
        console.error('Failed to load leagues:', result.error)
        // Fallback to sample leagues
        setAvailableLeagues(SAMPLE_LEAGUES)
        console.log('Using sample leagues fallback')
      }
    } catch (error) {
      console.error('Error loading leagues:', error)
      // Fallback to sample leagues
      setAvailableLeagues(SAMPLE_LEAGUES)
      console.log('Using sample leagues fallback due to error')
    }
  }

  const loadMatrixInputs = async () => {
    try {
      console.log('Loading matrix inputs...')
      const response = await fetch('/api/matrix/config')
      const result = await response.json()
      
      console.log('Matrix config API response:', result)
      
      if (result.success !== false && result.configs?.length > 0) {
        const activeConfig = result.configs[0]
        const activeInputs = activeConfig.inputs?.filter((input: MatrixInput) => input.isActive) || []
        
        console.log('Active inputs found:', activeInputs.length)
        
        // Associate providers with inputs based on labels
        const inputsWithProviders = activeInputs.map((input: MatrixInput) => ({
          ...input,
          provider: getProviderForInput(input.label)
        }))
        
        setMatrixInputs(inputsWithProviders)
        console.log('Matrix inputs loaded:', inputsWithProviders.length)
        
        // Associate providers with inputs
        const updatedProviders = providers.map(provider => ({
          ...provider,
          inputId: inputsWithProviders.find(input => input.provider === provider.id)?.id
        }))
        setProviders(updatedProviders)
      } else if (result.inputs?.length > 0) {
        // Handle case where inputs are directly in the result
        const activeInputs = result.inputs.filter((input: MatrixInput) => input.isActive) || []
        
        console.log('Active inputs found (direct):', activeInputs.length)
        
        const inputsWithProviders = activeInputs.map((input: MatrixInput) => ({
          ...input,
          provider: getProviderForInput(input.label)
        }))
        
        setMatrixInputs(inputsWithProviders)
        console.log('Matrix inputs loaded (direct):', inputsWithProviders.length)
        
        const updatedProviders = providers.map(provider => ({
          ...provider,
          inputId: inputsWithProviders.find(input => input.provider === provider.id)?.id
        }))
        setProviders(updatedProviders)
      } else {
        console.log('No matrix inputs found in response')
      }
    } catch (error) {
      console.error('Error loading matrix inputs:', error)
    }
  }

  const getProviderForInput = (inputLabel: string): string | undefined => {
    const label = inputLabel.toLowerCase()
    if (label.includes('cable') && !label.includes('streaming')) {
      return 'spectrum-business'
    } else if (label.includes('direct') || label.includes('satellite')) {
      return 'directv-nfl'
    } else if (label.includes('streaming') || label.includes('roku') || label.includes('apple')) {
      return 'streaming-box'
    }
    return undefined
  }

  const selectInput = (inputId: string) => {
    setSelectedInput(inputId)
    const input = matrixInputs.find(i => i.id === inputId)
    if (input && input.provider) {
      setSelectedProvider(input.provider)
    } else {
      setSelectedProvider(null)
    }
  }

  const toggleLeague = (leagueId: string) => {
    setSelectedLeagues(prev => {
      if (prev.includes(leagueId)) {
        return prev.filter(id => id !== leagueId)
      } else {
        return [...prev, leagueId]
      }
    })
  }

  const toggleLeagueExpansion = (category: string) => {
    setExpandedLeagues(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const generateSportsGuide = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/sports-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedLeagues })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSportsGuide(result.data.games || [])
      } else {
        console.error('Failed to generate sports guide:', result.error)
        setSportsGuide([])
      }
    } catch (error) {
      console.error('Error generating sports guide:', error)
      setSportsGuide([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleChannelClick = (channel: ChannelInfo) => {
    if (channel.url) {
      window.open(channel.url, '_blank')
    } else {
      // For cable channels, show platform options
      alert(`Available on: ${channel.platforms.join(', ')}`)
    }
  }

  const loadScheduledRoutines = async () => {
    try {
      // Initialize default routine if none exist
      const defaultRoutine: ScheduledRoutine = {
        id: 'daily-sports-update',
        name: '7-Day Sports Update',
        time: '00:00', // 12:00 AM
        enabled: true,
        nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
      
      setScheduledRoutines([defaultRoutine])
    } catch (error) {
      console.error('Error loading scheduled routines:', error)
    }
  }

  const toggleRoutine = async (routineId: string) => {
    setScheduledRoutines(prev => 
      prev.map(routine => 
        routine.id === routineId 
          ? { ...routine, enabled: !routine.enabled }
          : routine
      )
    )
  }

  const runScheduledUpdate = async () => {
    setIsLoading(true)
    try {
      // Generate comprehensive 7-day sports guide
      await generateSportsGuide()
      
      // Update routine last run time
      setScheduledRoutines(prev =>
        prev.map(routine => ({
          ...routine,
          lastRun: new Date().toISOString(),
          nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }))
      )
    } catch (error) {
      console.error('Error running scheduled update:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const downloadGuide = () => {
    const guideData = {
      generatedAt: new Date().toISOString(),
      selectedLeagues: selectedLeagues.map(id => availableLeagues.find(l => l.id === id)),
      games: sportsGuide,
      scheduledRoutines: scheduledRoutines
    }
    
    const blob = new Blob([JSON.stringify(guideData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sports-guide-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filteredLeagues = availableLeagues.filter(league => {
    const matchesCategory = filterCategory === 'all' || league.category === filterCategory
    const matchesSearch = league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         league.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const leaguesByCategory = filteredLeagues.reduce((acc, league) => {
    if (!acc[league.category]) acc[league.category] = []
    acc[league.category].push(league)
    return acc
  }, {} as Record<string, League[]>)

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'professional': return '🏆'
      case 'college': return '🎓'
      case 'international': return '🌍'
      case 'high-school': return '🏫'
      default: return '⚽'
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

  const getInputIcon = (inputType: string) => {
    switch (inputType.toLowerCase()) {
      case 'cable': return Cable
      case 'satellite': return Satellite
      case 'streaming': return Smartphone
      case 'iptv': return Router
      default: return Radio
    }
  }

  const getProviderIcon = (providerType: string) => {
    switch (providerType) {
      case 'cable': return '📺'
      case 'satellite': return '🛰️'
      case 'streaming': return '📱'
      case 'iptv': return '🌐'
      default: return '📺'
    }
  }

  const getFilteredGames = () => {
    if (!selectedProvider || !selectedInput) {
      return sportsGuide // Show all games if no input/provider selected
    }
    
    const provider = providers.find(p => p.id === selectedProvider)
    if (!provider) return sportsGuide
    
    return sportsGuide.filter(game => {
      // Filter games based on channels available on the selected provider
      return provider.channels.some(channel => 
        game.channel.name.toLowerCase().includes(channel.toLowerCase()) ||
        channel.toLowerCase().includes(game.channel.name.toLowerCase())
      )
    })
  }

  const getNextSevenDays = () => {
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() + i)
      days.push({
        date: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      })
    }
    return days
  }

  const getGamesForSelectedDay = () => {
    const targetDate = getNextSevenDays()[selectedDay]?.date
    return getFilteredGames().filter(game => game.gameDate === targetDate)
  }

  const getChannelsForGrid = () => {
    const allChannels = new Set<string>()
    getFilteredGames().forEach(game => allChannels.add(game.channel.name))
    return Array.from(allChannels).sort()
  }

  const getTimeSlots = () => {
    const slots = []
    for (let hour = 8; hour <= 23; hour++) {
      slots.push({
        time: `${hour}:00`,
        label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`
      })
    }
    return slots
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Input Selection Panel - Left Side */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <div className="p-4 border-b border-white/20">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Radio className="w-5 h-5" />
              <span>TV Input Sources</span>
            </h3>
            <p className="text-sm text-blue-200 mt-1">Select input to filter available content</p>
          </div>
          
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {matrixInputs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No inputs configured</p>
              </div>
            ) : (
              <>
                {matrixInputs.map((input) => {
                  const provider = providers.find(p => p.id === input.provider)
                  const IconComponent = getInputIcon(input.inputType)
                  
                  return (
                    <button
                      key={input.id}
                      onClick={() => selectInput(input.id)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        selectedInput === input.id
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <IconComponent className="w-5 h-5" />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{input.label}</div>
                          <div className="text-xs opacity-80">
                            Ch {input.channelNumber} • {input.inputType}
                          </div>
                          {provider && (
                            <div className="text-xs mt-1 opacity-75">
                              {getProviderIcon(provider.type)} {provider.name}
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
                      setSelectedProvider(null)
                    }}
                    className="w-full mt-2 px-3 py-2 text-sm bg-gray-500/20 text-gray-300 border border-gray-500/30 rounded-lg hover:bg-gray-500/30 transition-all"
                  >
                    Show All Content
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Provider Info Panel */}
        {selectedProvider && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
            <div className="p-4 border-b border-white/20">
              <h4 className="text-md font-semibold text-white">Provider Info</h4>
            </div>
            
            <div className="p-4">
              {(() => {
                const provider = providers.find(p => p.id === selectedProvider)
                if (!provider) return null
                
                return (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">{getProviderIcon(provider.type)}</span>
                        <span className="font-medium text-white text-sm">{provider.name}</span>
                      </div>
                      <div className="text-xs text-blue-200 mb-3">
                        {provider.packages.join(' • ')}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs font-medium text-gray-300 mb-2">Available Channels:</div>
                      <div className="flex flex-wrap gap-1">
                        {provider.channels.slice(0, 6).map((channel, index) => (
                          <span key={index} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                            {channel}
                          </span>
                        ))}
                        {provider.channels.length > 6 && (
                          <span className="text-xs text-gray-400">+{provider.channels.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Right Side */}
      <div className="lg:col-span-3 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl p-6 border border-blue-500/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Sports Viewing Guide</h2>
              <p className="text-blue-200">Find where to watch your favorite sports</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <a
              href="/sports-guide-config"
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Configure</span>
            </a>
            
            {sportsGuide.length > 0 && (
              <>
                <div className="flex bg-white/10 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm ${
                      viewMode === 'list' 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-blue-200 hover:text-white'
                    }`}
                  >
                    <List className="w-4 h-4" />
                    <span>List</span>
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm ${
                      viewMode === 'grid' 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'text-blue-200 hover:text-white'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                    <span>Cable Guide</span>
                  </button>
                </div>
                
                <button
                  onClick={() => setShowScheduler(!showScheduler)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Schedule</span>
                </button>
                
                <button
                  onClick={downloadGuide}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-300 w-4 h-4" />
            <input
              type="text"
              placeholder="Search leagues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/10 border border-blue-500/30 text-white placeholder-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-white/10 border border-blue-500/30 text-white rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          >
            <option value="all" className="bg-slate-800">All Categories</option>
            <option value="professional" className="bg-slate-800">Professional</option>
            <option value="college" className="bg-slate-800">College</option>
            <option value="high-school" className="bg-slate-800">High School</option>
            <option value="international" className="bg-slate-800">International</option>
          </select>
        </div>
        
        {/* Tab Navigation */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
          <div className="flex space-x-1 p-1">
            <button
              onClick={() => setActiveTab('sports-guide')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sports-guide'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Sports Guide</span>
            </button>
            <button
              onClick={() => setActiveTab('tv-programming')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'tv-programming'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>TV Programming</span>
            </button>
            <button
              onClick={() => setActiveTab('scheduler')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'scheduler'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Scheduler</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'tv-programming' && (
        <div className="lg:col-span-3">
          <EnhancedChannelGrid />
        </div>
      )}
      
      {activeTab === 'scheduler' && (
        <div className="lg:col-span-3">
          <ProgrammingScheduler />
        </div>
      )}
      
      {activeTab === 'sports-guide' && (
        <>
          {/* Scheduler Section */}
      {showScheduler && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <div className="p-6 border-b border-white/20">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span>Automated Sports Guide Updates</span>
            </h3>
            <p className="text-sm text-blue-200 mt-1">Configure automatic updates for your sports guide</p>
          </div>
          
          <div className="p-6">
            {scheduledRoutines.map((routine) => (
              <div key={routine.id} className="flex items-center justify-between p-4 border border-white/20 rounded-lg bg-white/5">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${routine.enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <div>
                      <h4 className="font-medium text-white">{routine.name}</h4>
                      <p className="text-sm text-blue-200">
                        Runs daily at {routine.time} • 
                        {routine.lastRun 
                          ? ` Last run: ${new Date(routine.lastRun).toLocaleDateString()}`
                          : ' Never run'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => toggleRoutine(routine.id)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      routine.enabled 
                        ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {routine.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  
                  <button
                    onClick={runScheduledUpdate}
                    disabled={isLoading}
                    className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Run Now</span>
                  </button>
                </div>
              </div>
            ))}
            
            <div className="mt-4 p-4 bg-blue-900/30 rounded-lg border border-blue-500/30">
              <p className="text-sm text-blue-200 font-medium mb-2">📅 Next 7-Day Update Schedule:</p>
              <p className="text-sm text-blue-300">
                The automated routine will pull sports shows and games for the next 7 days at 12:00 AM daily. 
                This ensures your sports guide is always up to date with the latest schedules from all major networks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* League Selection */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
        <div className="p-6 border-b border-white/20">
          <h3 className="text-lg font-semibold text-white">Select Sports Leagues</h3>
          <p className="text-sm text-blue-200 mt-1">Choose the leagues you want to follow</p>
        </div>
        
        <div className="p-6 space-y-4">
          {Object.entries(leaguesByCategory).map(([category, leagues]) => (
            <div key={category} className="border border-white/20 rounded-lg bg-white/5">
              <button
                onClick={() => toggleLeagueExpansion(category)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/10 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getCategoryIcon(category)}</span>
                  <div>
                    <h4 className="font-medium text-white capitalize">{category} Sports</h4>
                    <p className="text-sm text-blue-200">{leagues.length} leagues available</p>
                  </div>
                </div>
                {expandedLeagues.has(category) ? 
                  <ChevronDown className="w-5 h-5 text-blue-300" /> : 
                  <ChevronRight className="w-5 h-5 text-blue-300" />
                }
              </button>
              
              {expandedLeagues.has(category) && (
                <div className="border-t border-white/20 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {leagues.map((league) => (
                    <label
                      key={league.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedLeagues.includes(league.id)
                          ? 'border-blue-400 bg-blue-500/20'
                          : 'border-white/20 hover:border-white/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeagues.includes(league.id)}
                        onChange={() => toggleLeague(league.id)}
                        className="w-4 h-4 text-blue-500 bg-white/20 border-white/30 rounded focus:ring-blue-400"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">{league.name}</div>
                        <div className="text-xs text-blue-200">{league.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Generate Guide Button */}
      {selectedLeagues.length > 0 && (
        <div className="text-center">
          <button
            onClick={generateSportsGuide}
            disabled={isLoading}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Generating Guide...</span>
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                <span>Generate Sports Guide</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Sports Guide Results */}
      {sportsGuide.length > 0 && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
          <div className="p-6 border-b border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Your Sports Guide</h3>
              <div className="text-sm text-blue-200">
                {getFilteredGames().length} games found
                {selectedProvider && selectedInput && (
                  <span className="block text-xs mt-1">
                    Filtered by: {matrixInputs.find(i => i.id === selectedInput)?.label}
                  </span>
                )}
              </div>
            </div>
            
            {/* Day Navigation for Grid View */}
            {viewMode === 'grid' && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-2">
                {getNextSevenDays().map((day, index) => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(index)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all border ${
                      selectedDay === index
                        ? 'bg-emerald-600 text-white shadow-lg border-emerald-500/50'
                        : 'bg-slate-700/40 text-blue-200 border-slate-600/50 hover:bg-slate-600/50 hover:text-white'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-6">
            {viewMode === 'list' ? (
              /* List View */
              <div className="grid gap-4">
                {getFilteredGames().map((game) => (
                  <div
                    key={game.id}
                    className="border border-white/30 bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/20 transition-all shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-2">
                          <Star className="w-4 h-4 text-blue-300" />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{game.league}</h4>
                          <p className="text-sm text-blue-200">{game.description}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-1 text-sm text-blue-200">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium text-white">{game.gameTime}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-lg font-bold text-white">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-2">
                          {game.channel.type === 'streaming' ? 
                            <Smartphone className="w-4 h-4 text-purple-400" /> : 
                            <Tv className="w-4 h-4 text-blue-400" />
                          }
                        </div>
                        <div>
                          <div className="font-bold text-white">{game.channel.name}</div>
                          <div className="text-sm text-blue-300 font-medium">
                            {getCostIcon(game.channel.cost)} {game.channel.cost} • Ch. {game.channel.channelNumber || 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleChannelClick(game.channel)}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold shadow-lg border border-emerald-500/30"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Watch Now</span>
                      </button>
                    </div>
                    
                    <div className="mt-3 text-xs text-blue-300 bg-slate-900/30 rounded p-2 border border-slate-700/50">
                      <span className="font-medium text-white">Available on:</span> {game.channel.platforms.join(' • ')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Cable Guide Grid View */
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {/* Grid Header */}
                  <div className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] gap-1 mb-2">
                    <div className="font-bold text-white p-2 bg-slate-800/60 border border-slate-700/50 rounded-md">Time</div>
                    {getChannelsForGrid().map((channel) => (
                      <div key={channel} className="font-bold text-white p-2 text-center bg-slate-800/60 border border-slate-700/50 rounded-md">
                        {channel}
                      </div>
                    ))}
                  </div>
                  
                  {/* Grid Body */}
                  <div className="space-y-1">
                    {getTimeSlots().map((timeSlot) => (
                      <div key={timeSlot.time} className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] gap-1">
                        <div className="p-2 font-bold text-white bg-slate-700/40 border border-slate-600/50 rounded-md">
                          {timeSlot.label}
                        </div>
                        {getChannelsForGrid().map((channel) => {
                          const game = getGamesForSelectedDay().find(g => 
                            g.channel.name === channel && 
                            g.gameTime.includes(timeSlot.time.split(':')[0])
                          )
                          
                          return (
                            <div key={`${timeSlot.time}-${channel}`} className="p-2 border border-white/20 bg-white/5 rounded-md min-h-[60px]">
                              {game ? (
                                <button
                                  onClick={() => handleChannelClick(game.channel)}
                                  className="w-full text-left hover:bg-blue-600/20 hover:border-blue-400/50 rounded-md p-1 transition-colors border border-transparent"
                                >
                                  <div className="text-xs font-bold text-blue-300 mb-1">
                                    {game.league}
                                  </div>
                                  <div className="text-xs text-white font-medium">
                                    {game.awayTeam} @ {game.homeTeam}
                                  </div>
                                  <div className="text-xs text-blue-200 mt-1 font-medium">
                                    {game.gameTime}
                                  </div>
                                </button>
                              ) : (
                                <div className="text-xs text-gray-500 p-1 font-medium">-</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {getGamesForSelectedDay().length === 0 && (
                    <div className="text-center py-8 text-blue-200">
                      <Tv className="w-12 h-12 mx-auto mb-4 text-blue-300" />
                      <p className="text-white font-medium">No games scheduled for {getNextSevenDays()[selectedDay]?.label}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

        {/* Empty State */}
        {selectedLeagues.length === 0 && (
          <div className="text-center py-12">
            <div className="bg-white/10 rounded-full p-4 w-16 h-16 mx-auto mb-4">
              <Calendar className="w-8 h-8 text-blue-300 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No Leagues Selected</h3>
            <p className="text-blue-200">Select one or more sports leagues to generate your viewing guide</p>
          </div>
        )}
        </>
      )}
      </div>
    </div>
  )
}

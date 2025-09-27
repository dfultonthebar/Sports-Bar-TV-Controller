
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
  Zap
} from 'lucide-react'

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
  { id: 'champions', name: 'Champions League', description: 'UEFA Champions League', category: 'international', season: '2024-25' }
]

const SAMPLE_CHANNELS: ChannelInfo[] = [
  { 
    id: 'espn', 
    name: 'ESPN', 
    platforms: ['DirecTV', 'Spectrum', 'Hulu Live', 'YouTube TV'], 
    type: 'cable', 
    cost: 'subscription' 
  },
  { 
    id: 'fox-sports', 
    name: 'Fox Sports', 
    platforms: ['DirecTV', 'Spectrum', 'Sling TV', 'FuboTV'], 
    type: 'cable', 
    cost: 'subscription' 
  },
  { 
    id: 'nbc-sports', 
    name: 'NBC Sports', 
    platforms: ['DirecTV', 'Spectrum', 'Peacock Premium'], 
    type: 'cable', 
    cost: 'subscription' 
  },
  { 
    id: 'cbs-sports', 
    name: 'CBS Sports', 
    platforms: ['DirecTV', 'Spectrum', 'Paramount+'], 
    type: 'cable', 
    cost: 'subscription' 
  },
  { 
    id: 'amazon-prime', 
    name: 'Amazon Prime Video', 
    platforms: ['Fire TV', 'Roku', 'Apple TV'], 
    type: 'streaming', 
    cost: 'premium',
    url: 'https://www.amazon.com/gp/video/storefront'
  },
  { 
    id: 'netflix', 
    name: 'Netflix', 
    platforms: ['All Smart TVs', 'Fire TV', 'Roku'], 
    type: 'streaming', 
    cost: 'subscription',
    url: 'https://www.netflix.com'
  },
  { 
    id: 'paramount-plus', 
    name: 'Paramount+', 
    platforms: ['All Smart TVs', 'Fire TV', 'Roku'], 
    type: 'streaming', 
    cost: 'subscription',
    url: 'https://www.paramountplus.com'
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
  const [selectedDay, setSelectedDay] = useState(0) // 0 = today, 1 = tomorrow, etc.

  useEffect(() => {
    // Load available leagues on component mount
    loadAvailableLeagues()
    loadScheduledRoutines()
  }, [])

  useEffect(() => {
    if (selectedLeagues.length > 0) {
      generateSportsGuide()
    }
  }, [selectedLeagues])

  const loadAvailableLeagues = async () => {
    try {
      const response = await fetch('/api/leagues')
      const result = await response.json()
      
      if (result.success) {
        setAvailableLeagues(result.data)
      } else {
        console.error('Failed to load leagues:', result.error)
        // Fallback to sample leagues
        setAvailableLeagues(SAMPLE_LEAGUES)
      }
    } catch (error) {
      console.error('Error loading leagues:', error)
      // Fallback to sample leagues
      setAvailableLeagues(SAMPLE_LEAGUES)
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
    return sportsGuide.filter(game => game.gameDate === targetDate)
  }

  const getChannelsForGrid = () => {
    const allChannels = new Set<string>()
    sportsGuide.forEach(game => allChannels.add(game.channel.name))
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
    <div className="space-y-6">
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
            <option value="international" className="bg-slate-800">International</option>
          </select>
        </div>
      </div>

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
                {sportsGuide.length} games found
              </div>
            </div>
            
            {/* Day Navigation for Grid View */}
            {viewMode === 'grid' && (
              <div className="flex items-center space-x-2 overflow-x-auto">
                {getNextSevenDays().map((day, index) => (
                  <button
                    key={day.date}
                    onClick={() => setSelectedDay(index)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                      selectedDay === index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                {sportsGuide.map((game) => (
                  <div
                    key={game.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 rounded-lg p-2">
                          <Star className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{game.league}</h4>
                          <p className="text-sm text-gray-500">{game.description}</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{game.gameTime}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-lg font-medium text-gray-900">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        <div className="bg-white rounded-lg p-2 shadow-sm">
                          {game.channel.type === 'streaming' ? 
                            <Smartphone className="w-4 h-4 text-purple-600" /> : 
                            <Tv className="w-4 h-4 text-blue-600" />
                          }
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{game.channel.name}</div>
                          <div className="text-sm text-gray-500">
                            {getCostIcon(game.channel.cost)} {game.channel.cost}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleChannelClick(game.channel)}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Watch Now</span>
                      </button>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Available on: {game.channel.platforms.join(', ')}
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
                    <div className="font-semibold text-gray-700 p-2">Time</div>
                    {getChannelsForGrid().map((channel) => (
                      <div key={channel} className="font-semibold text-gray-700 p-2 text-center bg-gray-50 rounded-md">
                        {channel}
                      </div>
                    ))}
                  </div>
                  
                  {/* Grid Body */}
                  <div className="space-y-1">
                    {getTimeSlots().map((timeSlot) => (
                      <div key={timeSlot.time} className="grid grid-cols-[120px_repeat(auto-fit,minmax(200px,1fr))] gap-1">
                        <div className="p-2 font-medium text-gray-600 bg-gray-50 rounded-md">
                          {timeSlot.label}
                        </div>
                        {getChannelsForGrid().map((channel) => {
                          const game = getGamesForSelectedDay().find(g => 
                            g.channel.name === channel && 
                            g.gameTime.includes(timeSlot.time.split(':')[0])
                          )
                          
                          return (
                            <div key={`${timeSlot.time}-${channel}`} className="p-2 border border-gray-200 rounded-md min-h-[60px]">
                              {game ? (
                                <button
                                  onClick={() => handleChannelClick(game.channel)}
                                  className="w-full text-left hover:bg-blue-50 rounded-md p-1 transition-colors"
                                >
                                  <div className="text-xs font-medium text-blue-600 mb-1">
                                    {game.league}
                                  </div>
                                  <div className="text-xs text-gray-800">
                                    {game.awayTeam} @ {game.homeTeam}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {game.gameTime}
                                  </div>
                                </button>
                              ) : (
                                <div className="text-xs text-gray-400 p-1">-</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  
                  {getGamesForSelectedDay().length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Tv className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No games scheduled for {getNextSevenDays()[selectedDay]?.label}</p>
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
    </div>
  )
}

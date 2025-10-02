
'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Tv, 
  Smartphone, 
  ExternalLink, 
  MapPin,
  Clock,
  Star,
  Filter,
  Search,
  RefreshCw,
  Settings,
  Users,
  Trophy,
  Calendar,
  Zap,
  Radio,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import Link from 'next/link'

interface NFHSGame {
  id: string
  homeTeam: {
    name: string
    school: string
    city: string
    state: string
  }
  awayTeam: {
    name: string
    school: string
    city: string
    state: string
  }
  sport: string
  league: string
  division?: string
  level?: string
  gender?: string
  date: string
  time: string
  venue: string
  status: 'scheduled' | 'live' | 'completed'
  streamUrl?: string
  isNFHSNetwork: boolean
  ticketInfo?: string
  homeScore?: number
  awayScore?: number
  lastSynced?: string
}

interface NFHSSchool {
  id: string
  nfhsId: string
  name: string
  city: string
  state: string
  district?: string
  conferences: string[]
  sports: string[]
  upcomingGames: number
}

interface SyncStatus {
  syncing: boolean
  lastSync?: Date
  message?: string
  error?: string
}

export default function NFHSNetworkPage() {
  const [games, setGames] = useState<NFHSGame[]>([])
  const [schools, setSchools] = useState<NFHSSchool[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ syncing: false })
  const [selectedSport, setSelectedSport] = useState<string>('all')
  const [selectedState, setSelectedState] = useState<string>('WI')
  const [searchTerm, setSearchTerm] = useState('')
  const [showLiveOnly, setShowLiveOnly] = useState(false)
  const [showStreamingOnly, setShowStreamingOnly] = useState(true)

  const sports = [
    'Football', 'Basketball', 'Volleyball', 'Soccer', 'Baseball', 
    'Softball', 'Wrestling', 'Track and Field', 'Swimming', 'Tennis',
    'Cross Country', 'Golf', 'Hockey'
  ]

  const states = ['WI', 'MN', 'IA', 'IL', 'MI', 'IN', 'OH', 'MO']

  useEffect(() => {
    loadNFHSGames()
    loadNearbySchools()
  }, [selectedSport, selectedState])

  const loadNFHSGames = async () => {
    setIsLoading(true)
    try {
      // Build query parameters
      const params = new URLSearchParams()
      if (selectedSport !== 'all') {
        params.append('sport', selectedSport)
      }
      if (showStreamingOnly) {
        params.append('streamingOnly', 'true')
      }
      
      // Fetch from API
      const response = await fetch(`/api/nfhs/games?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setGames(data.games)
      } else {
        console.error('Failed to load games:', data.error)
        setGames([])
      }
    } catch (error) {
      console.error('Error loading NFHS games:', error)
      setGames([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadNearbySchools = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedState) {
        params.append('state', selectedState)
      }
      
      const response = await fetch(`/api/nfhs/schools?${params.toString()}`)
      const data = await response.json()
      
      if (data.success) {
        setSchools(data.schools)
      } else {
        console.error('Failed to load schools:', data.error)
        setSchools([])
      }
    } catch (error) {
      console.error('Error loading schools:', error)
      setSchools([])
    }
  }

  const syncNFHSData = async () => {
    setSyncStatus({ syncing: true, message: 'Syncing with NFHS Network...' })
    
    try {
      const response = await fetch('/api/nfhs/sync', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSyncStatus({
          syncing: false,
          lastSync: new Date(),
          message: data.message
        })
        
        // Reload games and schools after sync
        await loadNFHSGames()
        await loadNearbySchools()
      } else {
        setSyncStatus({
          syncing: false,
          error: data.error || 'Failed to sync data'
        })
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncStatus({
        syncing: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  const filteredGames = games.filter(game => {
    const matchesSearch = game.homeTeam.school.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.awayTeam.school.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.sport.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLive = !showLiveOnly || game.status === 'live'
    const matchesStreaming = !showStreamingOnly || game.isNFHSNetwork
    
    return matchesSearch && matchesLive && matchesStreaming
  })

  const liveGames = filteredGames.filter(game => game.status === 'live')
  const upcomingGames = filteredGames.filter(game => game.status === 'scheduled')
  const streamingGames = filteredGames.filter(game => game.isNFHSNetwork)

  const openNFHSStream = (game: NFHSGame) => {
    if (game.streamUrl) {
      window.open(game.streamUrl, '_blank')
    }
  }

  const launchNFHSApp = () => {
    // In a real implementation, this would send commands to Fire TV/Roku/etc.
    alert('Launching NFHS Network app on streaming device...')
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      {/* Header */}
      <header className="bg-sportsBar-800/90 backdrop-blur-sm border-b border-sportsBar-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 text-slate-400 hover:text-slate-100 hover:bg-sportsBar-800 rounded-lg transition-colors"
              >
                <span>←</span>
                <span>Back</span>
              </Link>
              
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-xl p-2.5 shadow-lg">
                <Play className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">NFHS Network</h1>
                <p className="text-sm text-slate-500">High School Sports Streaming</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={launchNFHSApp}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Tv className="w-4 h-4" />
                <span>Launch App</span>
              </button>
              
              <Link
                href="/remote"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Radio className="w-4 h-4" />
                <span>Remote</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sync Status Banner */}
        {(syncStatus.message || syncStatus.error) && (
          <div className={`mb-6 p-4 rounded-lg border ${
            syncStatus.error 
              ? 'bg-red-50 border-red-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center space-x-3">
              {syncStatus.error ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  syncStatus.error ? 'text-red-800' : 'text-green-800'
                }`}>
                  {syncStatus.error || syncStatus.message}
                </p>
                {syncStatus.lastSync && (
                  <p className="text-xs text-slate-500 mt-1">
                    Last synced: {syncStatus.lastSync.toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSyncStatus({ syncing: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-sportsBar-800/80 backdrop-blur-sm rounded-xl p-6 border border-sportsBar-700/50">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 rounded-lg p-3">
                <Play className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{liveGames.length}</p>
                <p className="text-sm text-slate-500">Live Games</p>
              </div>
            </div>
          </div>
          
          <div className="bg-sportsBar-800/80 backdrop-blur-sm rounded-xl p-6 border border-sportsBar-700/50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 rounded-lg p-3">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{upcomingGames.length}</p>
                <p className="text-sm text-slate-500">Upcoming Games</p>
              </div>
            </div>
          </div>
          
          <div className="bg-sportsBar-800/80 backdrop-blur-sm rounded-xl p-6 border border-sportsBar-700/50">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 rounded-lg p-3">
                <Smartphone className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{streamingGames.length}</p>
                <p className="text-sm text-slate-500">NFHS Streams</p>
              </div>
            </div>
          </div>
          
          <div className="bg-sportsBar-800/80 backdrop-blur-sm rounded-xl p-6 border border-sportsBar-700/50">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 rounded-lg p-3">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-100">{schools.length}</p>
                <p className="text-sm text-slate-500">Local Schools</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-sportsBar-800/80 backdrop-blur-sm rounded-xl p-6 border border-sportsBar-700/50 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search schools, sports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-sportsBar-600 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent bg-sportsBar-900 text-slate-100"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Sport</label>
              <select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="form-select-dark focus:ring-2 focus:ring-red-400 focus:border-transparent w-full"
              >
                <option value="all">All Sports</option>
                {sports.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="form-select-dark focus:ring-2 focus:ring-red-400 focus:border-transparent w-full"
              >
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-slate-300">Filters</label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showLiveOnly}
                  onChange={(e) => setShowLiveOnly(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-400"
                />
                <span className="text-sm text-slate-400">Live games only</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showStreamingOnly}
                  onChange={(e) => setShowStreamingOnly(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-400"
                />
                <span className="text-sm text-slate-400">NFHS streams only</span>
              </label>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={loadNFHSGames}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Games</span>
            </button>
            
            <button
              onClick={syncNFHSData}
              disabled={syncStatus.syncing}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <Zap className={`w-4 h-4 ${syncStatus.syncing ? 'animate-pulse' : ''}`} />
              <span>{syncStatus.syncing ? 'Syncing...' : 'Sync NFHS Data'}</span>
            </button>
          </div>
        </div>

        {/* Games List */}
        <div className="bg-sportsBar-800/80 backdrop-blur-sm rounded-xl border border-sportsBar-700/50">
          <div className="p-6 border-b border-sportsBar-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">High School Games</h3>
              <div className="text-sm text-slate-500">
                {filteredGames.length} games • {liveGames.length} live • {streamingGames.length} streaming
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
                <p className="text-slate-500">Loading NFHS Network games...</p>
              </div>
            ) : filteredGames.length === 0 ? (
              <div className="text-center py-8">
                <Play className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">No games found matching your criteria</p>
                <button
                  onClick={syncNFHSData}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sync NFHS Data
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredGames.map((game) => (
                  <div
                    key={game.id}
                    className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                      game.status === 'live' 
                        ? 'border-red-300 bg-red-50/10' 
                        : 'border-sportsBar-700 hover:border-sportsBar-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`rounded-lg p-2 ${
                          game.status === 'live' ? 'bg-red-100' : 'bg-sportsBar-800'
                        }`}>
                          <Trophy className={`w-4 h-4 ${
                            game.status === 'live' ? 'text-red-600' : 'text-slate-400'
                          }`} />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-100">{game.sport}</h4>
                          <p className="text-sm text-slate-500">
                            {game.league}
                            {game.level && ` • ${game.level}`}
                            {game.gender && ` • ${game.gender}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {game.status === 'live' && (
                          <span className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded-full">
                            LIVE
                          </span>
                        )}
                        {game.isNFHSNetwork && (
                          <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                            STREAM
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-lg font-medium text-slate-100 mb-2">
                      {game.awayTeam.name} @ {game.homeTeam.name}
                    </div>
                    
                    <div className="text-sm text-slate-400 mb-3">
                      {game.awayTeam.school} @ {game.homeTeam.school}
                    </div>
                    
                    <div className="flex items-center justify-between bg-sportsBar-900/50 rounded-lg p-3">
                      <div className="flex items-center space-x-4 text-sm text-slate-400">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(game.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{game.time}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{game.venue}</span>
                        </div>
                      </div>
                      
                      {game.isNFHSNetwork && (
                        <button
                          onClick={() => openNFHSStream(game)}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Watch Stream</span>
                        </button>
                      )}
                    </div>
                    
                    {game.ticketInfo && (
                      <div className="mt-2 text-xs text-slate-500">
                        🎫 {game.ticketInfo}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

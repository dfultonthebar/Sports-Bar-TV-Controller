
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
  Radio
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
  date: string
  time: string
  venue: string
  status: 'scheduled' | 'live' | 'completed'
  streamUrl?: string
  isNFHSNetwork: boolean
  ticketInfo?: string
  homeScore?: number
  awayScore?: number
}

interface NFHSSchool {
  id: string
  name: string
  city: string
  state: string
  district?: string
  conferences: string[]
  sports: string[]
}

export default function NFHSNetworkPage() {
  const [games, setGames] = useState<NFHSGame[]>([])
  const [schools, setSchools] = useState<NFHSSchool[]>([])
  const [isLoading, setIsLoading] = useState(false)
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
      // In a real implementation, this would call the NFHS API
      const mockGames = generateMockNFHSGames()
      setGames(mockGames)
    } catch (error) {
      console.error('Error loading NFHS games:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadNearbySchools = async () => {
    try {
      const mockSchools: NFHSSchool[] = [
        {
          id: 'madison-west',
          name: 'Madison West High School',
          city: 'Madison',
          state: selectedState,
          district: 'Madison Metropolitan School District',
          conferences: ['Big Eight Conference'],
          sports: ['Football', 'Basketball', 'Volleyball', 'Soccer', 'Swimming']
        },
        {
          id: 'milwaukee-hamilton',
          name: 'Milwaukee Hamilton High School', 
          city: 'Milwaukee',
          state: selectedState,
          district: 'Milwaukee Public Schools',
          conferences: ['Milwaukee City Conference'],
          sports: ['Football', 'Basketball', 'Track and Field', 'Wrestling']
        },
        {
          id: 'green-bay-east',
          name: 'Green Bay East High School',
          city: 'Green Bay',
          state: selectedState,
          district: 'Green Bay Area Public School District',
          conferences: ['Fox River Classic Conference'],
          sports: ['Football', 'Basketball', 'Hockey', 'Baseball', 'Softball']
        }
      ]
      setSchools(mockSchools)
    } catch (error) {
      console.error('Error loading schools:', error)
    }
  }

  const generateMockNFHSGames = (): NFHSGame[] => {
    const mockGames: NFHSGame[] = []
    const targetSports = selectedSport === 'all' ? sports.slice(0, 5) : [selectedSport]
    
    const wisConsimSchools = [
      { name: 'Madison West High School', city: 'Madison', team: 'Regents' },
      { name: 'Milwaukee Hamilton High School', city: 'Milwaukee', team: 'Chargers' },
      { name: 'Green Bay East High School', city: 'Green Bay', team: 'Red Devils' },
      { name: 'Appleton North High School', city: 'Appleton', team: 'Lightning' },
      { name: 'Stevens Point High School', city: 'Stevens Point', team: 'Panthers' }
    ]

    // Generate games for the next 5 days
    const today = new Date()
    for (let day = 0; day < 5; day++) {
      const gameDate = new Date(today)
      gameDate.setDate(gameDate.getDate() + day)
      
      targetSports.forEach(sport => {
        const numGames = Math.floor(Math.random() * 2) + 1
        
        for (let i = 0; i < numGames; i++) {
          const homeSchool = wisConsimSchools[Math.floor(Math.random() * wisConsimSchools.length)]
          let awaySchool = wisConsimSchools[Math.floor(Math.random() * wisConsimSchools.length)]
          while (awaySchool.name === homeSchool.name) {
            awaySchool = wisConsimSchools[Math.floor(Math.random() * wisConsimSchools.length)]
          }
          
          const isNFHSStream = Math.random() > 0.3 // 70% chance of being streamed
          const gameHour = Math.floor(Math.random() * 5) + 15 // 3 PM to 7 PM
          const gameTime = `${gameHour > 12 ? gameHour - 12 : gameHour}:00 PM CST`
          
          mockGames.push({
            id: `nfhs-${sport.toLowerCase()}-${day}-${i}`,
            homeTeam: {
              name: homeSchool.team,
              school: homeSchool.name,
              city: homeSchool.city,
              state: selectedState
            },
            awayTeam: {
              name: awaySchool.team,
              school: awaySchool.name,
              city: awaySchool.city,
              state: selectedState
            },
            sport,
            league: `${selectedState} High School ${sport}`,
            division: 'Conference Regular Season',
            date: gameDate.toISOString().split('T')[0],
            time: gameTime,
            venue: `${homeSchool.name} ${getVenueType(sport)}`,
            status: Math.random() > 0.8 ? 'live' : 'scheduled',
            streamUrl: isNFHSStream ? `https://www.nfhsnetwork.com/events/${sport.toLowerCase()}-${Math.floor(Math.random() * 10000)}` : undefined,
            isNFHSNetwork: isNFHSStream,
            ticketInfo: Math.random() > 0.6 ? 'Tickets available at the door - $5' : undefined
          })
        }
      })
    }

    return mockGames.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`)
      const dateB = new Date(`${b.date} ${b.time}`)
      return dateA.getTime() - dateB.getTime()
    })
  }

  const getVenueType = (sport: string): string => {
    const venues = {
      'Football': 'Stadium',
      'Basketball': 'Gymnasium',
      'Volleyball': 'Gymnasium',
      'Soccer': 'Soccer Field',
      'Baseball': 'Baseball Diamond',
      'Softball': 'Softball Field',
      'Swimming': 'Aquatic Center',
      'Tennis': 'Tennis Courts',
      'Track and Field': 'Track Complex',
      'Wrestling': 'Gymnasium',
      'Hockey': 'Ice Arena',
      'Golf': 'Golf Course',
      'Cross Country': 'Cross Country Course'
    }
    return venues[sport] || 'Athletic Facility'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-slate-800 or bg-slate-900/90 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-800 or bg-slate-900 rounded-lg transition-colors"
              >
                <span>←</span>
                <span>Back</span>
              </Link>
              
              <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-xl p-2.5 shadow-lg">
                <Play className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">NFHS Network</h1>
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
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-slate-800 or bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
            <div className="flex items-center space-x-3">
              <div className="bg-red-100 rounded-lg p-3">
                <Play className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{liveGames.length}</p>
                <p className="text-sm text-slate-500">Live Games</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 or bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-100 rounded-lg p-3">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{upcomingGames.length}</p>
                <p className="text-sm text-slate-500">Upcoming Games</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 or bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
            <div className="flex items-center space-x-3">
              <div className="bg-green-100 rounded-lg p-3">
                <Smartphone className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{streamingGames.length}</p>
                <p className="text-sm text-slate-500">NFHS Streams</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 or bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50">
            <div className="flex items-center space-x-3">
              <div className="bg-purple-100 rounded-lg p-3">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{schools.length}</p>
                <p className="text-sm text-slate-500">Local Schools</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 or bg-slate-900/80 backdrop-blur-sm rounded-xl p-6 border border-slate-200/50 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search schools, sports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sport</label>
              <select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent"
              >
                <option value="all">All Sports</option>
                {sports.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">State</label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent"
              >
                {states.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-slate-700">Filters</label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showLiveOnly}
                  onChange={(e) => setShowLiveOnly(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-400"
                />
                <span className="text-sm text-slate-600">Live games only</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showStreamingOnly}
                  onChange={(e) => setShowStreamingOnly(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-400"
                />
                <span className="text-sm text-slate-600">NFHS streams only</span>
              </label>
            </div>
          </div>
          
          <button
            onClick={loadNFHSGames}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Games</span>
          </button>
        </div>

        {/* Games List */}
        <div className="bg-slate-800 or bg-slate-900/80 backdrop-blur-sm rounded-xl border border-slate-200/50">
          <div className="p-6 border-b border-slate-200/50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">High School Games</h3>
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
                <p className="text-slate-500">No games found matching your criteria</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredGames.map((game) => (
                  <div
                    key={game.id}
                    className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                      game.status === 'live' 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`rounded-lg p-2 ${
                          game.status === 'live' ? 'bg-red-100' : 'bg-slate-800 or bg-slate-900'
                        }`}>
                          <Trophy className={`w-4 h-4 ${
                            game.status === 'live' ? 'text-red-600' : 'text-slate-600'
                          }`} />
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-900">{game.sport}</h4>
                          <p className="text-sm text-slate-500">{game.league}</p>
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
                    
                    <div className="text-lg font-medium text-slate-900 mb-2">
                      {game.awayTeam.name} @ {game.homeTeam.name}
                    </div>
                    
                    <div className="text-sm text-slate-600 mb-3">
                      {game.awayTeam.school} @ {game.homeTeam.school}
                    </div>
                    
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center space-x-4 text-sm text-slate-600">
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

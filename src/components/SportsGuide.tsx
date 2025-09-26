
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
  ChevronRight
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
  channel: ChannelInfo
  description?: string
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

  useEffect(() => {
    // Load available leagues on component mount
    loadAvailableLeagues()
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

  const downloadGuide = () => {
    const guideData = {
      generatedAt: new Date().toISOString(),
      selectedLeagues: selectedLeagues.map(id => availableLeagues.find(l => l.id === id)),
      games: sportsGuide
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Sports Viewing Guide</h2>
              <p className="text-gray-600">Find where to watch your favorite sports</p>
            </div>
          </div>
          
          {sportsGuide.length > 0 && (
            <button
              onClick={downloadGuide}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Guide</span>
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search leagues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="professional">Professional</option>
            <option value="college">College</option>
            <option value="international">International</option>
          </select>
        </div>
      </div>

      {/* League Selection */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Select Sports Leagues</h3>
          <p className="text-sm text-gray-600 mt-1">Choose the leagues you want to follow</p>
        </div>
        
        <div className="p-6 space-y-4">
          {Object.entries(leaguesByCategory).map(([category, leagues]) => (
            <div key={category} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleLeagueExpansion(category)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getCategoryIcon(category)}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">{category} Sports</h4>
                    <p className="text-sm text-gray-500">{leagues.length} leagues available</p>
                  </div>
                </div>
                {expandedLeagues.has(category) ? 
                  <ChevronDown className="w-5 h-5 text-gray-400" /> : 
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                }
              </button>
              
              {expandedLeagues.has(category) && (
                <div className="border-t border-gray-200 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {leagues.map((league) => (
                    <label
                      key={league.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedLeagues.includes(league.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLeagues.includes(league.id)}
                        onChange={() => toggleLeague(league.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{league.name}</div>
                        <div className="text-xs text-gray-500">{league.description}</div>
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
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Your Sports Guide</h3>
              <div className="text-sm text-gray-500">
                {sportsGuide.length} games found
              </div>
            </div>
          </div>
          
          <div className="p-6">
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
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedLeagues.length === 0 && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full p-4 w-16 h-16 mx-auto mb-4">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Leagues Selected</h3>
          <p className="text-gray-500">Select one or more sports leagues to generate your viewing guide</p>
        </div>
      )}
    </div>
  )
}

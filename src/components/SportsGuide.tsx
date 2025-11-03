'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar,
  Clock,
  Tv,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Filter
} from 'lucide-react'

/**
 * SIMPLIFIED Sports Guide Component
 * 
 * Version: 5.0.0 - Auto-Loading All Sports
 * 
 * CHANGES:
 * - Removed all league selection UI
 * - Auto-loads ALL sports on component mount
 * - Displays raw data from The Rail Media API
 * - Maximum verbosity logging for debugging
 * - Simple, clean interface
 */

interface SportsListingData {
  [key: string]: string
}

interface SportsListing {
  date?: string
  time: string
  stations?: any
  channel_numbers?: any
  data: SportsListingData
}

interface SportsListingGroup {
  group_title: string
  listings: SportsListing[]
  data_descriptions?: string[]
}

interface SportsGuideData {
  listing_groups: SportsListingGroup[]
}

interface ApiResponse {
  success: boolean
  data?: SportsGuideData
  error?: string
  summary?: {
    listingGroupsCount: number
    totalListings: number
  }
  timestamp?: string
  durationMs?: number
}

export default function SportsGuide() {
  const [guideData, setGuideData] = useState<SportsGuideData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Auto-load data on mount
  useEffect(() => {
    console.log('[SportsGuide] Component mounted - auto-loading sports data')
    loadSportsData()
  }, [])

  const loadSportsData = async () => {
    const requestId = Math.random().toString(36).substring(7)
    console.log(`[SportsGuide] ========== LOADING SPORTS DATA [${requestId}] ==========`)
    console.log(`[SportsGuide] Request started at ${new Date().toISOString()}`)
    
    setIsLoading(true)
    setError(null)
    
    try {
      console.log(`[SportsGuide] Calling API: POST /api/sports-guide`)
      console.log(`[SportsGuide] Requesting 7 days of ALL sports data`)
      
      const fetchStart = Date.now()
      
      const response = await fetch('/api/sports-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days: 7 })
      })
      
      const fetchDuration = Date.now() - fetchStart
      console.log(`[SportsGuide] API response received in ${fetchDuration}ms`)
      console.log(`[SportsGuide] Response status: ${response.status} ${response.statusText}`)
      
      const result: ApiResponse = await response.json()
      console.log(`[SportsGuide] Response parsed successfully`)
      console.log(`[SportsGuide] Response data:`, {
        success: result.success,
        hasData: !!result.data,
        listingGroups: result.data?.listing_groups?.length || 0,
        error: result.error || 'none'
      })
      
      if (result.success && result.data) {
        console.log(`[SportsGuide] ✓ Successfully loaded sports data`)
        console.log(`[SportsGuide] Summary:`, result.summary)
        console.log(`[SportsGuide] Listing groups:`, result.data.listing_groups.map(g => ({
          title: g.group_title,
          listings: g.listings.length
        })))
        
        setGuideData(result.data)
        setLastUpdate(new Date().toISOString())
        setError(null)
        
        // Auto-expand all groups by default
        const allGroups = new Set(result.data.listing_groups.map(g => g.group_title))
        setExpandedGroups(allGroups)
        
        console.log(`[SportsGuide] State updated successfully`)
      } else {
        const errorMsg = result.error || 'Failed to load sports data'
        console.error(`[SportsGuide] ✗ API returned error:`, errorMsg)
        setError(errorMsg)
        setGuideData(null)
      }
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error(`[SportsGuide] ✗ Exception while loading data:`, err)
      console.error(`[SportsGuide] Error message:`, errorMsg)
      setError(errorMsg)
      setGuideData(null)
    } finally {
      setIsLoading(false)
      console.log(`[SportsGuide] ========== LOADING COMPLETE [${requestId}] ==========`)
    }
  }

  const toggleGroup = (groupTitle: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupTitle)) {
      newExpanded.delete(groupTitle)
    } else {
      newExpanded.add(groupTitle)
    }
    setExpandedGroups(newExpanded)
  }

  const filteredData = guideData?.listing_groups.map(group => ({
    ...group,
    listings: group.listings.filter(listing => {
      if (!searchTerm) return true

      const searchLower = searchTerm.toLowerCase()

      // Search in data fields
      const dataMatch = Object.values(listing.data).some(value =>
        value.toLowerCase().includes(searchLower)
      )

      // Search in group title
      const titleMatch = group.group_title.toLowerCase().includes(searchLower)

      return dataMatch || titleMatch
    })
  })).filter(group => group.listings.length > 0) || []

  const totalListings = filteredData.reduce((sum, group) => sum + group.listings.length, 0)

  // Helper function to get sport-specific gradient colors
  const getSportGradient = (sportTitle: string) => {
    const title = sportTitle.toLowerCase()
    if (title.includes('football') || title.includes('nfl')) {
      return {
        gradient: 'from-orange-500/20 to-red-500/20',
        border: 'border-orange-400/30',
        hoverBorder: 'hover:border-orange-400/50',
        headerGradient: 'from-orange-600 to-red-600',
        headerHover: 'hover:from-orange-700 hover:to-red-700'
      }
    } else if (title.includes('basketball') || title.includes('nba')) {
      return {
        gradient: 'from-orange-500/20 to-yellow-500/20',
        border: 'border-orange-400/30',
        hoverBorder: 'hover:border-orange-400/50',
        headerGradient: 'from-orange-600 to-yellow-600',
        headerHover: 'hover:from-orange-700 hover:to-yellow-700'
      }
    } else if (title.includes('baseball') || title.includes('mlb')) {
      return {
        gradient: 'from-blue-500/20 to-red-500/20',
        border: 'border-blue-400/30',
        hoverBorder: 'hover:border-blue-400/50',
        headerGradient: 'from-blue-600 to-red-600',
        headerHover: 'hover:from-blue-700 hover:to-red-700'
      }
    } else if (title.includes('hockey') || title.includes('nhl')) {
      return {
        gradient: 'from-blue-500/20 to-cyan-500/20',
        border: 'border-blue-400/30',
        hoverBorder: 'hover:border-blue-400/50',
        headerGradient: 'from-blue-600 to-cyan-600',
        headerHover: 'hover:from-blue-700 hover:to-cyan-700'
      }
    } else if (title.includes('soccer')) {
      return {
        gradient: 'from-green-500/20 to-emerald-500/20',
        border: 'border-green-400/30',
        hoverBorder: 'hover:border-green-400/50',
        headerGradient: 'from-green-600 to-emerald-600',
        headerHover: 'hover:from-green-700 hover:to-emerald-700'
      }
    } else {
      return {
        gradient: 'from-purple-500/20 to-pink-500/20',
        border: 'border-purple-400/30',
        hoverBorder: 'hover:border-purple-400/50',
        headerGradient: 'from-purple-600 to-pink-600',
        headerHover: 'hover:from-purple-700 hover:to-pink-700'
      }
    }
  }

  // Helper function to detect if a game is live
  const isLiveGame = (listing: SportsListing) => {
    const timeStr = listing.time.toLowerCase()
    return timeStr.includes('live') || timeStr.includes('now') || timeStr.includes('in progress')
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
              All Sports Programming
            </h2>
            <p className="text-slate-300 text-sm">
              Automatically loaded from The Rail Media API - No selection required
            </p>
          </div>

          <button
            onClick={loadSportsData}
            disabled={isLoading}
            className="group relative backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border-2 border-blue-400/30 hover:border-blue-400/50 hover:scale-105 transition-all duration-300 shadow-xl px-4 py-2 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            <div className="relative z-10 flex items-center space-x-2 text-white font-medium">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
            </div>
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center space-x-4 text-sm">
          {isLoading && (
            <div className="flex items-center space-x-2 text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading sports data...</span>
            </div>
          )}
          
          {!isLoading && guideData && (
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>
                Loaded {filteredData.length} sports, {totalListings} games
              </span>
            </div>
          )}
          
          {!isLoading && error && (
            <div className="flex items-center space-x-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          
          {lastUpdate && (
            <div className="flex items-center space-x-2 text-slate-400">
              <Clock className="w-4 h-4" />
              <span>Updated: {new Date(lastUpdate).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search teams, sports, or games..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all duration-300"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-12 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <p className="text-slate-300 text-lg">Loading all sports programming...</p>
          <p className="text-slate-400 text-sm mt-2">Fetching 7 days of games from The Rail Media API</p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="backdrop-blur-xl bg-white/5 border-2 border-red-500/50 rounded-2xl shadow-2xl p-8">
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">Failed to Load Sports Data</h3>
              <p className="text-slate-300 mb-4">{error}</p>
              <button
                onClick={loadSportsData}
                className="group relative backdrop-blur-xl bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded-xl border-2 border-red-400/30 hover:border-red-400/50 hover:scale-105 transition-all duration-300 shadow-xl px-4 py-2 flex items-center space-x-2"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="relative z-10 flex items-center space-x-2 text-white font-medium">
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sports Data Display */}
      {!isLoading && !error && guideData && (
        <div className="space-y-4">
          {filteredData.length === 0 ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-slate-500" />
              <p className="text-slate-300 text-lg">No games match your search</p>
              <p className="text-slate-400 text-sm mt-2">Try a different search term</p>
            </div>
          ) : (
            filteredData.map((group, idx) => {
              const colors = getSportGradient(group.group_title)
              return (
                <div key={idx} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.group_title)}
                    className={`w-full px-6 py-4 bg-gradient-to-r ${colors.headerGradient} ${colors.headerHover} transition-all duration-300 text-left flex items-center justify-between`}
                  >
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        {group.group_title}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {group.listings.length} games
                      </p>
                    </div>
                    <div className="text-white text-xl">
                      {expandedGroups.has(group.group_title) ? '▼' : '▶'}
                    </div>
                  </button>

                  {/* Listings */}
                  {expandedGroups.has(group.group_title) && (
                    <div className="divide-y divide-white/5">
                      {group.listings.map((listing, listingIdx) => {
                        const isLive = isLiveGame(listing)
                        return (
                          <div key={listingIdx} className={`group relative backdrop-blur-xl bg-gradient-to-br ${colors.gradient} rounded-xl border-2 ${colors.border} ${colors.hoverBorder} hover:scale-[1.02] transition-all duration-300 shadow-xl m-4`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl`}></div>
                            <div className="relative z-10 p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  {/* Time with Live Indicator */}
                                  <div className="flex items-center space-x-3 mb-2">
                                    <Clock className="w-4 h-4 text-blue-400" />
                                    <span className="text-blue-400 font-medium">
                                      {listing.date && `${listing.date} - `}{listing.time}
                                    </span>
                                    {isLive && (
                                      <div className="flex items-center space-x-2 ml-2">
                                        <div className="relative">
                                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                                          <span className="absolute inset-0 animate-ping">
                                            <div className="w-3 h-3 bg-red-500 rounded-full opacity-75"></div>
                                          </span>
                                        </div>
                                        <span className="text-red-400 text-xs font-bold uppercase">Live</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Game Data */}
                                  <div className="space-y-1">
                                    {Object.entries(listing.data).map(([key, value], dataIdx) => (
                                      <div key={dataIdx} className="flex items-start space-x-2 text-sm">
                                        <span className="text-slate-400 capitalize min-w-[120px]">
                                          {key.replace(/_/g, ' ')}:
                                        </span>
                                        <span className="text-white font-medium">
                                          {value}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Stations */}
                                  {listing.stations && (
                                    <div className="mt-2 flex items-center space-x-2">
                                      <Tv className="w-4 h-4 text-green-400" />
                                      <span className="text-green-400 text-sm">
                                        Available on: {typeof listing.stations === 'object'
                                          ? Object.values(listing.stations).join(', ')
                                          : listing.stations}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !guideData && (
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-2xl p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-500" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">No Data Loaded</h3>
          <p className="text-slate-400 mb-6">Click refresh to load sports programming</p>
          <button
            onClick={loadSportsData}
            className="group relative backdrop-blur-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl border-2 border-blue-400/30 hover:border-blue-400/50 hover:scale-105 transition-all duration-300 shadow-xl px-4 py-2 mx-auto inline-flex items-center space-x-2"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
            <div className="relative z-10 flex items-center space-x-2 text-white font-medium">
              <RefreshCw className="w-4 h-4" />
              <span>Load Sports Data</span>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

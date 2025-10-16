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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              🏆 All Sports Programming
            </h2>
            <p className="text-slate-300 text-sm">
              Automatically loaded from The Rail Media API - No selection required
            </p>
          </div>
          
          <button
            onClick={loadSportsData}
            disabled={isLoading}
            className="btn-primary flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
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
            className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card p-12 text-center">
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
          <p className="text-slate-300 text-lg">Loading all sports programming...</p>
          <p className="text-slate-400 text-sm mt-2">Fetching 7 days of games from The Rail Media API</p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="card p-8 border-2 border-red-500/50">
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2">Failed to Load Sports Data</h3>
              <p className="text-slate-300 mb-4">{error}</p>
              <button
                onClick={loadSportsData}
                className="btn-primary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sports Data Display */}
      {!isLoading && !error && guideData && (
        <div className="space-y-4">
          {filteredData.length === 0 ? (
            <div className="card p-8 text-center">
              <Filter className="w-12 h-12 mx-auto mb-4 text-slate-500" />
              <p className="text-slate-300 text-lg">No games match your search</p>
              <p className="text-slate-400 text-sm mt-2">Try a different search term</p>
            </div>
          ) : (
            filteredData.map((group, idx) => (
              <div key={idx} className="card overflow-hidden">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.group_title)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-colors text-left flex items-center justify-between"
                >
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {group.group_title}
                    </h3>
                    <p className="text-blue-100 text-sm">
                      {group.listings.length} games
                    </p>
                  </div>
                  <div className="text-white">
                    {expandedGroups.has(group.group_title) ? '▼' : '▶'}
                  </div>
                </button>

                {/* Listings */}
                {expandedGroups.has(group.group_title) && (
                  <div className="divide-y divide-slate-700">
                    {group.listings.map((listing, listingIdx) => (
                      <div key={listingIdx} className="p-4 hover:bg-sportsBar-700/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Time */}
                            <div className="flex items-center space-x-2 mb-2">
                              <Clock className="w-4 h-4 text-blue-400" />
                              <span className="text-blue-400 font-medium">
                                {listing.date && `${listing.date} - `}{listing.time}
                              </span>
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
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !guideData && (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-500" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">No Data Loaded</h3>
          <p className="text-slate-400 mb-6">Click refresh to load sports programming</p>
          <button
            onClick={loadSportsData}
            className="btn-primary mx-auto"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Load Sports Data
          </button>
        </div>
      )}
    </div>
  )
}

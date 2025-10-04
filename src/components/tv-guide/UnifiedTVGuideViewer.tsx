
'use client'

import React, { useState, useEffect } from 'react'
import type { UnifiedChannel, UnifiedProgram } from '@/lib/unified-tv-guide-service'

interface TimeSlot {
  time: string
  hour: number
}

interface GuideData {
  success: boolean
  channels: UnifiedChannel[]
  programs: UnifiedProgram[]
  sources: {
    gracenote: { configured: boolean; used: boolean }
    spectrum: { configured: boolean; used: boolean }
  }
  coverage: {
    totalChannels: number
    sportsChannels: number
    premiumChannels: number
  }
}

const UnifiedTVGuideViewer: React.FC = () => {
  const [guideData, setGuideData] = useState<GuideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'all' | 'sports'>('sports')
  const [currentSports, setCurrentSports] = useState<UnifiedProgram[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnifiedProgram[]>([])

  useEffect(() => {
    loadGuideData()
    loadCurrentSports()
  }, [selectedDate, viewMode])

  const loadGuideData = async () => {
    try {
      setLoading(true)
      setError(null)

      const startTime = new Date(selectedDate)
      startTime.setHours(0, 0, 0, 0)
      const endTime = new Date(selectedDate)
      endTime.setHours(23, 59, 59, 999)

      let url = `/api/tv-guide/unified?action=guide&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`
      
      if (viewMode === 'sports') {
        url = `/api/tv-guide/unified?action=sports&startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (viewMode === 'sports') {
        // For sports view, create a simplified guide structure
        setGuideData({
          success: data.success,
          channels: [], // Will be populated from programs
          programs: data.programs || [],
          sources: { gracenote: { configured: true, used: true }, spectrum: { configured: true, used: true } },
          coverage: {
            totalChannels: 0,
            sportsChannels: data.count || 0,
            premiumChannels: 0
          }
        })
      } else {
        setGuideData(data)
      }
    } catch (error) {
      console.error('Error loading guide data:', error)
      setError('Failed to load TV guide data')
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentSports = async () => {
    try {
      const response = await fetch('/api/tv-guide/unified?action=current-sports')
      const data = await response.json()
      
      if (data.success) {
        setCurrentSports(data.programs)
      }
    } catch (error) {
      console.error('Error loading current sports:', error)
    }
  }

  const searchPrograms = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/tv-guide/unified?action=search&query=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (data.success) {
        setSearchResults(data.results)
      }
    } catch (error) {
      console.error('Error searching programs:', error)
    }
  }

  const formatTime = (timeString: string): string => {
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  }

  const isCurrentlyAiring = (program: UnifiedProgram): boolean => {
    const now = new Date()
    const start = new Date(program.startTime)
    const end = new Date(program.endTime)
    return start <= now && end >= now
  }

  const getSportsInfo = (program: UnifiedProgram): string => {
    if (!program.sportsInfo) return ''
    
    const parts: any[] = []
    if (program.sportsInfo.league) parts.push(program.sportsInfo.league)
    if (program.sportsInfo.homeTeam && program.sportsInfo.awayTeam) {
      parts.push(`${program.sportsInfo.awayTeam} @ ${program.sportsInfo.homeTeam}`)
    } else if (program.sportsInfo.teams) {
      parts.push(program.sportsInfo.teams.join(' vs '))
    }
    if (program.sportsInfo.venue) parts.push(program.sportsInfo.venue)
    
    return parts.join(' • ')
  }

  if (loading && !guideData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg">Loading TV guide...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="font-semibold text-red-800">Error Loading TV Guide</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={loadGuideData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 bg-slate-800 or bg-slate-900">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">TV Guide</h1>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="date" className="font-medium">Date:</label>
            <input
              type="date"
              id="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="border rounded px-3 py-2"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="font-medium">View:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'all' | 'sports')}
              className="border rounded px-3 py-2"
            >
              <option value="sports">Sports Only</option>
              <option value="all">All Channels</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search programs..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                searchPrograms(e.target.value)
              }}
              className="border rounded px-3 py-2 w-64"
            />
          </div>
        </div>

        {/* Data Sources Status */}
        {guideData?.sources && (
          <div className="flex items-center space-x-4 text-sm text-slate-300 mb-4">
            <span>Data Sources:</span>
            <span className={`px-2 py-1 rounded text-xs ${guideData.sources.gracenote.used ? 'bg-green-100 text-green-700' : 'bg-slate-800 or bg-slate-900 text-slate-400'}`}>
              Gracenote {guideData.sources.gracenote.used ? '✓' : '✗'}
            </span>
            <span className={`px-2 py-1 rounded text-xs ${guideData.sources.spectrum.used ? 'bg-green-100 text-green-700' : 'bg-slate-800 or bg-slate-900 text-slate-400'}`}>
              Spectrum {guideData.sources.spectrum.used ? '✓' : '✗'}
            </span>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchQuery && searchResults.length > 0 && (
        <div className="mb-6 bg-slate-800 or bg-slate-900 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Search Results ({searchResults.length})</h3>
          <div className="space-y-2">
            {searchResults.slice(0, 10).map((program, index) => (
              <div key={index} className="flex items-start justify-between p-3 bg-slate-800 or bg-slate-900 rounded border">
                <div className="flex-1">
                  <h4 className="font-medium">{program.title}</h4>
                  {program.episodeTitle && (
                    <p className="text-sm text-slate-300">{program.episodeTitle}</p>
                  )}
                  <p className="text-sm text-slate-400 mt-1">
                    {formatTime(program.startTime)} - {formatTime(program.endTime)} | {formatDuration(program.duration)}
                  </p>
                  {program.isSports && program.sportsInfo && (
                    <p className="text-sm text-blue-600 mt-1">{getSportsInfo(program)}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs ${program.source === 'gracenote' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {program.source}
                  </span>
                  {isCurrentlyAiring(program) && (
                    <div className="text-xs text-red-600 font-semibold mt-1">LIVE NOW</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Currently Airing Sports */}
      {currentSports.length > 0 && (
        <div className="mb-6 bg-green-50 p-4 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-800 mb-3">🔴 Live Sports Now</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentSports.map((program, index) => (
              <div key={index} className="bg-slate-800 or bg-slate-900 p-3 rounded border border-green-200">
                <h4 className="font-medium text-green-800">{program.title}</h4>
                {program.sportsInfo && (
                  <p className="text-sm text-green-600 mt-1">{getSportsInfo(program)}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  Ends at {formatTime(program.endTime)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TV Guide Grid */}
      {guideData && (
        <div className="bg-slate-800 or bg-slate-900 rounded-lg border">
          <div className="p-4 border-b bg-slate-800 or bg-slate-900">
            <h3 className="font-semibold">
              {viewMode === 'sports' ? 'Sports Programming' : 'All Channels'} - {selectedDate.toLocaleDateString()}
            </h3>
            {guideData.coverage && (
              <p className="text-sm text-slate-300 mt-1">
                {viewMode === 'sports' 
                  ? `${guideData.programs.length} sports programs found`
                  : `${guideData.coverage.totalChannels} channels, ${guideData.coverage.sportsChannels} sports channels`
                }
              </p>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {viewMode === 'sports' ? (
              // Sports-focused view
              <div className="space-y-2 p-4">
                {guideData.programs
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map((program, index) => (
                    <div 
                      key={index} 
                      className={`p-4 border rounded-lg ${isCurrentlyAiring(program) ? 'bg-red-50 border-red-200' : 'bg-slate-800 or bg-slate-900'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold">{program.title}</h4>
                          {program.episodeTitle && (
                            <p className="text-gray-600">{program.episodeTitle}</p>
                          )}
                          {program.description && (
                            <p className="text-sm text-slate-400 mt-1">{program.description}</p>
                          )}
                          {program.sportsInfo && (
                            <p className="text-sm text-blue-600 mt-2">{getSportsInfo(program)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          {isCurrentlyAiring(program) && (
                            <span className="inline-block px-2 py-1 bg-red-500 text-white text-xs rounded-full mb-2">
                              LIVE
                            </span>
                          )}
                          <p className="text-sm font-medium">
                            {formatTime(program.startTime)} - {formatTime(program.endTime)}
                          </p>
                          <p className="text-xs text-slate-400">{formatDuration(program.duration)}</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${program.source === 'gracenote' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {program.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                }
                {guideData.programs.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    No sports programming found for this date.
                  </div>
                )}
              </div>
            ) : (
              // Traditional grid view (for all channels)
              <div className="p-4">
                <p className="text-slate-400 text-center py-8">
                  Traditional grid view coming soon. For now, use Sports view to see programming.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="mt-6 flex justify-between items-center">
        <button
          onClick={loadGuideData}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh Guide Data'}
        </button>
        
        <div className="text-sm text-slate-400">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

export default UnifiedTVGuideViewer

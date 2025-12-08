'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Smartphone, Play, Calendar, RefreshCw, AlertCircle, Tv2, CheckCircle2, Trophy, Tv } from 'lucide-react'

import { logger } from '@/lib/logger'

// Big Ten Game interface
interface BigTenGame {
  id: string
  title: string
  shortName: string
  sport: 'Basketball' | 'Football'
  date: string
  startTime: string
  status: string
  isLive: boolean
  isCompleted: boolean
  teams: {
    home: { name: string; abbreviation: string; score?: string; logo?: string }
    away: { name: string; abbreviation: string; score?: string; logo?: string }
  }
  broadcast: {
    network: string
    isOnBTN: boolean
    isOnBigTenPlus: boolean
  }
  venue?: string
  deepLink?: string
}

interface StreamingApp {
  app: {
    id: string
    name: string
    packageName: string
    category: string
  }
  isInstalled: boolean
  deviceId: string
  lastChecked: string
}

interface StreamingEvent {
  id: string
  title: string
  sport: string
  league: string
  startTime: string
  endTime: string
  isLive: boolean
  teams?: { home: string; away: string }
  streamingApp: string
  appPackage: string
  deepLink?: string
}

interface AppEvents {
  app: {
    id: string
    name: string
    packageName: string
    category: string
  }
  events: StreamingEvent[]
}

interface FireTVStreamingGuideProps {
  deviceId: string
  deviceName: string
  ipAddress: string
  port: number
}

export default function FireTVStreamingGuide({
  deviceId,
  deviceName,
  ipAddress,
  port
}: FireTVStreamingGuideProps) {
  const [loading, setLoading] = useState(false)
  const [installedApps, setInstalledApps] = useState<StreamingApp[]>([])
  const [appEvents, setAppEvents] = useState<AppEvents[]>([])
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'live' | 'today' | 'upcoming'>('all')
  const [error, setError] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [bigTenGames, setBigTenGames] = useState<BigTenGame[]>([])
  const [bigTenLoading, setBigTenLoading] = useState(false)
  const [showBigTen, setShowBigTen] = useState(true)

  useEffect(() => {
    loadData()
    loadBigTenGames()

    // Auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      logger.info('[FireTV Guide] Auto-refreshing data...')
      loadData()
      loadBigTenGames()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(refreshInterval)
  }, [deviceId, ipAddress])

  const loadBigTenGames = async () => {
    setBigTenLoading(true)
    try {
      const response = await fetch('/api/sports/big-ten')
      const data = await response.json()

      if (data.success) {
        setBigTenGames(data.games || [])
        logger.info(`[FireTV Guide] Loaded ${data.games?.length || 0} Big Ten games`)
      }
    } catch (err) {
      logger.error('[FireTV Guide] Error loading Big Ten games:', err)
    } finally {
      setBigTenLoading(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    setError('')

    try {
      // First, detect installed apps
      const appsResponse = await fetch('/api/streaming/apps/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          ipAddress,
          port,
          forceRefresh: true
        })
      })

      const appsData = await appsResponse.json()

      if (!appsData.success) {
        throw new Error(appsData.error || 'Failed to detect apps')
      }

      setInstalledApps(appsData.apps || [])

      // Then, get events for installed apps
      const eventsResponse = await fetch(
        `/api/streaming/events?type=installed&deviceId=${deviceId}&ipAddress=${ipAddress}&port=${port}`
      )

      const eventsData = await eventsResponse.json()

      if (!eventsData.success) {
        throw new Error(eventsData.error || 'Failed to get events')
      }

      setAppEvents(eventsData.apps || [])
      setLastUpdated(new Date())
    } catch (err: any) {
      logger.error('Error loading Fire TV guide:', err)
      setError(err.message || 'Failed to load streaming guide')
    } finally {
      setLoading(false)
    }
  }

  const launchApp = async (appId: string, deepLink?: string) => {
    try {
      const response = await fetch('/api/streaming/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          ipAddress,
          port,
          appId,
          deepLink
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to launch app')
      }
    } catch (err: any) {
      logger.error('Error launching app:', err)
      setError(err.message || 'Failed to launch app')
    }
  }

  // Networks that are cable/broadcast only (not streaming apps)
  const CABLE_BROADCAST_NETWORKS = [
    'FOX', 'CBS', 'NBC', 'ABC', 'ESPN', 'ESPN2', 'ESPNU', 'FS1', 'FS2',
    'TNT', 'TBS', 'USA', 'NBCSN', 'NFL Network', 'MLB Network', 'NHL Network',
    'NBA TV', 'Golf Channel', 'Tennis Channel', 'CBSSN', 'truTV'
  ]

  // Check if event is streaming-only (not on cable/broadcast)
  const isStreamingContent = (event: StreamingEvent): boolean => {
    // If no broadcast info, assume it's streaming
    if (!event.broadcast || event.broadcast.length === 0) return true

    const broadcasts = Array.isArray(event.broadcast) ? event.broadcast : [event.broadcast]
    const networkNames = broadcasts.map(b => typeof b === 'string' ? b : b).flat()

    // Check if ALL broadcasts are cable/broadcast networks
    const allCableBroadcast = networkNames.every(network =>
      CABLE_BROADCAST_NETWORKS.some(cn =>
        network.toUpperCase().includes(cn.toUpperCase())
      )
    )

    // If it's ONLY on cable/broadcast, it's not streaming content
    return !allCableBroadcast
  }

  const getFilteredEvents = () => {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    let allEvents: StreamingEvent[] = []
    appEvents.forEach(appData => {
      allEvents = allEvents.concat(
        appData.events.map(event => ({
          ...event,
          // Don't override streamingApp if it exists, otherwise use app.id
          streamingApp: event.streamingApp || appData.app.id,
          appPackage: appData.app.packageName
        }))
      )
    })

    // Filter out cable/broadcast-only events - only show streaming content
    allEvents = allEvents.filter(isStreamingContent)

    switch (selectedFilter) {
      case 'live':
        return allEvents.filter(e => e.isLive)
      case 'today':
        return allEvents.filter(e => {
          const eventTime = new Date(e.startTime)
          return eventTime >= todayStart && eventTime <= todayEnd
        })
      case 'upcoming':
        return allEvents.filter(e => new Date(e.startTime) > now && !e.isLive)
      default:
        return allEvents
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eventDate = new Date(date)
    eventDate.setHours(0, 0, 0, 0)

    if (eventDate.getTime() === today.getTime()) {
      return 'Today'
    }

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (eventDate.getTime() === tomorrow.getTime()) {
      return 'Tomorrow'
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const filteredEvents = getFilteredEvents()
  const installedCount = installedApps.filter(a => a.isInstalled).length

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            Streaming Guide
          </h3>
          <p className="text-xs text-slate-400">{deviceName}</p>
        </div>
        <Button
          onClick={loadData}
          disabled={loading}
          size="sm"
          variant="outline"
          className="text-slate-300 border-slate-600"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Installed Apps Summary */}
      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">
              {installedCount} streaming apps installed
            </span>
          </div>
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Installed Apps - Quick Launch */}
      {installedApps.filter(a => a.isInstalled).length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Quick Launch</h4>
          <div className="grid grid-cols-2 gap-2">
            {installedApps
              .filter(a => a.isInstalled)
              .map((appData) => (
                <Button
                  key={appData.app.id}
                  onClick={() => launchApp(appData.app.id)}
                  className="flex items-center justify-start space-x-2 bg-slate-700 hover:bg-slate-600 text-white p-3 h-auto"
                >
                  <Smartphone className="w-4 h-4 text-blue-400" />
                  <span className="text-sm truncate">{appData.app.name}</span>
                </Button>
              ))}
          </div>
        </div>
      )}

      {/* Big Ten Games Section */}
      <div className="mb-4">
        <div
          className="flex items-center justify-between cursor-pointer mb-2"
          onClick={() => setShowBigTen(!showBigTen)}
        >
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center">
            <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
            Big Ten Games
            {bigTenGames.filter(g => g.isLive).length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                {bigTenGames.filter(g => g.isLive).length} LIVE
              </span>
            )}
          </h4>
          <span className="text-xs text-slate-500">{showBigTen ? '▼' : '▶'}</span>
        </div>

        {showBigTen && (
          <div className="space-y-2">
            {bigTenLoading ? (
              <div className="text-center py-4">
                <RefreshCw className="w-5 h-5 text-yellow-400 animate-spin mx-auto" />
              </div>
            ) : bigTenGames.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">
                No Big Ten games scheduled
              </div>
            ) : (
              bigTenGames.slice(0, 5).map((game) => (
                <div
                  key={game.id}
                  className={`rounded-lg p-3 border transition-all cursor-pointer ${
                    game.isLive
                      ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
                      : 'bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20'
                  }`}
                  onClick={() => launchApp('com.btn2go', game.deepLink)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        {game.isLive && (
                          <span className="flex items-center space-x-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                            <span>LIVE</span>
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          game.sport === 'Football' ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'
                        }`}>
                          {game.sport}
                        </span>
                        {game.broadcast.isOnBTN && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">
                            BTN
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-white">
                        {game.teams.away.abbreviation || game.teams.away.name} @ {game.teams.home.abbreviation || game.teams.home.name}
                      </h4>
                      {game.isLive && game.teams.away.score && (
                        <p className="text-lg font-bold text-white mt-1">
                          {game.teams.away.score} - {game.teams.home.score}
                        </p>
                      )}
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="text-xs text-slate-400">
                          <Tv className="w-3 h-3 inline mr-1" />
                          {game.broadcast.network}
                        </span>
                        <span className="text-xs text-slate-500">
                          {game.isLive ? game.status : game.startTime}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className={`ml-2 ${
                        game.broadcast.isOnBTN || game.broadcast.isOnBigTenPlus
                          ? 'bg-yellow-600 hover:bg-yellow-700'
                          : 'bg-slate-600 hover:bg-slate-700'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation()
                        launchApp('com.btn2go', game.deepLink)
                      }}
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {bigTenGames.length > 5 && (
              <div className="text-center text-xs text-slate-500">
                +{bigTenGames.length - 5} more games
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 mb-4">
        {(['all', 'live', 'today', 'upcoming'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedFilter === filter
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {filter === 'all' && 'All Events'}
            {filter === 'live' && '🔴 Live'}
            {filter === 'today' && 'Today'}
            {filter === 'upcoming' && 'Upcoming'}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-slate-400">Loading events...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-50" />
            <p className="text-sm text-slate-400">
              {selectedFilter === 'live'
                ? 'No live events right now'
                : selectedFilter === 'today'
                ? 'No events scheduled for today'
                : 'No upcoming events found'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {installedCount === 0
                ? 'No streaming apps detected on this device'
                : 'Check back later for new events'}
            </p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition-all cursor-pointer border border-slate-600/50 hover:border-blue-500/50"
              onClick={() => launchApp(event.streamingApp, event.deepLink)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    {event.isLive && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        <span>LIVE</span>
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-medium">{event.league}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate">{event.title}</h4>
                  {event.teams && (
                    <p className="text-xs text-slate-400 mt-1">
                      {event.teams.away} @ {event.teams.home}
                    </p>
                  )}
                  <div className="flex items-center space-x-3 mt-2">
                    <span className="text-xs text-blue-400 flex items-center">
                      <Tv2 className="w-3 h-3 mr-1" />
                      {event.streamingApp}
                    </span>
                    <span className="text-xs text-slate-500">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {formatDate(event.startTime)} at {formatTime(event.startTime)}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="ml-2 bg-blue-600 hover:bg-blue-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    launchApp(event.streamingApp, event.deepLink)
                  }}
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredEvents.length > 0 && (
        <div className="mt-3 text-center text-xs text-slate-500">
          Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}


'use client'

import { useState, useEffect } from 'react'

interface UnifiedEvent {
  id: string
  source: string
  title: string
  sport: string
  date: string
  startTime: string
  status: 'upcoming' | 'live' | 'final'
  teams?: {
    home: string
    away: string
    homeScore?: number
    awayScore?: number
  }
  league?: string
  broadcast?: string[]
  streamingApp?: string
  deepLink?: string
}

interface LiveEventsPanelProps {
  deviceId?: string
  ipAddress?: string
  port?: number
}

export function LiveEventsPanel({ deviceId, ipAddress, port = 5555 }: LiveEventsPanelProps) {
  const [events, setEvents] = useState<UnifiedEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventType, setEventType] = useState<'live' | 'today' | 'upcoming'>('live')
  const [launchingEvent, setLaunchingEvent] = useState<string | null>(null)

  useEffect(() => {
    loadEvents()
  }, [eventType])

  const loadEvents = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const url = new URL('/api/streaming/events', window.location.origin)
      url.searchParams.append('type', eventType)

      const response = await fetch(url.toString())
      const data = await response.json()

      if (data.success) {
        setEvents(data.events || [])
      } else {
        setError(data.error || 'Failed to load events')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load events')
    } finally {
      setIsLoading(false)
    }
  }

  const launchEvent = async (event: UnifiedEvent) => {
    if (!deviceId || !ipAddress || !event.streamingApp) {
      setError('Cannot launch: missing device info or streaming app')
      return
    }

    setLaunchingEvent(event.id)
    setError(null)

    try {
      const response = await fetch('/api/streaming/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          ipAddress,
          appId: event.streamingApp,
          port,
          deepLink: event.deepLink
        })
      })

      const data = await response.json()

      if (!data.success) {
        setError(data.error || 'Failed to launch event')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to launch event')
    } finally {
      setLaunchingEvent(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded animate-pulse">LIVE</span>
      case 'upcoming':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">Upcoming</span>
      case 'final':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">Final</span>
      default:
        return null
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sports Events</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setEventType('live')}
            className={`px-3 py-1 text-sm rounded-md ${
              eventType === 'live'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setEventType('today')}
            className={`px-3 py-1 text-sm rounded-md ${
              eventType === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setEventType('upcoming')}
            className={`px-3 py-1 text-sm rounded-md ${
              eventType === 'upcoming'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Upcoming
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Events List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No {eventType} events found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(event.status)}
                    <span className="text-xs text-gray-500 uppercase">{event.sport}</span>
                    {event.league && (
                      <span className="text-xs text-gray-500">• {event.league}</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-lg">{event.title}</h4>
                </div>
              </div>

              {event.teams && (
                <div className="my-3 p-3 bg-gray-50 rounded">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{event.teams.away}</span>
                        {event.teams.awayScore !== undefined && (
                          <span className="font-bold text-lg">{event.teams.awayScore}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{event.teams.home}</span>
                        {event.teams.homeScore !== undefined && (
                          <span className="font-bold text-lg">{event.teams.homeScore}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <div>{formatTime(event.startTime)}</div>
                  {event.broadcast && event.broadcast.length > 0 && (
                    <div className="text-xs">📺 {event.broadcast.join(', ')}</div>
                  )}
                  {event.source && (
                    <div className="text-xs text-gray-400 mt-1">
                      Source: {event.source.toUpperCase()}
                    </div>
                  )}
                </div>

                {deviceId && ipAddress && event.streamingApp && (
                  <button
                    onClick={() => launchEvent(event)}
                    disabled={launchingEvent === event.id}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {launchingEvent === event.id ? 'Launching...' : 'Watch'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={loadEvents}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Loading...' : 'Refresh Events'}
      </button>
    </div>
  )
}

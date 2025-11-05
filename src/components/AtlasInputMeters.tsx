'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, Mic, Volume2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'

import { logger } from '@/lib/logger'
interface InputMeter {
  index: number
  name: string
  level: number // dB value
  peak: number
  clipping: boolean
}

interface AtlasInputMetersProps {
  processorId?: string
  processorIp: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function AtlasInputMeters({
  processorId,
  processorIp,
  autoRefresh = false,
  refreshInterval = 1000 // 1000ms for HTTP polling
}: AtlasInputMetersProps) {
  const [inputMeters, setInputMeters] = useState<InputMeter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (autoRefresh) {
      connectWebSocket()
    } else {
      // Use HTTP polling instead of WebSocket
      fetchInputMeters()
      pollingIntervalRef.current = setInterval(fetchInputMeters, refreshInterval)
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [processorId, processorIp, autoRefresh, refreshInterval])

  const connectWebSocket = () => {
    try {
      // Connect to WebSocket for real-time meter updates
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/atlas/meter-stream?processorIp=${processorIp}`
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        logger.info('WebSocket connected for meter updates')
        setIsConnected(true)
        setError(null)
        setLoading(false)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'meter-update' && data.meters) {
            setInputMeters(data.meters)
          }
        } catch (err) {
          logger.error('Error parsing WebSocket message:', err)
        }
      }

      wsRef.current.onerror = (err) => {
        logger.error('WebSocket error:', { data: err })
        setError('Connection error')
        setIsConnected(false)
      }

      wsRef.current.onclose = () => {
        logger.info('WebSocket closed')
        setIsConnected(false)
        
        // Attempt to reconnect after 3 seconds
        if (autoRefresh) {
          reconnectTimeoutRef.current = setTimeout(() => {
            logger.info('Attempting to reconnect...')
            connectWebSocket()
          }, 3000)
        }
      }
    } catch (err) {
      logger.error('Error connecting WebSocket:', err)
      setError('Failed to connect')
      setLoading(false)
    }
  }

  const fetchInputMeters = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/atlas/input-meters?processorIp=${processorIp}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch input meters')
      }

      const data = await response.json()
      setInputMeters(data.meters || [])
      setError(null)
    } catch (err) {
      logger.error('Error fetching input meters:', err)
      setError(err instanceof Error ? err.message : 'Failed to load meters')
    } finally {
      setLoading(false)
    }
  }

  const getMeterColor = (level: number): string => {
    if (level > -6) return 'bg-red-500' // Clipping zone
    if (level > -12) return 'bg-yellow-500' // Warning zone
    if (level > -40) return 'bg-green-500' // Good zone
    return 'bg-slate-600' // Low signal
  }

  const getMeterWidth = (level: number): number => {
    // Convert dB to percentage (assuming -80dB to 0dB range)
    const percentage = ((level + 80) / 80) * 100
    return Math.max(0, Math.min(100, percentage))
  }

  const formatDb = (value: number): string => {
    return value > -80 ? `${value.toFixed(1)} dB` : '-∞ dB'
  }

  if (loading && inputMeters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Input Meters</span>
          </CardTitle>
          <CardDescription>Loading meter data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && inputMeters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-red-400" />
            <span>Input Meters</span>
          </CardTitle>
          <CardDescription className="text-red-400">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <button 
            onClick={fetchInputMeters}
            className="btn-primary w-full"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <CardTitle>Input Meters</CardTitle>
            {isConnected && (
              <span className="flex items-center space-x-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span>Live</span>
              </span>
            )}
          </div>
          {!autoRefresh && (
            <button 
              onClick={fetchInputMeters}
              className="btn-secondary text-sm"
              disabled={loading}
            >
              Refresh
            </button>
          )}
        </div>
        <CardDescription>
          Real-time audio input levels from Atlas processor
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {inputMeters.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No input meters available
            </div>
          ) : (
            inputMeters.map((meter) => (
              <div key={meter.index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Mic className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-200">{meter.name}</span>
                    {meter.clipping && (
                      <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                    )}
                  </div>
                  <span className={`font-mono ${meter.clipping ? 'text-red-400' : 'text-slate-300'}`}>
                    {formatDb(meter.level)}
                  </span>
                </div>
                
                {/* Meter bar */}
                <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden">
                  {/* Current level */}
                  <div 
                    className={`absolute left-0 top-0 h-full transition-all duration-75 ${getMeterColor(meter.level)}`}
                    style={{ width: `${getMeterWidth(meter.level)}%` }}
                  />
                  
                  {/* Peak indicator */}
                  {meter.peak > -80 && (
                    <div 
                      className="absolute top-0 h-full w-0.5 bg-white"
                      style={{ left: `${getMeterWidth(meter.peak)}%` }}
                    />
                  )}
                  
                  {/* dB scale markers */}
                  <div className="absolute inset-0 flex items-center justify-between px-2 text-xs text-slate-500 pointer-events-none">
                    <span>-80</span>
                    <span>-40</span>
                    <span>-20</span>
                    <span>-12</span>
                    <span>-6</span>
                    <span>0</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

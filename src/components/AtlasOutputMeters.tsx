'use client'

import { useState, useEffect, useRef } from 'react'
import { Volume2, Users, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'

interface OutputMeter {
  index: number
  name: string
  type: 'output' | 'group'
  level: number // dB value
  peak: number
  clipping: boolean
  muted: boolean
}

interface AtlasOutputMetersProps {
  processorId?: string
  processorIp: string
  showGroups?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function AtlasOutputMeters({ 
  processorId, 
  processorIp,
  showGroups = true,
  autoRefresh = true,
  refreshInterval = 100
}: AtlasOutputMetersProps) {
  const [outputMeters, setOutputMeters] = useState<OutputMeter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Don't attempt connection until processorIp is defined
    if (!processorIp) {
      setLoading(true)
      setError('Waiting for processor configuration...')
      return
    }

    if (autoRefresh) {
      connectWebSocket()
    } else {
      fetchOutputMeters()
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [processorId, processorIp, autoRefresh, showGroups])

  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/atlas/output-meter-stream?processorIp=${processorIp}&showGroups=${showGroups}`
      
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log('WebSocket connected for output meter updates')
        setIsConnected(true)
        setError(null)
        setLoading(false)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'meter-update' && data.meters) {
            setOutputMeters(data.meters)
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err)
        }
      }

      wsRef.current.onerror = (err) => {
        console.error('WebSocket error:', err)
        setError('Connection error')
        setIsConnected(false)
      }

      wsRef.current.onclose = () => {
        console.log('WebSocket closed')
        setIsConnected(false)
        
        if (autoRefresh) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Attempting to reconnect...')
            connectWebSocket()
          }, 3000)
        }
      }
    } catch (err) {
      console.error('Error connecting WebSocket:', err)
      setError('Failed to connect')
      setLoading(false)
    }
  }

  const fetchOutputMeters = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/atlas/output-meters?processorIp=${processorIp}&showGroups=${showGroups}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch output meters')
      }

      const data = await response.json()
      setOutputMeters(data.meters || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching output meters:', err)
      setError(err instanceof Error ? err.message : 'Failed to load meters')
    } finally {
      setLoading(false)
    }
  }

  const getMeterColor = (level: number, muted: boolean): string => {
    if (muted) return 'bg-slate-700'
    if (level > -6) return 'bg-red-500'
    if (level > -12) return 'bg-yellow-500'
    if (level > -40) return 'bg-green-500'
    return 'bg-slate-600'
  }

  const getMeterWidth = (level: number): number => {
    const percentage = ((level + 80) / 80) * 100
    return Math.max(0, Math.min(100, percentage))
  }

  const formatDb = (value: number): string => {
    return value > -80 ? `${value.toFixed(1)} dB` : '-∞ dB'
  }

  if (loading && outputMeters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-teal-400" />
            <span>Output Meters</span>
          </CardTitle>
          <CardDescription>Loading meter data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const outputs = outputMeters.filter(m => m.type === 'output')
  const groups = outputMeters.filter(m => m.type === 'group')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Volume2 className="w-5 h-5 text-teal-400" />
            <CardTitle>Output & Group Meters</CardTitle>
            {isConnected && (
              <span className="flex items-center space-x-1 text-xs text-green-400">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span>Live</span>
              </span>
            )}
          </div>
          {!autoRefresh && (
            <button 
              onClick={fetchOutputMeters}
              className="btn-secondary text-sm"
              disabled={loading}
            >
              Refresh
            </button>
          )}
        </div>
        <CardDescription>
          Real-time audio output and group levels
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Individual Outputs */}
          {outputs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
                <Volume2 className="w-4 h-4" />
                <span>Individual Outputs</span>
              </h3>
              <div className="space-y-3">
                {outputs.map((meter) => (
                  <div key={`output-${meter.index}`} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-slate-200">{meter.name}</span>
                        {meter.muted && (
                          <span className="text-xs text-slate-500">(Muted)</span>
                        )}
                        {meter.clipping && !meter.muted && (
                          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                        )}
                      </div>
                      <span className={`font-mono ${meter.clipping && !meter.muted ? 'text-red-400' : 'text-slate-300'}`}>
                        {formatDb(meter.level)}
                      </span>
                    </div>
                    
                    <div className="relative h-5 bg-slate-800 rounded-lg overflow-hidden">
                      <div 
                        className={`absolute left-0 top-0 h-full transition-all duration-75 ${getMeterColor(meter.level, meter.muted)}`}
                        style={{ width: `${getMeterWidth(meter.level)}%` }}
                      />
                      {meter.peak > -80 && !meter.muted && (
                        <div 
                          className="absolute top-0 h-full w-0.5 bg-white"
                          style={{ left: `${getMeterWidth(meter.peak)}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {showGroups && groups.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Groups</span>
              </h3>
              <div className="space-y-3">
                {groups.map((meter) => (
                  <div key={`group-${meter.index}`} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-slate-200">{meter.name}</span>
                        {meter.muted && (
                          <span className="text-xs text-slate-500">(Muted)</span>
                        )}
                        {meter.clipping && !meter.muted && (
                          <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                        )}
                      </div>
                      <span className={`font-mono ${meter.clipping && !meter.muted ? 'text-red-400' : 'text-slate-300'}`}>
                        {formatDb(meter.level)}
                      </span>
                    </div>
                    
                    <div className="relative h-6 bg-slate-800 rounded-lg overflow-hidden border-2 border-purple-500/30">
                      <div 
                        className={`absolute left-0 top-0 h-full transition-all duration-75 ${getMeterColor(meter.level, meter.muted)}`}
                        style={{ width: `${getMeterWidth(meter.level)}%` }}
                      />
                      {meter.peak > -80 && !meter.muted && (
                        <div 
                          className="absolute top-0 h-full w-0.5 bg-white"
                          style={{ left: `${getMeterWidth(meter.peak)}%` }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {outputMeters.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No output meters available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

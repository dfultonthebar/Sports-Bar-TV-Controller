'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface MeterData {
  index: number
  name: string
  level: number
  peak: number
  clipping: boolean
  muted?: boolean
  type?: string
}

export interface AtlasMeterState {
  outputs: MeterData[]
  inputs: MeterData[]
  groups: MeterData[]
  timestamp: number
  connected: boolean
  error: string | null
}

interface UseAtlasMetersSSEOptions {
  enabled?: boolean
}

/**
 * React hook for real-time Atlas audio meter data via SSE
 *
 * Connects to the SSE endpoint and receives meter updates at ~10 FPS.
 * Automatically reconnects on connection loss with aggressive retry.
 *
 * @param processorIp - Atlas processor IP address
 * @param options - Hook options (enabled)
 * @returns AtlasMeterState with real-time meter values
 */
export function useAtlasMetersSSE(
  processorIp: string | null,
  options: UseAtlasMetersSSEOptions = {}
): AtlasMeterState {
  const { enabled = true } = options

  const [state, setState] = useState<AtlasMeterState>({
    outputs: [],
    inputs: [],
    groups: [],
    timestamp: 0,
    connected: false,
    error: null
  })

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)
  const lastMessageTimeRef = useRef(0)
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Stable reference to processorIp to avoid unnecessary reconnects
  const processorIpRef = useRef(processorIp)
  processorIpRef.current = processorIp

  const connect = useCallback(() => {
    if (!isMountedRef.current || !processorIpRef.current) return

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    try {
      const url = `/api/atlas/meters/stream?processorIp=${encodeURIComponent(processorIpRef.current)}`
      console.log('[AtlasMetersSSE] Connecting to:', url)

      const eventSource = new EventSource(url)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('[AtlasMetersSSE] Connection opened')
        reconnectAttemptsRef.current = 0
        lastMessageTimeRef.current = Date.now()
        if (isMountedRef.current) {
          setState(prev => ({ ...prev, connected: true, error: null }))
        }
      }

      eventSource.addEventListener('connected', (event) => {
        console.log('[AtlasMetersSSE] Received connected event:', event.data)
        lastMessageTimeRef.current = Date.now()
      })

      eventSource.addEventListener('meters', (event) => {
        if (!isMountedRef.current) return
        lastMessageTimeRef.current = Date.now()
        try {
          const data = JSON.parse(event.data)
          setState({
            outputs: data.outputs || [],
            inputs: data.inputs || [],
            groups: data.groups || [],
            timestamp: data.timestamp || Date.now(),
            connected: true,
            error: null
          })
        } catch (e) {
          console.error('[AtlasMetersSSE] Error parsing meter data:', e)
        }
      })

      eventSource.onerror = (error) => {
        console.error('[AtlasMetersSSE] Connection error:', error)

        if (!isMountedRef.current) return

        setState(prev => ({ ...prev, connected: false, error: 'Connection lost' }))

        // Close the failed connection
        eventSource.close()
        eventSourceRef.current = null

        // Immediate reconnection with short delay (more aggressive)
        if (reconnectAttemptsRef.current < 50 && isMountedRef.current) {
          // Use shorter delays: 100ms, 200ms, 400ms, 800ms, max 2000ms
          const delay = Math.min(100 * Math.pow(2, Math.min(reconnectAttemptsRef.current, 4)), 2000)
          reconnectAttemptsRef.current++

          console.log(`[AtlasMetersSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) connect()
          }, delay)
        } else if (isMountedRef.current) {
          setState(prev => ({ ...prev, error: 'Max reconnection attempts reached' }))
          // Even after max attempts, try again after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              reconnectAttemptsRef.current = 0
              connect()
            }
          }, 5000)
        }
      }
    } catch (error) {
      console.error('[AtlasMetersSSE] Failed to create EventSource:', error)
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, connected: false, error: 'Failed to connect' }))
      }
    }
  }, [])

  // Health check - detect stale connections and reconnect
  useEffect(() => {
    if (!enabled || !processorIp) return

    healthCheckIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return

      const timeSinceLastMessage = Date.now() - lastMessageTimeRef.current

      // If no message received in 3 seconds, connection is stale
      if (lastMessageTimeRef.current > 0 && timeSinceLastMessage > 3000) {
        console.log('[AtlasMetersSSE] Connection stale, reconnecting...')
        setState(prev => ({ ...prev, connected: false, error: 'Connection stale' }))

        // Force reconnect
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        reconnectAttemptsRef.current = 0
        connect()
      }
    }, 1000)

    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
        healthCheckIntervalRef.current = null
      }
    }
  }, [enabled, processorIp, connect])

  useEffect(() => {
    isMountedRef.current = true

    if (!enabled || !processorIp) {
      // Close existing connection if disabled
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      return
    }

    // Start connection
    connect()

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current)
        healthCheckIntervalRef.current = null
      }
    }
  }, [processorIp, enabled, connect])

  return state
}

/**
 * Utility to convert dB level to percentage (0-100) for display
 */
export function dbToPercent(db: number): number {
  // dB range: -80 (silence) to 0 (max)
  // Map to 0-100%
  const clamped = Math.max(-80, Math.min(0, db))
  return ((clamped + 80) / 80) * 100
}

/**
 * Utility to get meter color based on level
 */
export function getMeterColor(db: number): string {
  if (db > -3) return 'rgb(239, 68, 68)' // red - clipping
  if (db > -12) return 'rgb(234, 179, 8)' // yellow - hot
  if (db > -40) return 'rgb(34, 197, 94)' // green - normal
  return 'rgb(75, 85, 99)' // gray - low/silent
}

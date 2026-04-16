
'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '../ui/button'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ArrowLeft,
  Menu,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  CheckCircle,
  AlertCircle,
  Info,
  Calendar,
  LogOut,
  RotateCcw,
  Radio,
  Square,
  Power,
  X
} from 'lucide-react'

interface CableBoxRemoteProps {
  deviceId: string
  deviceName: string
  iTachAddress?: string  // Optional - kept for backward compat, not used (server looks up device)
  irCodes?: Record<string, string>  // Optional - kept for backward compat, not used (server looks up codes)
  onClose?: () => void
}

export default function CableBoxRemote({ deviceId, deviceName, onClose }: CableBoxRemoteProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' })
  const [lastCommand, setLastCommand] = useState<string>('')

  // Channel digit buffer state
  const [channelDigits, setChannelDigits] = useState<string>('')
  const [channelDisplayState, setChannelDisplayState] = useState<'idle' | 'entering' | 'tuning' | 'tuned' | 'error'>('idle')
  const [tunedChannel, setTunedChannel] = useState<string>('')

  // Command debouncing to prevent rapid button presses from overwhelming devices
  const lastCommandTimeRef = useRef<number>(0)
  const commandQueueRef = useRef<boolean>(false)
  const COMMAND_DEBOUNCE_MS = 300 // Minimum 300ms between commands for stability

  // Channel buffer timer — fires tune API 2 seconds after last digit
  const channelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const CHANNEL_BUFFER_MS = 2000

  // Timer for clearing the "Tuned" confirmation message
  const tunedClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (channelTimerRef.current) clearTimeout(channelTimerRef.current)
      if (tunedClearTimerRef.current) clearTimeout(tunedClearTimerRef.current)
    }
  }, [])

  // Send the complete channel number through the unified tune API
  const tuneChannel = useCallback(async (channelNumber: string) => {
    setChannelDisplayState('tuning')

    try {
      const controller = new AbortController()
      const fetchTimeout = setTimeout(() => controller.abort(), 8000)

      const response = await fetch('/api/channel-presets/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelNumber,
          deviceType: 'cable',
          cableBoxId: deviceId,
          presetId: 'manual'
        }),
        signal: controller.signal
      })

      clearTimeout(fetchTimeout)

      const data = await response.json()

      if (response.ok && data.success) {
        const padded = channelNumber.padStart(3, '0')
        setTunedChannel(padded)
        setChannelDisplayState('tuned')
        setChannelDigits('')

        // Clear the "Tuned" message after 3 seconds
        if (tunedClearTimerRef.current) clearTimeout(tunedClearTimerRef.current)
        tunedClearTimerRef.current = setTimeout(() => {
          setChannelDisplayState('idle')
          setTunedChannel('')
        }, 3000)
      } else {
        setChannelDisplayState('error')
        setStatus({ type: 'error', message: data.error || 'Tune failed' })
        setTimeout(() => {
          setChannelDisplayState('idle')
          setChannelDigits('')
          setStatus({ type: null, message: '' })
        }, 3000)
      }
    } catch (error) {
      setChannelDisplayState('error')
      const msg = error instanceof DOMException && error.name === 'AbortError'
        ? 'Tune timed out'
        : 'Failed to tune channel'
      setStatus({ type: 'error', message: msg })
      setTimeout(() => {
        setChannelDisplayState('idle')
        setChannelDigits('')
        setStatus({ type: null, message: '' })
      }, 3000)
    }
  }, [deviceId])

  // Handle a digit press: accumulate in buffer, reset 2s timer
  const handleNumberClick = useCallback((digit: string) => {
    setChannelDigits(prev => {
      const updated = prev + digit
      // Reset the tune timer on each new digit
      if (channelTimerRef.current) clearTimeout(channelTimerRef.current)
      channelTimerRef.current = setTimeout(() => {
        tuneChannel(updated)
      }, CHANNEL_BUFFER_MS)
      return updated
    })
    setChannelDisplayState('entering')

    // Clear any previous "tuned" display
    if (tunedClearTimerRef.current) clearTimeout(tunedClearTimerRef.current)
    setTunedChannel('')
  }, [tuneChannel])

  // Clear channel entry mid-typing
  const handleClearChannel = useCallback(() => {
    if (channelTimerRef.current) clearTimeout(channelTimerRef.current)
    setChannelDigits('')
    setChannelDisplayState('idle')
  }, [])

  // Immediately send the buffered channel (Enter button)
  const handleChannelEnter = useCallback(() => {
    if (channelDigits) {
      if (channelTimerRef.current) clearTimeout(channelTimerRef.current)
      tuneChannel(channelDigits)
    }
  }, [channelDigits, tuneChannel])

  // Standard command sender with debounce and loading state (for non-digit buttons)
  const sendCommand = async (command: string, displayName?: string) => {
    // Debounce rapid button presses to prevent overwhelming devices
    const now = Date.now()
    const timeSinceLastCommand = now - lastCommandTimeRef.current

    if (timeSinceLastCommand < COMMAND_DEBOUNCE_MS) {
      // If a command is already in queue, ignore this one
      if (commandQueueRef.current) {
        return
      }

      // Queue this command to run after the debounce period
      commandQueueRef.current = true
      const waitTime = COMMAND_DEBOUNCE_MS - timeSinceLastCommand

      await new Promise(resolve => setTimeout(resolve, waitTime))
      commandQueueRef.current = false
    }

    lastCommandTimeRef.current = Date.now()

    setLoading(true)
    setLastCommand(displayName || command)

    // Safety timeout: auto-clear loading after 4 seconds to prevent stuck UI
    const safetyTimer = setTimeout(() => {
      setLoading(false)
      setStatus({ type: 'error', message: 'Command timed out' })
      setTimeout(() => setStatus({ type: null, message: '' }), 2000)
    }, 4000)

    try {
      // Use server-side IR command lookup (handles Global Cache device + port automatically)
      // Use AbortController to prevent fetch from hanging indefinitely
      const controller = new AbortController()
      const fetchTimeout = setTimeout(() => controller.abort(), 3000)

      const response = await fetch('/api/ir/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          commandName: command
        }),
        signal: controller.signal
      })

      clearTimeout(fetchTimeout)

      const data = await response.json()

      if (response.ok || data.success) {
        setStatus({ type: 'success', message: `${displayName || command} sent` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Command failed' })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus({ type: 'error', message: 'Command timed out' })
      } else {
        setStatus({ type: 'error', message: 'Failed to send command' })
      }
    } finally {
      clearTimeout(safetyTimer)
      setLoading(false)
      setTimeout(() => setStatus({ type: null, message: '' }), 2000)
    }
  }

  return (
    <div className="relative bg-slate-900 rounded-lg p-6 w-full max-w-md remote-control-container">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Cable Box Remote</h3>
        <p className="text-sm text-slate-400">{deviceName}</p>
      </div>

      {/* Remote Control Layout */}
      <div className="space-y-4">
        {/* Channel Number Display - Fixed height to prevent layout shift */}
        <div className="h-24 flex items-center justify-center">
          {channelDisplayState === 'entering' && channelDigits && (
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Ch:</span>
                  <span className="text-2xl font-bold text-blue-400 tracking-wider">
                    {channelDigits}
                    <span className="inline-block w-0.5 h-6 bg-blue-400 ml-0.5 align-middle animate-pulse" />
                  </span>
                </div>
                <Button
                  onClick={handleClearChannel}
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 min-w-[44px] min-h-[44px]"
                  aria-label="Clear channel entry"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex justify-center mt-2">
                <Button
                  onClick={handleChannelEnter}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 min-h-[44px] px-6"
                >
                  Tune Now
                </Button>
              </div>
            </div>
          )}

          {channelDisplayState === 'tuning' && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-3 w-full text-center">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />
                <span className="text-2xl font-bold text-yellow-400">
                  Tuning Ch {channelDigits}...
                </span>
              </div>
            </div>
          )}

          {channelDisplayState === 'tuned' && tunedChannel && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 w-full text-center">
              <div className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-2xl font-bold text-green-400">
                  Tuned to Ch {tunedChannel}
                </span>
              </div>
            </div>
          )}

          {channelDisplayState === 'error' && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 w-full text-center">
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="text-lg font-bold text-red-400">
                  {status.message || 'Tune failed'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Power & Top Row */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            onClick={() => sendCommand('POWER', 'Power')}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
          >
            <Power className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('MENU', 'Menu')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2"
          >
            <Menu className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('GUIDE', 'Guide')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2"
          >
            <Calendar className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('INFO', 'Info')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2"
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Pad */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="grid grid-cols-3 gap-2">
            {/* Up - Full row */}
            <div className="col-span-3 flex justify-center">
              <Button
                onClick={() => sendCommand('UP', 'Up')}
                disabled={loading}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3"
              >
                <ChevronUp className="w-6 h-6" />
              </Button>
            </div>

            {/* Left, OK, Right - Middle row */}
            <Button
              onClick={() => sendCommand('LEFT', 'Left')}
              disabled={loading}
              className="bg-slate-700 hover:bg-slate-600 text-white p-3"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              onClick={() => sendCommand('OK', 'Select')}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 relative"
            >
              <Circle className="w-8 h-8" fill="currentColor" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">OK</span>
            </Button>
            <Button
              onClick={() => sendCommand('RIGHT', 'Right')}
              disabled={loading}
              className="bg-slate-700 hover:bg-slate-600 text-white p-3"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            {/* Down - Full row */}
            <div className="col-span-3 flex justify-center">
              <Button
                onClick={() => sendCommand('DOWN', 'Down')}
                disabled={loading}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3"
              >
                <ChevronDown className="w-6 h-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Back/Exit Row */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => sendCommand('BACK', 'Back')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
          <Button
            onClick={() => sendCommand('EXIT', 'Exit')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <LogOut className="w-5 h-5 mr-1" />
            <span className="text-xs">Exit</span>
          </Button>
        </div>

        {/* Number Pad - disabled only while tuning is in progress */}
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'LAST', '0', 'ENTER'].map((btn) => (
              <Button
                key={btn}
                onClick={() => {
                  if (btn === 'ENTER') {
                    handleChannelEnter()
                  } else if (btn === 'LAST') {
                    sendCommand('LAST', 'Last Channel')
                  } else {
                    handleNumberClick(btn)
                  }
                }}
                disabled={
                  channelDisplayState === 'tuning' ||
                  (btn === 'LAST' && loading) ||
                  (btn === 'ENTER' && !channelDigits)
                }
                className={`${
                  btn === 'ENTER' ? 'bg-green-600 hover:bg-green-700' :
                  btn === 'LAST' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-slate-700 hover:bg-slate-600'
                } text-white p-3 font-bold min-h-[44px]`}
              >
                {btn === 'LAST' ? <RotateCcw className="w-4 h-4" /> : btn}
              </Button>
            ))}
          </div>
        </div>

        {/* Channel Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => sendCommand('CH_UP', 'Channel Up')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <span className="text-xs mr-1">CH</span>
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('CH_DOWN', 'Channel Down')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <span className="text-xs mr-1">CH</span>
            <ChevronDown className="w-5 h-5" />
          </Button>
        </div>

        {/* Playback Controls */}
        <div className="grid grid-cols-5 gap-2">
          <Button
            onClick={() => sendCommand('REWIND', 'Rewind')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('PLAY', 'Play')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('PAUSE', 'Pause')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Pause className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('STOP', 'Stop')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('FAST_FORWARD', 'Fast Forward')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* DVR/Record Controls */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => sendCommand('SKIP_BACK', 'Skip Back')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs"
          >
            Skip -10s
          </Button>
          <Button
            onClick={() => sendCommand('RECORD', 'Record')}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
          >
            <Radio className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('SKIP_FORWARD', 'Skip Forward')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs"
          >
            Skip +30s
          </Button>
        </div>

        {/* Volume Controls */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => sendCommand('VOL_UP', 'Volume Up')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Volume2 className="w-5 h-5" />
            <span className="ml-1 text-xs">+</span>
          </Button>
          <Button
            onClick={() => sendCommand('MUTE', 'Mute')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <VolumeX className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('VOL_DOWN', 'Volume Down')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Volume2 className="w-5 h-5" />
            <span className="ml-1 text-xs">-</span>
          </Button>
        </div>

        {/* Close Button */}
        {onClose && (
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full mt-4"
          >
            Close Remote
          </Button>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
          <div className="bg-slate-800 p-4 rounded-lg flex items-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-white text-sm">Sending {lastCommand}...</span>
          </div>
        </div>
      )}
    </div>
  )
}

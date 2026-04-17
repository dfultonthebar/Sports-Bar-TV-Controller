
'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
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
  List,
  Calendar,
  LogOut,
  RotateCcw,
  Radio,
  Square,
  X
} from 'lucide-react'

interface DirecTVRemoteProps {
  deviceId: string
  deviceName: string
  ipAddress: string
  port: number
  onClose?: () => void
}

export default function DirecTVRemote({ deviceId, deviceName, ipAddress, port, onClose }: DirecTVRemoteProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' })
  const [lastCommand, setLastCommand] = useState<string>('')

  // Channel digit buffer - collects digits, sends complete channel number via tune API
  const [channelBuffer, setChannelBuffer] = useState<string>('')
  const [channelStatus, setChannelStatus] = useState<'idle' | 'collecting' | 'tuning' | 'tuned' | 'error'>('idle')
  const [tunedChannel, setTunedChannel] = useState<string>('')
  const tuneTimerRef = useRef<NodeJS.Timeout | null>(null)
  const TUNE_DELAY_MS = 2000 // 2 seconds after last digit before sending tune

  // Command debouncing to prevent rapid button presses from overwhelming DirecTV boxes
  const lastCommandTimeRef = useRef<number>(0)
  const commandQueueRef = useRef<boolean>(false)
  const COMMAND_DEBOUNCE_MS = 300 // Minimum 300ms between commands for DirecTV stability

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (tuneTimerRef.current) clearTimeout(tuneTimerRef.current)
    }
  }, [])

  // Send the complete channel number through the unified tune API
  const tuneToChannel = useCallback(async (channel: string) => {
    if (!channel) return

    setChannelStatus('tuning')

    try {
      const response = await fetch('/api/channel-presets/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelNumber: channel,
          deviceType: 'directv',
          directTVId: deviceId,
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setTunedChannel(channel)
        setChannelStatus('tuned')
        setChannelBuffer('')
        // Clear tuned confirmation after 3 seconds
        setTimeout(() => {
          setChannelStatus('idle')
          setTunedChannel('')
        }, 3000)
      } else {
        setChannelStatus('error')
        setStatus({ type: 'error', message: data.error || `Failed to tune Ch ${channel}` })
        // Clear error state after 3 seconds
        setTimeout(() => {
          setChannelStatus('idle')
          setChannelBuffer('')
          setStatus({ type: null, message: '' })
        }, 3000)
      }
    } catch (error) {
      setChannelStatus('error')
      setStatus({ type: 'error', message: `Failed to tune Ch ${channel}` })
      setTimeout(() => {
        setChannelStatus('idle')
        setChannelBuffer('')
        setStatus({ type: null, message: '' })
      }, 3000)
    }
  }, [deviceId])

  // Standard command sender with debounce and loading state (for non-digit buttons)
  const sendCommand = async (command: string, displayName?: string) => {
    // Debounce rapid button presses to prevent overwhelming DirecTV boxes
    const now = Date.now()
    const timeSinceLastCommand = now - lastCommandTimeRef.current

    if (timeSinceLastCommand < COMMAND_DEBOUNCE_MS) {
      // If a command is already in queue, ignore this one
      if (commandQueueRef.current) {
        console.debug(`[DirecTV Remote] Ignoring rapid command: ${command} (debounced)`)
        return
      }

      // Queue this command to run after the debounce period
      commandQueueRef.current = true
      const waitTime = COMMAND_DEBOUNCE_MS - timeSinceLastCommand
      console.debug(`[DirecTV Remote] Queuing command: ${command} (waiting ${waitTime}ms)`)

      await new Promise(resolve => setTimeout(resolve, waitTime))
      commandQueueRef.current = false
    }

    lastCommandTimeRef.current = Date.now()

    setLoading(true)
    setLastCommand(displayName || command)

    try {
      const response = await fetch('/api/directv-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          command,
          ipAddress,
          port
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus({ type: 'success', message: `${displayName || command} sent` })
      } else {
        setStatus({ type: 'error', message: data.error || 'Command failed' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to send command' })
    } finally {
      setLoading(false)
      setTimeout(() => setStatus({ type: null, message: '' }), 2000)
    }
  }

  // Collect digit into buffer and reset the 2-second tune timer
  const handleNumberClick = (digit: string) => {
    setChannelBuffer(prev => {
      const updated = prev + digit
      // Reset the tune timer every time a digit is pressed
      if (tuneTimerRef.current) clearTimeout(tuneTimerRef.current)
      tuneTimerRef.current = setTimeout(() => {
        tuneToChannel(updated)
      }, TUNE_DELAY_MS)
      return updated
    })
    setChannelStatus('collecting')
    // Clear any previous tuned confirmation
    setTunedChannel('')
  }

  // Cancel mid-entry: clear the buffer and cancel the pending tune
  const handleClearChannel = () => {
    if (tuneTimerRef.current) clearTimeout(tuneTimerRef.current)
    setChannelBuffer('')
    setChannelStatus('idle')
    setTunedChannel('')
  }

  // Immediately tune the current buffer (Enter button)
  const handleChannelEnter = () => {
    if (channelBuffer) {
      if (tuneTimerRef.current) clearTimeout(tuneTimerRef.current)
      tuneToChannel(channelBuffer)
    }
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md remote-control-container">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">DirecTV Remote</h3>
        <p className="text-sm text-slate-400">{deviceName}</p>
      </div>

      {/* Remote Control Layout */}
      <div className="space-y-4">
        {/* Channel Number Display - always visible */}
        <div className={`rounded-lg p-3 text-center border ${
          channelStatus === 'collecting'
            ? 'bg-blue-500/20 border-blue-500/30'
            : channelStatus === 'tuning'
              ? 'bg-yellow-500/20 border-yellow-500/30'
              : channelStatus === 'tuned'
                ? 'bg-green-500/20 border-green-500/30'
                : channelStatus === 'error'
                  ? 'bg-red-500/20 border-red-500/30'
                  : 'bg-slate-800/50 border-slate-700'
        }`}>
          {channelStatus === 'collecting' && channelBuffer ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-blue-300">Ch:</span>
                <span className="text-2xl font-bold text-blue-400 font-mono">{channelBuffer}</span>
                <span className="inline-block w-0.5 h-6 bg-blue-400 animate-pulse" />
              </div>
              <div className="flex justify-center gap-3 mt-2">
                <Button
                  onClick={handleChannelEnter}
                  className="bg-green-600 hover:bg-green-700 text-white min-h-[44px] min-w-[80px] text-sm font-semibold"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Tune
                </Button>
                <Button
                  onClick={handleClearChannel}
                  variant="outline"
                  className="border-slate-500 text-slate-300 hover:bg-slate-700 min-h-[44px] min-w-[80px] text-sm font-semibold"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              <p className="text-xs text-blue-300/70 mt-1">Auto-tunes in 2s</p>
            </>
          ) : channelStatus === 'tuning' ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
              <span className="text-lg font-semibold text-yellow-400">Tuning to Ch {channelBuffer}...</span>
            </div>
          ) : channelStatus === 'tuned' && tunedChannel ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-lg font-semibold text-green-400">Tuned to Ch {tunedChannel}</span>
            </div>
          ) : channelStatus === 'error' ? (
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm font-semibold text-red-400">{status.message || 'Tune failed'}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-500">Enter channel number</span>
          )}
        </div>

        {/* Top Row: Menu, Guide, List, Info */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            onClick={() => sendCommand('MENU', 'Menu')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2"
          >
            <Menu className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('GUIDE', 'Guide')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2"
          >
            <Calendar className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('LIST', 'List')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('INFO', 'Info')}
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
                    className="bg-slate-700 hover:bg-slate-600 text-white p-3"
              >
                <ChevronUp className="w-6 h-6" />
              </Button>
            </div>

            {/* Left, OK, Right - Middle row */}
            <Button
              onClick={() => sendCommand('LEFT', 'Left')}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            <Button
              onClick={() => sendCommand('OK', 'Select')}
                className="bg-blue-600 hover:bg-blue-700 text-white p-3 relative"
            >
              <Circle className="w-8 h-8" fill="currentColor" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">OK</span>
            </Button>
            <Button
              onClick={() => sendCommand('RIGHT', 'Right')}
                className="bg-slate-700 hover:bg-slate-600 text-white p-3"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            {/* Down - Full row */}
            <div className="col-span-3 flex justify-center">
              <Button
                onClick={() => sendCommand('DOWN', 'Down')}
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
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-xs">Back</span>
          </Button>
          <Button
            onClick={() => sendCommand('EXIT', 'Exit')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <LogOut className="w-5 h-5 mr-1" />
            <span className="text-xs">Exit</span>
          </Button>
        </div>

        {/* Number Pad - digits are buffered and sent as complete channel via tune API */}
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'GO'].map((btn) => (
              <Button
                key={btn}
                onClick={() => {
                  if (btn === 'GO') {
                    handleChannelEnter()
                  } else if (btn === 'CLR') {
                    handleClearChannel()
                  } else {
                    handleNumberClick(btn)
                  }
                }}
                disabled={
                  (btn === 'GO' && !channelBuffer) ||
                  (btn === 'CLR' && !channelBuffer) ||
                  channelStatus === 'tuning'
                }
                className={`${
                  btn === 'GO' ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-900/30' :
                  btn === 'CLR' ? 'bg-red-600/70 hover:bg-red-700 disabled:bg-red-900/30' :
                  'bg-slate-700 hover:bg-slate-600'
                } text-white min-h-[48px] p-3 font-bold text-lg`}
              >
                {btn}
              </Button>
            ))}
          </div>
        </div>

        {/* Channel Controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => sendCommand('CH_UP', 'Channel Up')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <span className="text-xs mr-1">CH</span>
            <ChevronUp className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('CH_DOWN', 'Channel Down')}
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
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('PLAY', 'Play')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('PAUSE', 'Pause')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Pause className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('STOP', 'Stop')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Square className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('FAST_FORWARD', 'Fast Forward')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* DVR Controls */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => sendCommand('SKIP_BACK', 'Skip Back')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs"
          >
            Skip -30s
          </Button>
          <Button
            onClick={() => sendCommand('RECORD', 'Record')}
            className="bg-red-600 hover:bg-red-700 text-white p-2"
          >
            <Radio className="w-4 h-4" />
          </Button>
          <Button
            onClick={() => sendCommand('SKIP_FORWARD', 'Skip Forward')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-2 text-xs"
          >
            Skip +30s
          </Button>
        </div>

        {/* Volume Controls */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => sendCommand('VOL_UP', 'Volume Up')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Volume2 className="w-5 h-5" />
            <span className="ml-1 text-xs">+</span>
          </Button>
          <Button
            onClick={() => sendCommand('MUTE', 'Mute')}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <VolumeX className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('VOL_DOWN', 'Volume Down')}
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

    </div>
  )
}

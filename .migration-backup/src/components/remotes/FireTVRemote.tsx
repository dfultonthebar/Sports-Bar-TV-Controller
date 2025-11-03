
'use client'

import React, { useState } from 'react'
import { Button } from '../ui/button'
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Circle,
  Home,
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
  AlertCircle
} from 'lucide-react'

interface FireTVRemoteProps {
  deviceId: string
  deviceName: string
  ipAddress: string
  port: number
  onClose?: () => void
}

export default function FireTVRemote({ deviceId, deviceName, ipAddress, port, onClose }: FireTVRemoteProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' })
  const [lastCommand, setLastCommand] = useState<string>('')

  const sendCommand = async (command: string, displayName?: string) => {
    setLoading(true)
    setLastCommand(displayName || command)
    
    try {
      const response = await fetch('/api/firetv-devices/send-command', {
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
        setStatus({ type: 'error', message: data.message || 'Command failed' })
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to send command' })
    } finally {
      setLoading(false)
      setTimeout(() => setStatus({ type: null, message: '' }), 2000)
    }
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md relative">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">Fire TV Remote</h3>
        <p className="text-sm text-slate-400">{deviceName}</p>
        {status.message && (
          <div className={`mt-2 px-3 py-1 rounded-full text-xs flex items-center justify-center space-x-1 ${
            status.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {status.type === 'success' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            <span>{status.message}</span>
          </div>
        )}
      </div>

      {/* Remote Control Layout */}
      <div className="space-y-4">
        {/* Top Row: Home, Back, Menu */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => sendCommand('HOME', 'Home')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Home className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('BACK', 'Back')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('MENU', 'Menu')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Menu className="w-5 h-5" />
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

        {/* Playback Controls */}
        <div className="grid grid-cols-4 gap-2">
          <Button
            onClick={() => sendCommand('REWIND', 'Rewind')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('PLAY_PAUSE', 'Play/Pause')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Play className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('PAUSE', 'Pause')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <Pause className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => sendCommand('FAST_FORWARD', 'Fast Forward')}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3"
          >
            <SkipForward className="w-5 h-5" />
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

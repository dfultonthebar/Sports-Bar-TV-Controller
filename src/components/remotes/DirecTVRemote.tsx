
'use client'

import React, { useState } from 'react'
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
  Square
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
  const [channelInput, setChannelInput] = useState<string>('')

  const sendCommand = async (command: string, displayName?: string) => {
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

  const handleNumberClick = (number: string) => {
    setChannelInput(prev => prev + number)
    sendCommand(number, `Number ${number}`)
  }

  const handleChannelEnter = () => {
    if (channelInput) {
      sendCommand('ENTER', 'Enter')
      setChannelInput('')
    }
  }

  const handleClearChannel = () => {
    setChannelInput('')
  }

  return (
    <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md">
      {/* Header */}
      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-1">DirecTV Remote</h3>
        <p className="text-sm text-slate-400">{deviceName}</p>
      </div>

      {/* Remote Control Layout */}
      <div className="space-y-4">
        {/* Channel Input Display */}
        {channelInput && (
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">{channelInput}</div>
            <div className="flex justify-center space-x-2 mt-2">
              <Button
                onClick={handleChannelEnter}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Enter
              </Button>
              <Button
                onClick={handleClearChannel}
                size="sm"
                variant="outline"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

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

        {/* Number Pad */}
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DASH', '0', 'ENTER'].map((btn) => (
              <Button
                key={btn}
                onClick={() => {
                  if (btn === 'ENTER') {
                    handleChannelEnter()
                  } else if (btn === 'DASH') {
                    handleNumberClick('DASH')
                    sendCommand('DASH', 'Dash')
                  } else {
                    handleNumberClick(btn)
                  }
                }}
                    className={`${
                  btn === 'ENTER' ? 'bg-green-600 hover:bg-green-700' :
                  btn === 'DASH' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-slate-700 hover:bg-slate-600'
                } text-white p-3 font-bold`}
              >
                {btn === 'DASH' ? '-' : btn}
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

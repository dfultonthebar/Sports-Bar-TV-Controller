
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
  Calendar,
  LogOut,
  RotateCcw,
  Radio,
  Square,
  Power
} from 'lucide-react'

interface CableBoxRemoteProps {
  deviceId: string
  deviceName: string
  iTachAddress: string
  onClose?: () => void
}

export default function CableBoxRemote({ deviceId, deviceName, iTachAddress, onClose }: CableBoxRemoteProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' })
  const [lastCommand, setLastCommand] = useState<string>('')
  const [channelInput, setChannelInput] = useState<string>('')

  const sendCommand = async (command: string, displayName?: string) => {
    setLoading(true)
    setLastCommand(displayName || command)
    
    try {
      const response = await fetch('/api/ir-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          command,
          iTachAddress
        })
      })

      const data = await response.json()

      if (response.ok) {
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

  const handleNumberClick = async (number: string) => {
    setChannelInput(prev => prev + number)
    await sendCommand(number, `Number ${number}`)
    
    // Auto-submit after 4 digits or wait for manual entry
    if (channelInput.length + 1 >= 3) {
      setTimeout(() => {
        if (channelInput.length + 1 >= 3) {
          sendCommand('OK', 'Enter')
          setChannelInput('')
        }
      }, 1500)
    }
  }

  const handleChannelEnter = () => {
    if (channelInput) {
      sendCommand('OK', 'Enter')
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
        <h3 className="text-xl font-bold text-white mb-1">Cable Box Remote</h3>
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
            {/* Up */}
            <div className="col-start-2">
              <Button
                onClick={() => sendCommand('UP', 'Up')}
                disabled={loading}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3"
              >
                <ChevronUp className="w-6 h-6" />
              </Button>
            </div>
            
            {/* Left, OK, Right */}
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
            
            {/* Down */}
            <div className="col-start-2">
              <Button
                onClick={() => sendCommand('DOWN', 'Down')}
                disabled={loading}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3"
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

        {/* Number Pad */}
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
                disabled={loading}
                className={`${
                  btn === 'ENTER' ? 'bg-green-600 hover:bg-green-700' : 
                  btn === 'LAST' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-slate-700 hover:bg-slate-600'
                } text-white p-3 font-bold`}
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

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Menu,
  Info,
  Grid3x3,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Rewind,
  FastForward,
  X,
  Tv,
  Radio,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'

interface CableBox {
  id: string
  name: string
  devicePath: string
  provider: string
  model: string
  isOnline: boolean
  lastChannel?: string
}

export default function CableBoxRemoteControl() {
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>([])
  const [selectedBox, setSelectedBox] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<string>('')
  const [channelInput, setChannelInput] = useState('')
  const [lastCommand, setLastCommand] = useState<string>('')

  // Load cable boxes on mount
  useEffect(() => {
    fetchCableBoxes()
  }, [])

  const fetchCableBoxes = async () => {
    try {
      const response = await fetch('/api/cec/cable-box')
      const data = await response.json()
      if (data.success) {
        setCableBoxes(data.cableBoxes)
        if (data.cableBoxes.length > 0 && !selectedBox) {
          setSelectedBox(data.cableBoxes[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching cable boxes:', error)
    }
  }

  const sendCommand = async (command: string, params?: any) => {
    if (!selectedBox) {
      showFeedback('Please select a cable box first', 'error')
      return
    }

    setLoading(true)
    setLastCommand(command)

    try {
      const response = await fetch('/api/cec/cable-box/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cableBoxId: selectedBox,
          command,
          ...params,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showFeedback(`Command sent: ${command}`, 'success')
      } else {
        showFeedback(data.error || 'Command failed', 'error')
      }
    } catch (error) {
      showFeedback('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }

  const tuneChannel = async (channel?: string) => {
    const channelToTune = channel || channelInput
    if (!channelToTune) {
      showFeedback('Enter a channel number', 'error')
      return
    }

    if (!selectedBox) {
      showFeedback('Please select a cable box first', 'error')
      return
    }

    setLoading(true)
    setLastCommand(`Tune to ${channelToTune}`)

    try {
      const response = await fetch('/api/cec/cable-box/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cableBoxId: selectedBox,
          channel: channelToTune,
        }),
      })

      const data = await response.json()
      if (data.success) {
        showFeedback(`Tuned to channel ${channelToTune}`, 'success')
        setChannelInput('')
        // Refresh cable boxes to update lastChannel
        fetchCableBoxes()
      } else {
        showFeedback(data.error || 'Tuning failed', 'error')
      }
    } catch (error) {
      showFeedback('Network error', 'error')
    } finally {
      setLoading(false)
    }
  }

  const addDigit = (digit: string) => {
    if (channelInput.length < 4) {
      setChannelInput(channelInput + digit)
    }
  }

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback(message)
    setTimeout(() => setFeedback(''), 3000)
  }

  const selectedBoxData = cableBoxes.find((box) => box.id === selectedBox)

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Tv className="w-6 h-6" />
            Cable Box Remote Control
          </span>
          {selectedBoxData && (
            <Badge variant={selectedBoxData.isOnline ? 'default' : 'secondary'}>
              {selectedBoxData.isOnline ? 'Online' : 'Offline'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cable Box Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Cable Box</label>
          <select
            value={selectedBox || ''}
            onChange={(e) => setSelectedBox(e.target.value)}
            className="w-full p-2 border rounded-md bg-background"
          >
            {cableBoxes.length === 0 ? (
              <option value="">No cable boxes configured</option>
            ) : (
              cableBoxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name} {box.lastChannel ? `(Last: ${box.lastChannel})` : ''}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-3 rounded-md text-sm flex items-center gap-2 ${
              feedback.includes('success') || feedback.includes('Tuned')
                ? 'bg-green-100 text-green-800 border border-green-200'
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            {feedback.includes('success') || feedback.includes('Tuned') ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback}
          </div>
        )}

        {/* Last Command */}
        {lastCommand && !loading && (
          <div className="text-sm text-muted-foreground">
            Last command: {lastCommand}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Channel Entry Section */}
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-sm font-medium mb-2">Channel Entry</div>
              <div className="bg-muted p-4 rounded-lg mb-3">
                <div className="text-3xl font-mono h-10 flex items-center justify-center">
                  {channelInput || '---'}
                </div>
              </div>
            </div>

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <Button
                  key={num}
                  onClick={() => addDigit(num)}
                  variant="outline"
                  className="h-14 text-lg font-semibold"
                  disabled={loading}
                >
                  {num}
                </Button>
              ))}
              <Button
                onClick={() => setChannelInput('')}
                variant="outline"
                className="h-14"
                disabled={loading}
              >
                Clear
              </Button>
              <Button
                onClick={() => addDigit('0')}
                variant="outline"
                className="h-14 text-lg font-semibold"
                disabled={loading}
              >
                0
              </Button>
              <Button
                onClick={() => tuneChannel()}
                variant="default"
                className="h-14 bg-green-600 hover:bg-green-700"
                disabled={loading || !channelInput}
              >
                Enter
              </Button>
            </div>

            {/* Quick Channel Buttons */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-center">Quick Channels</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => tuneChannel('11')}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  Ch 11
                </Button>
                <Button
                  onClick={() => tuneChannel('26')}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  Ch 26
                </Button>
                <Button
                  onClick={() => tuneChannel('206')}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  ESPN (206)
                </Button>
                <Button
                  onClick={() => tuneChannel('212')}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  FS1 (212)
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation & Control Section */}
          <div className="space-y-4">
            {/* D-Pad Navigation */}
            <div className="text-center">
              <div className="text-sm font-medium mb-2">Navigation</div>
              <div className="inline-grid grid-cols-3 gap-1">
                <div></div>
                <Button
                  onClick={() => sendCommand('up')}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  disabled={loading}
                >
                  <ChevronUp className="w-6 h-6" />
                </Button>
                <div></div>

                <Button
                  onClick={() => sendCommand('left')}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  disabled={loading}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <Button
                  onClick={() => sendCommand('select')}
                  variant="default"
                  size="icon"
                  className="h-12 w-12"
                  disabled={loading}
                >
                  <Circle className="w-6 h-6" />
                </Button>
                <Button
                  onClick={() => sendCommand('right')}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  disabled={loading}
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>

                <div></div>
                <Button
                  onClick={() => sendCommand('down')}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                  disabled={loading}
                >
                  <ChevronDown className="w-6 h-6" />
                </Button>
                <div></div>
              </div>
            </div>

            {/* Menu Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => sendCommand('menu')}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <Menu className="w-4 h-4 mr-2" />
                Menu
              </Button>
              <Button
                onClick={() => sendCommand('exit')}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Exit
              </Button>
              <Button
                onClick={() => sendCommand('guide')}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <Grid3x3 className="w-4 h-4 mr-2" />
                Guide
              </Button>
              <Button
                onClick={() => sendCommand('info')}
                variant="outline"
                size="sm"
                disabled={loading}
              >
                <Info className="w-4 h-4 mr-2" />
                Info
              </Button>
            </div>

            {/* Channel Controls */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => sendCommand('channelUp')}
                variant="outline"
                disabled={loading}
              >
                CH <ChevronUp className="w-4 h-4 ml-1" />
              </Button>
              <Button
                onClick={() => sendCommand('channelDown')}
                variant="outline"
                disabled={loading}
              >
                CH <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </div>

            <Button
              onClick={() => sendCommand('lastChannel')}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              <SkipBack className="w-4 h-4 mr-2" />
              Last Channel
            </Button>
          </div>
        </div>

        {/* DVR Controls */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-3 text-center">DVR Controls</div>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => sendCommand('rewind')}
              variant="outline"
              size="icon"
              disabled={loading}
            >
              <Rewind className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => sendCommand('play')}
              variant="outline"
              size="icon"
              disabled={loading}
            >
              <Play className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => sendCommand('pause')}
              variant="outline"
              size="icon"
              disabled={loading}
            >
              <Pause className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => sendCommand('fastForward')}
              variant="outline"
              size="icon"
              disabled={loading}
            >
              <FastForward className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => sendCommand('record')}
              variant="outline"
              size="icon"
              disabled={loading}
            >
              <Radio className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Status Info */}
        <div className="border-t pt-4 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Provider: {selectedBoxData?.provider || 'N/A'}</span>
            <span>Model: {selectedBoxData?.model || 'N/A'}</span>
          </div>
          {selectedBoxData?.lastChannel && (
            <div className="mt-1">Last tuned: Channel {selectedBoxData.lastChannel}</div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 animate-spin" />
            Sending command...
          </div>
        )}
      </CardContent>
    </Card>
  )
}

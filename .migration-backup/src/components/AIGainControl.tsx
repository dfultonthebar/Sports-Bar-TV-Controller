
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Switch } from './ui/switch'
import { Slider } from './ui/slider'
import { logger } from '@/lib/logger'
import { 
  Settings, 
  Zap, 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

interface AIGainControlProps {
  processorId: string
  inputNumber: number
  inputName: string
  currentLevel: number | null
  currentGain: number
  aiEnabled: boolean
  inputType: 'mic' | 'line'
  targetLevel: number
  adjustmentMode: string
  onUpdate: () => void
}

export default function AIGainControl({
  processorId,
  inputNumber,
  inputName,
  currentLevel,
  currentGain,
  aiEnabled,
  inputType,
  targetLevel,
  adjustmentMode,
  onUpdate
}: AIGainControlProps) {
  const [localAiEnabled, setLocalAiEnabled] = useState(aiEnabled)
  const [localInputType, setLocalInputType] = useState(inputType)
  const [localGain, setLocalGain] = useState(currentGain)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setLocalAiEnabled(aiEnabled)
    setLocalInputType(inputType)
    setLocalGain(currentGain)
  }, [aiEnabled, inputType, currentGain])

  const handleAIToggle = async (enabled: boolean) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/audio-processor/${processorId}/ai-gain-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputNumber,
          aiEnabled: enabled
        })
      })

      if (response.ok) {
        setLocalAiEnabled(enabled)
        onUpdate()
      }
    } catch (error) {
      logger.error('Error toggling AI control:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleInputTypeChange = async (type: 'mic' | 'line') => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/audio-processor/${processorId}/ai-gain-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputNumber,
          inputType: type
        })
      })

      if (response.ok) {
        setLocalInputType(type)
        onUpdate()
      }
    } catch (error) {
      logger.error('Error changing input type:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleManualGainChange = async (gain: number) => {
    setLocalGain(gain)
  }

  const applyManualGain = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/audio-processor/${processorId}/input-gain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputNumber,
          gain: localGain,
          reason: 'manual_override'
        })
      })

      if (response.ok) {
        onUpdate()
      }
    } catch (error) {
      logger.error('Error setting manual gain:', error)
    } finally {
      setUpdating(false)
    }
  }

  const getStatusIcon = () => {
    switch (adjustmentMode) {
      case 'fast':
        return <TrendingUp className="h-4 w-4 text-yellow-500" />
      case 'slow':
        return <TrendingUp className="h-4 w-4 text-blue-500" />
      case 'idle':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'waiting':
        return <Clock className="h-4 w-4 text-gray-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusText = () => {
    switch (adjustmentMode) {
      case 'fast':
        return 'Fast Adjustment'
      case 'slow':
        return 'Fine Tuning'
      case 'idle':
        return 'Target Reached'
      case 'waiting':
        return 'Waiting for Audio'
      default:
        return 'Inactive'
    }
  }

  const getStatusColor = () => {
    switch (adjustmentMode) {
      case 'fast':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'slow':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'idle':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'waiting':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{inputName}</CardTitle>
            <Badge variant="outline" className="text-xs">
              Input {inputNumber}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${getStatusColor()} border`}>
              <div className="flex items-center gap-1">
                {getStatusIcon()}
                <span className="text-xs">{getStatusText()}</span>
              </div>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Control Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className={`h-4 w-4 ${localAiEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
            <span className="font-medium text-sm">AI Gain Control</span>
          </div>
          <Switch
            checked={localAiEnabled}
            onCheckedChange={handleAIToggle}
            disabled={updating || localInputType === 'mic'}
          />
        </div>

        {localInputType === 'mic' && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <strong>Microphone Input:</strong> AI gain control is disabled for microphone inputs to prevent feedback and maintain consistent vocal levels.
            </div>
          </div>
        )}

        {/* Input Type Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Input Type</label>
          <div className="flex gap-2">
            <Button
              variant={localInputType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleInputTypeChange('line')}
              disabled={updating}
              className="flex-1"
            >
              Line Level
            </Button>
            <Button
              variant={localInputType === 'mic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleInputTypeChange('mic')}
              disabled={updating}
              className="flex-1"
            >
              Microphone
            </Button>
          </div>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Current Level</div>
            <div className="text-lg font-bold text-blue-600">
              {currentLevel !== null ? `${currentLevel.toFixed(1)} dB` : 'N/A'}
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Target Level</div>
            <div className="text-lg font-bold text-green-600">
              {targetLevel.toFixed(1)} dB
            </div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-xs text-gray-600 mb-1">Current Gain</div>
            <div className="text-lg font-bold text-purple-600">
              {currentGain.toFixed(1)} dB
            </div>
          </div>
        </div>

        {/* Manual Gain Control */}
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Manual Gain Override</label>
            {localAiEnabled && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Overrides AI
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600 w-12">-20 dB</span>
              <Slider
                value={[localGain]}
                onValueChange={(value) => handleManualGainChange(value[0])}
                min={-20}
                max={20}
                step={0.5}
                className="flex-1"
              />
              <span className="text-xs text-gray-600 w-12 text-right">+20 dB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {localGain.toFixed(1)} dB
              </span>
              <Button
                size="sm"
                onClick={applyManualGain}
                disabled={updating || localGain === currentGain}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
        </Button>

        {showAdvanced && (
          <div className="space-y-3 p-3 border border-gray-200 rounded-lg bg-white">
            <div className="text-sm font-medium text-gray-700 mb-2">AI Adjustment Parameters</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-600">Fast Mode Step:</span>
                <span className="font-medium ml-1">3.0 dB</span>
              </div>
              <div>
                <span className="text-gray-600">Slow Mode Step:</span>
                <span className="font-medium ml-1">1.0 dB</span>
              </div>
              <div>
                <span className="text-gray-600">Fast Threshold:</span>
                <span className="font-medium ml-1">-10.0 dB</span>
              </div>
              <div>
                <span className="text-gray-600">Silence Threshold:</span>
                <span className="font-medium ml-1">-40.0 dB</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

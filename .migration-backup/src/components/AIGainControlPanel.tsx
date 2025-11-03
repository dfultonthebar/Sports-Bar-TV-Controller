
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Activity, 
  Zap, 
  Play, 
  Square, 
  Settings,
  BarChart3,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react'
import EnhancedInputLevelMonitor from './EnhancedInputLevelMonitor'
import AIGainControl from './AIGainControl'

import { logger } from '@/lib/logger'
interface AudioProcessor {
  id: string
  name: string
  model: string
  status: string
}

interface InputMeterWithAI {
  id: string
  inputNumber: number
  parameterName: string
  inputName: string | null
  currentLevel: number | null
  peakLevel: number | null
  isActive: boolean
  aiGainConfig?: {
    id: string
    aiEnabled: boolean
    inputType: string
    currentGain: number
    targetLevel: number
    adjustmentMode: string
    lastAdjustment: string | null
    adjustmentCount: number
  }
}

interface AIGainControlPanelProps {
  processor: AudioProcessor
}

export default function AIGainControlPanel({ processor }: AIGainControlPanelProps) {
  const [inputMeters, setInputMeters] = useState<InputMeterWithAI[]>([])
  const [monitoringActive, setMonitoringActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchAIGainSettings()
    const interval = setInterval(fetchAIGainSettings, 2000) // Update every 2 seconds
    
    return () => clearInterval(interval)
  }, [processor.id])

  const fetchAIGainSettings = async () => {
    try {
      const response = await fetch(`/api/audio-processor/${processor.id}/ai-gain-control`)
      if (response.ok) {
        const data = await response.json()
        setInputMeters(data.inputMeters || [])
      }
    } catch (error) {
      logger.error('Error fetching AI gain settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStartMonitoring = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/audio-processor/${processor.id}/ai-monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })

      if (response.ok) {
        setMonitoringActive(true)
      }
    } catch (error) {
      logger.error('Error starting monitoring:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleStopMonitoring = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/audio-processor/${processor.id}/ai-monitoring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })

      if (response.ok) {
        setMonitoringActive(false)
      }
    } catch (error) {
      logger.error('Error stopping monitoring:', error)
    } finally {
      setUpdating(false)
    }
  }

  const aiEnabledCount = inputMeters.filter(m => m.aiGainConfig?.aiEnabled).length
  const activeAdjustments = inputMeters.filter(
    m => m.aiGainConfig?.aiEnabled && 
    m.aiGainConfig?.adjustmentMode !== 'idle' && 
    m.aiGainConfig?.adjustmentMode !== 'waiting'
  ).length

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Loading AI Gain Control...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-t-4 border-t-blue-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Zap className="h-6 w-6 text-blue-600" />
                AI-Powered Input Gain Control
              </CardTitle>
              <CardDescription className="mt-2">
                Automatic gain adjustment to maintain optimal audio levels at -3dB target
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm text-gray-600">Processor</div>
                <div className="font-semibold">{processor.name}</div>
                <Badge variant="outline" className="mt-1">
                  {processor.model}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${monitoringActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium">
                  Monitoring: {monitoringActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-sm">
                  {aiEnabledCount} of {inputMeters.length} inputs AI-enabled
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">
                  {activeAdjustments} actively adjusting
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAIGainSettings}
                disabled={updating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {monitoringActive ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopMonitoring}
                  disabled={updating}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Monitoring
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartMonitoring}
                  disabled={updating}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Monitoring
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="meters" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="meters" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            VU Meters
          </TabsTrigger>
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            AI Controls
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Information
          </TabsTrigger>
        </TabsList>

        <TabsContent value="meters" className="space-y-4">
          <EnhancedInputLevelMonitor 
            processorId={processor.id}
            processorName={processor.name}
            showAIControls={true}
          />
        </TabsContent>

        <TabsContent value="controls" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {inputMeters.map((meter) => (
              <AIGainControl
                key={meter.id}
                processorId={processor.id}
                inputNumber={meter.inputNumber}
                inputName={meter.inputName || `Input ${meter.inputNumber + 1}`}
                currentLevel={meter.currentLevel}
                currentGain={meter.aiGainConfig?.currentGain || 0}
                aiEnabled={meter.aiGainConfig?.aiEnabled || false}
                inputType={(meter.aiGainConfig?.inputType as 'mic' | 'line') || 'line'}
                targetLevel={meter.aiGainConfig?.targetLevel || -3.0}
                adjustmentMode={meter.aiGainConfig?.adjustmentMode || 'idle'}
                onUpdate={fetchAIGainSettings}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>How AI Gain Control Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Target Level: -3dB</h3>
                <p className="text-sm text-gray-600">
                  All line-level inputs are automatically adjusted to maintain a consistent -3dB level, 
                  ensuring optimal audio quality without clipping.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Smart Adjustment Speed</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  <li><strong>Fast Mode:</strong> When audio is present and level is below -10dB, gain increases by 3dB per adjustment</li>
                  <li><strong>Slow Mode:</strong> Once at -10dB, gain increases by 1dB per adjustment until reaching -3dB target</li>
                  <li><strong>Idle Mode:</strong> When target level is reached, monitoring continues but no adjustments are made</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Audio Presence Detection</h3>
                <p className="text-sm text-gray-600">
                  If an input is at -40dB or lower for more than 1 minute, the system enters waiting mode 
                  and won't adjust gain until actual audio is detected. This prevents adjusting noise floor.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">Microphone Protection</h3>
                <p className="text-sm text-gray-600">
                  Microphone inputs are excluded from AI gain control to prevent feedback and maintain 
                  consistent vocal levels. Only line-level inputs (1-6 when set to line, and 7-10) are adjusted.
                </p>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">Important Notes</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                      <li>Manual gain adjustments override AI control temporarily</li>
                      <li>Each input can be individually enabled/disabled for AI control</li>
                      <li>Monitoring service must be running for AI adjustments to occur</li>
                      <li>All adjustments are logged for review and troubleshooting</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}


'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/cards'
import { Badge } from './ui/badge'
import { logger } from '@sports-bar/logger'
import { 
  Volume2, 
  AlertTriangle, 
  AlertCircle,
  Activity,
  TrendingUp
} from 'lucide-react'

interface InputMeter {
  id: string
  inputNumber: number
  parameterName: string
  inputName: string | null
  currentLevel: number | null
  peakLevel: number | null
  levelPercent: number | null
  warningThreshold: number
  dangerThreshold: number
  lastUpdate: string | null
  isActive: boolean
  aiGainConfig?: {
    aiEnabled: boolean
    inputType: string
    currentGain: number
    targetLevel: number
    adjustmentMode: string
  }
}

interface EnhancedInputLevelMonitorProps {
  processorId: string
  processorName: string
  showAIControls?: boolean
}

export default function EnhancedInputLevelMonitor({ 
  processorId, 
  processorName,
  showAIControls = false 
}: EnhancedInputLevelMonitorProps) {
  const [inputMeters, setInputMeters] = useState<InputMeter[]>([])
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<{inputNumber: number, type: 'clipping' | 'low', message: string}[]>([])

  // Fetch meter status every 500ms for real-time updates
  const fetchMeterStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/audio-processor/meter-status?processorId=${processorId}`)
      if (response.ok) {
        const data = await response.json()
        const meters = data.inputMeters || []
        setInputMeters(meters)
        
        // Check for alerts
        const newAlerts: typeof alerts = []
        meters.forEach((meter: InputMeter) => {
          if (meter.currentLevel !== null) {
            if (meter.currentLevel >= -0.5) {
              newAlerts.push({
                inputNumber: meter.inputNumber,
                type: 'clipping',
                message: `${meter.inputName || `Input ${meter.inputNumber + 1}`} is clipping!`
              })
            } else if (meter.currentLevel < -50 && meter.isActive) {
              newAlerts.push({
                inputNumber: meter.inputNumber,
                type: 'low',
                message: `${meter.inputName || `Input ${meter.inputNumber + 1}`} level very low`
              })
            }
          }
        })
        setAlerts(newAlerts)
      }
    } catch (error) {
      logger.error('Error fetching meter status:', error)
    } finally {
      setLoading(false)
    }
  }, [processorId])

  useEffect(() => {
    fetchMeterStatus()
    const interval = setInterval(fetchMeterStatus, 500) // Update every 500ms for real-time
    
    return () => clearInterval(interval)
  }, [fetchMeterStatus])

  const getVUMeterColor = (level: number | null, warningThreshold: number, dangerThreshold: number) => {
    if (level === null) return 'bg-gray-300'
    if (level >= dangerThreshold) return 'bg-red-500'
    if (level >= warningThreshold) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getVUMeterHeight = (level: number | null) => {
    if (level === null) return 0
    // Convert dB to percentage (assuming -80dB to 0dB range)
    const percentage = Math.max(0, Math.min(100, ((level + 80) / 80) * 100))
    return percentage
  }

  const formatLevel = (level: number | null) => {
    if (level === null) return 'N/A'
    return `${level.toFixed(1)} dB`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            Loading Input Levels...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Audio Level Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded ${
                    alert.type === 'clipping' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">{alert.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VU Meters Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Input Level Meters - {processorName}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Real-time Monitoring
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {inputMeters.map((meter) => (
              <div key={meter.id} className="flex flex-col items-center space-y-2">
                {/* Input Label */}
                <div className="text-center">
                  <div className="text-xs font-medium text-gray-700">
                    {meter.inputName || `Input ${meter.inputNumber + 1}`}
                  </div>
                  {meter.aiGainConfig?.aiEnabled && (
                    <Badge variant="outline" className="text-xs mt-1">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}
                </div>

                {/* VU Meter Bar */}
                <div className="relative w-12 h-48 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300">
                  {/* Danger zone marker (top) */}
                  <div 
                    className="absolute w-full h-px bg-red-600 z-10"
                    style={{ 
                      bottom: `${getVUMeterHeight(meter.dangerThreshold)}%` 
                    }}
                  />
                  {/* Warning zone marker */}
                  <div 
                    className="absolute w-full h-px bg-yellow-600 z-10"
                    style={{ 
                      bottom: `${getVUMeterHeight(meter.warningThreshold)}%` 
                    }}
                  />
                  
                  {/* Level bar */}
                  <div 
                    className={`absolute bottom-0 w-full transition-all duration-100 ${
                      getVUMeterColor(meter.currentLevel, meter.warningThreshold, meter.dangerThreshold)
                    }`}
                    style={{ 
                      height: `${getVUMeterHeight(meter.currentLevel)}%` 
                    }}
                  />

                  {/* Peak indicator */}
                  {meter.peakLevel !== null && (
                    <div 
                      className="absolute w-full h-1 bg-white z-20"
                      style={{ 
                        bottom: `${getVUMeterHeight(meter.peakLevel)}%` 
                      }}
                    />
                  )}

                  {/* Scale markers */}
                  <div className="absolute inset-0 flex flex-col justify-between py-2 px-1">
                    <span className="text-[8px] text-gray-600">0</span>
                    <span className="text-[8px] text-gray-600">-10</span>
                    <span className="text-[8px] text-gray-600">-20</span>
                    <span className="text-[8px] text-gray-600">-30</span>
                    <span className="text-[8px] text-gray-600">-40</span>
                  </div>
                </div>

                {/* Level Display */}
                <div className="text-center">
                  <div className={`text-sm font-bold ${
                    meter.currentLevel === null ? 'text-gray-400' :
                    meter.currentLevel >= meter.dangerThreshold ? 'text-red-600' :
                    meter.currentLevel >= meter.warningThreshold ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {formatLevel(meter.currentLevel)}
                  </div>
                  {meter.aiGainConfig && (
                    <div className="text-xs text-gray-500 mt-1">
                      Gain: {meter.aiGainConfig.currentGain.toFixed(1)}dB
                    </div>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    meter.lastUpdate ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs text-gray-500">
                    {meter.lastUpdate ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {inputMeters.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No input meters configured. Add input meters to start monitoring.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded" />
              <span>Normal (-20 to -3 dB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded" />
              <span>Warning (-3 to 0 dB)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded" />
              <span>Clipping (0 dB+)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

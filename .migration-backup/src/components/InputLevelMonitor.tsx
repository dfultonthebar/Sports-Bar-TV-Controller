

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Input } from './ui/input'
import { logger } from '@/lib/logger'
import { 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Plus,
  RotateCcw,
  Settings
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
  status: 'normal' | 'warning' | 'danger'
  statusColor: 'green' | 'yellow' | 'red'
  isStale: boolean
  isReceiving: boolean
}

interface InputLevelMonitorProps {
  processorId: string
  processorName: string
}

export default function InputLevelMonitor({ processorId, processorName }: InputLevelMonitorProps) {
  const [inputMeters, setInputMeters] = useState<InputMeter[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMeterForm, setNewMeterForm] = useState({
    inputNumber: 0,
    parameterName: '',
    inputName: '',
    warningThreshold: -12.0,
    dangerThreshold: -3.0
  })

  // Fetch meter status every 2 seconds
  const fetchMeterStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/audio-processor/meter-status?processorId=${processorId}`)
      if (response.ok) {
        const data = await response.json()
        setInputMeters(data.inputMeters || [])
      }
    } catch (error) {
      logger.error('Error fetching meter status:', error)
    } finally {
      setLoading(false)
    }
  }, [processorId])

  useEffect(() => {
    fetchMeterStatus()
    const interval = setInterval(fetchMeterStatus, 2000) // Update every 2 seconds
    
    return () => clearInterval(interval)
  }, [fetchMeterStatus])

  const handleAddMeter = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/audio-processor/input-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId,
          ...newMeterForm
        })
      })

      if (response.ok) {
        setShowAddForm(false)
        setNewMeterForm({
          inputNumber: 0,
          parameterName: '',
          inputName: '',
          warningThreshold: -12.0,
          dangerThreshold: -3.0
        })
        fetchMeterStatus()
      } else {
        const error = await response.json()
        alert(`Error adding meter: ${error.error}`)
      }
    } catch (error) {
      logger.error('Error adding meter:', error)
      alert('Failed to add input meter')
    }
  }

  const handleResetPeaks = async () => {
    try {
      const response = await fetch('/api/audio-processor/meter-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processorId })
      })

      if (response.ok) {
        fetchMeterStatus()
      }
    } catch (error) {
      logger.error('Error resetting peaks:', error)
    }
  }

  const getLevelColor = (level: number | null, warningThreshold: number, dangerThreshold: number): string => {
    if (level === null) return '#6b7280'
    if (level > dangerThreshold) return '#ef4444'  // Red
    if (level > warningThreshold) return '#f59e0b'  // Yellow
    return '#10b981'  // Green
  }

  const getLevelPercentage = (level: number | null): number => {
    if (level === null) return 0
    // Convert dB (-80 to 0) to percentage (0 to 100)
    return Math.max(0, Math.min(100, ((level + 80) / 80) * 100))
  }

  const formatLevel = (level: number | null): string => {
    if (level === null) return '--'
    return `${level.toFixed(1)} dB`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Input Level Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            Loading input meters...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Input Level Monitor - {processorName}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleResetPeaks}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Reset Peaks
              </Button>
              <Button
                onClick={() => setShowAddForm(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Input
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inputMeters.length === 0 ? (
            <div className="text-center py-8">
              <Volume2 className="h-12 w-12 mx-auto mb-4 text-slate-500" />
              <p className="text-slate-400 mb-4">No input meters configured</p>
              <Button onClick={() => setShowAddForm(true)}>
                Add First Input Meter
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inputMeters.map((meter) => (
                <Card key={meter.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {meter.inputName || `Input ${meter.inputNumber + 1}`}
                      </CardTitle>
                      <Badge 
                        variant={meter.isReceiving ? "default" : "secondary"}
                        className={`text-xs ${
                          meter.isReceiving 
                            ? meter.status === 'danger' 
                              ? 'bg-red-100 text-red-800'
                              : meter.status === 'warning'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            : 'bg-slate-800 or bg-slate-900 text-slate-100'
                        }`}
                      >
                        {meter.isReceiving ? (
                          <>
                            {meter.status === 'danger' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {meter.status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                            {meter.status === 'normal' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {meter.status.toUpperCase()}
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            NO SIGNAL
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-400">
                      {meter.parameterName}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Current Level Display */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Current:</span>
                        <span className={`text-sm font-mono ${
                          meter.currentLevel !== null ? 'text-foreground' : 'text-slate-500'
                        }`}>
                          {formatLevel(meter.currentLevel)}
                        </span>
                      </div>

                      {/* Level Meter */}
                      <div className="space-y-1">
                        <div className="relative h-4 bg-slate-800 or bg-slate-900 rounded overflow-hidden">
                          <div 
                            className="h-full transition-all duration-200"
                            style={{
                              width: `${getLevelPercentage(meter.currentLevel)}%`,
                              backgroundColor: getLevelColor(
                                meter.currentLevel, 
                                meter.warningThreshold, 
                                meter.dangerThreshold
                              )
                            }}
                          />
                          {/* Threshold markers */}
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                            style={{ 
                              left: `${getLevelPercentage(meter.warningThreshold)}%` 
                            }}
                          />
                          <div 
                            className="absolute top-0 bottom-0 w-0.5 bg-red-400"
                            style={{ 
                              left: `${getLevelPercentage(meter.dangerThreshold)}%` 
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>-80dB</span>
                          <span>0dB</span>
                        </div>
                      </div>

                      {/* Peak Level */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Peak:</span>
                        <span className={`text-sm font-mono ${
                          meter.peakLevel !== null ? 'text-foreground' : 'text-slate-500'
                        }`}>
                          {formatLevel(meter.peakLevel)}
                        </span>
                      </div>

                      {/* Last Update */}
                      {meter.lastUpdate && (
                        <div className="text-xs text-slate-400">
                          Last update: {new Date(meter.lastUpdate).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Meter Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Input Meter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMeter} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inputNumber" className="block text-sm font-medium text-slate-200 mb-1">
                    Input Number (0-based)
                  </label>
                  <Input
                    id="inputNumber"
                    type="number"
                    min="0"
                    value={newMeterForm.inputNumber}
                    onChange={(e) => setNewMeterForm(prev => ({
                      ...prev,
                      inputNumber: parseInt(e.target.value) || 0
                    }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="parameterName" className="block text-sm font-medium text-slate-200 mb-1">
                    Parameter Name
                  </label>
                  <Input
                    id="parameterName"
                    placeholder="e.g., SourceMeter_0"
                    value={newMeterForm.parameterName}
                    onChange={(e) => setNewMeterForm(prev => ({
                      ...prev,
                      parameterName: e.target.value
                    }))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="inputName" className="block text-sm font-medium text-slate-200 mb-1">
                  Input Name (friendly name)
                </label>
                <Input
                  id="inputName"
                  placeholder="e.g., Live Band Input"
                  value={newMeterForm.inputName}
                  onChange={(e) => setNewMeterForm(prev => ({
                    ...prev,
                    inputName: e.target.value
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="warningThreshold" className="block text-sm font-medium text-slate-200 mb-1">
                    Warning Threshold (dB)
                  </label>
                  <Input
                    id="warningThreshold"
                    type="number"
                    step="0.1"
                    value={newMeterForm.warningThreshold}
                    onChange={(e) => setNewMeterForm(prev => ({
                      ...prev,
                      warningThreshold: parseFloat(e.target.value)
                    }))}
                  />
                </div>
                <div>
                  <label htmlFor="dangerThreshold" className="block text-sm font-medium text-slate-200 mb-1">
                    Danger Threshold (dB)
                  </label>
                  <Input
                    id="dangerThreshold"
                    type="number"
                    step="0.1"
                    value={newMeterForm.dangerThreshold}
                    onChange={(e) => setNewMeterForm(prev => ({
                      ...prev,
                      dangerThreshold: parseFloat(e.target.value)
                    }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Add Meter
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


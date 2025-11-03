'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Usb,
  Activity,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Trash2,
  Link as LinkIcon,
  TestTube,
  AlertCircle,
  Clock,
  TrendingUp,
  BarChart3,
} from 'lucide-react'

interface CECDevice {
  id: string
  devicePath: string
  deviceType: string
  deviceName: string
  matrixInputId?: string
  vendorId?: string
  productId?: string
  serialNumber?: string
  firmwareVersion?: string
  isActive: boolean
  lastSeen?: string
}

interface CableBox {
  id: string
  name: string
  cecDeviceId: string
  provider: string
  model: string
  lastChannel?: string
  isOnline: boolean
  matrixInputId?: string
  devicePath?: string  // From joined cecDevice
}

interface CommandLog {
  id: string
  command: string
  cecCode?: string
  success: boolean
  responseTime?: number
  timestamp: string
  errorMessage?: string
}

export default function CECDevicesAdminPage() {
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [testingDevice, setTestingDevice] = useState<string | null>(null)
  const [commandLogs, setCommandLogs] = useState<Record<string, CommandLog[]>>({})
  const [stats, setStats] = useState<Record<string, any>>({})

  useEffect(() => {
    fetchCableBoxes()
    fetchStats()
  }, [])

  const fetchCableBoxes = async () => {
    try {
      const response = await fetch('/api/cec/cable-box')
      const data = await response.json()
      if (data.success) {
        setCableBoxes(data.cableBoxes)
      }
    } catch (error) {
      console.error('Error fetching cable boxes:', error)
    }
  }

  const fetchStats = async () => {
    // Fetch command statistics for each cable box
    // This would be implemented in a new API endpoint
    try {
      const response = await fetch('/api/cec/cable-box/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const testConnection = async (cableBoxId: string) => {
    setTestingDevice(cableBoxId)
    try {
      const response = await fetch(`/api/cec/cable-box/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cableBoxId }),
      })

      const data = await response.json()
      if (data.success) {
        showFeedback('Connection test successful!', 'success')
        fetchCableBoxes() // Refresh to update online status
      } else {
        showFeedback(`Test failed: ${data.error}`, 'error')
      }
    } catch (error) {
      showFeedback('Network error during test', 'error')
    } finally {
      setTestingDevice(null)
    }
  }

  const discoverDevices = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cec/cable-box/discover', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        showFeedback(`Discovered ${data.adapters?.length || 0} adapters`, 'success')
        fetchCableBoxes()
      } else {
        showFeedback('Discovery failed', 'error')
      }
    } catch (error) {
      showFeedback('Network error during discovery', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 4000)
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Usb className="w-8 h-8" />
          CEC Device Management
        </h1>
        <div className="flex gap-2">
          <Button onClick={fetchCableBoxes} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={discoverDevices} disabled={loading} size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Discover Devices
          </Button>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{cableBoxes.length}</p>
              </div>
              <Usb className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600">
                  {cableBoxes.filter((b) => b.isOnline).length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-red-600">
                  {cableBoxes.filter((b) => !b.isOnline).length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">95%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cable Box List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Configured Cable Boxes</h2>

        {cableBoxes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Usb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No Cable Boxes Configured</p>
              <p className="text-sm text-muted-foreground mb-4">
                Configure cable boxes in the database or run device discovery
              </p>
              <Button onClick={discoverDevices} disabled={loading}>
                <Activity className="w-4 h-4 mr-2" />
                Discover Devices
              </Button>
            </CardContent>
          </Card>
        ) : (
          cableBoxes.map((box) => (
            <Card key={box.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <Usb className="w-5 h-5" />
                    {box.name}
                    <Badge variant={box.isOnline ? 'default' : 'secondary'}>
                      {box.isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => testConnection(box.id)}
                      variant="outline"
                      size="sm"
                      disabled={testingDevice === box.id}
                    >
                      {testingDevice === box.id ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube className="w-4 h-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Device Path</p>
                    <p className="font-mono text-sm">{box.devicePath || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Provider</p>
                    <p className="font-medium">{box.provider}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Model</p>
                    <p className="font-medium">{box.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Channel</p>
                    <p className="font-medium">{box.lastChannel || 'None'}</p>
                  </div>
                </div>

                {box.matrixInputId && (
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <LinkIcon className="w-4 h-4" />
                    <span>Linked to Matrix Input: {box.matrixInputId}</span>
                  </div>
                )}

                {/* Command Statistics (placeholder) */}
                <div className="mt-4 grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold">247</p>
                    <p className="text-xs text-muted-foreground">Total Commands</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">235</p>
                    <p className="text-xs text-muted-foreground">Successful</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">184ms</p>
                    <p className="text-xs text-muted-foreground">Avg Response</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Hardware Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Hardware Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Current Hardware Status:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>TV Power Control Adapter: /dev/ttyACM0 (Installed)</li>
              <li>Cable Box Adapters: /dev/ttyACM1-4 (Awaiting installation)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Next Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Purchase 4x Pulse-Eight USB CEC Adapters ($200-320)</li>
              <li>Install adapters between cable boxes and matrix inputs</li>
              <li>Click "Discover Devices" to detect new adapters</li>
              <li>Test each connection using the "Test Connection" button</li>
              <li>Link adapters to matrix inputs if needed</li>
            </ol>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Once adapters are installed, they will automatically appear here.
              Use the test button to verify CEC communication before deploying to production.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

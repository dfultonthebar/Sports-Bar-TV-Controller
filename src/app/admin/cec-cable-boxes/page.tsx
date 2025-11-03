'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import {
  Usb,
  Cable,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  Play,
  Terminal,
  AlertCircle,
  Link as LinkIcon,
  TestTube,
  Power,
  Zap,
} from 'lucide-react'

interface CableBox {
  id: string
  name: string
  cecDeviceId: string
  devicePath?: string
  provider: string
  model: string
  lastChannel?: string
  isOnline: boolean
  matrixInputId?: string
}

interface CECDevice {
  id: string
  devicePath: string
  deviceType: string
  deviceName: string
  vendorId?: string
  productId?: string
  serialNumber?: string
  isActive: boolean
  lastSeen?: string
}

interface DiscoveredAdapter {
  path: string
  serial: string
}

export default function CECCableBoxAdminPage() {
  const [cableBoxes, setCableBoxes] = useState<CableBox[]>([])
  const [cecDevices, setCECDevices] = useState<CECDevice[]>([])
  const [discoveredAdapters, setDiscoveredAdapters] = useState<DiscoveredAdapter[]>([])
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [runningScript, setRunningScript] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [testingDevice, setTestingDevice] = useState<string | null>(null)
  const [scriptOutput, setScriptOutput] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([fetchCableBoxes(), fetchCECDevices()])
    } catch (error) {
      logger.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCableBoxes = async () => {
    try {
      const response = await fetch('/api/cec/cable-box')
      const data = await response.json()
      if (data.success) {
        setCableBoxes(data.cableBoxes)
      }
    } catch (error) {
      logger.error('Error fetching cable boxes:', error)
    }
  }

  const fetchCECDevices = async () => {
    try {
      // This endpoint doesn't exist yet - we'll need to create it
      // For now, extract from cable boxes
      const uniqueDevices = new Map<string, CECDevice>()
      cableBoxes.forEach((box) => {
        if (box.devicePath) {
          uniqueDevices.set(box.devicePath, {
            id: box.cecDeviceId,
            devicePath: box.devicePath,
            deviceType: 'cable_box',
            deviceName: `Adapter for ${box.name}`,
            isActive: box.isOnline,
          })
        }
      })
      setCECDevices(Array.from(uniqueDevices.values()))
    } catch (error) {
      logger.error('Error processing CEC devices:', error)
    }
  }

  const discoverAdapters = async () => {
    setDiscovering(true)
    try {
      const response = await fetch('/api/cec/cable-box/discover', {
        method: 'POST',
      })

      const data = await response.json()
      if (data.success) {
        setDiscoveredAdapters(data.adapters || [])
        showFeedback(
          `Discovered ${data.adapters?.length || 0} Pulse-Eight adapter(s)`,
          data.adapters?.length > 0 ? 'success' : 'info'
        )
        fetchData()
      } else {
        showFeedback('Discovery failed: ' + (data.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      showFeedback('Network error during discovery', 'error')
    } finally {
      setDiscovering(false)
    }
  }

  const runSetupScript = async () => {
    setRunningScript(true)
    setScriptOutput('Running CEC device setup script...\n')

    try {
      showFeedback('Setup script is running. This may take a minute...', 'info')

      // Call an endpoint that runs the bash script
      const response = await fetch('/api/cec/cable-box/run-setup', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setScriptOutput((prev) => prev + '\n' + (data.output || 'Script completed successfully.'))
        showFeedback('Setup script completed! udev rules have been generated.', 'success')
        fetchData()
      } else {
        setScriptOutput((prev) => prev + '\n' + (data.error || 'Script failed.'))
        showFeedback('Setup script failed: ' + (data.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      setScriptOutput((prev) => prev + '\n' + 'Error: ' + (error as Error).message)
      showFeedback('Failed to run setup script', 'error')
    } finally {
      setRunningScript(false)
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
        fetchData()
      } else {
        showFeedback(`Test failed: ${data.error}`, 'error')
      }
    } catch (error) {
      showFeedback('Network error during test', 'error')
    } finally {
      setTestingDevice(null)
    }
  }

  const showFeedback = (message: string, type: 'success' | 'error' | 'info') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 5000)
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Cable className="w-8 h-8" />
            CEC Cable Box Configuration
          </h1>
          <p className="text-gray-900 mt-1">
            Configure Pulse-Eight USB CEC adapters for cable box control
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${
            feedback.type === 'success'
              ? 'bg-green-100 text-green-800 border border-green-200'
              : feedback.type === 'error'
              ? 'bg-red-100 text-red-800 border border-red-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : feedback.type === 'error' ? (
            <XCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Hardware Setup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Hardware Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Step 1: Discover Adapters</h3>
              <p className="text-sm text-gray-900 mb-3">
                Scan for connected Pulse-Eight USB CEC adapters. Make sure all adapters are plugged in
                before running discovery.
              </p>
              <Button onClick={discoverAdapters} disabled={discovering} className="w-full">
                <Usb className="w-4 h-4 mr-2" />
                {discovering ? 'Discovering...' : 'Discover CEC Adapters'}
              </Button>
              {discoveredAdapters.length > 0 && (
                <div className="mt-3 p-3 bg-muted rounded text-sm">
                  <p className="font-medium mb-1">Found {discoveredAdapters.length} adapter(s):</p>
                  {discoveredAdapters.map((adapter, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <Usb className="w-3 h-3" />
                      <span className="font-mono">{adapter.path}</span>
                      {adapter.serial && <span className="text-muted-foreground">({adapter.serial})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Step 2: Generate udev Rules</h3>
              <p className="text-sm text-gray-900 mb-3">
                Run the automated setup script to create persistent device names. This ensures adapters
                maintain consistent paths across reboots.
              </p>
              <Button onClick={runSetupScript} disabled={runningScript} variant="secondary" className="w-full">
                <Play className="w-4 h-4 mr-2" />
                {runningScript ? 'Running Script...' : 'Run Setup Script'}
              </Button>
              {scriptOutput && (
                <div className="mt-3 p-3 bg-black text-green-400 rounded text-xs font-mono overflow-auto max-h-40">
                  <pre>{scriptOutput}</pre>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Note:</strong> After running the setup script, adapters will be available at{' '}
              <code className="bg-blue-100 px-1 rounded">/dev/cec-adapter-1</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">/dev/cec-adapter-2</code>, etc.
            </p>
            <p className="text-sm text-blue-800">
              <strong>Using a USB Hub?</strong> Make sure all adapters stay in the same hub ports. The setup script will detect hub paths like <code className="bg-blue-100 px-1 rounded">3-7.1</code>, <code className="bg-blue-100 px-1 rounded">3-7.2</code>, etc.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cable Box Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cable className="w-5 h-5" />
            Cable Box Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {cableBoxes.length === 0 ? (
              <div className="text-center py-8 text-gray-900">
                <Cable className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No cable boxes configured yet</p>
                <p className="text-sm">Cable boxes will appear here once they are set up in the database</p>
              </div>
            ) : (
              cableBoxes.map((box) => (
                <div
                  key={box.id}
                  className={`p-4 rounded-lg border-2 ${
                    box.isOnline
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Cable className="w-5 h-5" />
                        <h3 className="font-semibold text-lg">{box.name}</h3>
                        <Badge variant={box.isOnline ? 'default' : 'secondary'}>
                          {box.isOnline ? 'Online' : 'Offline'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-gray-700 font-medium">Device Path</p>
                          <p className="font-mono font-semibold text-gray-900">
                            {box.devicePath || (
                              <span className="text-yellow-700 font-semibold">Not assigned</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-700 font-medium">Provider</p>
                          <p className="font-semibold text-gray-900">{box.provider}</p>
                        </div>
                        <div>
                          <p className="text-gray-700 font-medium">Model</p>
                          <p className="font-semibold text-gray-900">{box.model}</p>
                        </div>
                        <div>
                          <p className="text-gray-700 font-medium">Last Channel</p>
                          <p className="font-semibold text-gray-900">{box.lastChannel || 'None'}</p>
                        </div>
                      </div>

                      {box.matrixInputId && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                          <LinkIcon className="w-4 h-4" />
                          <span>Linked to Matrix Input: {box.matrixInputId}</span>
                        </div>
                      )}
                    </div>

                    <div className="ml-4">
                      <Button
                        onClick={() => testConnection(box.id)}
                        variant="outline"
                        size="sm"
                        disabled={testingDevice === box.id || !box.devicePath}
                      >
                        {testingDevice === box.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Testing...
                          </>
                        ) : (
                          <>
                            <TestTube className="w-4 h-4 mr-2" />
                            Test
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">Database Configuration</h3>
            <p className="text-sm text-gray-900 mb-2">
              To assign adapters to cable boxes, update the database:
            </p>
            <div className="bg-black text-green-400 p-3 rounded font-mono text-xs overflow-x-auto">
              <pre>{`UPDATE CableBox SET devicePath = '/dev/cec-adapter-1' WHERE id = 'cable-box-1';
UPDATE CableBox SET devicePath = '/dev/cec-adapter-2' WHERE id = 'cable-box-2';
UPDATE CableBox SET devicePath = '/dev/cec-adapter-3' WHERE id = 'cable-box-3';
UPDATE CableBox SET devicePath = '/dev/cec-adapter-4' WHERE id = 'cable-box-4';`}</pre>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Typical Setup</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>
                <strong>Cable Box 1 → /dev/cec-adapter-1</strong> - Controls cable box on Matrix Input 1
              </li>
              <li>
                <strong>Cable Box 2 → /dev/cec-adapter-2</strong> - Controls cable box on Matrix Input 2
              </li>
              <li>
                <strong>Cable Box 3 → /dev/cec-adapter-3</strong> - Controls cable box on Matrix Input 3
              </li>
              <li>
                <strong>Cable Box 4 → /dev/cec-adapter-4</strong> - Controls cable box on Matrix Input 4
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">USB Hub Setup (Recommended Workflow)</h3>
            <ol className="list-decimal list-inside text-sm space-y-1 text-gray-900">
              <li>
                <strong>Label your USB hub ports</strong> with tape or marker: "1", "2", "3", "4"
              </li>
              <li>
                <strong>Plug in one adapter at a time</strong> to hub port 1, connect HDMI to Cable Box 1, test it works
              </li>
              <li>
                <strong>Repeat for adapters 2-4</strong> - assign each to its specific hub port and cable box
              </li>
              <li>
                <strong>Run "Run Setup Script"</strong> with all 4 plugged in - it will detect hub paths (e.g., 3-7.1, 3-7.2)
              </li>
              <li>
                <strong>IMPORTANT:</strong> Never move adapters between hub ports after setup - the system uses physical USB port locations
              </li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Verification</h3>
            <p className="text-sm text-gray-900">
              After configuration, use the "Test" button next to each cable box to verify CEC communication is
              working. A successful test means the adapter can communicate with the cable box.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

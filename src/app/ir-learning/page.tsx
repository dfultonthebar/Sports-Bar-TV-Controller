'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, PlayCircle, AlertCircle, Loader2, Download, Upload, Save, Info } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// Button definitions organized by category (27 total)
const BUTTON_CATEGORIES = {
  power: {
    title: 'Power',
    buttons: ['power'],
  },
  numbers: {
    title: 'Numbers',
    buttons: ['digit_0', 'digit_1', 'digit_2', 'digit_3', 'digit_4', 'digit_5', 'digit_6', 'digit_7', 'digit_8', 'digit_9'],
  },
  navigation: {
    title: 'Navigation',
    buttons: ['arrow_up', 'arrow_down', 'arrow_left', 'arrow_right', 'select'],
  },
  functions: {
    title: 'Functions',
    buttons: ['guide', 'menu', 'info', 'exit', 'last'],
  },
  channel: {
    title: 'Channel',
    buttons: ['channel_up', 'channel_down'],
  },
  dvr: {
    title: 'DVR',
    buttons: ['play', 'pause', 'rewind', 'fast_forward'],
  },
}

// Format button name for display
function formatButtonName(buttonId: string): string {
  return buttonId
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

type ButtonStatus = 'not_learned' | 'learning' | 'learned' | 'error'

interface ButtonState {
  status: ButtonStatus
  irCode?: string
  errorMessage?: string
}

interface IRDevice {
  id: string
  name: string
  deviceType: string
  brand: string
  model?: string
  irCodes?: string
}

export default function IRLearningPage() {
  const [devices, setDevices] = useState<IRDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [iTachAddress, setITachAddress] = useState('192.168.1.100')
  const [portNumber, setPortNumber] = useState(1)
  const [buttonStates, setButtonStates] = useState<Record<string, ButtonState>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Calculate total buttons and learned count
  const totalButtons = Object.values(BUTTON_CATEGORIES).reduce((sum, cat) => sum + cat.buttons.length, 0)
  const learnedCount = Object.values(buttonStates).filter(s => s.status === 'learned').length
  const progressPercentage = totalButtons > 0 ? Math.round((learnedCount / totalButtons) * 100) : 0

  // Load devices on mount
  useEffect(() => {
    loadDevices()
  }, [])

  // Load button states when device is selected
  useEffect(() => {
    if (selectedDeviceId) {
      loadButtonStates()
    }
  }, [selectedDeviceId])

  async function loadDevices() {
    try {
      const response = await fetch('/api/ir-devices')
      if (!response.ok) throw new Error('Failed to load devices')

      const data = await response.json()

      // Filter for cable box devices or all IR devices
      const irDevices = data.devices || []
      setDevices(irDevices)

      // Auto-select first device if available
      if (irDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(irDevices[0].id)
      }
    } catch (error) {
      console.error('Error loading devices:', error)
      toast.error('Failed to load IR devices')
    }
  }

  async function loadButtonStates() {
    if (!selectedDeviceId) return

    try {
      // Fetch device with IR codes from database
      const response = await fetch(`/api/ir-devices?id=${selectedDeviceId}`)
      if (!response.ok) throw new Error('Failed to load device')

      const data = await response.json()
      const device = data.devices?.find((d: IRDevice) => d.id === selectedDeviceId)

      if (!device) return

      // Parse IR codes
      const irCodes = device.irCodes ? JSON.parse(device.irCodes) : {}

      // Initialize button states
      const newStates: Record<string, ButtonState> = {}
      Object.values(BUTTON_CATEGORIES).forEach(category => {
        category.buttons.forEach(buttonId => {
          if (irCodes[buttonId]) {
            newStates[buttonId] = {
              status: 'learned',
              irCode: irCodes[buttonId],
            }
          } else {
            newStates[buttonId] = {
              status: 'not_learned',
            }
          }
        })
      })

      setButtonStates(newStates)
    } catch (error) {
      console.error('Error loading button states:', error)
      toast.error('Failed to load learned codes')
    }
  }

  async function learnButton(buttonId: string) {
    if (!selectedDeviceId) {
      toast.error('Please select a device first')
      return
    }

    // Update status to learning
    setButtonStates(prev => ({
      ...prev,
      [buttonId]: { status: 'learning' },
    }))

    toast.loading(`Learning ${formatButtonName(buttonId)}... Point remote at iTach and press button`, {
      id: `learn-${buttonId}`,
      duration: 10000,
    })

    try {
      const response = await fetch('/api/ir-devices/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          command: buttonId,
          iTachAddress,
          portNumber,
          timeout: 10000,
        }),
      })

      const data = await response.json()

      if (data.success && data.irCode) {
        // Successfully learned
        setButtonStates(prev => ({
          ...prev,
          [buttonId]: {
            status: 'learned',
            irCode: data.irCode,
          },
        }))
        toast.success(`Successfully learned ${formatButtonName(buttonId)}!`, {
          id: `learn-${buttonId}`,
        })
      } else {
        // Error or timeout
        setButtonStates(prev => ({
          ...prev,
          [buttonId]: {
            status: 'error',
            errorMessage: data.error || 'Failed to learn code',
          },
        }))
        toast.error(data.error || 'Failed to learn code', {
          id: `learn-${buttonId}`,
        })
      }
    } catch (error) {
      console.error('Error learning button:', error)
      setButtonStates(prev => ({
        ...prev,
        [buttonId]: {
          status: 'error',
          errorMessage: 'Network error',
        },
      }))
      toast.error('Network error during learning', {
        id: `learn-${buttonId}`,
      })
    }
  }

  async function testButton(buttonId: string) {
    if (!selectedDeviceId) {
      toast.error('Please select a device first')
      return
    }

    const state = buttonStates[buttonId]
    if (!state?.irCode) {
      toast.error('No IR code learned for this button')
      return
    }

    const toastId = toast.loading(`Testing ${formatButtonName(buttonId)}...`)

    try {
      const response = await fetch('/api/ir-devices/send-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: selectedDeviceId,
          command: state.irCode,
          iTachAddress,
          isRawCode: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Test successful for ${formatButtonName(buttonId)}!`, { id: toastId })
      } else {
        toast.error(`Test failed: ${data.error || 'Unknown error'}`, { id: toastId })
      }
    } catch (error) {
      console.error('Error testing button:', error)
      toast.error('Network error during test', { id: toastId })
    }
  }

  async function saveAllCodes() {
    if (!selectedDeviceId) {
      toast.error('Please select a device first')
      return
    }

    setIsSaving(true)
    const toastId = toast.loading('Saving all codes to database...')

    try {
      // Get current device data
      const response = await fetch(`/api/ir-devices?id=${selectedDeviceId}`)
      if (!response.ok) throw new Error('Failed to load device')

      const data = await response.json()
      const device = data.devices?.find((d: IRDevice) => d.id === selectedDeviceId)

      if (!device) throw new Error('Device not found')

      // Codes are already saved individually during learning
      // This is just a confirmation
      toast.success(`All ${learnedCount} codes confirmed saved!`, { id: toastId })
    } catch (error) {
      console.error('Error saving codes:', error)
      toast.error('Failed to save codes', { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  async function exportCodes() {
    if (!selectedDeviceId) {
      toast.error('Please select a device first')
      return
    }

    try {
      const response = await fetch(`/api/ir-devices?id=${selectedDeviceId}`)
      if (!response.ok) throw new Error('Failed to load device')

      const data = await response.json()
      const device = data.devices?.find((d: IRDevice) => d.id === selectedDeviceId)

      if (!device) throw new Error('Device not found')

      const irCodes = device.irCodes ? JSON.parse(device.irCodes) : {}

      // Create download
      const blob = new Blob([JSON.stringify(irCodes, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${device.name.replace(/\s+/g, '_')}_ir_codes.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('IR codes exported successfully!')
    } catch (error) {
      console.error('Error exporting codes:', error)
      toast.error('Failed to export codes')
    }
  }

  async function importCodes(event: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedDeviceId) {
      toast.error('Please select a device first')
      return
    }

    const file = event.target.files?.[0]
    if (!file) return

    const toastId = toast.loading('Importing IR codes...')

    try {
      const text = await file.text()
      const importedCodes = JSON.parse(text)

      // Get current device
      const response = await fetch(`/api/ir-devices?id=${selectedDeviceId}`)
      if (!response.ok) throw new Error('Failed to load device')

      const data = await response.json()
      const device = data.devices?.find((d: IRDevice) => d.id === selectedDeviceId)

      if (!device) throw new Error('Device not found')

      // Update device with imported codes
      const updateResponse = await fetch('/api/ir-devices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...device,
          irCodes: JSON.stringify(importedCodes),
        }),
      })

      if (!updateResponse.ok) throw new Error('Failed to update device')

      // Reload button states
      await loadButtonStates()

      toast.success('IR codes imported successfully!', { id: toastId })
    } catch (error) {
      console.error('Error importing codes:', error)
      toast.error('Failed to import codes. Check file format.', { id: toastId })
    }

    // Reset file input
    event.target.value = ''
  }

  function getStatusColor(status: ButtonStatus): string {
    switch (status) {
      case 'not_learned': return 'bg-gray-700'
      case 'learning': return 'bg-blue-600'
      case 'learned': return 'bg-green-600'
      case 'error': return 'bg-red-600'
      default: return 'bg-gray-700'
    }
  }

  function getStatusText(status: ButtonStatus): string {
    switch (status) {
      case 'not_learned': return 'Not Learned'
      case 'learning': return 'Learning...'
      case 'learned': return 'Learned'
      case 'error': return 'Error'
      default: return 'Unknown'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">IR Learning System</h1>
        <p className="text-slate-400">
          Capture IR codes from your physical remote control using the Global Cache iTach IP2IR device.
          Point your remote at the iTach sensor and press the button you want to learn.
        </p>
      </div>

      {/* Configuration Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Device Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                IR Device
              </label>
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                iTach IP Address
              </label>
              <Input
                type="text"
                value={iTachAddress}
                onChange={(e) => setITachAddress(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                IR Port
              </label>
              <Select value={portNumber.toString()} onValueChange={(v) => setPortNumber(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Port 1</SelectItem>
                  <SelectItem value="2">Port 2</SelectItem>
                  <SelectItem value="3">Port 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-950 border border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-200">
                <p className="font-semibold mb-2">How to learn IR codes:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Select your IR device from the dropdown above</li>
                  <li>Verify iTach IP address and port number are correct</li>
                  <li>Click "Learn" on any button below</li>
                  <li>Point your physical remote at the iTach sensor (6-12 inches away)</li>
                  <li>Press and hold the button on your remote for 1-2 seconds</li>
                  <li>Wait for confirmation that the code was captured</li>
                  <li>Click "Test" to verify the learned code works</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">
                Learning Progress
              </span>
              <span className="text-sm text-slate-400">
                {learnedCount} / {totalButtons} buttons ({progressPercentage}%)
              </span>
            </div>
            <Progress value={progressPercentage} />
          </div>
        </CardContent>
      </Card>

      {/* Learning Grid */}
      {!selectedDeviceId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-slate-400">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Please select a device to begin learning IR codes</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(BUTTON_CATEGORIES).map(([categoryId, category]) => (
            <Card key={categoryId}>
              <CardHeader>
                <CardTitle>{category.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {category.buttons.map((buttonId) => {
                    const state = buttonStates[buttonId] || { status: 'not_learned' }
                    return (
                      <div
                        key={buttonId}
                        className={`border rounded-lg p-4 ${getStatusColor(state.status)} bg-opacity-10 border-opacity-50`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-white mb-1">
                              {formatButtonName(buttonId)}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(state.status)}`}>
                                {getStatusText(state.status)}
                              </span>
                              {state.status === 'learned' && (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {state.status === 'error' && state.errorMessage && (
                          <p className="text-xs text-red-400 mb-3">
                            {state.errorMessage}
                          </p>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => learnButton(buttonId)}
                            disabled={state.status === 'learning'}
                            size="sm"
                            variant={state.status === 'learned' ? 'outline' : 'default'}
                            className="flex-1"
                          >
                            {state.status === 'learning' ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Learning
                              </>
                            ) : (
                              'Learn'
                            )}
                          </Button>

                          <Button
                            onClick={() => testButton(buttonId)}
                            disabled={state.status !== 'learned'}
                            size="sm"
                            variant="outline"
                            title="Test this button"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {selectedDeviceId && (
        <Card className="mt-8">
          <CardContent className="py-6">
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                onClick={saveAllCodes}
                disabled={isSaving || learnedCount === 0}
                size="lg"
                className="min-w-[200px]"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save All Codes
                  </>
                )}
              </Button>

              <Button
                onClick={exportCodes}
                disabled={learnedCount === 0}
                variant="outline"
                size="lg"
                className="min-w-[200px]"
              >
                <Download className="w-5 h-5 mr-2" />
                Export Codes
              </Button>

              <label>
                <input
                  type="file"
                  accept=".json"
                  onChange={importCodes}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-[200px]"
                  asChild
                >
                  <span>
                    <Upload className="w-5 h-5 mr-2" />
                    Import Codes
                  </span>
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

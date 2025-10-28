'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Radio, 
  Trash2, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play
} from 'lucide-react'

interface IRDevice {
  id: string
  name: string
  brand: string
  deviceType: string
  globalCacheDeviceId?: string
  globalCachePortNumber?: number
}

interface GlobalCacheDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  status: string
}

interface IRCommand {
  id: string
  deviceId: string
  functionName: string
  irCode: string
  hexCode?: string
  category?: string
  createdAt: string
}

interface IRLearningPanelProps {
  device: IRDevice
  onClose: () => void
}

export function IRLearningPanel({ device, onClose }: IRLearningPanelProps) {
  const [commands, setCommands] = useState<IRCommand[]>([])
  const [globalCacheDevices, setGlobalCacheDevices] = useState<GlobalCacheDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [newCommandName, setNewCommandName] = useState('')
  const [newCommandCategory, setNewCommandCategory] = useState('Other')
  const [learningCommandId, setLearningCommandId] = useState<string | null>(null)
  const [learningStatus, setLearningStatus] = useState<string>('')
  const [learningError, setLearningError] = useState<string>('')

  const categories = ['Power', 'Volume', 'Channel', 'Menu', 'Navigation', 'Other']

  useEffect(() => {
    loadCommands()
    loadGlobalCacheDevices()
  }, [])

  const loadCommands = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/ir/devices/${device.id}/commands`)
      const data = await response.json()
      
      if (data.success) {
        setCommands(data.commands || [])
      }
    } catch (error) {
      console.error('Error loading commands:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalCacheDevices = async () => {
    try {
      const response = await fetch('/api/globalcache/devices')
      const data = await response.json()
      
      if (data.success) {
        setGlobalCacheDevices(data.devices || [])
      }
    } catch (error) {
      console.error('Error loading Global Cache devices:', error)
    }
  }

  const addCommandPlaceholder = async () => {
    if (!newCommandName.trim()) {
      alert('Please enter a command name')
      return
    }

    // Check if command with this name already exists
    const existingCommand = commands.find(
      cmd => cmd.functionName.toLowerCase() === newCommandName.trim().toLowerCase()
    )

    if (existingCommand) {
      alert('A command with this name already exists')
      return
    }

    // Create a placeholder command (will be replaced when learned)
    try {
      const response = await fetch('/api/ir/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          functionName: newCommandName.trim(),
          irCode: 'PLACEHOLDER',
          category: newCommandCategory
        })
      })

      const data = await response.json()

      if (data.success) {
        setCommands([...commands, data.command])
        setNewCommandName('')
        setNewCommandCategory('Other')
      } else {
        alert('Error adding command: ' + data.error)
      }
    } catch (error) {
      console.error('Error adding command:', error)
      alert('Error adding command')
    }
  }

  const startLearning = async (commandId: string, functionName: string) => {
    // Validate Global Cache device is configured
    if (!device.globalCacheDeviceId) {
      alert('This device is not configured with a Global Cache device. Please edit the device and assign a Global Cache device and port.')
      return
    }

    const globalCacheDevice = globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)
    
    if (!globalCacheDevice) {
      alert('Global Cache device not found. Please ensure it is properly configured.')
      return
    }

    if (globalCacheDevice.status !== 'online') {
      alert(`Global Cache device "${globalCacheDevice.name}" is offline. Please ensure it is powered on and connected to the network.`)
      return
    }

    setLearningCommandId(commandId)
    setLearningStatus('Initializing IR learning mode...')
    setLearningError('')

    try {
      console.log(`🎓 Starting IR learning for command: ${functionName}`)
      console.log(`   Device: ${globalCacheDevice.name} (${globalCacheDevice.ipAddress})`)

      const response = await fetch('/api/ir/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          globalCacheDeviceId: device.globalCacheDeviceId,
          commandId: commandId,
          functionName: functionName
        })
      })

      const data = await response.json()

      if (data.success && data.learnedCode) {
        setLearningStatus('✅ IR code learned successfully!')
        
        // Reload commands to show the updated code
        await loadCommands()

        // Clear status after 3 seconds
        setTimeout(() => {
          setLearningCommandId(null)
          setLearningStatus('')
        }, 3000)
      } else {
        setLearningError(data.error || 'Failed to learn IR code')
        setTimeout(() => {
          setLearningCommandId(null)
          setLearningError('')
        }, 5000)
      }
    } catch (error) {
      console.error('Error learning IR code:', error)
      setLearningError('Error learning IR code: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setTimeout(() => {
        setLearningCommandId(null)
        setLearningError('')
      }, 5000)
    }
  }

  const deleteCommand = async (commandId: string) => {
    if (!confirm('Are you sure you want to delete this command?')) {
      return
    }

    try {
      const response = await fetch(`/api/ir/commands/${commandId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setCommands(commands.filter(cmd => cmd.id !== commandId))
      } else {
        alert('Error deleting command: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting command:', error)
      alert('Error deleting command')
    }
  }

  const testCommand = async (command: IRCommand) => {
    if (command.irCode === 'PLACEHOLDER') {
      alert('This command has not been learned yet. Click the "Learn" button to capture the IR code from your remote.')
      return
    }

    if (!device.globalCacheDeviceId) {
      alert('This device is not configured with a Global Cache device.')
      return
    }

    try {
      const response = await fetch('/api/ir/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          commandId: command.id
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('Command sent successfully')
      } else {
        alert('Error sending command: ' + data.error)
      }
    } catch (error) {
      console.error('Error testing command:', error)
      alert('Error testing command')
    }
  }

  // Group commands by category
  const commandsByCategory = commands.reduce((acc, cmd) => {
    const category = cmd.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(cmd)
    return acc
  }, {} as Record<string, IRCommand[]>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">IR Learning</h2>
          <p className="text-slate-400 mt-1">
            Learn IR commands from your physical remote for <span className="text-slate-200 font-medium">{device.name}</span>
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Back to Devices
        </Button>
      </div>

      {/* Global Cache Status */}
      {device.globalCacheDeviceId ? (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-blue-400" />
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Global Cache Device: {globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)?.name || 'Unknown'}
                </div>
                <div className="text-xs text-slate-400">
                  Port {device.globalCachePortNumber} • 
                  {globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)?.ipAddress}
                </div>
              </div>
              <Badge
                className={`ml-auto ${
                  globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)?.status === 'online'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}
              >
                {globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)?.status || 'unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <div className="text-sm text-amber-200">
                No Global Cache device assigned to this IR device. Please edit the device configuration and assign a Global Cache device and port.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add New Command */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-100">Add New Command</CardTitle>
          <CardDescription>
            Give your command a name, then click "Learn" to capture the IR code from your remote
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Command name (e.g., Power, Volume Up, Channel 5)"
                value={newCommandName}
                onChange={(e) => setNewCommandName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCommandPlaceholder()}
                className="bg-slate-700 border-slate-600 text-slate-100"
              />
            </div>
            <div className="w-40">
              <select
                value={newCommandCategory}
                onChange={(e) => setNewCommandCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <Button onClick={addCommandPlaceholder}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Learning Status */}
      {learningCommandId && (
        <Card className={`border-2 ${learningError ? 'border-red-500/50 bg-red-500/10' : 'border-blue-500/50 bg-blue-500/10'}`}>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              {learningError ? (
                <>
                  <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-red-200">Learning Failed</div>
                    <div className="text-sm text-red-300 mt-1">{learningError}</div>
                  </div>
                </>
              ) : learningStatus.includes('✅') ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-green-200">{learningStatus}</div>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-blue-200">{learningStatus}</div>
                    <div className="text-sm text-blue-300 mt-1">
                      Point your remote at the Global Cache device and press the button you want to learn...
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commands List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : commands.length === 0 ? (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-16 h-16 text-slate-600 mb-4" />
            <p className="text-slate-400 text-center">
              No commands yet. Add a command above to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(commandsByCategory).map(([category, categoryCommands]) => (
            <Card key={category} className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-lg text-slate-100">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoryCommands.map((command) => {
                    const isPlaceholder = command.irCode === 'PLACEHOLDER'
                    const isLearning = learningCommandId === command.id

                    return (
                      <div
                        key={command.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isPlaceholder
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : 'border-slate-600 bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-2 rounded ${isPlaceholder ? 'bg-amber-500/20' : 'bg-green-500/20'}`}>
                            {isPlaceholder ? (
                              <AlertCircle className="w-4 h-4 text-amber-400" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-slate-200">{command.functionName}</div>
                            <div className="text-xs text-slate-400">
                              {isPlaceholder ? 'Not learned yet' : `Learned ${new Date(command.createdAt).toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isPlaceholder && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => testCommand(command)}
                              disabled={isLearning}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Test
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => startLearning(command.id, command.functionName)}
                            disabled={isLearning || !device.globalCacheDeviceId}
                            className={isPlaceholder ? 'bg-blue-600 hover:bg-blue-700' : ''}
                          >
                            {isLearning ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Learning...
                              </>
                            ) : (
                              <>
                                <Radio className="w-4 h-4 mr-1" />
                                {isPlaceholder ? 'Learn' : 'Re-learn'}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteCommand(command.id)}
                            disabled={isLearning}
                          >
                            <Trash2 className="w-4 h-4" />
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
    </div>
  )
}

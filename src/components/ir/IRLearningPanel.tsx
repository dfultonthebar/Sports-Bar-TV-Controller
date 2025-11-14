'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { logger } from '@/lib/logger'
import {
  Plus,
  Radio,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  FlaskConical
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

interface CommandTemplate {
  id: string
  name: string
  brand: string
  deviceType: string
  commands: Array<{ name: string; category: string }>
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
  
  // Template loading state
  const [templates, setTemplates] = useState<CommandTemplate[]>([])
  const [showTemplateLoader, setShowTemplateLoader] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null)
  const [selectedTemplateCommands, setSelectedTemplateCommands] = useState<Set<string>>(new Set())
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  // Test state
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [showTestResults, setShowTestResults] = useState(false)

  const categories = ['Power', 'Volume', 'Channel', 'Menu', 'Navigation', 'Other']

  useEffect(() => {
    loadCommands()
    loadGlobalCacheDevices()
    loadTemplates()
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
      logger.error('Error loading commands:', error)
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
      logger.error('Error loading Global Cache devices:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/ir/templates')
      const data = await response.json()
      
      if (data.success) {
        setTemplates(data.templates || [])
      }
    } catch (error) {
      logger.error('Error loading command templates:', error)
    }
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      // Select all commands by default
      setSelectedTemplateCommands(new Set(template.commands.map(cmd => cmd.name)))
    }
  }

  const toggleTemplateCommand = (commandName: string) => {
    const newSelected = new Set(selectedTemplateCommands)
    if (newSelected.has(commandName)) {
      newSelected.delete(commandName)
    } else {
      newSelected.add(commandName)
    }
    setSelectedTemplateCommands(newSelected)
  }

  const selectAllTemplateCommands = () => {
    if (selectedTemplate) {
      setSelectedTemplateCommands(new Set(selectedTemplate.commands.map(cmd => cmd.name)))
    }
  }

  const deselectAllTemplateCommands = () => {
    setSelectedTemplateCommands(new Set())
  }

  const loadCommandsFromTemplate = async () => {
    if (!selectedTemplate) return
    if (selectedTemplateCommands.size === 0) {
      alert('Please select at least one command to load')
      return
    }

    setLoadingTemplate(true)
    try {
      const response = await fetch(`/api/ir/devices/${device.id}/load-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          selectedCommands: Array.from(selectedTemplateCommands)
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`Successfully loaded ${data.added} commands. ${data.skipped} commands were skipped (already exist).`)
        await loadCommands()
        setShowTemplateLoader(false)
        setSelectedTemplate(null)
        setSelectedTemplateCommands(new Set())
      } else {
        alert('Error loading commands: ' + data.error)
      }
    } catch (error) {
      logger.error('Error loading commands from template:', error)
      alert('Error loading commands from template')
    } finally {
      setLoadingTemplate(false)
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
      logger.error('Error adding command:', error)
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
      logger.info(`🎓 Starting IR learning for command: ${functionName}`)
      logger.info(`   Device: ${globalCacheDevice.name} (${globalCacheDevice.ipAddress})`)

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
      logger.error('Error learning IR code:', error)
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
      logger.error('Error deleting command:', error)
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
        logger.info('Command sent successfully')
      } else {
        alert('Error sending command: ' + data.error)
      }
    } catch (error) {
      logger.error('Error testing command:', error)
      alert('Error testing command')
    }
  }

  const testAllCommands = async () => {
    if (!device.globalCacheDeviceId) {
      alert('This device is not configured with a Global Cache device.')
      return
    }

    const learnedCommands = commands.filter(cmd => cmd.irCode !== 'PLACEHOLDER')
    if (learnedCommands.length === 0) {
      alert('No learned commands to test. Please learn some IR codes first.')
      return
    }

    setTesting(true)
    setTestResults(null)

    try {
      logger.info(`Testing ${learnedCommands.length} IR commands...`)

      const response = await fetch('/api/ir-devices/test-all-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id
        })
      })

      const data = await response.json()

      if (data.success) {
        setTestResults(data)
        setShowTestResults(true)
        logger.info(`Test complete: ${data.summary.passed}/${data.summary.total} passed`)
      } else {
        alert('Error testing commands: ' + data.error)
      }
    } catch (error) {
      logger.error('Error testing all commands:', error)
      alert('Error testing all commands')
    } finally {
      setTesting(false)
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={testAllCommands}
            disabled={testing || commands.filter(c => c.irCode !== 'PLACEHOLDER').length === 0}
            className="flex items-center gap-2"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FlaskConical className="w-4 h-4" />
                Test All Commands
              </>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Back to Devices
          </Button>
        </div>
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

      {/* Load Commands from Template */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-100">Load Commands from Template</CardTitle>
              <CardDescription>
                Quickly add common commands for your device type
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowTemplateLoader(!showTemplateLoader)}
            >
              {showTemplateLoader ? 'Hide Templates' : 'Show Templates'}
            </Button>
          </div>
        </CardHeader>
        {showTemplateLoader && (
          <CardContent className="space-y-4">
            <div>
              <Label className="text-slate-300">Select Device Model Template</Label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full h-10 px-3 mt-2 rounded-md bg-slate-700 border border-slate-600 text-slate-100"
              >
                <option value="">Choose a template...</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.commands.length} commands)
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-slate-300">
                    Select Commands to Load ({selectedTemplateCommands.size} selected)
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllTemplateCommands}
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={deselectAllTemplateCommands}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-600 rounded-md p-3 bg-slate-700/30">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTemplate.commands.map((cmd) => (
                      <label
                        key={cmd.name}
                        className="flex items-center gap-2 p-2 rounded hover:bg-slate-600/30 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTemplateCommands.has(cmd.name)}
                          onChange={() => toggleTemplateCommand(cmd.name)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-slate-200">{cmd.name}</span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {cmd.category}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={loadCommandsFromTemplate}
                  disabled={loadingTemplate || selectedTemplateCommands.size === 0}
                  className="w-full"
                >
                  {loadingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading Commands...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Load {selectedTemplateCommands.size} Commands
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Add New Command */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-slate-100">Add Individual Command</CardTitle>
          <CardDescription>
            Or add a single custom command, then click "Learn" to capture the IR code from your remote
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
                    const testResult = testResults?.results?.find((r: any) => r.command === command.functionName)

                    return (
                      <div
                        key={command.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isPlaceholder
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : testResult?.success === false
                            ? 'border-red-500/30 bg-red-500/5'
                            : testResult?.success === true
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-slate-600 bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`p-2 rounded ${
                            isPlaceholder
                              ? 'bg-amber-500/20'
                              : testResult?.success === false
                              ? 'bg-red-500/20'
                              : testResult?.success === true
                              ? 'bg-green-500/20'
                              : 'bg-slate-600/20'
                          }`}>
                            {isPlaceholder ? (
                              <AlertCircle className="w-4 h-4 text-amber-400" />
                            ) : testResult?.success === false ? (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            ) : testResult?.success === true ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-slate-200">{command.functionName}</div>
                              {testResult && (
                                <Badge
                                  variant="outline"
                                  className={
                                    testResult.success
                                      ? 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'
                                      : 'bg-red-500/20 text-red-400 border-red-500/30 text-xs'
                                  }
                                >
                                  {testResult.success ? '✓ PASS' : '✗ FAIL'}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">
                              {isPlaceholder ? (
                                'Not learned yet'
                              ) : testResult?.error ? (
                                <span className="text-red-400 font-mono">{testResult.error} • {command.irCode.length} chars</span>
                              ) : (
                                `Learned ${new Date(command.createdAt).toLocaleDateString()} • ${command.irCode.length} chars`
                              )}
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

      {/* Test Results Modal */}
      {showTestResults && testResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden border-slate-700 bg-slate-800">
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-100">IR Command Test Results</CardTitle>
                  <CardDescription>
                    Tested {testResults.summary.total} commands on {testResults.device}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setShowTestResults(false)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="border-slate-600 bg-slate-700/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-slate-100">{testResults.summary.total}</div>
                    <div className="text-sm text-slate-400 mt-1">Total Tested</div>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30 bg-green-500/10">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">{testResults.summary.passed}</div>
                    <div className="text-sm text-green-300 mt-1">Passed ✓</div>
                  </CardContent>
                </Card>
                <Card className="border-red-500/30 bg-red-500/10">
                  <CardContent className="p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">{testResults.summary.failed}</div>
                    <div className="text-sm text-red-300 mt-1">Failed ✗</div>
                  </CardContent>
                </Card>
              </div>

              {/* Results List */}
              <div className="space-y-3">
                {testResults.results.map((result: any, index: number) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${
                      result.success
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {result.success ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-slate-200">{result.command}</div>
                          <div className="text-xs text-slate-400 mt-1">
                            Code length: {result.code.length} chars
                            {result.error && (
                              <span className="ml-3 text-red-400 font-mono">
                                {result.error}
                              </span>
                            )}
                            {result.success && result.response && result.response !== 'No response' && (
                              <span className="ml-3 text-green-400">
                                {result.response}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          result.success
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }
                      >
                        {result.success ? 'PASS' : 'FAIL'}
                      </Badge>
                    </div>
                    {!result.success && result.code && (
                      <div className="mt-2 text-xs text-slate-500 font-mono truncate">
                        Ending: ...{result.code.slice(-60)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Failed Commands Summary */}
              {testResults.summary.failed > 0 && (
                <div className="mt-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 text-amber-400 font-medium mb-2">
                    <AlertCircle className="w-5 h-5" />
                    Commands Needing Re-learning
                  </div>
                  <div className="text-sm text-amber-200">
                    The following {testResults.summary.failed} command(s) failed and should be re-learned:
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {testResults.results
                      .filter((r: any) => !r.success)
                      .map((r: any, i: number) => (
                        <Badge key={i} variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                          {r.command}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

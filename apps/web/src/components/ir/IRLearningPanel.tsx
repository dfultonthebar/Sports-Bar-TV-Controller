'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { logger } from '@sports-bar/logger'
import {
  Plus,
  Radio,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Download,
  FlaskConical,
  Target,
  StopCircle
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

  // Alignment test mode state - continuously sends Exit command for IR emitter alignment
  const [alignmentTestRunning, setAlignmentTestRunning] = useState(false)
  const [alignmentTestCount, setAlignmentTestCount] = useState(0)
  const [alignmentTestInterval, setAlignmentTestInterval] = useState<NodeJS.Timeout | null>(null)

  // Learn All wizard state
  const [wizardRunning, setWizardRunning] = useState(false)
  const [wizardQueue, setWizardQueue] = useState<IRCommand[]>([])
  const [wizardIndex, setWizardIndex] = useState(0)
  const [wizardStatus, setWizardStatus] = useState<'idle' | 'connecting' | 'ready' | 'captured' | 'testing' | 'verified' | 'failed' | 'skipped'>('idle')
  const [wizardResults, setWizardResults] = useState<Array<{ name: string; status: 'ok' | 'fail' | 'skipped' }>>([])
  const [wizardAbort, setWizardAbort] = useState(false)

  // Clone state
  const [cloning, setCloning] = useState(false)
  const [cloneResult, setCloneResult] = useState<string>('')
  const [allIRDevices, setAllIRDevices] = useState<IRDevice[]>([])

  const categories = ['Power', 'Volume', 'Channel', 'Menu', 'Navigation', 'Other']

  useEffect(() => {
    loadCommands()
    loadGlobalCacheDevices()
    loadTemplates()
    loadAllIRDevices()
  }, [])

  // Cleanup alignment test interval on unmount
  useEffect(() => {
    return () => {
      if (alignmentTestInterval) {
        clearInterval(alignmentTestInterval)
      }
    }
  }, [alignmentTestInterval])

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

  const loadAllIRDevices = async () => {
    try {
      const response = await fetch('/api/ir/devices')
      const data = await response.json()
      if (data.success) {
        setAllIRDevices(data.devices || [])
      }
    } catch (error) {
      logger.error('Error loading IR devices:', error)
    }
  }

  const cloneToOtherDevices = async () => {
    const otherDevices = allIRDevices.filter(d => d.id !== device.id)
    if (otherDevices.length === 0) return

    setCloning(true)
    setCloneResult('')
    try {
      const response = await fetch('/api/ir/commands/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceDeviceId: device.id,
          targetDeviceIds: otherDevices.map(d => d.id)
        })
      })
      const data = await response.json()
      if (data.success) {
        const summary = data.results.map((r: any) => `${r.deviceName}: ${r.updated} updated, ${r.added} added`).join('; ')
        setCloneResult(summary)
      } else {
        setCloneResult(`Error: ${data.error}`)
      }
    } catch (error) {
      setCloneResult('Failed to clone commands')
    } finally {
      setCloning(false)
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

  // Play a beep using Web Audio API (no audio files needed)
  const playBeep = (frequency: number = 880, duration: number = 200) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = frequency
      osc.type = 'sine'
      gain.gain.value = 0.3
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000)
      osc.start()
      osc.stop(ctx.currentTime + duration / 1000)
    } catch {}
  }

  const startLearning = async (commandId: string, functionName: string) => {
    if (!device.globalCacheDeviceId) {
      alert('This device is not configured with a Global Cache device.')
      return
    }

    const globalCacheDevice = globalCacheDevices.find(d => d.id === device.globalCacheDeviceId)
    if (!globalCacheDevice) {
      alert('Global Cache device not found.')
      return
    }

    setLearningCommandId(commandId)
    setLearningStatus('connecting')
    setLearningError('')

    try {
      const response = await fetch('/api/ir/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          globalCacheDeviceId: device.globalCacheDeviceId,
          commandId,
          functionName
        })
      })

      // Check if streaming response
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) throw new Error('No response stream')

        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/m)
            if (!match) continue
            try {
              const event = JSON.parse(match[1])
              if (event.status === 'connecting') {
                setLearningStatus('connecting')
              } else if (event.status === 'ready') {
                setLearningStatus('ready')
                playBeep(880, 150)
                setTimeout(() => playBeep(1100, 150), 180)
              } else if (event.status === 'captured') {
                setLearningStatus('captured')
                playBeep(1320, 300)
                await loadCommands()
                setTimeout(() => {
                  setLearningCommandId(null)
                  setLearningStatus('')
                }, 2000)
              } else if (event.status === 'error') {
                setLearningError(event.error || 'Learning failed')
                setTimeout(() => {
                  setLearningCommandId(null)
                  setLearningError('')
                }, 5000)
              }
            } catch {}
          }
        }
      } else {
        // Fallback for non-streaming response
        const data = await response.json()
        if (data.success) {
          setLearningStatus('captured')
          await loadCommands()
          setTimeout(() => { setLearningCommandId(null); setLearningStatus('') }, 2000)
        } else {
          setLearningError(data.error || 'Failed')
          setTimeout(() => { setLearningCommandId(null); setLearningError('') }, 5000)
        }
      }
    } catch (error) {
      setLearningError('Error: ' + (error instanceof Error ? error.message : 'Unknown'))
      setTimeout(() => { setLearningCommandId(null); setLearningError('') }, 5000)
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

  // Start alignment test mode - continuously sends Exit command
  const startAlignmentTest = () => {
    // Find the Exit command
    const exitCommand = commands.find(
      cmd => cmd.functionName.toLowerCase() === 'exit' && cmd.irCode !== 'PLACEHOLDER'
    )

    if (!exitCommand) {
      alert('Exit command not found or not learned yet. Please learn the "Exit" command first.')
      return
    }

    if (!device.globalCacheDeviceId) {
      alert('This device is not configured with a Global Cache device.')
      return
    }

    setAlignmentTestRunning(true)
    setAlignmentTestCount(0)

    // Send first command immediately
    sendAlignmentCommand(exitCommand)

    // Then send every 2 seconds
    const interval = setInterval(() => {
      sendAlignmentCommand(exitCommand)
    }, 2000)

    setAlignmentTestInterval(interval)
    logger.info('🎯 Started IR alignment test mode - sending Exit command every 2 seconds')
  }

  const sendAlignmentCommand = async (command: IRCommand) => {
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
        setAlignmentTestCount(prev => prev + 1)
        logger.debug(`🎯 Alignment test: Exit command sent (${alignmentTestCount + 1})`)
      } else {
        logger.warn('🎯 Alignment test: Command failed:', data.error)
      }
    } catch (error) {
      logger.error('🎯 Alignment test error:', error)
    }
  }

  const stopAlignmentTest = () => {
    if (alignmentTestInterval) {
      clearInterval(alignmentTestInterval)
      setAlignmentTestInterval(null)
    }
    setAlignmentTestRunning(false)
    logger.info(`🎯 Stopped IR alignment test mode after ${alignmentTestCount} commands`)
  }

  // Learn All wizard - walks through every command sequentially
  const startWizard = () => {
    // Queue all commands (prioritize unlearned, then all)
    const queue = [...commands].sort((a, b) => {
      const aLearned = a.irCode !== 'PLACEHOLDER' && !a.irCode.startsWith('sendir,1:1,1,38000')
      const bLearned = b.irCode !== 'PLACEHOLDER' && !b.irCode.startsWith('sendir,1:1,1,38000')
      if (aLearned === bLearned) return 0
      return aLearned ? 1 : -1 // Unlearned first
    })
    setWizardQueue(queue)
    setWizardIndex(0)
    setWizardResults([])
    setWizardRunning(true)
    setWizardAbort(false)
    setWizardStatus('idle')
    // Start first command
    wizardLearnCommand(queue, 0)
  }

  const stopWizard = () => {
    setWizardAbort(true)
    setWizardRunning(false)
    setWizardStatus('idle')
    setLearningCommandId(null)
  }

  const wizardSkip = () => {
    const cmd = wizardQueue[wizardIndex]
    setWizardResults(prev => [...prev, { name: cmd.functionName, status: 'skipped' }])
    const nextIdx = wizardIndex + 1
    if (nextIdx < wizardQueue.length) {
      setWizardIndex(nextIdx)
      setWizardStatus('idle')
      wizardLearnCommand(wizardQueue, nextIdx)
    } else {
      setWizardRunning(false)
      setWizardStatus('idle')
      setLearningCommandId(null)
    }
  }

  const wizardLearnCommand = async (queue: IRCommand[], idx: number) => {
    if (idx >= queue.length) {
      setWizardRunning(false)
      setWizardStatus('idle')
      setLearningCommandId(null)
      return
    }

    const cmd = queue[idx]
    setLearningCommandId(cmd.id)
    setWizardStatus('connecting')

    try {
      const response = await fetch('/api/ir/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: device.id,
          globalCacheDeviceId: device.globalCacheDeviceId,
          commandId: cmd.id,
          functionName: cmd.functionName
        })
      })

      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error('No stream')

        let buffer = ''
        let captured = false
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const match = line.match(/^data: (.+)$/m)
            if (!match) continue
            try {
              const event = JSON.parse(match[1])
              if (event.status === 'connecting') setWizardStatus('connecting')
              else if (event.status === 'ready') {
                setWizardStatus('ready')
                playBeep(880, 150)
                setTimeout(() => playBeep(1100, 150), 180)
              } else if (event.status === 'captured') {
                captured = true
                setWizardStatus('testing')
                playBeep(1320, 200)

                // Auto-test the captured code
                await loadCommands()
                await new Promise(r => setTimeout(r, 500))
                const testRes = await fetch('/api/ir/commands/send', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ deviceId: device.id, commandId: cmd.id })
                })
                const testData = await testRes.json()

                if (testData.success) {
                  setWizardStatus('verified')
                  setWizardResults(prev => [...prev, { name: cmd.functionName, status: 'ok' }])
                  playBeep(1320, 100)
                  setTimeout(() => playBeep(1540, 200), 120)
                } else {
                  setWizardStatus('failed')
                  setWizardResults(prev => [...prev, { name: cmd.functionName, status: 'fail' }])
                }

                // Auto-advance after 1.5s
                await new Promise(r => setTimeout(r, 1500))
                if (!wizardAbort) {
                  const nextIdx = idx + 1
                  setWizardIndex(nextIdx)
                  wizardLearnCommand(queue, nextIdx)
                }
              } else if (event.status === 'error') {
                setWizardStatus('failed')
                setWizardResults(prev => [...prev, { name: cmd.functionName, status: 'fail' }])
                await new Promise(r => setTimeout(r, 2000))
                if (!wizardAbort) {
                  const nextIdx = idx + 1
                  setWizardIndex(nextIdx)
                  wizardLearnCommand(queue, nextIdx)
                }
              }
            } catch {}
          }
        }

        if (!captured) {
          setWizardResults(prev => [...prev, { name: cmd.functionName, status: 'fail' }])
          if (!wizardAbort) {
            const nextIdx = idx + 1
            setWizardIndex(nextIdx)
            wizardLearnCommand(queue, nextIdx)
          }
        }
      }
    } catch (error) {
      setWizardResults(prev => [...prev, { name: cmd.functionName, status: 'fail' }])
      if (!wizardAbort) {
        const nextIdx = idx + 1
        setWizardIndex(nextIdx)
        wizardLearnCommand(queue, nextIdx)
      }
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
          {/* Learn All Wizard Button */}
          {wizardRunning ? (
            <Button
              variant="destructive"
              onClick={stopWizard}
              className="flex items-center gap-2"
            >
              <StopCircle className="w-4 h-4" />
              Stop Wizard
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={startWizard}
              disabled={commands.length === 0 || !device.globalCacheDeviceId || alignmentTestRunning}
              className="flex items-center gap-2 border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <Radio className="w-4 h-4" />
              Learn All
            </Button>
          )}
          {/* Alignment Test Button */}
          {alignmentTestRunning ? (
            <Button
              variant="destructive"
              onClick={stopAlignmentTest}
              className="flex items-center gap-2 animate-pulse"
            >
              <StopCircle className="w-4 h-4" />
              Stop Alignment ({alignmentTestCount})
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={startAlignmentTest}
              disabled={!commands.some(c => c.functionName.toLowerCase() === 'exit' && c.irCode !== 'PLACEHOLDER')}
              className="flex items-center gap-2"
              title="Continuously sends Exit command for IR emitter alignment"
            >
              <Target className="w-4 h-4" />
              Alignment Test
            </Button>
          )}
          <Button
            variant="outline"
            onClick={testAllCommands}
            disabled={testing || alignmentTestRunning || commands.filter(c => c.irCode !== 'PLACEHOLDER').length === 0}
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
          {allIRDevices.filter(d => d.id !== device.id).length > 0 && (
            <Button
              variant="outline"
              onClick={cloneToOtherDevices}
              disabled={cloning || commands.filter(c => c.irCode && c.irCode.startsWith('sendir')).length === 0}
              className="flex items-center gap-2 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              {cloning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Copy to Other Boxes ({allIRDevices.filter(d => d.id !== device.id).length})
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={alignmentTestRunning}>
            Back to Devices
          </Button>
        </div>
      </div>

      {/* Clone result banner */}
      {cloneResult && (
        <div className={`rounded-lg border p-3 text-sm ${
          cloneResult.startsWith('Error') ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-green-500 bg-green-500/10 text-green-400'
        }`}>
          {cloneResult}
          <button onClick={() => setCloneResult('')} className="ml-2 text-slate-400 hover:text-white">&times;</button>
        </div>
      )}

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

      {/* Alignment Test Mode Banner */}
      {alignmentTestRunning && (
        <Card className="border-2 border-orange-500/50 bg-orange-500/10 animate-pulse">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-orange-400 animate-bounce" />
                <div>
                  <div className="font-medium text-orange-200">
                    🎯 Alignment Test Running
                  </div>
                  <div className="text-sm text-orange-300 mt-1">
                    Sending Exit command every 2 seconds • {alignmentTestCount} commands sent
                  </div>
                  <div className="text-xs text-orange-400 mt-1">
                    Adjust the IR emitter position until the cable box responds consistently
                  </div>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={stopAlignmentTest}
                className="flex items-center gap-2"
              >
                <StopCircle className="w-4 h-4" />
                Stop Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Learn All Wizard Banner */}
      {wizardRunning && wizardQueue.length > 0 && (
        <Card className={`border-2 ${
          wizardStatus === 'ready' ? 'border-green-500 bg-green-500/10 animate-pulse' :
          wizardStatus === 'captured' || wizardStatus === 'testing' ? 'border-blue-500 bg-blue-500/10' :
          wizardStatus === 'verified' ? 'border-green-500 bg-green-500/10' :
          wizardStatus === 'failed' ? 'border-red-500 bg-red-500/10' :
          'border-blue-500/50 bg-blue-500/10'
        }`}>
          <CardContent className="py-6">
            <div className="text-center space-y-4">
              {/* Progress */}
              <div className="text-sm text-slate-400">
                Button {wizardIndex + 1} of {wizardQueue.length}
                {wizardResults.length > 0 && (
                  <span className="ml-3">
                    ({wizardResults.filter(r => r.status === 'ok').length} verified,
                    {' '}{wizardResults.filter(r => r.status === 'fail').length} failed,
                    {' '}{wizardResults.filter(r => r.status === 'skipped').length} skipped)
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(wizardIndex / wizardQueue.length) * 100}%` }}
                />
              </div>

              {/* Current button name - BIG */}
              <div className={`text-4xl font-bold ${
                wizardStatus === 'ready' ? 'text-green-400' :
                wizardStatus === 'verified' ? 'text-green-400' :
                wizardStatus === 'failed' ? 'text-red-400' :
                'text-white'
              }`}>
                {wizardQueue[wizardIndex]?.functionName || ''}
              </div>

              {/* Status */}
              <div className={`text-xl font-semibold ${
                wizardStatus === 'connecting' ? 'text-blue-400' :
                wizardStatus === 'ready' ? 'text-green-400 animate-pulse' :
                wizardStatus === 'captured' || wizardStatus === 'testing' ? 'text-blue-400' :
                wizardStatus === 'verified' ? 'text-green-400' :
                wizardStatus === 'failed' ? 'text-red-400' :
                'text-slate-400'
              }`}>
                {wizardStatus === 'connecting' && '⏳ Connecting...'}
                {wizardStatus === 'ready' && '👉 PRESS THE BUTTON NOW!'}
                {wizardStatus === 'captured' && '📡 Captured! Testing...'}
                {wizardStatus === 'testing' && '🔍 Verifying...'}
                {wizardStatus === 'verified' && '✅ Verified! Moving on...'}
                {wizardStatus === 'failed' && '❌ Failed — moving on...'}
                {wizardStatus === 'skipped' && '⏭️ Skipped'}
                {wizardStatus === 'idle' && 'Starting...'}
              </div>

              {/* Skip button */}
              {(wizardStatus === 'ready' || wizardStatus === 'connecting') && (
                <Button
                  variant="outline"
                  onClick={wizardSkip}
                  className="mt-2"
                >
                  Skip This Button
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wizard Complete Summary */}
      {!wizardRunning && wizardResults.length > 0 && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-100">Learn All Results</h3>
              <Button size="sm" variant="outline" onClick={() => setWizardResults([])}>Dismiss</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {wizardResults.map((r, i) => (
                <Badge
                  key={i}
                  className={
                    r.status === 'ok' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    r.status === 'fail' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                    'bg-slate-500/20 text-slate-400 border-slate-500/30'
                  }
                >
                  {r.status === 'ok' ? '✓' : r.status === 'fail' ? '✗' : '⏭'} {r.name}
                </Badge>
              ))}
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
                        className="flex items-center gap-2 p-2 rounded-sm hover:bg-slate-600/30 cursor-pointer"
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

      {/* Learning Status - shows error details if any */}
      {learningCommandId && learningError && (
        <Card className="border-2 border-red-500/50 bg-red-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-red-200">Learning Failed</div>
                <div className="text-sm text-red-300 mt-1">{learningError}</div>
              </div>
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
                            disabled={(learningCommandId !== null && !isLearning) || !device.globalCacheDeviceId}
                            className={
                              isLearning && learningStatus === 'ready'
                                ? 'bg-green-500 hover:bg-green-600 animate-pulse text-white min-w-[140px]'
                                : isLearning && learningStatus === 'captured'
                                ? 'bg-green-700 text-white min-w-[140px]'
                                : isLearning && learningError
                                ? 'bg-red-600 text-white min-w-[140px]'
                                : isLearning
                                ? 'bg-blue-600 text-white min-w-[140px]'
                                : isPlaceholder
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : ''
                            }
                          >
                            {isLearning && learningError ? (
                              <>
                                <AlertCircle className="w-4 h-4 mr-1" />
                                Failed
                              </>
                            ) : isLearning && learningStatus === 'connecting' ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Connecting...
                              </>
                            ) : isLearning && learningStatus === 'ready' ? (
                              <>
                                <Radio className="w-4 h-4 mr-1 animate-ping" />
                                PRESS NOW!
                              </>
                            ) : isLearning && learningStatus === 'captured' ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Captured!
                              </>
                            ) : isLearning ? (
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
                          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
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

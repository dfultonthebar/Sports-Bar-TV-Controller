
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Settings, 
  Upload, 
  Download, 
  Save, 
  Play, 
  FileText, 
  Cpu, 
  Network, 
  Volume2, 
  Mic, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Activity,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Eye,
  EyeOff,
  Sliders,
  Router,
  AudioLines,
  MessageSquare,
  Clock,
  Music,
  Headphones,
  Info
} from 'lucide-react'

interface AtlasProcessor {
  id: string
  name: string
  model: string
  ipAddress: string
  port: number
  status: 'online' | 'offline' | 'error'
  zones: number
  inputs: number
  outputs: number
  username?: string
  hasCredentials?: boolean
}

interface InputConfig {
  id: number
  name: string
  type: 'microphone' | 'line' | 'dante' | 'zone'
  physicalInput: number // Physical input number on the processor (1-based)
  stereoLink?: number // ID of paired input for stereo (optional)
  stereoMode: 'mono' | 'left' | 'right' | 'stereo' // Stereo configuration
  gainDb: number
  phantom: boolean
  lowcut: boolean
  compressor: boolean
  gate: boolean
  eq: {
    band1: number
    band2: number
    band3: number
  }
  routing: number[]
}

interface OutputConfig {
  id: number
  name: string
  type: 'speaker' | 'dante' | 'zone'
  physicalOutput: number // Physical output number on the processor (1-based)
  groupId?: string // Group ID for output grouping (optional)
  groupName?: string // Human-readable group name
  levelDb: number
  muted: boolean
  delay: number
  eq: {
    band1: number
    band2: number
    band3: number
  }
  compressor: boolean
  limiter: boolean
}

interface SceneConfig {
  id: number
  name: string
  description: string
  inputs: Partial<InputConfig>[]
  outputs: Partial<OutputConfig>[]
  recall_time: number
  created_at: string
}

interface MessageConfig {
  id: number
  name: string
  file: string
  duration: number
  priority: number
  zones: number[]
  volume: number
}

export default function AtlasProgrammingInterface() {
  const [processors, setProcessors] = useState<AtlasProcessor[]>([])
  const [selectedProcessor, setSelectedProcessor] = useState<AtlasProcessor | null>(null)
  const [activeTab, setActiveTab] = useState('processors')
  const [inputs, setInputs] = useState<InputConfig[]>([])
  const [outputs, setOutputs] = useState<OutputConfig[]>([])
  const [scenes, setScenes] = useState<SceneConfig[]>([])
  const [messages, setMessages] = useState<MessageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)
  const [outputGroups, setOutputGroups] = useState<{[key: string]: string}>({}) // groupId -> groupName mapping
  const [showAddProcessor, setShowAddProcessor] = useState(false)
  const [showEditProcessor, setShowEditProcessor] = useState(false)
  const [editingProcessor, setEditingProcessor] = useState<AtlasProcessor | null>(null)
  const [newProcessor, setNewProcessor] = useState({
    name: '',
    model: 'AZM8',
    ipAddress: '',
    port: 80,
    zones: 8,
    description: '',
    username: 'admin',
    password: 'admin'
  })

  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  useEffect(() => {
    fetchProcessors()
  }, [])

  useEffect(() => {
    if (selectedProcessor) {
      fetchConfiguration(selectedProcessor.id)
    }
  }, [selectedProcessor])

  const fetchProcessors = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      if (response.ok) {
        const data = await response.json()
        setProcessors(data.processors || [])
        setLoading(false)
      } else {
        showMessage('Failed to fetch processors', 'error')
      }
    } catch (error) {
      console.error('Error fetching processors:', error)
      showMessage('Failed to connect to server', 'error')
      setLoading(false)
    }
  }

  const fetchConfiguration = async (processorId: string) => {
    try {
      const response = await fetch(`/api/atlas/configuration?processorId=${processorId}`)
      if (response.ok) {
        const config = await response.json()
        console.log('[Atlas Config] Fetching configuration for processor:', processorId)
        console.log('[Atlas Config] Received configuration:', config)
        
        // Helper function to extract string from Atlas name format
        // This prevents React error #31 by ensuring we never try to render objects
        const extractName = (nameField: any, defaultName: string): string => {
          // Already a string - most common case
          if (typeof nameField === 'string') {
            return nameField
          }
          
          // Object with str property: {str: "Input 1"} or {param: "InputName", str: "Input 1"}
          if (nameField && typeof nameField === 'object' && !Array.isArray(nameField)) {
            if (nameField.str !== undefined) {
              return String(nameField.str)
            }
            if (nameField.val !== undefined) {
              return String(nameField.val)
            }
          }
          
          // Array format: [{str: "Input 1"}]
          if (Array.isArray(nameField) && nameField.length > 0) {
            const first = nameField[0]
            if (typeof first === 'string') {
              return first
            }
            if (first && typeof first === 'object') {
              if (first.str !== undefined) {
                return String(first.str)
              }
              if (first.val !== undefined) {
                return String(first.val)
              }
            }
          }
          
          // Fallback to default - ensures we always return a string
          return defaultName
        }
        
        // Normalize inputs to ensure routing array exists and convert Atlas format
        const normalizedInputs = (config.inputs || generateDefaultInputs()).map((input: any, index: number) => ({
          id: index + 1,
          name: extractName(input.name, `Input ${index + 1}`),
          type: input.type || 'line',
          physicalInput: index + 1,
          stereoMode: input.stereoMode || 'mono',
          gainDb: input.gain !== undefined ? input.gain : 0,
          phantom: input.phantom || false,
          lowcut: input.lowcut || false,
          compressor: input.compressor || false,
          gate: input.gate || false,
          eq: input.eq || { band1: 0, band2: 0, band3: 0 },
          routing: Array.isArray(input.routing) ? input.routing : []
        }))
        
        // Normalize outputs to ensure all properties exist and convert Atlas format
        const normalizedOutputs = (config.outputs || generateDefaultOutputs()).map((output: any, index: number) => ({
          id: index + 1,
          name: extractName(output.name, `Zone ${index + 1}`),
          type: output.type || 'speaker',
          physicalOutput: index + 1,
          levelDb: output.gain !== undefined ? output.gain : -10,
          muted: output.mute || false,
          delay: output.delay || 0,
          eq: output.eq || { band1: 0, band2: 0, band3: 0 },
          compressor: output.compressor || false,
          limiter: output.limiter !== undefined ? output.limiter : true,
          groupId: output.groupId,
          groupName: output.groupName
        }))
        
        // Normalize scenes
        const normalizedScenes = (config.scenes || []).map((scene: any, index: number) => ({
          id: index + 1,
          name: extractName(scene.name, `Scene ${index + 1}`),
          description: scene.description || '',
          inputs: scene.inputs || [],
          outputs: scene.outputs || [],
          recall_time: scene.recall_time || 2,
          created_at: scene.created_at || new Date().toISOString()
        }))
        
        setInputs(normalizedInputs)
        setOutputs(normalizedOutputs)
        setScenes(normalizedScenes)
        setMessages(config.messages || [])
        console.log('[Atlas Config] Configuration loaded successfully')
      } else {
        // Generate default configuration if none exists
        setInputs(generateDefaultInputs())
        setOutputs(generateDefaultOutputs())
        setScenes([])
        setMessages([])
      }
    } catch (error) {
      console.error('Error fetching configuration:', error)
      setInputs(generateDefaultInputs())
      setOutputs(generateDefaultOutputs())
      setScenes([])
      setMessages([])
    }
  }

  const generateDefaultInputs = (): InputConfig[] => {
    return Array.from({ length: selectedProcessor?.inputs || 8 }, (_, i) => ({
      id: i + 1,
      name: `Input ${i + 1}`,
      type: i < 4 ? 'microphone' : 'line',
      physicalInput: i + 1, // Map to physical input 1-based
      stereoMode: 'mono',
      gainDb: 0,
      phantom: false,
      lowcut: false,
      compressor: false,
      gate: false,
      eq: { band1: 0, band2: 0, band3: 0 },
      routing: [] as any[]
    }))
  }

  const generateDefaultOutputs = (): OutputConfig[] => {
    return Array.from({ length: selectedProcessor?.outputs || 8 }, (_, i) => ({
      id: i + 1,
      name: `Zone ${i + 1}`,
      type: 'speaker',
      physicalOutput: i + 1, // Map to physical output 1-based
      levelDb: -10,
      muted: false,
      delay: 0,
      eq: { band1: 0, band2: 0, band3: 0 },
      compressor: false,
      limiter: true
    }))
  }

  const updateInput = async (inputId: number, updates: Partial<InputConfig>) => {
    // Update local state immediately for responsive UI
    setInputs(prev => prev.map(input => 
      input.id === inputId ? { ...input, ...updates } : input
    ))

    // If gain is being updated, send it to the Atlas hardware
    if (updates.gainDb !== undefined && selectedProcessor) {
      try {
        const input = inputs.find(i => i.id === inputId)
        if (!input) return

        const response = await fetch(`/api/audio-processor/${selectedProcessor.id}/input-gain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputNumber: input.physicalInput,
            gain: updates.gainDb,
            reason: 'manual_adjustment'
          })
        })

        if (!response.ok) {
          const error = await response.json()
          console.error('Failed to set input gain:', error)
          showMessage(`Failed to set gain for ${input.name}: ${error.error || 'Unknown error'}`, 'error')
        } else {
          console.log(`Successfully set gain for Input ${input.physicalInput} to ${updates.gainDb}dB`)
        }
      } catch (error) {
        console.error('Error setting input gain:', error)
        showMessage('Failed to communicate with Atlas processor', 'error')
      }
    }
  }

  const updateOutput = (outputId: number, updates: Partial<OutputConfig>) => {
    setOutputs(prev => prev.map(output => 
      output.id === outputId ? { ...output, ...updates } : output
    ))
  }

  const addInput = () => {
    const maxId = Math.max(0, ...inputs.map(i => i.id))
    const usedPhysicalInputs = inputs.map(i => i.physicalInput)
    const availablePhysicalInput = Array.from({ length: selectedProcessor?.inputs || 8 }, (_, i) => i + 1)
      .find(physical => !usedPhysicalInputs.includes(physical)) || 1
      
    const newInput: InputConfig = {
      id: maxId + 1,
      name: `Input ${maxId + 1}`,
      type: 'line',
      physicalInput: availablePhysicalInput,
      stereoMode: 'mono',
      gainDb: 0,
      phantom: false,
      lowcut: false,
      compressor: false,
      gate: false,
      eq: { band1: 0, band2: 0, band3: 0 },
      routing: [] as any[]
    }
    setInputs(prev => [...prev, newInput])
  }

  const deleteInput = (inputId: number) => {
    if (inputs.length <= 1) {
      showMessage('Cannot delete the last input', 'error')
      return
    }
    setInputs(prev => prev.filter(input => input.id !== inputId))
    // Note: Outputs don't have routing arrays, inputs do the routing to outputs
  }

  const addOutput = () => {
    const maxId = Math.max(0, ...outputs.map(o => o.id))
    const usedPhysicalOutputs = outputs.map(o => o.physicalOutput)
    const availablePhysicalOutput = Array.from({ length: selectedProcessor?.outputs || 8 }, (_, i) => i + 1)
      .find(physical => !usedPhysicalOutputs.includes(physical)) || 1
      
    const newOutput: OutputConfig = {
      id: maxId + 1,
      name: `Zone ${maxId + 1}`,
      type: 'speaker',
      physicalOutput: availablePhysicalOutput,
      levelDb: -10,
      muted: false,
      delay: 0,
      eq: { band1: 0, band2: 0, band3: 0 },
      compressor: false,
      limiter: true
    }
    setOutputs(prev => [...prev, newOutput])
  }

  const deleteOutput = (outputId: number) => {
    if (outputs.length <= 1) {
      showMessage('Cannot delete the last output', 'error')
      return
    }
    setOutputs(prev => prev.filter(output => output.id !== outputId))
    // Also remove this output from all input routings
    setInputs(prev => prev.map(input => ({
      ...input,
      routing: (input.routing || []).filter(r => r !== outputId)
    })))
  }

  const saveConfiguration = async () => {
    if (!selectedProcessor) return

    setSaving(true)
    try {
      const response = await fetch(`/api/atlas/configuration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          inputs,
          outputs,
          scenes,
          messages
        })
      })

      if (response.ok) {
        showMessage('Configuration saved successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to save configuration', 'error')
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      showMessage('Failed to save configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const uploadConfiguration = async () => {
    if (!selectedProcessor) return

    try {
      const response = await fetch(`/api/atlas/upload-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          ipAddress: selectedProcessor.ipAddress,
          inputs,
          outputs,
          scenes
        })
      })

      if (response.ok) {
        showMessage('Configuration uploaded to processor successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to upload configuration', 'error')
      }
    } catch (error) {
      console.error('Error uploading configuration:', error)
      showMessage('Failed to upload configuration', 'error')
    }
  }

  const downloadConfiguration = async () => {
    if (!selectedProcessor) return

    try {
      const response = await fetch(`/api/atlas/download-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          ipAddress: selectedProcessor.ipAddress
        })
      })

      if (response.ok) {
        const config = await response.json()
        setInputs(config.inputs || inputs)
        setOutputs(config.outputs || outputs)
        setScenes(config.scenes || scenes)
        showMessage('Configuration downloaded from processor successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to download configuration', 'error')
      }
    } catch (error) {
      console.error('Error downloading configuration:', error)
      showMessage('Failed to download configuration', 'error')
    }
  }

  const queryHardware = async () => {
    if (!selectedProcessor) return

    try {
      showMessage('Querying Atlas hardware for actual zone and source names...', 'success')
      
      const response = await fetch(`/api/atlas/query-hardware`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id
        })
      })

      if (response.ok) {
        const result = await response.json()
        
        if (result.success) {
          // Reload configuration to get the queried hardware data
          await fetchConfiguration(selectedProcessor.id)
          showMessage(`✓ Hardware queried successfully! Found ${result.configuration.sources} sources and ${result.configuration.zones} zones`, 'success')
        } else {
          showMessage(result.error || 'Failed to query hardware', 'error')
        }
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to query hardware', 'error')
      }
    } catch (error) {
      console.error('Error querying hardware:', error)
      showMessage('Failed to query hardware configuration', 'error')
    }
  }

  const createScene = () => {
    const newScene: SceneConfig = {
      id: scenes.length + 1,
      name: `Scene ${scenes.length + 1}`,
      description: '',
      inputs: inputs.map(input => ({
        id: input.id,
        gainDb: input.gainDb,
        phantom: input.phantom,
        muted: false
      })),
      outputs: outputs.map(output => ({
        id: output.id,
        levelDb: output.levelDb,
        muted: output.muted
      })),
      recall_time: 2,
      created_at: new Date().toISOString()
    }
    setScenes([...scenes, newScene])
  }

  const recallScene = async (sceneId: number) => {
    if (!selectedProcessor) return

    try {
      const response = await fetch(`/api/atlas/recall-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          sceneId
        })
      })

      if (response.ok) {
        showMessage(`Scene ${sceneId} recalled successfully`)
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to recall scene', 'error')
      }
    } catch (error) {
      console.error('Error recalling scene:', error)
      showMessage('Failed to recall scene', 'error')
    }
  }

  const addProcessor = async () => {
    try {
      const response = await fetch('/api/audio-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProcessor)
      })

      if (response.ok) {
        const data = await response.json()
        // Update processor list
        await fetchProcessors()
        // Reset form
        setNewProcessor({
          name: '',
          model: 'AZM8',
          ipAddress: '',
          port: 80,
          zones: 8,
          description: '',
          username: 'admin',
          password: 'admin'
        })
        setShowAddProcessor(false)
        showMessage(`Processor "${data.processor.name}" added successfully`)
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to add processor', 'error')
      }
    } catch (error) {
      console.error('Error adding processor:', error)
      showMessage('Failed to add processor', 'error')
    }
  }

  const openEditProcessor = (processor: AtlasProcessor) => {
    setEditingProcessor(processor)
    setNewProcessor({
      name: processor.name,
      model: processor.model,
      ipAddress: processor.ipAddress,
      port: processor.port,
      zones: processor.zones,
      description: '',
      username: processor.username || 'admin',
      password: '' // Don't pre-fill password for security
    })
    setShowEditProcessor(true)
  }

  const updateProcessor = async () => {
    if (!editingProcessor) return

    try {
      const updateData: any = {
        name: newProcessor.name,
        model: newProcessor.model,
        ipAddress: newProcessor.ipAddress,
        port: newProcessor.port,
        zones: newProcessor.zones,
        description: newProcessor.description
      }

      // Only include credentials if username is provided
      if (newProcessor.username) {
        updateData.username = newProcessor.username
        // Only update password if a new one is provided
        if (newProcessor.password) {
          updateData.password = newProcessor.password
        }
      }

      const response = await fetch(`/api/audio-processor?id=${editingProcessor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        await fetchProcessors()
        // Update selected processor if it was the one being edited
        if (selectedProcessor?.id === editingProcessor.id) {
          const updatedProcessors = await fetch('/api/audio-processor').then(r => r.json())
          const updated = updatedProcessors.processors.find((p: AtlasProcessor) => p.id === editingProcessor.id)
          if (updated) setSelectedProcessor(updated)
        }
        setShowEditProcessor(false)
        setEditingProcessor(null)
        setNewProcessor({
          name: '',
          model: 'AZM8',
          ipAddress: '',
          port: 80,
          zones: 8,
          description: '',
          username: 'admin',
          password: 'admin'
        })
        showMessage('Processor updated successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to update processor', 'error')
      }
    } catch (error) {
      console.error('Error updating processor:', error)
      showMessage('Failed to update processor', 'error')
    }
  }

  const deleteProcessor = async (processorId: string) => {
    if (!confirm('Are you sure you want to delete this processor? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/audio-processor?id=${processorId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchProcessors()
        if (selectedProcessor?.id === processorId) {
          setSelectedProcessor(null)
        }
        showMessage('Processor deleted successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to delete processor', 'error')
      }
    } catch (error) {
      console.error('Error deleting processor:', error)
      showMessage('Failed to delete processor', 'error')
    }
  }

  const testConnection = async (processor: AtlasProcessor) => {
    try {
      showMessage('Testing connection...', 'success')
      const response = await fetch('/api/audio-processor/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: processor.id,
          ipAddress: processor.ipAddress,
          port: processor.port,
          autoDetectCredentials: true
        })
      })

      const result = await response.json()
      
      if (result.connected) {
        if (result.authenticated) {
          showMessage('✓ Connected and authenticated successfully')
        } else if (result.requiresAuth) {
          showMessage('⚠ Connected but requires authentication. Please add credentials.', 'error')
        } else {
          showMessage(`✓ Connected successfully via ${result.protocol?.toUpperCase() || 'HTTP'} on port ${result.port}`)
        }
        // Refresh processors to get updated status
        await fetchProcessors()
        
        // Show IP cleaning message if applicable
        if (result.ipCleaned) {
          setTimeout(() => {
            showMessage(`IP address was cleaned from "${result.originalIp}" to "${result.cleanedIp}"`, 'success')
          }, 3000)
        }
      } else {
        let errorMsg = result.message || 'Connection failed'
        if (result.requiresAuth) {
          errorMsg = 'Authentication required. Please add username and password.'
        }
        if (result.ipCleaned) {
          errorMsg += ` (IP cleaned to: ${result.cleanedIp})`
        }
        showMessage(errorMsg, 'error')
        
        // Show troubleshooting steps
        if (result.troubleshooting?.steps) {
          console.log('Troubleshooting steps:', result.troubleshooting.steps.join('\n'))
        }
        
        // Refresh processors to get updated status
        await fetchProcessors()
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      showMessage('Failed to test connection', 'error')
    }
  }

  // Stereo linking functions
  const linkStereoInputs = (leftInputId: number, rightInputId: number) => {
    setInputs(prev => prev.map(input => {
      if (input.id === leftInputId) {
        return { ...input, stereoLink: rightInputId, stereoMode: 'left' as const }
      } else if (input.id === rightInputId) {
        return { ...input, stereoLink: leftInputId, stereoMode: 'right' as const }
      }
      return input
    }))
    showMessage('Stereo link created successfully')
  }

  const unlinkStereoInputs = (inputId: number) => {
    const input = inputs.find(i => i.id === inputId)
    if (input?.stereoLink) {
      setInputs(prev => prev.map(inp => {
        if (inp.id === inputId || inp.id === input.stereoLink) {
          return { ...inp, stereoLink: undefined, stereoMode: 'mono' as const }
        }
        return inp
      }))
      showMessage('Stereo link removed successfully')
    }
  }

  // Output grouping functions
  const createOutputGroup = (outputIds: number[], groupName: string) => {
    const groupId = `group_${Date.now()}`
    setOutputGroups(prev => ({ ...prev, [groupId]: groupName }))
    setOutputs(prev => prev.map(output => 
      outputIds.includes(output.id) 
        ? { ...output, groupId, groupName }
        : output
    ))
    showMessage(`Output group "${groupName}" created successfully`)
  }

  const removeFromGroup = (outputId: number) => {
    setOutputs(prev => prev.map(output => 
      output.id === outputId 
        ? { ...output, groupId: undefined, groupName: undefined }
        : output
    ))
    showMessage('Output removed from group')
  }

  const getAvailablePhysicalInputs = () => {
    const usedInputs = inputs.map(i => i.physicalInput)
    return Array.from({ length: selectedProcessor?.inputs || 8 }, (_, i) => i + 1)
      .filter(physical => !usedInputs.includes(physical))
  }

  const getAvailablePhysicalOutputs = () => {
    const usedOutputs = outputs.map(o => o.physicalOutput)
    return Array.from({ length: selectedProcessor?.outputs || 8 }, (_, i) => i + 1)
      .filter(physical => !usedOutputs.includes(physical))
  }

  const renderProcessorForm = (isEdit: boolean = false) => (
    <Card className="border-2 border-blue-800/40 bg-blue-900/20">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-blue-100 flex items-center gap-2">
              {isEdit ? <Edit3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {isEdit ? 'Edit Atlas Processor' : 'Add New Atlas Processor'}
            </CardTitle>
            <CardDescription>
              {isEdit ? 'Update processor configuration and credentials' : 'Configure a new Atlas audio processor for programming and control'}
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              if (isEdit) {
                setShowEditProcessor(false)
                setEditingProcessor(null)
              } else {
                setShowAddProcessor(false)
              }
              setNewProcessor({
                name: '',
                model: 'AZM8',
                ipAddress: '',
                port: 80,
                zones: 8,
                description: '',
                username: 'admin',
                password: 'admin'
              })
            }}
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-slate-200"
          >
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-100 border-b pb-2">Basic Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Processor Name *</label>
              <Input
                value={newProcessor.name}
                onChange={(e) => setNewProcessor({ ...newProcessor, name: e.target.value })}
                placeholder="e.g., Main Bar Audio"
                className="border-slate-700 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Model</label>
              <select
                value={newProcessor.model}
                onChange={(e) => {
                  const model = e.target.value
                  const zones = model.includes('AZM8') ? 8 : 4
                  setNewProcessor({ 
                    ...newProcessor, 
                    model, 
                    zones
                  })
                }}
                className="w-full p-2 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="AZM4">AZM4 (4 zones)</option>
                <option value="AZM8">AZM8 (8 zones)</option>
                <option value="AZMP4">AZMP4 (4 zones with processing)</option>
                <option value="AZMP8">AZMP8 (8 zones with processing)</option>
                <option value="AZM4-D">AZM4-D (4 zones + Dante)</option>
                <option value="AZM8-D">AZM8-D (8 zones + Dante)</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-100">Description (Optional)</label>
            <Input
              value={newProcessor.description}
              onChange={(e) => setNewProcessor({ ...newProcessor, description: e.target.value })}
              placeholder="Additional notes about this processor"
              className="border-slate-700 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Network Configuration */}
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-100 border-b pb-2">Network Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-100">IP Address *</label>
              <Input
                value={newProcessor.ipAddress}
                onChange={(e) => setNewProcessor({ ...newProcessor, ipAddress: e.target.value })}
                placeholder="192.168.1.100"
                className="border-slate-700 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400">Static IP address of the processor</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Port</label>
              <Input
                type="number"
                value={newProcessor.port}
                onChange={(e) => setNewProcessor({ ...newProcessor, port: parseInt(e.target.value) || 80 })}
                placeholder="80"
                min="1"
                max="65535"
                className="border-slate-700 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400">Usually 80 (HTTP)</p>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="space-y-4">
          <h4 className="font-semibold text-slate-100 border-b pb-2">Authentication</h4>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Atlas processors typically require authentication</p>
                <p>Default credentials are usually <strong>admin/admin</strong>. {isEdit && 'Leave password blank to keep existing password.'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Username</label>
              <Input
                type="text"
                value={newProcessor.username}
                onChange={(e) => setNewProcessor({ ...newProcessor, username: e.target.value })}
                placeholder="admin"
                className="border-slate-700 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400">Web interface username (default: admin)</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-100">Password</label>
              <Input
                type="password"
                value={newProcessor.password}
                onChange={(e) => setNewProcessor({ ...newProcessor, password: e.target.value })}
                placeholder={isEdit ? "Leave blank to keep existing" : "admin"}
                className="border-slate-700 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400">
                {isEdit ? 'Leave blank to keep existing password' : 'Web interface password (default: admin)'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            onClick={() => {
              if (isEdit) {
                setShowEditProcessor(false)
                setEditingProcessor(null)
              } else {
                setShowAddProcessor(false)
              }
              setNewProcessor({
                name: '',
                model: 'AZM8',
                ipAddress: '',
                port: 80,
                zones: 8,
                description: '',
                username: 'admin',
                password: 'admin'
              })
            }}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={isEdit ? updateProcessor : addProcessor}
            disabled={!newProcessor.name || !newProcessor.ipAddress}
            className="bg-blue-400 hover:bg-blue-300 text-white"
          >
            {isEdit ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {isEdit ? 'Update Processor' : 'Add Processor'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Settings className="h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-100">Atlas Programming</h1>
            <p className="text-lg text-gray-600">Loading Atlas processor configurations...</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading processors...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Message Display */}
      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border-l-4 ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-400 text-emerald-800' 
            : 'bg-red-50 border-red-400 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded-xl">
              <Settings className="h-6 w-6 text-blue-400" />
            </div>
            Atlas Programming Interface
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive Atlas processor programming and configuration
          </p>
        </div>
        <Button
          onClick={() => setShowAddProcessor(true)}
          className="bg-blue-400 hover:bg-blue-300 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Processor
        </Button>
      </div>

      {/* Add Processor Form */}
      {showAddProcessor && renderProcessorForm(false)}

      {/* Edit Processor Form */}
      {showEditProcessor && renderProcessorForm(true)}

      {/* Processor Selection */}
      {processors.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-700">
          <CardContent className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Cpu className="h-12 w-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">No Atlas Processors</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Add Atlas processors to start programming and configuring your audio system.
            </p>
            <Button
              onClick={() => setShowAddProcessor(true)}
              className="bg-blue-400 hover:bg-blue-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Processor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Processor Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processors.map((processor) => (
              <Card 
                key={processor.id} 
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                  selectedProcessor?.id === processor.id 
                    ? 'border-blue-400 bg-blue-900/20 shadow-lg' 
                    : 'border-slate-700 hover:border-slate-700'
                }`}
                onClick={() => setSelectedProcessor(processor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1 flex-1">
                      <h3 className="font-semibold text-slate-100">{processor.name}</h3>
                      <p className="text-sm text-slate-300">{processor.model}</p>
                      {processor.hasCredentials && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Authenticated
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={processor.status === 'online' ? 'default' : 'secondary'} className={`
                        ${processor.status === 'online' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ''}
                        ${processor.status === 'offline' ? 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700' : ''}
                        ${processor.status === 'error' ? 'bg-red-100 text-red-800 border-red-300' : ''}
                      `}>
                        {processor.status}
                      </Badge>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          testConnection(processor)
                        }}
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                        title="Test Connection"
                      >
                        <Zap className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditProcessor(processor)
                        }}
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 text-green-600 border-green-200 hover:bg-green-50"
                        title="Edit Processor"
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteProcessor(processor.id)
                        }}
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600 border-red-200 hover:bg-red-50"
                        title="Delete Processor"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Network className="h-3 w-3" />
                      <span>{processor.ipAddress}:{processor.port}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AudioLines className="h-3 w-3" />
                      <span>{processor.inputs} inputs • {processor.outputs} outputs</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Programming Interface - Rest of the component remains the same */}
          {selectedProcessor && (
            <Card className="border-2 border-blue-900/30 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-blue-900/20 to-blue-900/20">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl text-blue-100 flex items-center gap-3">
                      <div className="p-2 bg-blue-800/40 rounded-lg">
                        <Settings className="h-6 w-6 text-blue-300" />
                      </div>
                      Programming: {selectedProcessor.name}
                    </CardTitle>
                    <CardDescription className="text-blue-300 text-base">
                      {selectedProcessor.model} • {selectedProcessor.inputs} inputs • {selectedProcessor.outputs} outputs
                    </CardDescription>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={queryHardware}
                      variant="outline"
                      size="sm"
                      className="border-green-800/40 text-green-300 hover:bg-green-900/20"
                      title="Query the Atlas processor for actual zone and source names"
                    >
                      <Router className="h-4 w-4 mr-2" />
                      Query Hardware
                    </Button>
                    <Button
                      onClick={downloadConfiguration}
                      variant="outline"
                      size="sm"
                      className="border-blue-800/40 text-blue-300 hover:bg-blue-900/20"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Config
                    </Button>
                    <Button
                      onClick={saveConfiguration}
                      disabled={saving}
                      variant="outline"
                      size="sm"
                      className="border-blue-800/40 text-blue-300 hover:bg-blue-900/20"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving...' : 'Save Config'}
                    </Button>
                    <Button
                      onClick={uploadConfiguration}
                      size="sm"
                      className="bg-blue-400 hover:bg-blue-300 text-white"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload to Processor
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <Tabs defaultValue="inputs" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-6">
                    <TabsTrigger value="inputs" className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Inputs ({(inputs || []).length})
                    </TabsTrigger>
                    <TabsTrigger value="outputs" className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      Outputs ({(outputs || []).length})
                    </TabsTrigger>
                    <TabsTrigger value="scenes" className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Scenes ({(scenes || []).length})
                    </TabsTrigger>
                    <TabsTrigger value="messages" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Messages ({(messages || []).length})
                    </TabsTrigger>
                  </TabsList>

                  {/* INPUTS TAB */}
                  <TabsContent value="inputs" className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-slate-200">Input Configuration</h3>
                      <Button onClick={addInput} size="sm" className="bg-blue-500 hover:bg-blue-600">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Input
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {inputs.map((input) => (
                        <Card key={input.id} className="border-slate-700 bg-slate-800/50">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Input
                                  value={input.name}
                                  onChange={(e) => updateInput(input.id, { name: e.target.value })}
                                  className="font-semibold text-lg mb-2 bg-slate-900/50 border-slate-600"
                                  placeholder="Input name"
                                />
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    Physical: {input.physicalInput}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {input.type}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                onClick={() => deleteInput(input.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Input Type */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Type</label>
                              <select
                                value={input.type}
                                onChange={(e) => updateInput(input.id, { type: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm"
                              >
                                <option value="microphone">Microphone</option>
                                <option value="line">Line</option>
                                <option value="dante">Dante</option>
                                <option value="zone">Zone</option>
                              </select>
                            </div>

                            {/* Physical Input */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Physical Input</label>
                              <select
                                value={input.physicalInput}
                                onChange={(e) => updateInput(input.id, { physicalInput: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm"
                              >
                                {Array.from({ length: selectedProcessor?.inputs || 8 }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Input {i + 1}</option>
                                ))}
                              </select>
                            </div>

                            {/* Gain */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">
                                Gain: {input.gainDb} dB
                              </label>
                              <input
                                type="range"
                                min="-60"
                                max="12"
                                step="1"
                                value={input.gainDb}
                                onChange={(e) => updateInput(input.id, { gainDb: parseInt(e.target.value) })}
                                className="w-full"
                              />
                            </div>

                            {/* Stereo Mode */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Stereo Mode</label>
                              <select
                                value={input.stereoMode}
                                onChange={(e) => updateInput(input.id, { stereoMode: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm"
                              >
                                <option value="mono">Mono</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="stereo">Stereo</option>
                              </select>
                            </div>

                            {/* Processing Options */}
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={input.phantom}
                                  onChange={(e) => updateInput(input.id, { phantom: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Phantom</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={input.lowcut}
                                  onChange={(e) => updateInput(input.id, { lowcut: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Low Cut</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={input.compressor}
                                  onChange={(e) => updateInput(input.id, { compressor: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Compressor</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={input.gate}
                                  onChange={(e) => updateInput(input.id, { gate: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Gate</span>
                              </label>
                            </div>

                            {/* Routing */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Route to Outputs</label>
                              <div className="grid grid-cols-4 gap-1 max-h-32 overflow-y-auto p-2 bg-slate-900/30 rounded border border-slate-700">
                                {outputs.map((output) => (
                                  <label key={output.id} className="flex items-center gap-1 text-xs cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={input.routing?.includes(output.id) || false}
                                      onChange={(e) => {
                                        const currentRouting = input.routing || []
                                        const newRouting = e.target.checked
                                          ? [...currentRouting, output.id]
                                          : currentRouting.filter(r => r !== output.id)
                                        updateInput(input.id, { routing: newRouting })
                                      }}
                                      className="rounded"
                                    />
                                    <span className="text-slate-300">{output.id}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* OUTPUTS TAB */}
                  <TabsContent value="outputs" className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-slate-200">Output Configuration</h3>
                      <Button onClick={addOutput} size="sm" className="bg-blue-500 hover:bg-blue-600">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Output
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {outputs.map((output) => (
                        <Card key={output.id} className="border-slate-700 bg-slate-800/50">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <Input
                                  value={output.name}
                                  onChange={(e) => updateOutput(output.id, { name: e.target.value })}
                                  className="font-semibold text-lg mb-2 bg-slate-900/50 border-slate-600"
                                  placeholder="Output name"
                                />
                                <div className="flex gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    Physical: {output.physicalOutput}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {output.type}
                                  </Badge>
                                  {output.muted && (
                                    <Badge variant="destructive" className="text-xs">
                                      Muted
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                onClick={() => deleteOutput(output.id)}
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Output Type */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Type</label>
                              <select
                                value={output.type}
                                onChange={(e) => updateOutput(output.id, { type: e.target.value as any })}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm"
                              >
                                <option value="speaker">Speaker</option>
                                <option value="dante">Dante</option>
                                <option value="zone">Zone</option>
                              </select>
                            </div>

                            {/* Physical Output */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Physical Output</label>
                              <select
                                value={output.physicalOutput}
                                onChange={(e) => updateOutput(output.id, { physicalOutput: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-sm"
                              >
                                {Array.from({ length: selectedProcessor?.outputs || 8 }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>Output {i + 1}</option>
                                ))}
                              </select>
                            </div>

                            {/* Group */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">Group (Optional)</label>
                              <Input
                                value={output.groupName || ''}
                                onChange={(e) => updateOutput(output.id, { groupName: e.target.value })}
                                className="bg-slate-900/50 border-slate-600 text-sm"
                                placeholder="e.g., Main Floor, Bar Area"
                              />
                            </div>

                            {/* Level */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">
                                Level: {output.levelDb} dB
                              </label>
                              <input
                                type="range"
                                min="-60"
                                max="0"
                                step="1"
                                value={output.levelDb}
                                onChange={(e) => updateOutput(output.id, { levelDb: parseInt(e.target.value) })}
                                className="w-full"
                              />
                            </div>

                            {/* Delay */}
                            <div>
                              <label className="text-xs text-slate-400 mb-1 block">
                                Delay: {output.delay} ms
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={output.delay}
                                onChange={(e) => updateOutput(output.id, { delay: parseInt(e.target.value) })}
                                className="w-full"
                              />
                            </div>

                            {/* Processing Options */}
                            <div className="grid grid-cols-2 gap-2">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={output.muted}
                                  onChange={(e) => updateOutput(output.id, { muted: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Muted</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={output.compressor}
                                  onChange={(e) => updateOutput(output.id, { compressor: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Compressor</span>
                              </label>
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={output.limiter}
                                  onChange={(e) => updateOutput(output.id, { limiter: e.target.checked })}
                                  className="rounded"
                                />
                                <span className="text-slate-300">Limiter</span>
                              </label>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  {/* SCENES TAB */}
                  <TabsContent value="scenes" className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-slate-200">Scene Management</h3>
                      <Button onClick={createScene} size="sm" className="bg-blue-500 hover:bg-blue-600">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Scene
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {scenes.map((scene) => (
                        <Card key={scene.id} className="border-slate-700 bg-slate-800/50">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Zap className="h-5 w-5 text-yellow-400" />
                              {scene.name}
                            </CardTitle>
                            {scene.description && (
                              <CardDescription className="text-slate-400">
                                {scene.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-xs text-slate-400 space-y-1">
                              <div className="flex items-center gap-2">
                                <Mic className="h-3 w-3" />
                                <span>{scene.inputs.length} inputs configured</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Volume2 className="h-3 w-3" />
                                <span>{scene.outputs.length} outputs configured</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>Recall time: {scene.recall_time}s</span>
                              </div>
                            </div>
                            <Button
                              onClick={() => recallScene(scene.id)}
                              className="w-full bg-yellow-600 hover:bg-yellow-500"
                              size="sm"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Recall Scene
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {scenes.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No scenes created yet</p>
                        <p className="text-sm">Create a scene to save your current configuration</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* MESSAGES TAB */}
                  <TabsContent value="messages" className="space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-slate-200">Audio Messages</h3>
                      <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Message
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {messages.map((message) => (
                        <Card key={message.id} className="border-slate-700 bg-slate-800/50">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <MessageSquare className="h-5 w-5 text-blue-400" />
                              {message.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="text-xs text-slate-400 space-y-1">
                              <div className="flex items-center gap-2">
                                <Music className="h-3 w-3" />
                                <span>{message.file}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>Duration: {message.duration}s</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Volume2 className="h-3 w-3" />
                                <span>Volume: {message.volume}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Headphones className="h-3 w-3" />
                                <span>Zones: {message.zones.join(', ')}</span>
                              </div>
                            </div>
                            <Button className="w-full" size="sm" variant="outline">
                              <Play className="h-4 w-4 mr-2" />
                              Play Message
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {messages.length === 0 && (
                      <div className="text-center py-12 text-slate-400">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg mb-2">No messages configured</p>
                        <p className="text-sm">Add audio messages for announcements and alerts</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>

            </Card>
          )}
        </div>
      )}
    </div>
  )
}


'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Trash2, Plus, Settings, Wifi, WifiOff, Volume2, VolumeX, Play, BarChart3, AlertCircle, CheckCircle, ExternalLink, Zap, Activity, Info, Edit3, Save } from 'lucide-react'
import InputLevelMonitor from './InputLevelMonitor'
import AIGainControlPanel from './AIGainControlPanel'
import { getModelSpec, formatInputName, type AtlasModelSpec } from '@/lib/atlas-models-config'
import Image from 'next/image'

interface AudioProcessor {
  id: string
  name: string
  model: string
  ipAddress: string
  port: number
  zones: number
  description?: string
  status: 'online' | 'offline' | 'error'
  lastSeen?: string
  createdAt: string
}

interface AudioZone {
  id: string
  processorId: string
  zoneNumber: number
  name: string
  description?: string
  currentSource?: string
  volume: number
  muted: boolean
  enabled: boolean
}

export default function AudioProcessorManager() {
  const [processors, setProcessors] = useState<AudioProcessor[]>([])
  const [zones, setZones] = useState<AudioZone[]>([])
  const [selectedProcessor, setSelectedProcessor] = useState<AudioProcessor | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingProcessor, setEditingProcessor] = useState<AudioProcessor | null>(null)
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    model: 'AZM4',
    ipAddress: '',
    port: 80,
    description: '',
    username: 'admin',
    password: 'admin'
  })

  const [selectedModelSpec, setSelectedModelSpec] = useState<AtlasModelSpec | null>(null)
  const [showModelInfo, setShowModelInfo] = useState(false)

  const [zoneFormData, setZoneFormData] = useState({
    zoneNumber: 1,
    name: '',
    description: '',
    currentSource: 'Input 1'
  })

  // Simple message system
  const showMessage = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 5000)
  }

  useEffect(() => {
    fetchProcessors()
  }, [])

  useEffect(() => {
    if (selectedProcessor) {
      fetchZones(selectedProcessor.id)
      // Load model specifications
      const spec = getModelSpec(selectedProcessor.model)
      setSelectedModelSpec(spec || null)
      // Reset zone form when switching processors
      setShowZoneForm(false)
      const firstInput = spec?.inputs[0]?.name || 'Input 1'
      setZoneFormData({ zoneNumber: 1, name: '', description: '', currentSource: firstInput })
    } else {
      setZones([])
      setSelectedModelSpec(null)
    }
  }, [selectedProcessor])

  const fetchProcessors = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      if (response.ok) {
        const data = await response.json()
        setProcessors(data.processors || [])
      } else {
        showMessage('Failed to fetch audio processors', 'error')
      }
    } catch (error) {
      console.error('Error fetching processors:', error)
      showMessage('Failed to connect to server', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchZones = async (processorId: string) => {
    try {
      const response = await fetch(`/api/audio-processor/zones?processorId=${processorId}`)
      if (response.ok) {
        const data = await response.json()
        setZones(data.zones || [])
      }
    } catch (error) {
      console.error('Error fetching zones:', error)
    }
  }

  const addProcessor = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/audio-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          zones: formData.model.includes('8') ? 8 : 4
        })
      })

      if (response.ok) {
        const data = await response.json()
        setProcessors([...processors, data.processor])
        setShowAddForm(false)
        setFormData({ name: '', model: 'AZM4', ipAddress: '', port: 80, description: '', username: 'admin', password: 'admin' })
        showMessage('Audio processor added successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to add processor', 'error')
      }
    } catch (error) {
      console.error('Error adding processor:', error)
      showMessage('Failed to connect to server', 'error')
    }
  }

  const openEditProcessor = (processor: AudioProcessor) => {
    setEditingProcessor(processor)
    setFormData({
      name: processor.name,
      model: processor.model,
      ipAddress: processor.ipAddress,
      port: processor.port,
      description: processor.description || '',
      username: 'admin', // Default, will be loaded from server if exists
      password: '' // Don't pre-fill password for security
    })
    setShowEditForm(true)
    setShowAddForm(false)
  }

  const updateProcessor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProcessor) return

    try {
      const updateData: any = {
        id: editingProcessor.id,
        name: formData.name,
        model: formData.model,
        ipAddress: formData.ipAddress,
        port: formData.port,
        zones: formData.model.includes('8') ? 8 : 4,
        description: formData.description
      }

      // Only include credentials if username is provided
      if (formData.username) {
        updateData.username = formData.username
        // Only update password if a new one is provided
        if (formData.password) {
          updateData.password = formData.password
        }
      }

      const response = await fetch(`/api/audio-processor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const data = await response.json()
        setProcessors(processors.map(p => p.id === editingProcessor.id ? data.processor : p))
        if (selectedProcessor?.id === editingProcessor.id) {
          setSelectedProcessor(data.processor)
        }
        setShowEditForm(false)
        setEditingProcessor(null)
        setFormData({ name: '', model: 'AZM4', ipAddress: '', port: 80, description: '', username: 'admin', password: 'admin' })
        showMessage('Audio processor updated successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to update processor', 'error')
      }
    } catch (error) {
      console.error('Error updating processor:', error)
      showMessage('Failed to connect to server', 'error')
    }
  }

  const testConnection = async (processor: AudioProcessor) => {
    showMessage(`Testing connection to ${processor.name}...`)

    try {
      const response = await fetch('/api/audio-processor/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: processor.id,
          ipAddress: processor.ipAddress,
          port: processor.port,
          autoDetectCredentials: true // Enable auto-detection if no credentials stored
        })
      })

      const result = await response.json()
      
      if (result.connected) {
        if (result.authenticated) {
          showMessage('Connection successful! Authenticated.')
        } else if (result.requiresAuth) {
          showMessage('Processor requires authentication. Please add username and password in processor settings.', 'error')
        } else {
          showMessage('Connection successful!')
        }
        
        setProcessors(processors.map(p => 
          p.id === processor.id 
            ? { ...p, status: 'online', lastSeen: new Date().toISOString() }
            : p
        ))
      } else {
        if (result.requiresAuth) {
          showMessage('Authentication required. Default credentials: admin/admin', 'error')
        } else {
          showMessage('Connection failed: ' + result.message, 'error')
        }
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      showMessage('Failed to test connection', 'error')
    }
  }

  const queryHardware = async (processor: AudioProcessor) => {
    showMessage(`Querying hardware configuration from ${processor.name}...`)

    try {
      const response = await fetch('/api/atlas/query-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: processor.id,
          testOnly: false
        })
      })

      const result = await response.json()
      
      if (result.success) {
        showMessage(`Hardware configuration retrieved: ${result.configuration.sources} sources, ${result.configuration.zones} zones`)
        
        // Update processor status
        setProcessors(processors.map(p => 
          p.id === processor.id 
            ? { ...p, status: 'online', lastSeen: new Date().toISOString() }
            : p
        ))
        
        // Refresh zones to show the new configuration
        if (selectedProcessor && selectedProcessor.id === processor.id) {
          fetchZones(processor.id)
        }
      } else {
        showMessage(`Failed to query hardware: ${result.error || result.details}`, 'error')
      }
    } catch (error) {
      console.error('Error querying hardware:', error)
      showMessage('Failed to query hardware configuration', 'error')
    }
  }

  const controlZone = async (action: string, zone: AudioZone, value?: any) => {
    if (!selectedProcessor) return

    try {
      const response = await fetch('/api/audio-processor/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          command: {
            action,
            zone: zone.zoneNumber,
            value
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        showMessage(`Zone ${zone.zoneNumber} ${action} updated`)
        fetchZones(selectedProcessor.id)
      } else {
        showMessage(result.error, 'error')
      }
    } catch (error) {
      console.error('Error controlling zone:', error)
      showMessage('Failed to control zone', 'error')
    }
  }

  const addZone = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProcessor) {
      showMessage('Please select a processor first', 'error')
      return
    }

    // Validate required fields
    if (!zoneFormData.name.trim()) {
      showMessage('Zone name is required', 'error')
      return
    }

    // Check if zone number already exists
    const existingZone = zones.find(zone => zone.zoneNumber === zoneFormData.zoneNumber)
    if (existingZone) {
      showMessage(`Zone ${zoneFormData.zoneNumber} already exists`, 'error')
      return
    }

    try {
      const zoneData = {
        processorId: selectedProcessor.id,
        zoneNumber: parseInt(zoneFormData.zoneNumber.toString()),
        name: zoneFormData.name.trim(),
        description: zoneFormData.description?.trim() || null,
        currentSource: zoneFormData.currentSource || 'Input 1',
        volume: 50,
        muted: false
      }

      console.log('Creating zone with data:', zoneData)
      
      const response = await fetch('/api/audio-processor/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneData)
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Zone created successfully:', data)
        setZones([...zones, data.zone])
        setShowZoneForm(false)
        setZoneFormData({ zoneNumber: 1, name: '', description: '', currentSource: 'Input 1' })
        showMessage('Audio zone added successfully')
      } else {
        const error = await response.json()
        console.error('Server error:', error)
        showMessage(error.error || 'Failed to add zone', 'error')
      }
    } catch (error) {
      console.error('Error adding zone:', error)
      showMessage('Failed to connect to server', 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      online: {
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: CheckCircle
      },
      offline: {
        color: 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700',
        icon: WifiOff
      },
      error: {
        color: 'bg-red-100 text-red-800 border-red-300',
        icon: AlertCircle
      }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3" />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <Activity className="h-6 w-6 text-blue-600 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-100">Audio Processors</h1>
            <p className="text-lg text-gray-600">Loading audio processor configurations...</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading audio processors...</span>
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
            <div className="p-2 bg-blue-100 rounded-xl">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            Audio Processors
          </h1>
          <p className="text-lg text-gray-600">
            Manage AtlasIED Atmosphere zone controllers and input monitoring
          </p>
        </div>
        
        <Button
          onClick={() => setShowAddForm(true)}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Processor
        </Button>
      </div>

      {/* Add Processor Form */}
      {showAddForm && (
        <Card className="border-2 border-blue-100 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-xl text-blue-900 flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Add Audio Processor
                </CardTitle>
                <CardDescription className="text-blue-700">
                  Configure a new AtlasIED Atmosphere zone controller
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={addProcessor} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-100 border-b pb-2">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Processor Name *</label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Main Bar Audio"
                      required
                      className="border-slate-700 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Model</label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="AZM4">AZM4 (4-Zone Controller)</option>
                      <option value="AZM8">AZM8 (8-Zone Controller)</option>
                      <option value="AZMP4">AZMP4 (4-Zone + Power Amplifier)</option>
                      <option value="AZMP8">AZMP8 (8-Zone + Power Amplifier)</option>
                      <option value="AZM4-D">AZM4-D (4-Zone + Dante Network)</option>
                      <option value="AZM8-D">AZM8-D (8-Zone + Dante Network)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-100">Description</label>
                  <Input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Main dining area audio control"
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
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                      placeholder="192.168.1.100"
                      required
                      className="border-slate-700 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">Static IP address of the processor</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Port</label>
                    <Input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
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
                      <p>Default credentials are usually <strong>admin/admin</strong>. If you leave these fields empty, the system will attempt to auto-detect credentials during connection testing.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Username</label>
                    <Input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      placeholder="admin"
                      className="border-slate-700 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">Web interface username (default: admin)</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Password</label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="admin"
                      className="border-slate-700 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">Web interface password (default: admin)</p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-initial"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Processor
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Edit Processor Form */}
      {showEditForm && (
        <Card className="border-2 border-green-100 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <CardTitle className="text-xl text-green-900 flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Edit Audio Processor
                </CardTitle>
                <CardDescription className="text-green-700">
                  Update processor configuration and credentials
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setShowEditForm(false)
                  setEditingProcessor(null)
                  setFormData({ name: '', model: 'AZM4', ipAddress: '', port: 80, description: '', username: 'admin', password: 'admin' })
                }}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={updateProcessor} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-100 border-b pb-2">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Processor Name *</label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Main Bar Audio"
                      required
                      className="border-slate-700 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Model</label>
                    <select
                      value={formData.model}
                      onChange={(e) => setFormData({...formData, model: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="AZM4">AZM4 (4-Zone Controller)</option>
                      <option value="AZM8">AZM8 (8-Zone Controller)</option>
                      <option value="AZMP4">AZMP4 (4-Zone + Power Amplifier)</option>
                      <option value="AZMP8">AZMP8 (8-Zone + Power Amplifier)</option>
                      <option value="AZM4-D">AZM4-D (4-Zone + Dante Network)</option>
                      <option value="AZM8-D">AZM8-D (8-Zone + Dante Network)</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-100">Description</label>
                  <Input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Main dining area audio control"
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
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                      placeholder="192.168.1.100"
                      required
                      className="border-slate-700 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">Static IP address of the processor</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Port</label>
                    <Input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
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
                      <p>Default credentials are usually <strong>admin/admin</strong>. If you leave these fields empty, the system will attempt to auto-detect credentials during connection testing.</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Username</label>
                    <Input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      placeholder="admin"
                      className="border-slate-700 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">Web interface username (default: admin)</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-100">Password</label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      placeholder="admin"
                      className="border-slate-700 focus:border-blue-500"
                    />
                    <p className="text-xs text-slate-400">Leave blank to keep existing password</p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-initial"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Update Processor
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false)
                    setEditingProcessor(null)
                    setFormData({ name: '', model: 'AZM4', ipAddress: '', port: 80, description: '', username: 'admin', password: 'admin' })
                  }}
                  variant="outline"
                  className="flex-1 sm:flex-initial"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {processors.length === 0 ? (
        <Card className="border-2 border-dashed border-slate-700">
          <CardContent className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-slate-800 or bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <Activity className="h-12 w-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-slate-100 mb-2">No Audio Processors</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Add your first AtlasIED Atmosphere processor to start managing audio zones and monitoring input levels.
            </p>
            <Button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Processor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Processor Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processors.map((processor) => (
              <Card 
                key={processor.id} 
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
                  selectedProcessor?.id === processor.id 
                    ? 'border-blue-500 bg-blue-50/50 shadow-lg' 
                    : 'border-slate-700 hover:border-slate-700'
                }`}
                onClick={() => setSelectedProcessor(processor)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1 flex-1">
                      <h3 className="font-semibold text-slate-100">{processor.name}</h3>
                      <p className="text-sm text-slate-300">{processor.model}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={processor.status === 'online' ? 'default' : 'secondary'} className={`
                        ${processor.status === 'online' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : ''}
                        ${processor.status === 'offline' ? 'bg-slate-800 or bg-slate-900 text-slate-100 border-slate-700' : ''}
                        ${processor.status === 'error' ? 'bg-red-100 text-red-800 border-red-300' : ''}
                      `}>
                        <div className="flex items-center gap-1.5">
                          {processor.status === 'online' && <CheckCircle className="h-3 w-3" />}
                          {processor.status === 'offline' && <WifiOff className="h-3 w-3" />}
                          {processor.status === 'error' && <AlertCircle className="h-3 w-3" />}
                          {processor.status.charAt(0).toUpperCase() + processor.status.slice(1)}
                        </div>
                      </Badge>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditProcessor(processor)
                        }}
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 p-0 text-green-600 border-green-200 hover:bg-green-50"
                        title="Edit Processor"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-3 w-3" />
                      <span>{processor.ipAddress}:{processor.port}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-3 w-3" />
                      <span>{processor.zones} audio zones</span>
                    </div>
                    {processor.description && (
                      <p className="text-slate-400 mt-2 line-clamp-2">{processor.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected Processor Details */}
          {selectedProcessor && (
            <Card className="border-2 border-blue-100 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl text-blue-900 flex items-center gap-3">
                      <div className="p-2 bg-blue-200 rounded-lg">
                        <Activity className="h-6 w-6 text-blue-700" />
                      </div>
                      {selectedProcessor.name}
                    </CardTitle>
                    <CardDescription className="text-blue-700 text-base">
                      {selectedProcessor.model} • {selectedProcessor.ipAddress}:{selectedProcessor.port} • {selectedProcessor.zones} zones
                    </CardDescription>
                    {selectedProcessor.description && (
                      <p className="text-sm text-blue-600 mt-1">{selectedProcessor.description}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => testConnection(selectedProcessor)}
                      variant="outline"
                      size="sm"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Wifi className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                    <Button
                      onClick={() => queryHardware(selectedProcessor)}
                      variant="outline"
                      size="sm"
                      className="border-green-200 text-green-700 hover:bg-green-50"
                    >
                      <Activity className="h-4 w-4 mr-2" />
                      Query Hardware
                    </Button>
                    <Button
                      onClick={() => window.open(`http://${selectedProcessor.ipAddress}:${selectedProcessor.port}`, '_blank')}
                      variant="outline"
                      size="sm"
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Web Interface
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-6">
                {/* Model Information Panel */}
                {selectedModelSpec && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowModelInfo(!showModelInfo)}
                      className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                    >
                      <div className="flex items-center gap-3">
                        <Info className="h-5 w-5 text-blue-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-blue-900">Model Specifications</h4>
                          <p className="text-sm text-blue-700">{selectedModelSpec.fullName}</p>
                        </div>
                      </div>
                      <div className="text-blue-600">
                        {showModelInfo ? '▲' : '▼'}
                      </div>
                    </button>
                    
                    {showModelInfo && (
                      <div className="mt-4 p-6 bg-slate-800 or bg-slate-900 rounded-lg border-2 border-blue-100 space-y-6">
                        {/* Rear Panel Image */}
                        <div className="space-y-3">
                          <h5 className="font-semibold text-slate-100 flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Rear Panel Layout
                          </h5>
                          <div className="relative w-full aspect-video bg-slate-800 or bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                            <Image
                              src={selectedModelSpec.rearPanelImage}
                              alt={`${selectedModelSpec.model} Rear Panel`}
                              fill
                              className="object-contain p-4"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                          </div>
                        </div>

                        {/* Input Configuration */}
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h5 className="font-semibold text-slate-100">Physical Inputs</h5>
                            <div className="space-y-2">
                              {selectedModelSpec.inputs
                                .filter(inp => inp.type !== 'matrix_audio')
                                .map(inp => (
                                  <div key={inp.id} className="flex items-start gap-2 text-sm">
                                    <Badge 
                                      variant={inp.priority === 'high' ? 'default' : 'secondary'}
                                      className={inp.priority === 'high' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-800 or bg-slate-900 text-slate-200'}
                                    >
                                      {inp.name}
                                    </Badge>
                                    <div className="flex-1">
                                      <p className="text-slate-100 font-medium">{inp.connector} {inp.type === 'balanced' ? 'Balanced' : inp.type === 'unbalanced' ? 'Unbalanced' : 'Network'}</p>
                                      <p className="text-gray-600 text-xs">{inp.description}</p>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h5 className="font-semibold text-slate-100">Features</h5>
                            <ul className="space-y-2">
                              {selectedModelSpec.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-slate-200">
                                  <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Output Configuration */}
                        <div className="space-y-3">
                          <h5 className="font-semibold text-slate-100">Zone Outputs</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {selectedModelSpec.outputs
                              .filter(out => out.type !== 'dante')
                              .slice(0, selectedModelSpec.zones)
                              .map(out => (
                                <div key={out.id} className="p-3 bg-slate-800 or bg-slate-900 rounded-lg border border-slate-700">
                                  <p className="font-medium text-slate-100 text-sm">{out.name}</p>
                                  <p className="text-xs text-slate-400">{out.type === 'amplified' ? '🔊 Amplified' : '📡 Line Level'}</p>
                                  {out.powerRating && (
                                    <p className="text-xs text-emerald-600 font-medium mt-1">{out.powerRating}</p>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Tabs defaultValue="zones" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="zones" className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Audio Zones</span>
                      <span className="sm:hidden">Zones</span>
                    </TabsTrigger>
                    <TabsTrigger value="levels" className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Input Levels</span>
                      <span className="sm:hidden">Levels</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai-gain" className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span className="hidden sm:inline">AI Gain Control</span>
                      <span className="sm:hidden">AI Gain</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="zones" className="space-y-6">
                    {/* Zone Management Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-slate-100">Audio Zones</h3>
                        <p className="text-sm text-slate-300">Configure and control individual audio zones</p>
                      </div>
                      <Button
                        onClick={() => setShowZoneForm(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Zone
                      </Button>
                    </div>

                    {/* Zone Form */}
                    {showZoneForm && (
                      <Card className="border-2 border-emerald-100 bg-emerald-50/50">
                        <CardHeader className="bg-emerald-50 pb-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="text-lg text-emerald-900 flex items-center gap-2">
                                <Volume2 className="h-5 w-5" />
                                Add New Audio Zone
                              </CardTitle>
                              <CardDescription className="text-emerald-700">
                                Configure a new audio zone for {selectedProcessor.name}
                              </CardDescription>
                            </div>
                            <Button
                              onClick={() => setShowZoneForm(false)}
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-slate-200"
                            >
                              ✕
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <form onSubmit={addZone} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-100">Zone Number</label>
                                <select
                                  value={zoneFormData.zoneNumber}
                                  onChange={(e) => {
                                    const newZoneNumber = parseInt(e.target.value)
                                    console.log('Zone number changed to:', newZoneNumber)
                                    setZoneFormData({...zoneFormData, zoneNumber: newZoneNumber})
                                  }}
                                  className="w-full px-3 py-2 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                  required
                                >
                                  {Array.from({length: selectedProcessor.zones}, (_, i) => {
                                    const zoneNum = i + 1
                                    const isUsed = zones.some(zone => zone.zoneNumber === zoneNum)
                                    return (
                                      <option key={zoneNum} value={zoneNum} disabled={isUsed}>
                                        Zone {zoneNum} {isUsed ? '(Already exists)' : ''}
                                      </option>
                                    )
                                  })}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-100">Zone Name *</label>
                                <Input
                                  type="text"
                                  value={zoneFormData.name}
                                  onChange={(e) => {
                                    console.log('Zone name changed to:', e.target.value)
                                    setZoneFormData({...zoneFormData, name: e.target.value})
                                  }}
                                  placeholder="Main Dining Area"
                                  required
                                  className="border-slate-700 focus:border-emerald-500"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-100">Description</label>
                              <Input
                                type="text"
                                value={zoneFormData.description}
                                onChange={(e) => {
                                  console.log('Zone description changed to:', e.target.value)
                                  setZoneFormData({...zoneFormData, description: e.target.value})
                                }}
                                placeholder="Main dining area ceiling speakers"
                                className="border-slate-700 focus:border-emerald-500"
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-slate-100">Audio Source</label>
                              <select
                                value={zoneFormData.currentSource}
                                onChange={(e) => {
                                  console.log('Current source changed to:', e.target.value)
                                  setZoneFormData({...zoneFormData, currentSource: e.target.value})
                                }}
                                className="w-full px-3 py-2 border border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                              >
                                {selectedModelSpec ? (
                                  <>
                                    <optgroup label="Physical Inputs">
                                      {selectedModelSpec.inputs
                                        .filter(inp => inp.type === 'balanced' || inp.type === 'unbalanced')
                                        .map(inp => (
                                          <option key={inp.id} value={inp.name}>
                                            {formatInputName(inp)}
                                          </option>
                                        ))}
                                    </optgroup>
                                    {selectedModelSpec.inputs.some(inp => inp.type === 'dante') && (
                                      <optgroup label="Dante Network Audio">
                                        {selectedModelSpec.inputs
                                          .filter(inp => inp.type === 'dante')
                                          .map(inp => (
                                            <option key={inp.id} value={inp.name}>
                                              {formatInputName(inp)}
                                            </option>
                                          ))}
                                      </optgroup>
                                    )}
                                    <optgroup label="Matrix Audio (Internal)">
                                      {selectedModelSpec.inputs
                                        .filter(inp => inp.type === 'matrix_audio')
                                        .map(inp => (
                                          <option key={inp.id} value={inp.name}>
                                            {formatInputName(inp)}
                                          </option>
                                        ))}
                                    </optgroup>
                                  </>
                                ) : (
                                  <>
                                    <option value="Input 1">Input 1</option>
                                    <option value="Input 2">Input 2</option>
                                    <option value="Input 3">Input 3</option>
                                    <option value="Input 4">Input 4</option>
                                    <option value="Matrix Audio 1">Matrix Audio 1</option>
                                    <option value="Matrix Audio 2">Matrix Audio 2</option>
                                    <option value="Matrix Audio 3">Matrix Audio 3</option>
                                    <option value="Matrix Audio 4">Matrix Audio 4</option>
                                  </>
                                )}
                              </select>
                              {selectedModelSpec && (
                                <p className="text-xs text-slate-400">
                                  ⚡ = Balanced • 🔊 = RCA • 🌐 = Dante • 🔄 = Internal
                                </p>
                              )}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                              <Button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 sm:flex-initial"
                                disabled={!zoneFormData.name.trim()}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Zone
                              </Button>
                              <Button
                                type="button"
                                onClick={() => {
                                  setShowZoneForm(false)
                                  setZoneFormData({ zoneNumber: 1, name: '', description: '', currentSource: 'Input 1' })
                                }}
                                variant="outline"
                                className="flex-1 sm:flex-initial"
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    )}

                    {/* Zones Grid */}
                    <div className="space-y-4">
                      {zones.length === 0 ? (
                        <Card className="border-2 border-dashed border-slate-700">
                          <CardContent className="text-center py-8">
                            <div className="mx-auto w-16 h-16 bg-slate-800 or bg-slate-900 rounded-full flex items-center justify-center mb-4">
                              <Volume2 className="h-8 w-8 text-slate-500" />
                            </div>
                            <h4 className="text-lg font-semibold text-slate-100 mb-2">No Audio Zones</h4>
                            <p className="text-gray-600 mb-4">
                              Configure audio zones to start controlling different areas
                            </p>
                            <Button
                              onClick={() => setShowZoneForm(true)}
                              variant="outline"
                              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add First Zone
                            </Button>
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid gap-4">
                          {zones.map((zone) => (
                            <Card key={zone.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-lg font-semibold text-slate-100">
                                        Zone {zone.zoneNumber}: {zone.name}
                                      </h4>
                                      {zone.muted && (
                                        <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-300">
                                          <VolumeX className="h-3 w-3 mr-1" />
                                          Muted
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-slate-300">
                                      <span className="flex items-center gap-1">
                                        <Play className="h-3 w-3" />
                                        {zone.currentSource}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Volume2 className="h-3 w-3" />
                                        Volume: {zone.volume}%
                                      </span>
                                    </div>
                                    {zone.description && (
                                      <p className="text-sm text-slate-400">{zone.description}</p>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Button
                                      onClick={() => controlZone('mute', zone, !zone.muted)}
                                      variant="outline"
                                      size="sm"
                                      className={zone.muted ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" : ""}
                                    >
                                      {zone.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      onClick={() => controlZone('volume', zone, Math.max(0, zone.volume - 10))}
                                      variant="outline"
                                      size="sm"
                                    >
                                      Vol-
                                    </Button>
                                    <Button
                                      onClick={() => controlZone('volume', zone, Math.min(100, zone.volume + 10))}
                                      variant="outline"
                                      size="sm"
                                    >
                                      Vol+
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                    </TabsContent>
                    
                    <TabsContent value="levels" className="space-y-6">
                      <InputLevelMonitor 
                        processorId={selectedProcessor.id} 
                        processorName={selectedProcessor.name}
                      />
                    </TabsContent>

                    <TabsContent value="ai-gain" className="space-y-6">
                      <AIGainControlPanel 
                        processor={selectedProcessor}
                      />
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

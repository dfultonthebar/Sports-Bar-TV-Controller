
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Trash2, Plus, Settings, Wifi, WifiOff, Volume2, VolumeX, Play } from 'lucide-react'

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
  const [showZoneForm, setShowZoneForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    model: 'AZM4',
    ipAddress: '',
    port: 80,
    description: ''
  })

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
        setFormData({ name: '', model: 'AZM4', ipAddress: '', port: 80, description: '' })
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

  const testConnection = async (processor: AudioProcessor) => {
    showMessage(`Testing connection to ${processor.name}...`)

    try {
      const response = await fetch('/api/audio-processor/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: processor.id,
          ipAddress: processor.ipAddress,
          port: processor.port
        })
      })

      const result = await response.json()
      
      if (result.connected) {
        showMessage('Connection successful!')
        setProcessors(processors.map(p => 
          p.id === processor.id 
            ? { ...p, status: 'online', lastSeen: new Date().toISOString() }
            : p
        ))
      } else {
        showMessage('Connection failed: ' + result.message, 'error')
      }
    } catch (error) {
      console.error('Error testing connection:', error)
      showMessage('Failed to test connection', 'error')
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
    if (!selectedProcessor) return

    try {
      const response = await fetch('/api/audio-processor/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorId: selectedProcessor.id,
          ...zoneFormData
        })
      })

      if (response.ok) {
        const data = await response.json()
        setZones([...zones, data.zone])
        setShowZoneForm(false)
        setZoneFormData({ zoneNumber: 1, name: '', description: '', currentSource: 'Input 1' })
        showMessage('Audio zone added successfully')
      } else {
        const error = await response.json()
        showMessage(error.error || 'Failed to add zone', 'error')
      }
    } catch (error) {
      console.error('Error adding zone:', error)
      showMessage('Failed to connect to server', 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-gray-100 text-gray-800',
      error: 'bg-red-100 text-red-800'
    }
    
    const icons = {
      online: Wifi,
      offline: WifiOff,
      error: WifiOff
    }

    const Icon = icons[status as keyof typeof icons] || WifiOff
    const colorClass = colors[status as keyof typeof colors] || colors.offline

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audio Processors</h2>
          <p className="text-gray-600">Manage AtlasIED Atmosphere zone controllers</p>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Processor
        </button>
      </div>

      {/* Add Processor Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Add Audio Processor</CardTitle>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <CardDescription>Add a new AtlasIED Atmosphere audio processor</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addProcessor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Main Bar Audio"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AZM4">AZM4 (4-Zone)</option>
                    <option value="AZM8">AZM8 (8-Zone)</option>
                    <option value="AZMP4">AZMP4 (4-Zone + Amp)</option>
                    <option value="AZMP8">AZMP8 (8-Zone + Amp)</option>
                    <option value="AZM4-D">AZM4-D (4-Zone + Dante)</option>
                    <option value="AZM8-D">AZM8-D (8-Zone + Dante)</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({...formData, ipAddress: e.target.value})}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({...formData, port: parseInt(e.target.value)})}
                    placeholder="80"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Main dining area audio control"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Add Processor
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {processors.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500 mb-4">No audio processors configured</p>
            <p className="text-sm text-gray-400">Add an AtlasIED Atmosphere processor to get started</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={selectedProcessor?.id || processors[0]?.id} onValueChange={(value) => {
          const processor = processors.find(p => p.id === value)
          setSelectedProcessor(processor || null)
        }}>
          <TabsList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {processors.map((processor) => (
              <TabsTrigger key={processor.id} value={processor.id} className="flex items-center gap-2">
                <span>{processor.name}</span>
                {getStatusBadge(processor.status)}
              </TabsTrigger>
            ))}
          </TabsList>

          {processors.map((processor) => (
            <TabsContent key={processor.id} value={processor.id} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {processor.name}
                        {getStatusBadge(processor.status)}
                      </CardTitle>
                      <CardDescription>
                        {processor.model} • {processor.ipAddress}:{processor.port} • {processor.zones} zones
                      </CardDescription>
                      {processor.description && (
                        <p className="text-sm text-gray-600 mt-1">{processor.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => testConnection(processor)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <Wifi className="h-4 w-4" />
                        Test Connection
                      </button>
                      <button
                        onClick={() => window.open(`http://${processor.ipAddress}:${processor.port}`, '_blank')}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <Settings className="h-4 w-4" />
                        Web Interface
                      </button>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Audio Zones</h3>
                    <button
                      onClick={() => setShowZoneForm(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Zone
                    </button>
                  </div>

                  {/* Zone Form */}
                  {showZoneForm && (
                    <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium">Add New Zone</h4>
                        <button
                          onClick={() => setShowZoneForm(false)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                      <form onSubmit={addZone} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Zone Number</label>
                            <select
                              value={zoneFormData.zoneNumber}
                              onChange={(e) => setZoneFormData({...zoneFormData, zoneNumber: parseInt(e.target.value)})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {Array.from({length: processor.zones}, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>Zone {num}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                              type="text"
                              value={zoneFormData.name}
                              onChange={(e) => setZoneFormData({...zoneFormData, name: e.target.value})}
                              placeholder="Main Dining"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            value={zoneFormData.description}
                            onChange={(e) => setZoneFormData({...zoneFormData, description: e.target.value})}
                            placeholder="Main dining area speakers"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            Add Zone
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowZoneForm(false)}
                            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="grid gap-4">
                    {zones.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        No zones configured for this processor
                      </p>
                    ) : (
                      zones.map((zone) => (
                        <div key={zone.id} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-medium">Zone {zone.zoneNumber}: {zone.name}</h4>
                              <p className="text-sm text-gray-600">
                                {zone.currentSource} • Volume: {zone.volume}% 
                                {zone.muted && " • Muted"}
                              </p>
                              {zone.description && (
                                <p className="text-xs text-gray-500">{zone.description}</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => controlZone('mute', zone, !zone.muted)}
                                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                {zone.muted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => controlZone('volume', zone, Math.max(0, zone.volume - 10))}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Vol-
                              </button>
                              <button
                                onClick={() => controlZone('volume', zone, Math.min(100, zone.volume + 10))}
                                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Vol+
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

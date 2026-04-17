'use client'

import { useState, useEffect } from 'react'
import { Sliders, Volume2, Disc, Settings, Brain, Cpu, Speaker } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AtlasProgrammingInterface from '@/components/AtlasProgrammingInterface'
import AtlasAIMonitor from '@/components/AtlasAIMonitor'
// import AtlasOutputMeters from '@/components/AtlasOutputMeters' // Disabled - too slow
import AudioZoneControl from '@/components/AudioZoneControl'
import SoundtrackControl from '@/components/SoundtrackControl'
import SoundtrackConfiguration from '@/components/SoundtrackConfiguration'
import AudioProcessorManager from '@/components/AudioProcessorManager'
import HTDManager from '@/components/HTDManager'
import HTDZoneControl from '@/components/HTDZoneControl'

import { logger } from '@sports-bar/logger'

interface HTDDevice {
  id: string
  name: string
  model: string
  zones: number
  sources: number
  status: 'online' | 'offline' | 'error'
}

export default function AudioControlTabs() {
  const [activeProcessor, setActiveProcessor] = useState<any>(null)
  const [loadingProcessor, setLoadingProcessor] = useState(true)
  const [htdDevices, setHtdDevices] = useState<HTDDevice[]>([])
  const [selectedHtdDevice, setSelectedHtdDevice] = useState<HTDDevice | null>(null)

  useEffect(() => {
    fetchActiveProcessor()
    fetchHTDDevices()
  }, [])

  const fetchActiveProcessor = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      const data = await response.json()
      if (data.processors && data.processors.length > 0) {
        // Get the first active processor or just the first one
        const processor = data.processors.find((p: any) => p.isActive) || data.processors[0]
        setActiveProcessor(processor)
      }
    } catch (error) {
      logger.error('Error fetching processor:', error)
    } finally {
      setLoadingProcessor(false)
    }
  }

  const fetchHTDDevices = async () => {
    try {
      const response = await fetch('/api/htd')
      const data = await response.json()
      if (data.devices && data.devices.length > 0) {
        setHtdDevices(data.devices)
        // Select first device by default
        setSelectedHtdDevice(data.devices[0])
      }
    } catch (error) {
      logger.error('Error fetching HTD devices:', error)
    }
  }

  return (
    <div className="card p-6">
      <Tabs defaultValue="zones" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-800/50">
          <TabsTrigger
            value="zones"
            className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
          >
            <Sliders className="w-4 h-4" />
            <span>Zone Control</span>
          </TabsTrigger>
          <TabsTrigger
            value="processors"
            className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
          >
            <Cpu className="w-4 h-4" />
            <span>Processors</span>
          </TabsTrigger>
          <TabsTrigger
            value="htd"
            className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
          >
            <Speaker className="w-4 h-4" />
            <span>HTD Audio</span>
          </TabsTrigger>
          <TabsTrigger
            value="atlas"
            className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
          >
            <Volume2 className="w-4 h-4" />
            <span>Atlas System</span>
          </TabsTrigger>
          <TabsTrigger
            value="soundtrack"
            className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
          >
            <Disc className="w-4 h-4" />
            <span>Soundtrack</span>
          </TabsTrigger>
        </TabsList>

        {/* Zone Control Tab */}
        <TabsContent value="zones" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Sliders className="w-6 h-6 text-cyan-400" />
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Audio Zone Control</h2>
                <p className="text-slate-300 text-sm">Manage volume and settings for all audio zones</p>
              </div>
            </div>
            <AudioZoneControl />
          </div>
        </TabsContent>

        {/* Processors Tab */}
        <TabsContent value="processors" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Cpu className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Audio Processors</h2>
                <p className="text-slate-300 text-sm">Configure AtlasIED and dbx ZonePRO audio processors</p>
              </div>
            </div>
            <AudioProcessorManager />
          </div>
        </TabsContent>

        {/* HTD Audio Tab */}
        <TabsContent value="htd" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Speaker className="w-6 h-6 text-indigo-400" />
              <div>
                <h2 className="text-2xl font-bold text-slate-100">HTD Whole-House Audio</h2>
                <p className="text-slate-300 text-sm">Configure and control HTD multi-zone audio systems</p>
              </div>
            </div>

            <Tabs defaultValue="control" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/30">
                <TabsTrigger
                  value="control"
                  className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Zone Control</span>
                </TabsTrigger>
                <TabsTrigger
                  value="configuration"
                  className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
                >
                  <Settings className="w-4 h-4" />
                  <span>Configuration</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="control" className="mt-6">
                {htdDevices.length > 0 ? (
                  <div className="space-y-4">
                    {/* Device Selector */}
                    {htdDevices.length > 1 && (
                      <div className="flex items-center space-x-3">
                        <span className="text-sm text-slate-400">Device:</span>
                        <select
                          value={selectedHtdDevice?.id || ''}
                          onChange={(e) => {
                            const device = htdDevices.find(d => d.id === e.target.value)
                            if (device) setSelectedHtdDevice(device)
                          }}
                          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100"
                        >
                          {htdDevices.map(device => (
                            <option key={device.id} value={device.id}>{device.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Zone Control */}
                    {selectedHtdDevice && (
                      <HTDZoneControl
                        device={selectedHtdDevice}
                        onRefresh={fetchHTDDevices}
                        showToneControls={true}
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-lg">
                    <Speaker className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No HTD devices configured</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Go to the Configuration tab to add an HTD device
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="configuration" className="mt-6">
                <HTDManager
                  onDeviceCountChange={(count) => {
                    if (count > 0) fetchHTDDevices()
                  }}
                  showBartenderToggle={true}
                />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {/* Atlas System Tab */}
        <TabsContent value="atlas" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Volume2 className="w-6 h-6 text-teal-400" />
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Atlas Audio System</h2>
                <p className="text-slate-300 text-sm">AI-Powered Audio Processing & Zone Management</p>
              </div>
            </div>
            
            <Tabs defaultValue="configuration" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-800/30">
                <TabsTrigger 
                  value="configuration" 
                  className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
                >
                  <Settings className="w-4 h-4" />
                  <span>Configuration</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="ai-monitor" 
                  className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
                >
                  <Brain className="w-4 h-4" />
                  <span>AI Monitor</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="configuration" className="mt-6">
                <AtlasProgrammingInterface />

                {/* Atlas Output Meters - DISABLED (too slow to be useful) */}
                {/*
                <div className="mt-6">
                  <AtlasOutputMeters
                    processorId={activeProcessor?.id || "atlas-001"}
                    processorIp={activeProcessor?.ipAddress || ""}
                    autoRefresh={false}
                    refreshInterval={1000}
                  />
                </div>
                */}
              </TabsContent>
              
              <TabsContent value="ai-monitor" className="mt-6">
                <AtlasAIMonitor 
                  processorId={activeProcessor?.id || "atlas-001"}
                  processorModel={activeProcessor?.model || "AZM8"}
                  autoRefresh={true}
                  refreshInterval={30000}
                />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {/* Soundtrack Tab */}
        <TabsContent value="soundtrack" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-4">
              <Disc className="w-6 h-6 text-purple-400" />
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Soundtrack Your Brand</h2>
                <p className="text-slate-300 text-sm">Configure music streaming and zone-specific playback</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Main Configuration */}
              <SoundtrackConfiguration />
              
              {/* Soundtrack Control */}
              <div className="max-w-4xl">
                <SoundtrackControl zoneName="Soundtrack Music Control" showVolumeControls={false} bartenderOnly={true} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

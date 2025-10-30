'use client'

import { useState, useEffect } from 'react'
import { Sliders, Volume2, Disc, Settings, Brain } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AtlasProgrammingInterface from '@/components/AtlasProgrammingInterface'
import AtlasAIMonitor from '@/components/AtlasAIMonitor'
import AtlasOutputMeters from '@/components/AtlasOutputMeters'
import AudioZoneControl from '@/components/AudioZoneControl'
import SoundtrackControl from '@/components/SoundtrackControl'
import SoundtrackConfiguration from '@/components/SoundtrackConfiguration'

export default function AudioControlTabs() {
  const [activeProcessor, setActiveProcessor] = useState<any>(null)
  const [loadingProcessor, setLoadingProcessor] = useState(true)

  useEffect(() => {
    fetchActiveProcessor()
  }, [])

  const fetchActiveProcessor = async () => {
    try {
      const response = await fetch('/api/audio-processor')
      const data = await response.json()
      if (data.success && data.processors && data.processors.length > 0) {
        // Get the first active processor or just the first one
        const processor = data.processors.find((p: any) => p.isActive) || data.processors[0]
        setActiveProcessor(processor)
      }
    } catch (error) {
      console.error('Error fetching processor:', error)
    } finally {
      setLoadingProcessor(false)
    }
  }

  return (
    <div className="card p-6">
      <Tabs defaultValue="zones" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
          <TabsTrigger 
            value="zones" 
            className="flex items-center space-x-2 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100"
          >
            <Sliders className="w-4 h-4" />
            <span>Zone Control</span>
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
                
                {/* Atlas Output Meters */}
                <div className="mt-6">
                  <AtlasOutputMeters
                    processorId={activeProcessor?.id || "atlas-001"}
                    processorIp={activeProcessor?.ipAddress || ""}
                    autoRefresh={true}
                    refreshInterval={1000}
                  />
                </div>
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

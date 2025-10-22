'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Music, Speaker, Volume2, Disc, Sliders, Settings, Brain } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'

// Import components dynamically to prevent hydration errors
const AtlasProgrammingInterface = dynamic(() => import('@/components/AtlasProgrammingInterface'), { ssr: false })
const AtlasAIMonitor = dynamic(() => import('@/components/AtlasAIMonitor'), { ssr: false })
const AudioZoneControl = dynamic(() => import('@/components/AudioZoneControl'), { ssr: false })
const SoundtrackControl = dynamic(() => import('@/components/SoundtrackControl'), { ssr: false })
const SoundtrackConfiguration = dynamic(() => import('@/components/SoundtrackConfiguration'), { ssr: false })

export default function AudioControlCenterPage() {
  const [activeProcessor, setActiveProcessor] = useState<any>(null)
  const [loadingProcessor, setLoadingProcessor] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
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


  const headerActions = (
    <Link href="/" className="btn-secondary">
      <span>← Back to Home</span>
    </Link>
  )

  // Prevent hydration mismatch by only rendering after client mount
  if (!isMounted) {
    return (
      <SportsBarLayout>
        <SportsBarHeader
          title="Audio Control Center"
          subtitle="Complete audio system management - Atlas, Zones, and Soundtrack"
          icon={<Music className="w-8 h-8 text-teal-400" />}
          actions={headerActions}
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="card p-6 flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          </div>
        </main>
      </SportsBarLayout>
    )
  }

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Audio Control Center"
        subtitle="Complete audio system management - Atlas, Zones, and Soundtrack"
        icon={<Music className="w-8 h-8 text-teal-400" />}
        actions={headerActions}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  
                  {/* Zone-Specific Controls */}
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold text-slate-100 mb-4">Zone-Specific Soundtrack Control</h3>
                    <div className="space-y-4">
                      <SoundtrackControl zoneName="Main Audio System" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        <SoundtrackControl zoneId="mainbar" zoneName="Main Bar" compact />
                        <SoundtrackControl zoneId="pavilion" zoneName="Pavilion" compact />
                        <SoundtrackControl zoneId="partyroom" zoneName="Party Room" compact />
                        <SoundtrackControl zoneId="upstairs" zoneName="Upstairs" compact />
                        <SoundtrackControl zoneId="patio" zoneName="Patio" compact />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </SportsBarLayout>
  )
}

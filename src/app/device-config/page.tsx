'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import DirecTVController from '@/components/DirecTVController'
import FireTVController from '@/components/FireTVController'
import GlobalCacheControl from '@/components/globalcache/GlobalCacheControl'
import EnhancedDirecTVController from '@/components/EnhancedDirecTVController'
import SubscriptionDashboard from '@/components/SubscriptionDashboard'
import SoundtrackConfiguration from '@/components/SoundtrackConfiguration'
import CECDiscoveryPanel from '@/components/CECDiscoveryPanel'
import { Button } from '@/components/ui/button'
import SportsBarLayout from '@/components/SportsBarLayout'
import SportsBarHeader from '@/components/SportsBarHeader'
import { 
  Satellite, 
  MonitorPlay, 
  Radio, 
  Settings, 
  Brain, 
  Zap,
  TrendingUp,
  Target,
  BarChart3,
  Music2,
  Tv
} from 'lucide-react'

export default function DeviceConfigPage() {
  const [aiEnhancementsEnabled, setAiEnhancementsEnabled] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedState = localStorage.getItem('deviceConfigAiEnabled')
    if (savedState !== null) {
      setAiEnhancementsEnabled(savedState === 'true')
    }
  }, [])

  const toggleAiEnhancements = () => {
    const newState = !aiEnhancementsEnabled
    setAiEnhancementsEnabled(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('deviceConfigAiEnabled', String(newState))
    }
  }

  if (!mounted) {
    return (
      <SportsBarLayout>
        <SportsBarHeader
          title="Device Configuration"
          subtitle="Configure and manage DirecTV, Fire TV, and IR devices with AI-enhanced capabilities"
          icon={<Settings className="w-8 h-8 text-blue-400" />}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-slate-400">Loading...</div>
          </div>
        </div>
      </SportsBarLayout>
    )
  }

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Device Configuration"
        subtitle="Configure and manage DirecTV, Fire TV, and Global Cache IR devices with AI-enhanced capabilities"
        icon={<Settings className="w-8 h-8 text-blue-400" />}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-slate-300">AI Enhancements</span>
            </div>
            <Button
              variant={aiEnhancementsEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleAiEnhancements}
              className="flex items-center gap-2"
            >
              {aiEnhancementsEnabled ? (
                <>
                  <Zap className="w-4 h-4" />
                  Enabled
                </>
              ) : (
                <>
                  <Target className="w-4 h-4" />
                  Enable AI
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="container mx-auto px-4 py-8 space-y-6">
        {aiEnhancementsEnabled && (
          <div className="card p-4 border-blue-600/50 bg-gradient-to-r from-blue-900/40 to-purple-900/40">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="font-semibold text-blue-200">AI Enhancements Active</h3>
                <p className="text-sm text-blue-300">
                  Intelligent monitoring, smart recommendations, and predictive optimization are now enabled for all devices.
                </p>
              </div>
              <div className="flex gap-2 ml-auto">
                <Badge className="bg-green-900/50 text-green-200 border-green-800">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Learning
                </Badge>
                <Badge className="bg-blue-900/50 text-blue-200 border-blue-800">
                  <Zap className="w-3 h-3 mr-1" />
                  Optimizing
                </Badge>
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="directv" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="directv" className="flex items-center gap-2">
              <Satellite className="w-4 h-4" />
              DirecTV
            </TabsTrigger>
            <TabsTrigger value="firetv" className="flex items-center gap-2">
              <MonitorPlay className="w-4 h-4" />
              Fire TV
            </TabsTrigger>
            <TabsTrigger value="globalcache" className="flex items-center gap-2">
              <Radio className="w-4 h-4" />
              IR Control
            </TabsTrigger>
            <TabsTrigger value="soundtrack" className="flex items-center gap-2">
              <Music2 className="w-4 h-4" />
              Soundtrack
            </TabsTrigger>
            <TabsTrigger value="cec-discovery" className="flex items-center gap-2">
              <Tv className="w-4 h-4" />
              CEC Discovery
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Subscriptions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="directv" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Satellite className="w-5 h-5 text-blue-600" />
                  DirecTV Configuration
                  {aiEnhancementsEnabled && (
                    <Badge className="bg-purple-100 text-purple-800">
                      <Brain className="w-3 h-3 mr-1" />
                      AI Enhanced
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {aiEnhancementsEnabled 
                    ? "Configure DirecTV receivers with intelligent channel suggestions, performance monitoring, and smart automation"
                    : "Configure and control DirecTV receivers via IP"
                  }
                </CardDescription>
              </CardHeader>
            </Card>
            
            {aiEnhancementsEnabled && selectedDevice ? (
              <EnhancedDirecTVController 
                device={selectedDevice} 
                onDeviceUpdate={setSelectedDevice}
              />
            ) : (
              <DirecTVController />
            )}
          </TabsContent>

          <TabsContent value="firetv" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MonitorPlay className="w-5 h-5 text-orange-600" />
                  Fire TV Configuration
                </CardTitle>
                <CardDescription>
                  Configure and control Amazon Fire TV devices
                </CardDescription>
              </CardHeader>
            </Card>
            <FireTVController />
          </TabsContent>

          <TabsContent value="globalcache" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-green-600" />
                  Global Cache IR Control
                </CardTitle>
                <CardDescription>
                  Manage Global Cache iTach devices for infrared control of cable boxes and other IR devices
                </CardDescription>
              </CardHeader>
            </Card>
            <GlobalCacheControl />
          </TabsContent>

          <TabsContent value="soundtrack" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music2 className="w-5 h-5 text-purple-600" />
                  Soundtrack Configuration
                </CardTitle>
                <CardDescription>
                  Configure Soundtrack Your Brand audio zones and playback
                </CardDescription>
              </CardHeader>
            </Card>
            <SoundtrackConfiguration />
          </TabsContent>

          <TabsContent value="cec-discovery" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-indigo-600" />
                  CEC Device Discovery
                </CardTitle>
                <CardDescription>
                  Discover and identify TVs connected via HDMI-CEC
                </CardDescription>
              </CardHeader>
            </Card>
            <CECDiscoveryPanel />
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-600" />
                  Device Subscriptions
                </CardTitle>
                <CardDescription>
                  Monitor device subscriptions and streaming service access
                </CardDescription>
              </CardHeader>
            </Card>
            <SubscriptionDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </SportsBarLayout>
  )
}

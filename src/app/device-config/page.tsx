
'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import DirecTVController from '@/components/DirecTVController'
import FireTVController from '@/components/FireTVController'
import IRDeviceControl from '@/components/IRDeviceControl'
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

  // Load AI toggle state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('deviceConfigAiEnabled')
    if (savedState !== null) {
      setAiEnhancementsEnabled(savedState === 'true')
    }
  }, [])

  // Save AI toggle state to localStorage when it changes
  const toggleAiEnhancements = () => {
    const newState = !aiEnhancementsEnabled
    setAiEnhancementsEnabled(newState)
    localStorage.setItem('deviceConfigAiEnabled', String(newState))
  }

  return (
    <SportsBarLayout>
      <SportsBarHeader
        title="Device Configuration"
        subtitle="Configure and manage DirecTV, Fire TV, and IR devices with AI-enhanced capabilities"
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
        {/* AI Enhancement Notice */}
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

      {/* Device Tabs */}
      <Tabs defaultValue="directv" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
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
            Global Cache
          </TabsTrigger>
          <TabsTrigger value="ir" className="flex items-center gap-2">
            <Radio className="w-4 h-4" />
            IR Devices
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
                {aiEnhancementsEnabled && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {aiEnhancementsEnabled 
                  ? "Manage Fire TV devices with predictive app loading, performance optimization, and smart content recommendations"
                  : "Configure and control Amazon Fire TV devices"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <FireTVController />
        </TabsContent>

        <TabsContent value="globalcache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-purple-600" />
                Global Cache Configuration
                {aiEnhancementsEnabled && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {aiEnhancementsEnabled 
                  ? "Configure iTach devices with intelligent IR learning, signal optimization, and predictive maintenance"
                  : "Configure Global Cache iTach IR devices"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <IRDeviceControl />
        </TabsContent>

        <TabsContent value="ir" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-green-600" />
                IR Device Configuration
                {aiEnhancementsEnabled && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {aiEnhancementsEnabled 
                  ? "Manage IR devices with intelligent command learning, failure prediction, and automatic positioning optimization"
                  : "Configure and control infrared devices"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <IRDeviceControl />
        </TabsContent>

        <TabsContent value="soundtrack" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-purple-600" />
                Soundtrack Your Brand
              </CardTitle>
              <CardDescription>
                Configure API access and manage business music streaming
              </CardDescription>
            </CardHeader>
          </Card>
          <SoundtrackConfiguration />
        </TabsContent>

        <TabsContent value="cec-discovery" className="space-y-4">
          <Card className="bg-[#1e3a5f]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Tv className="w-5 h-5 text-blue-400" />
                CEC TV Discovery
                {aiEnhancementsEnabled && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-blue-200">
                {aiEnhancementsEnabled 
                  ? "Automatically detect TV brands with AI-powered brand recognition and optimization recommendations"
                  : "Automatically detect TV brands connected to WolfPack outputs via CEC protocol"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <CECDiscoveryPanel />
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Subscription Dashboard
                {aiEnhancementsEnabled && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {aiEnhancementsEnabled 
                  ? "Monitor streaming and TV subscriptions with AI-powered cost optimization and usage analytics"
                  : "View and manage streaming subscriptions across DirecTV and Fire TV devices"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <SubscriptionDashboard />
        </TabsContent>
      </Tabs>

      {/* Quick Actions for AI Features */}
      {aiEnhancementsEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Quick AI Actions
            </CardTitle>
            <CardDescription>
              Common AI-powered operations for device management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                <Brain className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="font-medium">Run Full AI Analysis</div>
                  <div className="text-xs text-slate-400">Complete device intelligence scan</div>
                </div>
              </Button>
              
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                <Target className="w-5 h-5 text-green-400" />
                <div className="text-left">
                  <div className="font-medium">Optimize All Devices</div>
                  <div className="text-xs text-slate-400">Apply AI recommendations</div>
                </div>
              </Button>
              
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <div className="text-left">
                  <div className="font-medium">View AI Insights</div>
                  <div className="text-xs text-slate-400">Check performance predictions</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </SportsBarLayout>
  )
}

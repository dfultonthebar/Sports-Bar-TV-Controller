

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
import GlobalCacheControl from '@/components/globalcache/GlobalCacheControl'
import { IRDeviceSetup } from '@/components/ir/IRDeviceSetup'
import ChannelPresetsPanel from '@/components/settings/ChannelPresetsPanel'
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
  Tv,
  Star,
  Cable
} from 'lucide-react'

export default function DeviceConfigPage() {
  const [aiEnhancementsEnabled, setAiEnhancementsEnabled] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)
  const [mounted, setMounted] = useState(false)
  const [aiActionLoading, setAiActionLoading] = useState<string | null>(null)
  const [aiActionResult, setAiActionResult] = useState<any>(null)

  // Load AI toggle state from localStorage on mount
  useEffect(() => {
    // Mark component as mounted to prevent hydration issues
    setMounted(true)
    
    // Load localStorage value only on client side
    const savedState = localStorage.getItem('deviceConfigAiEnabled')
    if (savedState !== null) {
      setAiEnhancementsEnabled(savedState === 'true')
    }
  }, [])

  // Save AI toggle state to localStorage when it changes
  const toggleAiEnhancements = () => {
    const newState = !aiEnhancementsEnabled
    setAiEnhancementsEnabled(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem('deviceConfigAiEnabled', String(newState))
    }
  }

  // Handle AI Actions
  const handleAiAction = async (action: string) => {
    setAiActionLoading(action)
    setAiActionResult(null)

    try {
      const response = await fetch('/api/ai/device-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await response.json()
      setAiActionResult({ action, data })

      // Auto-dismiss after 5 seconds
      setTimeout(() => setAiActionResult(null), 5000)
    } catch (error) {
      console.error('AI Action failed:', error)
      setAiActionResult({
        action,
        data: { success: false, error: 'Action failed' }
      })
    } finally {
      setAiActionLoading(null)
    }
  }

  // Prevent rendering until mounted to avoid hydration mismatch
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

      {/* Version Indicator */}
      <div className="flex justify-end mb-2">
        <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500 text-lg px-4 py-2">
          ✓ Version 2.0 - 9 Tabs Only (No TV CEC Tab)
        </Badge>
      </div>

      {/* Device Tabs */}
      <Tabs defaultValue="channel-presets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="channel-presets" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Channel Presets
          </TabsTrigger>
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
          <TabsTrigger value="cec-cable-boxes" className="flex items-center gap-2">
            <Cable className="w-4 h-4" />
            CEC Cable Boxes
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Subscriptions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channel-presets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Channel Presets Configuration
                {aiEnhancementsEnabled && (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Brain className="w-3 h-3 mr-1" />
                    AI Enhanced
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {aiEnhancementsEnabled 
                  ? "Configure quick-access channel presets for Cable Box and DirecTV with AI-powered usage analytics and smart reordering"
                  : "Configure quick-access channel presets for Cable Box and DirecTV inputs"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <ChannelPresetsPanel />
        </TabsContent>

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
                Global Cache IR Control
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
                  : "Manage Global Cache iTach devices for infrared control of cable boxes and other IR devices"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <GlobalCacheControl />
        </TabsContent>

        <TabsContent value="ir" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-green-600" />
                IR Device Setup
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
                  : "Configure IR-controlled devices (Cable boxes, AV receivers) and download IR commands from the Global Cache database"
                }
              </CardDescription>
            </CardHeader>
          </Card>
          <IRDeviceSetup />
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

        <TabsContent value="cec-cable-boxes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cable className="w-5 h-5 text-orange-600" />
                CEC Cable Box Configuration
              </CardTitle>
              <CardDescription>
                Configure Pulse-Eight USB CEC adapters for automated cable box control
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 mb-3">
                  <strong>CEC Cable Box Configuration</strong> has its own dedicated admin page with hardware setup wizard, device discovery, and testing tools.
                </p>
                <Button
                  onClick={() => window.location.href = '/admin/cec-cable-boxes'}
                  className="w-full"
                >
                  <Cable className="w-4 h-4 mr-2" />
                  Open CEC Cable Box Admin
                </Button>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Features Available:</h3>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  <li>Discover connected Pulse-Eight USB CEC adapters</li>
                  <li>Generate udev rules for persistent device naming</li>
                  <li>Assign adapters to cable boxes</li>
                  <li>Test CEC connections to cable boxes</li>
                  <li>View cable box online/offline status</li>
                  <li>Configuration guide with SQL examples</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Bartender Integration:</strong> Once configured, cable boxes will automatically use CEC control when bartenders select cable inputs in the channel guide. No manual CEC toggle needed!
                </p>
              </div>
            </CardContent>
          </Card>
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
              Real AI-powered operations using device performance data and sports context
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="flex items-center gap-2 h-auto p-4"
                onClick={() => handleAiAction('analyze')}
                disabled={aiActionLoading === 'analyze'}
              >
                <Brain className="w-5 h-5 text-blue-400" />
                <div className="text-left">
                  <div className="font-medium">Run Full AI Analysis</div>
                  <div className="text-xs text-slate-400">
                    {aiActionLoading === 'analyze' ? 'Analyzing...' : 'Scan all devices & performance'}
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2 h-auto p-4"
                onClick={() => handleAiAction('optimize')}
                disabled={aiActionLoading === 'optimize'}
              >
                <Target className="w-5 h-5 text-green-400" />
                <div className="text-left">
                  <div className="font-medium">Optimize All Devices</div>
                  <div className="text-xs text-slate-400">
                    {aiActionLoading === 'optimize' ? 'Optimizing...' : 'Apply AI recommendations'}
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="flex items-center gap-2 h-auto p-4"
                onClick={() => handleAiAction('insights')}
                disabled={aiActionLoading === 'insights'}
              >
                <TrendingUp className="w-5 h-5 text-purple-400" />
                <div className="text-left">
                  <div className="font-medium">View AI Insights</div>
                  <div className="text-xs text-slate-400">
                    {aiActionLoading === 'insights' ? 'Loading...' : 'Weekly trends & predictions'}
                  </div>
                </div>
              </Button>
            </div>

            {/* AI Action Results */}
            {aiActionResult && aiActionResult.data.success && (
              <div className="card p-4 border-blue-600/50 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-400" />
                    <span className="font-semibold text-blue-200">
                      {aiActionResult.action === 'analyze' && 'Analysis Complete'}
                      {aiActionResult.action === 'optimize' && 'Optimization Complete'}
                      {aiActionResult.action === 'insights' && 'AI Insights'}
                    </span>
                  </div>

                  {aiActionResult.action === 'analyze' && aiActionResult.data.analysis && (
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>• {aiActionResult.data.analysis.onlineDevices}/{aiActionResult.data.analysis.totalDevices} devices online</div>
                      <div>• Overall health: {Math.round(aiActionResult.data.analysis.overallHealth)}%</div>
                      <div>• Success rate: {aiActionResult.data.analysis.recentPerformance.successRate}%</div>
                      {aiActionResult.data.analysis.recommendations.map((rec: string, i: number) => (
                        <div key={i}>• {rec}</div>
                      ))}
                    </div>
                  )}

                  {aiActionResult.action === 'optimize' && aiActionResult.data.optimizations && (
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>• Found {aiActionResult.data.optimizationsApplied} optimization opportunities</div>
                      {aiActionResult.data.optimizations.slice(0, 3).map((opt: any, i: number) => (
                        <div key={i}>• {opt.message}</div>
                      ))}
                    </div>
                  )}

                  {aiActionResult.action === 'insights' && aiActionResult.data.insights && (
                    <div className="text-sm text-slate-300 space-y-1">
                      <div>• Overall success rate: {aiActionResult.data.insights.overallSuccessRate}%</div>
                      <div>• Total tests: {aiActionResult.data.insights.totalTests} (last 7 days)</div>
                      {aiActionResult.data.insights.predictions.map((pred: string, i: number) => (
                        <div key={i}>• {pred}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </SportsBarLayout>
  )
}

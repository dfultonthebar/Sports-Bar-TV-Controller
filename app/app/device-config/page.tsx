
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import DirecTVController from '@/components/DirecTVController'
import FireTVController from '@/components/FireTVController'
import IRDeviceControl from '@/components/IRDeviceControl'
import EnhancedDirecTVController from '@/components/EnhancedDirecTVController'
import SubscriptionDashboard from '@/components/SubscriptionDashboard'
import { Button } from '@/components/ui/button'
import { 
  Satellite, 
  MonitorPlay, 
  Radio, 
  Settings, 
  Brain, 
  Zap,
  TrendingUp,
  Target,
  BarChart3
} from 'lucide-react'

export default function DeviceConfigPage() {
  const [aiEnhancementsEnabled, setAiEnhancementsEnabled] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<any>(null)

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            Device Configuration
          </h1>
          <p className="text-gray-600 mt-2">
            Configure and manage DirecTV, Fire TV, and IR devices with AI-enhanced capabilities
          </p>
        </div>
        
        {/* AI Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium">AI Enhancements</span>
          </div>
          <Button
            variant={aiEnhancementsEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setAiEnhancementsEnabled(!aiEnhancementsEnabled)}
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
      </div>

      {/* AI Enhancement Notice */}
      {aiEnhancementsEnabled && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">AI Enhancements Active</h3>
                <p className="text-sm text-blue-700">
                  Intelligent monitoring, smart recommendations, and predictive optimization are now enabled for all devices.
                </p>
              </div>
              <div className="flex gap-2 ml-auto">
                <Badge className="bg-green-100 text-green-800">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Learning
                </Badge>
                <Badge className="bg-blue-100 text-blue-800">
                  <Zap className="w-3 h-3 mr-1" />
                  Optimizing
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Tabs */}
      <Tabs defaultValue="directv" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
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
              <Zap className="w-5 h-5 text-yellow-600" />
              Quick AI Actions
            </CardTitle>
            <CardDescription>
              Common AI-powered operations for device management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                <Brain className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Run Full AI Analysis</div>
                  <div className="text-xs text-gray-600">Complete device intelligence scan</div>
                </div>
              </Button>
              
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                <Target className="w-5 h-5 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">Optimize All Devices</div>
                  <div className="text-xs text-gray-600">Apply AI recommendations</div>
                </div>
              </Button>
              
              <Button variant="outline" className="flex items-center gap-2 h-auto p-4">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <div className="text-left">
                  <div className="font-medium">View AI Insights</div>
                  <div className="text-xs text-gray-600">Check performance predictions</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

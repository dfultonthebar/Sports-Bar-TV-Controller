
'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DeviceAIAssistant from '@/components/DeviceAIAssistant'
import SmartDeviceOptimizer from '@/components/SmartDeviceOptimizer'
import IntelligentTroubleshooter from '@/components/IntelligentTroubleshooter'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import { 
  Brain, 
  Zap, 
  Target, 
  Bug, 
  TrendingUp, 
  CheckCircle, 
  AlertTriangle,
  Clock,
  Settings,
  Tv,
  Satellite,
  Radio
} from 'lucide-react'

export default function AIEnhancedDevicesPage() {
  const [activeDevices] = useState({
    directv: 3,
    firetv: 2,
    ir: 5
  })

  const [systemStats] = useState({
    totalOptimizations: 12,
    activeAlerts: 4,
    avgHealthScore: 87,
    aiUptime: 99.2
  })

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-600" />
            AI-Enhanced Device Management
          </h1>
          <p className="text-gray-600 mt-2">
            Intelligent monitoring, optimization, and troubleshooting for DirecTV, Fire TV, and IR devices
          </p>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{systemStats.avgHealthScore}%</div>
            <div className="text-xs text-blue-800">Avg Health</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{systemStats.aiUptime}%</div>
            <div className="text-xs text-green-800">AI Uptime</div>
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Devices</p>
                <p className="text-2xl font-bold">
                  {activeDevices.directv + activeDevices.firetv + activeDevices.ir}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <Satellite className="w-3 h-3 text-blue-500" />
                  <span className="text-xs">{activeDevices.directv}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Tv className="w-3 h-3 text-orange-500" />
                  <span className="text-xs">{activeDevices.firetv}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Radio className="w-3 h-3 text-purple-500" />
                  <span className="text-xs">{activeDevices.ir}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Optimizations</p>
                <p className="text-2xl font-bold text-green-600">{systemStats.totalOptimizations}</p>
              </div>
              <Zap className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Active automation rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Smart Alerts</p>
                <p className="text-2xl font-bold text-orange-600">{systemStats.activeAlerts}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-xs text-slate-400 mt-1">Requiring attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Status</p>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-bold text-green-600">Online</span>
                </div>
              </div>
              <Brain className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-slate-400 mt-1">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Feature Tabs */}
      <Tabs defaultValue="assistant" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assistant" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="optimizer" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Smart Optimizer
          </TabsTrigger>
          <TabsTrigger value="troubleshooter" className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Troubleshooter
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assistant" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-600" />
                Device AI Assistant
              </CardTitle>
              <CardDescription>
                Real-time AI insights, smart recommendations, and predictive analytics for all your devices
              </CardDescription>
            </CardHeader>
          </Card>
          <DeviceAIAssistant />
        </TabsContent>

        <TabsContent value="optimizer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Smart Device Optimizer
              </CardTitle>
              <CardDescription>
                Automated optimization rules and AI-generated suggestions for maximum performance
              </CardDescription>
            </CardHeader>
          </Card>
          <SmartDeviceOptimizer />
        </TabsContent>

        <TabsContent value="troubleshooter" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5 text-purple-600" />
                Intelligent Troubleshooter
              </CardTitle>
              <CardDescription>
                AI-powered diagnostics and automated repair for device issues
              </CardDescription>
            </CardHeader>
          </Card>
          <IntelligentTroubleshooter />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Response Time</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-green-200 rounded-full">
                        <div className="w-3/4 h-full bg-green-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">+15%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Success Rate</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-blue-200 rounded-full">
                        <div className="w-5/6 h-full bg-blue-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">+8%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Uptime</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-purple-200 rounded-full">
                        <div className="w-11/12 h-full bg-purple-500 rounded-full"></div>
                      </div>
                      <span className="text-sm font-medium">+3%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Learning Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  AI Learning Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pattern Recognition</span>
                    <Badge className="bg-green-100 text-green-800">97%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Prediction Accuracy</span>
                    <Badge className="bg-blue-100 text-blue-800">89%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto-Fix Success</span>
                    <Badge className="bg-purple-100 text-purple-800">84%</Badge>
                  </div>
                  <div className="text-xs text-slate-400 mt-3">
                    AI models continuously improve based on your sports bar's usage patterns
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent AI Actions */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  Recent AI Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      time: '2 minutes ago',
                      action: 'Auto-tuned Main Bar DirecTV to NFL RedZone',
                      reason: 'High sports viewing probability detected',
                      type: 'optimization',
                      success: true
                    },
                    {
                      time: '15 minutes ago',
                      action: 'Cleared Fire TV cache automatically',
                      reason: 'Performance degradation detected',
                      type: 'maintenance',
                      success: true
                    },
                    {
                      time: '1 hour ago',
                      action: 'Repositioned IR blaster recommendation sent',
                      reason: 'Command failure rate above threshold',
                      type: 'troubleshooting',
                      success: false
                    },
                    {
                      time: '2 hours ago',
                      action: 'Created lunch-time news automation rule',
                      reason: 'Usage pattern analysis completed',
                      type: 'optimization',
                      success: true
                    }
                  ].map((action, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800 or bg-slate-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        {action.type === 'optimization' && <Zap className="w-4 h-4 text-yellow-500" />}
                        {action.type === 'maintenance' && <Settings className="w-4 h-4 text-blue-500" />}
                        {action.type === 'troubleshooting' && <Bug className="w-4 h-4 text-purple-500" />}
                        <div>
                          <p className="text-sm font-medium">{action.action}</p>
                          <p className="text-xs text-slate-400">{action.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {action.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-xs text-slate-400">{action.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

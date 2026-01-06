
'use client'

import { useState, useEffect } from 'react'
import { 
  Monitor, 
  Tv, 
  RefreshCw, 
  TrendingUp,
  DollarSign,
  Trophy,
  PlayCircle,
  AlertTriangle,
  CheckCircle,
  Star,
  BarChart3,
  PieChart,
  Calendar,
  Wifi
} from 'lucide-react'
import DeviceSubscriptionPanel from './DeviceSubscriptionPanel'

import { logger } from '@sports-bar/logger'
interface Device {
  id: string
  name: string
  type: 'firetv' | 'directv'
  ipAddress: string
}

interface DeviceSubscription {
  deviceId: string
  deviceType: 'firetv' | 'directv'
  deviceName: string
  subscriptions: Subscription[]
  lastPolled: string
  pollStatus: 'success' | 'error' | 'pending'
  error?: string
}

interface Subscription {
  id: string
  name: string
  type: 'streaming' | 'premium' | 'sports' | 'addon'
  status: 'active' | 'inactive' | 'expired'
  provider?: string
  cost?: number
  expirationDate?: string
}

interface SubscriptionStats {
  totalDevices: number
  totalSubscriptions: number
  activeSubscriptions: number
  monthlyCost: number
  sportsSubscriptions: number
  streamingSubscriptions: number
  expiringSoon: number
}

export default function SubscriptionDashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [subscriptions, setSubscriptions] = useState<DeviceSubscription[]>([])
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<SubscriptionStats>({
    totalDevices: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    monthlyCost: 0,
    sportsSubscriptions: 0,
    streamingSubscriptions: 0,
    expiringSoon: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    calculateStats()
  }, [subscriptions])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load Fire TV devices
      const firetv = await fetch('/api/firetv-devices')
      const firetvData = await firetv.json()
      
      // Load DirecTV devices
      const directv = await fetch('/api/directv-devices')
      const directvData = await directv.json()
      
      // Combine devices
      const allDevices = [
        ...(firetvData.devices || []).map((d: any) => ({ ...d, type: 'firetv' as const })),
        ...(directvData.devices || []).map((d: any) => ({ ...d, type: 'directv' as const }))
      ]
      setDevices(allDevices)
      
      // Load subscription data
      const subscriptionsResponse = await fetch('/api/device-subscriptions')
      const subscriptionsData = await subscriptionsResponse.json()
      setSubscriptions(subscriptionsData.devices || [])
      
    } catch (error) {
      logger.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = () => {
    const allSubscriptions = subscriptions.flatMap(d => d.subscriptions)
    const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active')
    const sportsSubscriptions = activeSubscriptions.filter(s => s.type === 'sports')
    const streamingSubscriptions = activeSubscriptions.filter(s => s.type === 'streaming')
    
    // Calculate expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const expiringSoon = activeSubscriptions.filter(s => 
      s.expirationDate && new Date(s.expirationDate) <= thirtyDaysFromNow
    ).length

    const monthlyCost = activeSubscriptions
      .filter(s => s.cost)
      .reduce((total, s) => total + (s.cost || 0), 0)

    setStats({
      totalDevices: devices.length,
      totalSubscriptions: allSubscriptions.length,
      activeSubscriptions: activeSubscriptions.length,
      monthlyCost,
      sportsSubscriptions: sportsSubscriptions.length,
      streamingSubscriptions: streamingSubscriptions.length,
      expiringSoon
    })
  }

  const refreshAllData = async () => {
    try {
      setRefreshing(true)
      
      // Poll all devices
      const pollPromises = devices.map(device => 
        fetch('/api/device-subscriptions/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: device.id,
            deviceType: device.type,
            force: true
          })
        })
      )
      
      await Promise.all(pollPromises)
      await loadData()
      
    } catch (error) {
      logger.error('Error refreshing data:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const getDeviceIcon = (type: string) => {
    return type === 'firetv' ? <Monitor className="w-5 h-5" /> : <Tv className="w-5 h-5" />
  }

  const getDeviceSubscriptionData = (deviceId: string) => {
    return subscriptions.find(s => s.deviceId === deviceId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading subscription data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Subscription Dashboard</h2>
          <p className="text-gray-600">Monitor streaming and TV subscriptions across all devices</p>
        </div>
        <button
          onClick={refreshAllData}
          disabled={refreshing}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 or bg-slate-900 p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Devices</p>
              <p className="text-2xl font-bold text-slate-100">{stats.totalDevices}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 or bg-slate-900 p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 or bg-slate-900 p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Cost</p>
              <p className="text-2xl font-bold text-purple-600">${stats.monthlyCost.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 or bg-slate-900 p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sports Subscriptions</p>
              <p className="text-2xl font-bold text-orange-600">{stats.sportsSubscriptions}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Trophy className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Warning Alerts */}
      {stats.expiringSoon > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800 font-medium">
              {stats.expiringSoon} subscription{stats.expiringSoon > 1 ? 's' : ''} expiring within 30 days
            </span>
          </div>
        </div>
      )}

      {selectedDevice ? (
        // Device Detail View
        <DeviceSubscriptionPanel
          deviceId={selectedDevice.id}
          deviceType={selectedDevice.type}
          deviceName={selectedDevice.name}
          onClose={() => setSelectedDevice(null)}
        />
      ) : (
        // Device Grid View
        <div className="bg-slate-800 or bg-slate-900 rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-slate-100">Devices</h3>
            <p className="text-gray-600">Click on a device to view its subscriptions</p>
          </div>
          
          <div className="p-6">
            {devices.length === 0 ? (
              <div className="text-center py-8">
                <Wifi className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-100 mb-2">No Devices Found</h4>
                <p className="text-gray-600">Configure Fire TV and DirecTV devices to monitor subscriptions</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map(device => {
                  const subscriptionData = getDeviceSubscriptionData(device.id)
                  const activeCount = subscriptionData?.subscriptions.filter(s => s.status === 'active').length || 0
                  const sportsCount = subscriptionData?.subscriptions.filter(s => s.type === 'sports' && s.status === 'active').length || 0
                  const monthlyCost = subscriptionData?.subscriptions
                    .filter(s => s.status === 'active' && s.cost)
                    .reduce((total, s) => total + (s.cost || 0), 0) || 0

                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className="p-4 border rounded-lg hover:bg-slate-800 or bg-slate-900 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 rounded-lg ${
                          device.type === 'firetv' ? 'bg-orange-100' : 'bg-blue-100'
                        }`}>
                          <div className={`${
                            device.type === 'firetv' ? 'text-orange-600' : 'text-blue-600'
                          }`}>
                            {getDeviceIcon(device.type)}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-slate-100">{device.name}</h4>
                          <p className="text-sm text-slate-400">{device.ipAddress}</p>
                        </div>
                      </div>

                      {subscriptionData ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Active subscriptions:</span>
                            <span className="font-medium">{activeCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Sports packages:</span>
                            <span className="font-medium text-orange-600">{sportsCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Monthly cost:</span>
                            <span className="font-medium text-green-600">${monthlyCost.toFixed(2)}</span>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full inline-block ${
                            subscriptionData.pollStatus === 'success' ? 'bg-green-100 text-green-700' :
                            subscriptionData.pollStatus === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            Last updated: {new Date(subscriptionData.lastPolled).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-sm text-slate-400 mb-2">No subscription data</p>
                          <span className="text-xs bg-slate-800 or bg-slate-900 text-gray-600 px-2 py-1 rounded">
                            Click to poll device
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subscription Summary */}
      {subscriptions.length > 0 && !selectedDevice && (
        <div className="bg-slate-800 or bg-slate-900 rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold text-slate-100">Subscription Summary</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-slate-100 mb-3">By Type</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <PlayCircle className="w-4 h-4 text-purple-600" />
                      <span>Streaming</span>
                    </div>
                    <span className="font-medium">{stats.streamingSubscriptions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-4 h-4 text-orange-600" />
                      <span>Sports</span>
                    </div>
                    <span className="font-medium">{stats.sportsSubscriptions}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-100 mb-3">Popular Services</h4>
                <div className="space-y-1 text-sm text-slate-300">
                  {subscriptions
                    .flatMap(d => d.subscriptions.filter(s => s.status === 'active'))
                    .reduce((acc, sub) => {
                      acc[sub.provider || 'Unknown'] = (acc[sub.provider || 'Unknown'] || 0) + 1
                      return acc
                    }, {} as Record<string, number>)
                    && Object.entries(
                      subscriptions
                        .flatMap(d => d.subscriptions.filter(s => s.status === 'active'))
                        .reduce((acc, sub) => {
                          acc[sub.provider || 'Unknown'] = (acc[sub.provider || 'Unknown'] || 0) + 1
                          return acc
                        }, {} as Record<string, number>)
                    )
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([provider, count]) => (
                      <div key={provider} className="flex justify-between">
                        <span>{provider}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-slate-100 mb-3">Cost Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Monthly:</span>
                    <span className="font-medium text-green-600">${stats.monthlyCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Annual Estimate:</span>
                    <span className="font-medium">${(stats.monthlyCost * 12).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

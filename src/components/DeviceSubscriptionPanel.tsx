
'use client'

import { useState, useEffect } from 'react'
import { 
  Tv, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  DollarSign,
  Calendar,
  Package,
  Zap,
  PlayCircle,
  Star,
  Shield,
  Trophy,
  Monitor
} from 'lucide-react'

interface Subscription {
  id: string
  name: string
  type: 'streaming' | 'premium' | 'sports' | 'addon'
  status: 'active' | 'inactive' | 'expired'
  provider?: string
  packageName?: string
  subscriptionDate?: string
  expirationDate?: string
  cost?: number
  description?: string
  logoUrl?: string
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

interface DeviceSubscriptionPanelProps {
  deviceId: string
  deviceType: 'firetv' | 'directv'
  deviceName: string
  onClose?: () => void
}

export default function DeviceSubscriptionPanel({ 
  deviceId, 
  deviceType, 
  deviceName, 
  onClose 
}: DeviceSubscriptionPanelProps) {
  const [subscriptionData, setSubscriptionData] = useState<DeviceSubscription | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'streaming' | 'sports' | 'premium' | 'addon'>('all')

  useEffect(() => {
    loadSubscriptions()
  }, [deviceId])

  const loadSubscriptions = async () => {
    try {
      const response = await fetch(`/api/device-subscriptions?deviceId=${deviceId}`)
      const result = await response.json()
      
      if (result.success && result.devices.length > 0) {
        setSubscriptionData(result.devices[0])
      } else {
        setSubscriptionData(null)
      }
    } catch (err) {
      console.error('Error loading subscriptions:', err)
      setError('Failed to load subscription data')
    }
  }

  const pollSubscriptions = async (force = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/device-subscriptions/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          deviceType,
          force
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        await loadSubscriptions()
      } else {
        setError(result.error || 'Failed to poll subscriptions')
      }
    } catch (err) {
      console.error('Error polling subscriptions:', err)
      setError('Failed to poll device subscriptions')
    } finally {
      setLoading(false)
    }
  }

  const getSubscriptionIcon = (type: string) => {
    switch (type) {
      case 'streaming': return <PlayCircle className="w-4 h-4" />
      case 'sports': return <Trophy className="w-4 h-4" />
      case 'premium': return <Star className="w-4 h-4" />
      case 'addon': return <Package className="w-4 h-4" />
      default: return <Tv className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100'
      case 'inactive': return 'text-gray-600 bg-gray-100'
      case 'expired': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const filteredSubscriptions = subscriptionData?.subscriptions.filter(sub => 
    filter === 'all' || sub.type === filter
  ) || []

  const totalMonthlyCost = subscriptionData?.subscriptions
    .filter(sub => sub.status === 'active' && sub.cost)
    .reduce((total, sub) => total + (sub.cost || 0), 0) || 0

  const activeCount = subscriptionData?.subscriptions.filter(sub => sub.status === 'active').length || 0
  const sportsCount = subscriptionData?.subscriptions.filter(sub => sub.type === 'sports' && sub.status === 'active').length || 0

  return (
    <div className="bg-white rounded-lg border shadow-lg">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${deviceType === 'firetv' ? 'bg-orange-100' : 'bg-blue-100'}`}>
              {deviceType === 'firetv' ? (
                <Monitor className="w-5 h-5 text-orange-600" />
              ) : (
                <Tv className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Device Subscriptions</h3>
              <p className="text-sm text-slate-300">{deviceName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => pollSubscriptions(true)}
              disabled={loading}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-slate-500 hover:text-gray-600 rounded-lg"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        {subscriptionData && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                subscriptionData.pollStatus === 'success' ? 'bg-green-100 text-green-700' :
                subscriptionData.pollStatus === 'error' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {subscriptionData.pollStatus === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : subscriptionData.pollStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
                <span className="capitalize">{subscriptionData.pollStatus}</span>
              </div>
              <div className="text-sm text-slate-400">
                Last updated: {new Date(subscriptionData.lastPolled).toLocaleString()}
              </div>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>{activeCount} Active</span>
              </div>
              <div className="flex items-center space-x-1">
                <Trophy className="w-4 h-4 text-orange-600" />
                <span>{sportsCount} Sports</span>
              </div>
              {totalMonthlyCost > 0 && (
                <div className="flex items-center space-x-1">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span>${totalMonthlyCost.toFixed(2)}/month</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-b">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {!subscriptionData && !loading && (
          <div className="text-center py-8">
            <Wifi className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-slate-100 mb-2">No Subscription Data</h4>
            <p className="text-gray-600 mb-4">Poll this device to discover available subscriptions and streaming services.</p>
            <button
              onClick={() => pollSubscriptions()}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Poll Subscriptions
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Polling device subscriptions...</p>
          </div>
        )}

        {subscriptionData && subscriptionData.subscriptions.length > 0 && (
          <div>
            {/* Filter Tabs */}
            <div className="flex space-x-1 mb-4 bg-gray-100 p-1 rounded-lg">
              {(['all', 'streaming', 'sports', 'premium', 'addon'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    filter === type
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-slate-100'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Subscriptions Grid */}
            <div className="space-y-3">
              {filteredSubscriptions.map(subscription => (
                <div key={subscription.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${
                        subscription.type === 'sports' ? 'bg-orange-100 text-orange-600' :
                        subscription.type === 'streaming' ? 'bg-purple-100 text-purple-600' :
                        subscription.type === 'premium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {getSubscriptionIcon(subscription.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-slate-100">{subscription.name}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(subscription.status)}`}>
                            {subscription.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mb-2">{subscription.description}</p>
                        <div className="flex items-center space-x-4 text-xs text-slate-400">
                          {subscription.provider && (
                            <span>Provider: {subscription.provider}</span>
                          )}
                          {subscription.cost && (
                            <span className="flex items-center space-x-1">
                              <DollarSign className="w-3 h-3" />
                              <span>${subscription.cost}/month</span>
                            </span>
                          )}
                          {subscription.expirationDate && (
                            <span className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>Expires: {new Date(subscription.expirationDate).toLocaleDateString()}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredSubscriptions.length === 0 && (
              <div className="text-center py-6">
                <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <p className="text-gray-600">No {filter === 'all' ? '' : filter + ' '}subscriptions found</p>
              </div>
            )}
          </div>
        )}

        {subscriptionData && subscriptionData.pollStatus === 'error' && (
          <div className="text-center py-8">
            <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-slate-100 mb-2">Polling Failed</h4>
            <p className="text-gray-600 mb-4">
              {subscriptionData.error || 'Unable to connect to device'}
            </p>
            <button
              onClick={() => pollSubscriptions(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

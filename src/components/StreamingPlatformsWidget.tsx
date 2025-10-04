

'use client'

import { useState, useEffect } from 'react'
import { 
  Play, 
  Settings, 
  ExternalLink, 
  User, 
  Eye, 
  EyeOff, 
  Check, 
  X,
  Tv,
  Wifi,
  Key,
  Shield,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

interface StreamingPlatform {
  id: string
  name: string
  description: string
  logoUrl?: string
  loginUrl: string
  hasAuth: boolean
  authStatus: 'connected' | 'expired' | 'not-connected'
  lastSync?: string
  subscriptionType?: 'free' | 'subscription' | 'premium'
  features: string[]
  quickLaunchUrl?: string
}

interface StreamingCredentials {
  id: string
  platformId: string
  username: string
  encrypted: boolean
  lastUpdated: string
  status: 'active' | 'expired' | 'error'
}

const STREAMING_PLATFORMS: StreamingPlatform[] = [
  {
    id: 'youtube-tv',
    name: 'YouTube TV',
    description: 'Live TV streaming service',
    loginUrl: 'https://tv.youtube.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['Live Sports Channels', 'DVR', 'Multiple Screens', 'Sports Add-ons']
  },
  {
    id: 'hulu-live',
    name: 'Hulu + Live TV',
    description: 'Live TV and on-demand streaming',
    loginUrl: 'https://www.hulu.com/live-tv',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['Live Sports', 'ESPN+', 'Disney+ Bundle', 'Sports Add-ons']
  },
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    description: 'CBS Sports and live TV',
    loginUrl: 'https://www.paramountplus.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['CBS Sports', 'NFL Games', 'SEC on CBS', 'Champions League']
  },
  {
    id: 'peacock',
    name: 'Peacock Premium',
    description: 'NBC Sports streaming',
    loginUrl: 'https://www.peacocktv.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['NBC Sports', 'Premier League', 'NFL', 'Olympics Coverage']
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime Video',
    description: 'Prime Video sports content',
    loginUrl: 'https://www.amazon.com/gp/video',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'premium',
    features: ['Thursday Night Football', 'Prime Video Sports', 'Live Events', 'Original Content']
  }
]

export default function StreamingPlatformsWidget() {
  const [platforms, setPlatforms] = useState<StreamingPlatform[]>(STREAMING_PLATFORMS)
  const [credentials, setCredentials] = useState<StreamingCredentials[]>([])
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<StreamingPlatform | null>(null)
  const [authForm, setAuthForm] = useState({ username: '', password: '', rememberMe: true })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null)

  useEffect(() => {
    loadCredentials()
    updateAuthStatus()
  }, [])

  const loadCredentials = async () => {
    try {
      const response = await fetch('/api/streaming-platforms/credentials')
      const result = await response.json()
      
      if (result.success) {
        setCredentials(result.credentials || [])
        updatePlatformsWithAuth(result.credentials || [])
      }
    } catch (error) {
      console.error('Error loading streaming credentials:', error)
    }
  }

  const updatePlatformsWithAuth = (creds: StreamingCredentials[]) => {
    setPlatforms(prev => prev.map(platform => {
      const credential = creds.find(c => c.platformId === platform.id)
      if (credential) {
        return {
          ...platform,
          authStatus: credential.status === 'active' ? 'connected' : 'expired' as 'connected' | 'expired' | 'not-connected',
          lastSync: credential.lastUpdated
        }
      }
      return platform
    }))
  }

  const updateAuthStatus = async () => {
    try {
      const response = await fetch('/api/streaming-platforms/status')
      const result = await response.json()
      
      if (result.success) {
        setPlatforms(prev => prev.map(platform => ({
          ...platform,
          authStatus: result.statuses?.[platform.id] || platform.authStatus
        })))
      }
    } catch (error) {
      console.error('Error updating auth status:', error)
    }
  }

  const handleLogin = async () => {
    if (!selectedPlatform) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/streaming-platforms/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformId: selectedPlatform.id,
          username: authForm.username,
          password: authForm.password,
          rememberMe: authForm.rememberMe
        })
      })

      const result = await response.json()
      
      if (result.success) {
        await loadCredentials()
        setShowAuthModal(false)
        setAuthForm({ username: '', password: '', rememberMe: true })
        setSelectedPlatform(null)
      } else {
        alert(`Authentication failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error during authentication:', error)
      alert('Authentication error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async (platformId: string) => {
    try {
      const response = await fetch('/api/streaming-platforms/auth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformId })
      })

      const result = await response.json()
      
      if (result.success) {
        await loadCredentials()
      } else {
        alert(`Logout failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error during logout:', error)
      alert('Logout error occurred')
    }
  }

  const openAuthModal = (platform: StreamingPlatform) => {
    setSelectedPlatform(platform)
    setShowAuthModal(true)
  }

  const getAuthStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Check className="w-4 h-4 text-green-500" />
      case 'expired':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <X className="w-4 h-4 text-slate-500" />
    }
  }

  const getAuthStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'expired':
        return 'Expired'
      default:
        return 'Not Connected'
    }
  }

  const connectedPlatforms = platforms.filter(p => p.authStatus === 'connected')
  const availablePlatforms = platforms.filter(p => p.authStatus !== 'connected')

  return (
    <div className="bg-slate-800 or bg-slate-900 rounded-2xl shadow-lg border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-2.5 shadow-lg">
            <Tv className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Streaming Platforms</h3>
            <p className="text-sm text-slate-500">Manage your streaming service accounts</p>
          </div>
        </div>
        
        <button
          onClick={() => updateAuthStatus()}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-800 or bg-slate-900 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-xl">
          <div className="text-2xl font-bold text-green-600">{connectedPlatforms.length}</div>
          <div className="text-sm text-green-700">Connected</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-xl">
          <div className="text-2xl font-bold text-blue-600">{availablePlatforms.length}</div>
          <div className="text-sm text-blue-700">Available</div>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-xl">
          <div className="text-2xl font-bold text-purple-600">{platforms.length}</div>
          <div className="text-sm text-purple-700">Total</div>
        </div>
      </div>

      {/* Connected Platforms */}
      {connectedPlatforms.length > 0 && (
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-green-500" />
            Connected Platforms
          </h4>
          <div className="space-y-2">
            {connectedPlatforms.map(platform => (
              <div key={platform.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  {getAuthStatusIcon(platform.authStatus)}
                  <div>
                    <div className="font-medium text-green-800">{platform.name}</div>
                    <div className="text-sm text-green-600">
                      Last sync: {platform.lastSync ? new Date(platform.lastSync).toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {platform.quickLaunchUrl && (
                    <a
                      href={platform.quickLaunchUrl}
                      className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                      title="Launch Platform"
                    >
                      <Play className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleLogout(platform.id)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                    title="Disconnect"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Platforms */}
      <div>
        <h4 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
          <Wifi className="w-5 h-5 mr-2 text-blue-500" />
          Available Platforms
        </h4>
        <div className="space-y-2">
          {availablePlatforms.map(platform => (
            <div key={platform.id} className="border border-slate-200 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => setExpandedPlatform(expandedPlatform === platform.id ? null : platform.id)}
              >
                <div className="flex items-center space-x-3">
                  {getAuthStatusIcon(platform.authStatus)}
                  <div>
                    <div className="font-medium text-slate-800">{platform.name}</div>
                    <div className="text-sm text-slate-500">{platform.description}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs px-2 py-1 bg-slate-800 or bg-slate-900 text-slate-600 rounded-full">
                    {getAuthStatusText(platform.authStatus)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openAuthModal(platform)
                    }}
                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title="Connect Account"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {expandedPlatform === platform.id && (
                <div className="px-3 pb-3 border-t border-slate-100">
                  <div className="text-sm text-slate-600 mb-2">Features:</div>
                  <div className="flex flex-wrap gap-1">
                    {platform.features.map((feature, index) => (
                      <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Authentication Modal */}
      {showAuthModal && selectedPlatform && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 or bg-slate-900 rounded-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Connect to {selectedPlatform.name}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Username or Email
                </label>
                <input
                  type="text"
                  value={authForm.username}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your username/email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(e) => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={authForm.rememberMe}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, rememberMe: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="rememberMe" className="text-sm text-slate-700">
                  Keep me logged in
                </label>
              </div>

              <div className="text-xs text-slate-500 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-start space-x-2">
                  <Shield className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    Your credentials are encrypted and stored securely. We use them only to fetch more accurate sports data and streaming information.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAuthModal(false)}
                className="flex-1 px-4 py-2 text-slate-700 bg-slate-800 or bg-slate-900 rounded-lg hover:bg-slate-800 or bg-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                disabled={isLoading || !authForm.username || !authForm.password}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Connect Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

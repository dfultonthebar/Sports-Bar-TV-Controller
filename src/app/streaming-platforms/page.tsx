

'use client'

import { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  Settings, 
  Shield, 
  Key, 
  Users, 
  Tv,
  Play,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Eye,
  EyeOff,
  Plus,
  Minus,
  ExternalLink,
  Database,
  Activity
} from 'lucide-react'
import Link from 'next/link'

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
  dataEnhancements: string[]
  quickLaunchUrl?: string
}

interface StreamingCredentials {
  id: string
  platformId: string
  username: string
  encrypted: boolean
  lastUpdated: string
  status: 'active' | 'expired' | 'error'
  lastSync?: string
}

const STREAMING_PLATFORMS: StreamingPlatform[] = [
  {
    id: 'nfhs-network',
    name: 'NFHS Network',
    description: 'High school sports streaming platform with comprehensive coverage',
    loginUrl: 'https://www.nfhsnetwork.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['Live High School Sports', 'Game Archives', 'Multi-Sport Coverage', 'Regional Games'],
    dataEnhancements: ['Local team schedules', 'Player statistics', 'Regional tournament brackets', 'School-specific notifications'],
    quickLaunchUrl: '/nfhs-network'
  },
  {
    id: 'youtube-tv',
    name: 'YouTube TV',
    description: 'Comprehensive live TV streaming service with extensive sports coverage',
    loginUrl: 'https://tv.youtube.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['Live Sports Channels', 'Unlimited DVR', 'Multiple Screens', 'Sports Add-ons'],
    dataEnhancements: ['Personalized recommendations', 'DVR scheduling', 'Multi-view support', 'Your recorded games']
  },
  {
    id: 'hulu-live',
    name: 'Hulu + Live TV',
    description: 'Live TV and on-demand streaming with Disney+ and ESPN+ bundle',
    loginUrl: 'https://www.hulu.com/live-tv',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['Live Sports', 'ESPN+ Content', 'Disney+ Bundle', 'Sports Add-ons'],
    dataEnhancements: ['Watchlist integration', 'ESPN+ exclusive content', 'Personalized sports feed', 'Multi-profile support']
  },
  {
    id: 'paramount-plus',
    name: 'Paramount+',
    description: 'CBS Sports and premium content streaming',
    loginUrl: 'https://www.paramountplus.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['CBS Sports', 'NFL Games', 'SEC on CBS', 'Champions League'],
    dataEnhancements: ['CBS Sports exclusive content', 'Your team preferences', 'Game highlights', 'Live score updates']
  },
  {
    id: 'peacock',
    name: 'Peacock Premium',
    description: 'NBC Sports streaming with live and on-demand content',
    loginUrl: 'https://www.peacocktv.com',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'subscription',
    features: ['NBC Sports', 'Premier League', 'NFL', 'Olympics Coverage'],
    dataEnhancements: ['Premier League match center', 'Olympics coverage', 'NBC Sports exclusives', 'Live commentary']
  },
  {
    id: 'amazon-prime',
    name: 'Amazon Prime Video',
    description: 'Prime Video sports content with exclusive NFL games',
    loginUrl: 'https://www.amazon.com/gp/video',
    hasAuth: true,
    authStatus: 'not-connected',
    subscriptionType: 'premium',
    features: ['Thursday Night Football', 'Prime Video Sports', 'Live Events', 'Original Content'],
    dataEnhancements: ['X-Ray sports stats', 'Multi-camera angles', 'Prime member exclusives', 'Next Gen Stats']
  }
]

export default function StreamingPlatformsPage() {
  const [platforms, setPlatforms] = useState<StreamingPlatform[]>(STREAMING_PLATFORMS)
  const [credentials, setCredentials] = useState<StreamingCredentials[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<StreamingPlatform | null>(null)
  const [authForm, setAuthForm] = useState({ username: '', password: '', rememberMe: true })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'authentication' | 'data-sync'>('overview')

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
    }
  }

  const getAuthStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Check className="w-5 h-5 text-green-500" />
      case 'expired':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      default:
        return <X className="w-5 h-5 text-slate-500" />
    }
  }

  const connectedPlatforms = platforms.filter(p => p.authStatus === 'connected')
  const availablePlatforms = platforms.filter(p => p.authStatus !== 'connected')

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 px-3 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Link>
              
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-2.5 shadow-lg">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Streaming Platforms</h1>
                <p className="text-sm text-slate-500">Manage your streaming service integrations</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => updateAuthStatus()}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 mb-8">
          <div className="border-b border-slate-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', name: 'Overview', icon: Activity },
                { id: 'authentication', name: 'Authentication', icon: Shield },
                { id: 'data-sync', name: 'Data Sync', icon: Database }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{connectedPlatforms.length}</div>
                    <div className="text-sm text-green-700">Connected</div>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{availablePlatforms.length}</div>
                    <div className="text-sm text-blue-700">Available</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{platforms.length}</div>
                    <div className="text-sm text-purple-700">Total Platforms</div>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {platforms.filter(p => p.authStatus === 'expired').length}
                    </div>
                    <div className="text-sm text-yellow-700">Need Renewal</div>
                  </div>
                </div>

                {/* Platform Overview Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {platforms.map(platform => (
                    <div key={platform.id} className="border border-slate-200 rounded-xl p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {getAuthStatusIcon(platform.authStatus)}
                          <div>
                            <h3 className="font-semibold text-slate-900">{platform.name}</h3>
                            <p className="text-sm text-slate-500">{platform.description}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          platform.authStatus === 'connected' 
                            ? 'bg-green-100 text-green-700'
                            : platform.authStatus === 'expired'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {platform.authStatus === 'connected' ? 'Connected' :
                           platform.authStatus === 'expired' ? 'Expired' : 'Not Connected'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-2">Features</h4>
                          <div className="flex flex-wrap gap-1">
                            {platform.features.slice(0, 3).map((feature, index) => (
                              <span key={index} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                {feature}
                              </span>
                            ))}
                            {platform.features.length > 3 && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                +{platform.features.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                          {platform.authStatus === 'connected' ? (
                            <div className="flex space-x-2">
                              {platform.quickLaunchUrl && (
                                <Link
                                  href={platform.quickLaunchUrl}
                                  className="flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Launch</span>
                                </Link>
                              )}
                              <button
                                onClick={() => handleLogout(platform.id)}
                                className="flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                              >
                                <X className="w-3 h-3" />
                                <span>Disconnect</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedPlatform(platform)}
                              className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                            >
                              <Key className="w-3 h-3" />
                              <span>Connect</span>
                            </button>
                          )}
                          
                          <a
                            href={platform.loginUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-1 text-slate-500 hover:text-slate-700 text-sm"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Visit Site</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Authentication Tab */}
            {activeTab === 'authentication' && (
              <div className="space-y-6">
                <div className="bg-blue-50 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Shield className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-blue-900">Secure Authentication</h3>
                  </div>
                  <p className="text-blue-700 mb-4">
                    Connect your streaming platform accounts to enable enhanced data retrieval and personalized sports recommendations.
                  </p>
                  <div className="text-sm text-blue-600">
                    <div className="flex items-center space-x-2 mb-2">
                      <Check className="w-4 h-4" />
                      <span>Passwords are encrypted and stored securely</span>
                    </div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Check className="w-4 h-4" />
                      <span>Data is used only for sports guide enhancement</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Check className="w-4 h-4" />
                      <span>You can disconnect at any time</span>
                    </div>
                  </div>
                </div>

                {/* Authentication Form */}
                {selectedPlatform && (
                  <div className="border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">
                      Connect to {selectedPlatform.name}
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Username or Email
                        </label>
                        <input
                          type="text"
                          value={authForm.username}
                          onChange={(e) => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 pr-10"
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
                          className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="rememberMe" className="text-sm text-slate-700">
                          Keep me logged in
                        </label>
                      </div>

                      <div className="flex space-x-3">
                        <button
                          onClick={() => setSelectedPlatform(null)}
                          className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleLogin}
                          disabled={isLoading || !authForm.username || !authForm.password}
                          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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

                {/* Connected Accounts */}
                {connectedPlatforms.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Connected Accounts</h3>
                    <div className="space-y-3">
                      {connectedPlatforms.map(platform => (
                        <div key={platform.id} className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center space-x-3">
                            <Check className="w-5 h-5 text-green-500" />
                            <div>
                              <div className="font-medium text-green-800">{platform.name}</div>
                              <div className="text-sm text-green-600">
                                Connected • Last sync: {platform.lastSync ? new Date(platform.lastSync).toLocaleDateString() : 'Never'}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleLogout(platform.id)}
                            className="px-3 py-1 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg transition-colors text-sm"
                          >
                            Disconnect
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Data Sync Tab */}
            {activeTab === 'data-sync' && (
              <div className="space-y-6">
                <div className="bg-purple-50 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Database className="w-6 h-6 text-purple-600" />
                    <h3 className="text-lg font-semibold text-purple-900">Data Enhancement</h3>
                  </div>
                  <p className="text-purple-700">
                    Connected streaming platforms provide enhanced data for more accurate sports recommendations and personalized content.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {platforms.map(platform => (
                    <div key={platform.id} className="border border-slate-200 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">{platform.name}</h3>
                        <span className={`flex items-center space-x-1 text-sm ${
                          platform.authStatus === 'connected' ? 'text-green-600' : 'text-slate-400'
                        }`}>
                          {getAuthStatusIcon(platform.authStatus)}
                          <span>
                            {platform.authStatus === 'connected' ? 'Syncing' : 'Disconnected'}
                          </span>
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Data Enhancements</h4>
                        <div className="space-y-2">
                          {platform.dataEnhancements.map((enhancement, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              {platform.authStatus === 'connected' ? (
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Minus className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              )}
                              <span className={`text-sm ${
                                platform.authStatus === 'connected' ? 'text-slate-700' : 'text-slate-400'
                              }`}>
                                {enhancement}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

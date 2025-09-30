
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/cards'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { 
  Music2, 
  Key, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Radio,
  Users,
  MapPin,
  Eye,
  EyeOff,
  Save,
  TestTube
} from 'lucide-react'

interface SoundtrackConfig {
  apiKey: string
  accountId?: string
  accountName?: string
  isConfigured: boolean
  lastTested?: string
  status?: 'active' | 'error' | 'untested'
}

interface SoundtrackAccount {
  id: string
  businessName: string
  locationCount?: number
}

export default function SoundtrackConfiguration() {
  const [config, setConfig] = useState<SoundtrackConfig>({
    apiKey: '',
    isConfigured: false,
    status: 'untested'
  })
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const [accountInfo, setAccountInfo] = useState<SoundtrackAccount | null>(null)

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/soundtrack/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data.config || { apiKey: '', isConfigured: false, status: 'untested' })
        if (data.config?.apiKey) {
          setApiKey('••••••••••••' + data.config.apiKey.slice(-4))
        }
        if (data.accountInfo) {
          setAccountInfo(data.accountInfo)
        }
      }
    } catch (error) {
      console.error('Failed to load configuration:', error)
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async (keyToTest?: string) => {
    const testKey = keyToTest || config.apiKey
    if (!testKey || testKey.includes('••••')) {
      setMessage({ type: 'error', text: 'Please enter an API key first' })
      return false
    }

    setTesting(true)
    setMessage({ type: 'info', text: 'Testing connection to Soundtrack Your Brand...' })

    try {
      const response = await fetch('/api/soundtrack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: testKey })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: `✓ Connected successfully! Account: ${data.accountInfo?.businessName || 'Unknown'}` })
        setAccountInfo(data.accountInfo)
        return true
      } else {
        setMessage({ type: 'error', text: `✗ Connection failed: ${data.error || 'Unknown error'}` })
        return false
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `✗ Connection error: ${error.message}` })
      return false
    } finally {
      setTesting(false)
    }
  }

  const saveConfiguration = async () => {
    if (!apiKey || apiKey.includes('••••')) {
      setMessage({ type: 'error', text: 'Please enter a valid API key' })
      return
    }

    // Test first
    const connectionSuccess = await testConnection(apiKey)
    if (!connectionSuccess) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/soundtrack/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          accountId: accountInfo?.id,
          accountName: accountInfo?.businessName,
          status: 'active'
        })
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        setMessage({ type: 'success', text: '✓ Configuration saved successfully!' })
        setTimeout(() => loadConfiguration(), 1000)
      } else {
        const data = await response.json()
        setMessage({ type: 'error', text: `Failed to save: ${data.error}` })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Save error: ${error.message}` })
    } finally {
      setSaving(false)
    }
  }

  const deleteConfiguration = async () => {
    if (!confirm('Are you sure you want to remove the Soundtrack Your Brand configuration?')) {
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/soundtrack/config', {
        method: 'DELETE'
      })

      if (response.ok) {
        setConfig({ apiKey: '', isConfigured: false, status: 'untested' })
        setApiKey('')
        setAccountInfo(null)
        setMessage({ type: 'success', text: 'Configuration removed successfully' })
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: `Delete error: ${error.message}` })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mr-2" />
          <span className="text-gray-600">Loading configuration...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Main Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Music2 className="w-6 h-6 text-purple-600" />
              <CardTitle>Soundtrack Your Brand Configuration</CardTitle>
            </div>
            {config.isConfigured && (
              <Badge variant={config.status === 'active' ? 'default' : 'destructive'}>
                {config.status === 'active' ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                ) : (
                  <><XCircle className="w-3 h-3 mr-1" /> Error</>
                )}
              </Badge>
            )}
          </div>
          <CardDescription>
            Configure API access to control playlists and audio zones
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Message */}
          {message && (
            <div className={`p-3 rounded-lg border ${
              message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
              message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <div className="flex items-center">
                {message.type === 'success' ? <CheckCircle className="w-4 h-4 mr-2" /> :
                 message.type === 'error' ? <XCircle className="w-4 h-4 mr-2" /> :
                 <AlertCircle className="w-4 h-4 mr-2" />}
                {message.text}
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              <Key className="w-4 h-4 mr-2 text-purple-600" />
              API Token
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Soundtrack Your Brand API token"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={() => testConnection(apiKey)}
                disabled={testing || !apiKey || apiKey.includes('••••')}
                variant="outline"
              >
                {testing ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Testing</>
                ) : (
                  <><TestTube className="w-4 h-4 mr-2" /> Test</>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Get your API token from <a href="https://business.soundtrackyourbrand.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">Soundtrack Your Brand Dashboard</a>
            </p>
          </div>

          {/* Account Info */}
          {accountInfo && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Account Information
              </h4>
              <div className="space-y-1 text-sm text-purple-800">
                <div className="flex items-center">
                  <Radio className="w-3 h-3 mr-2" />
                  <span className="font-medium">Business Name:</span>
                  <span className="ml-2">{accountInfo.businessName}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-3 h-3 mr-2" />
                  <span className="font-medium">Account ID:</span>
                  <span className="ml-2 font-mono text-xs">{accountInfo.id}</span>
                </div>
                {accountInfo.locationCount && (
                  <div className="flex items-center">
                    <MapPin className="w-3 h-3 mr-2" />
                    <span className="font-medium">Locations:</span>
                    <span className="ml-2">{accountInfo.locationCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {config.isConfigured ? (
              <>
                <Button
                  onClick={() => testConnection()}
                  disabled={testing}
                  variant="outline"
                >
                  {testing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Testing</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" /> Test Connection</>
                  )}
                </Button>
                <Button
                  onClick={deleteConfiguration}
                  disabled={saving}
                  variant="destructive"
                >
                  Remove Configuration
                </Button>
              </>
            ) : (
              <Button
                onClick={saveConfiguration}
                disabled={saving || !apiKey || apiKey.includes('••••')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {saving ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Save Configuration</>
                )}
              </Button>
            )}
          </div>

          {/* Last Tested */}
          {config.lastTested && (
            <p className="text-xs text-gray-500">
              Last tested: {new Date(config.lastTested).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Setup Instructions Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900 text-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            How to Get Your API Token
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-800">
          <ol className="list-decimal list-inside space-y-2">
            <li>Log in to your <a href="https://business.soundtrackyourbrand.com" target="_blank" rel="noopener noreferrer" className="font-medium underline">Soundtrack Your Brand account</a></li>
            <li>Navigate to <strong>Settings → API Access</strong></li>
            <li>Click <strong>Generate New Token</strong> or copy your existing token</li>
            <li>Paste the token in the field above and click <strong>Test</strong></li>
            <li>If the test succeeds, click <strong>Save Configuration</strong></li>
          </ol>
          <div className="mt-3 p-2 bg-blue-100 rounded border border-blue-300">
            <p className="text-xs">
              <strong>Note:</strong> Your API token is stored securely and is only used to control your Soundtrack players.
              Keep your token confidential and don't share it with unauthorized users.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

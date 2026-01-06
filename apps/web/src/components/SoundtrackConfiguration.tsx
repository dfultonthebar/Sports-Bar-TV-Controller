

'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { logger } from '@sports-bar/logger'
import { 
  Music2, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Key,
  Trash2,
  RotateCcw
} from 'lucide-react'

interface SoundtrackPlayer {
  id: string
  playerId: string
  playerName: string
  accountId?: string
  bartenderVisible: boolean
  displayOrder: number
}

interface SoundtrackConfig {
  id: string
  apiKey: string
  accountId?: string
  accountName?: string
  status: string
  lastTested?: string
}

export default function SoundtrackConfiguration() {
  const [config, setConfig] = useState<SoundtrackConfig | null>(null)
  const [players, setPlayers] = useState<SoundtrackPlayer[]>([])
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [confirmClearCache, setConfirmClearCache] = useState(false)

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/soundtrack/config')
      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
        setPlayers(data.players || [])
      } else if (response.status === 404) {
        // No config yet - that's ok
        setConfig(null)
        setPlayers([])
      } else {
        throw new Error('Failed to load configuration')
      }
    } catch (err: any) {
      logger.error('Error loading Soundtrack configuration:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const saveApiKey = async () => {
    if (!apiKey.trim()) {
      setError('Please enter an API token')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/soundtrack/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save API token')
      }

      const data = await response.json()
      setConfig(data.config)
      setSuccess('API token saved successfully! Loading sound zones...')
      setApiKey('')
      
      // Reload to get updated players
      setTimeout(() => {
        loadConfiguration()
        setSuccess(null)
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteConfiguration = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }

    try {
      setDeleting(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/soundtrack/config', {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete configuration')
      }

      setConfig(null)
      setPlayers([])
      setSuccess('Configuration deleted successfully')
      setConfirmDelete(false)
      
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const clearTokenCache = async () => {
    if (!confirmClearCache) {
      setConfirmClearCache(true)
      return
    }

    try {
      setClearingCache(true)
      setError(null)
      setSuccess(null)

      const response = await fetch('/api/soundtrack/cache', {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to clear token cache')
      }

      const data = await response.json()
      setSuccess(data.message || 'Token cache cleared successfully!')
      setConfirmClearCache(false)
      
      // Reload configuration to show updated status
      setTimeout(() => {
        loadConfiguration()
        setSuccess(null)
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setClearingCache(false)
    }
  }

  const togglePlayerVisibility = async (player: SoundtrackPlayer) => {
    try {
      const response = await fetch('/api/soundtrack/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.playerId,
          bartenderVisible: !player.bartenderVisible
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update player visibility')
      }

      // Update local state
      setPlayers(players.map(p => 
        p.playerId === player.playerId 
          ? { ...p, bartenderVisible: !p.bartenderVisible }
          : p
      ))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const updateDisplayOrder = async (player: SoundtrackPlayer, newOrder: number) => {
    try {
      const response = await fetch('/api/soundtrack/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.playerId,
          displayOrder: newOrder
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update display order')
      }

      // Update local state
      setPlayers(players.map(p => 
        p.playerId === player.playerId 
          ? { ...p, displayOrder: newOrder }
          : p
      ).sort((a, b) => a.displayOrder - b.displayOrder))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const runDiagnostics = async () => {
    try {
      setDiagnosing(true)
      setError(null)
      setDiagnosticResult(null)

      const response = await fetch('/api/soundtrack/diagnose')
      const data = await response.json()
      
      setDiagnosticResult(data)
      
      if (!data.success) {
        setError(data.message || 'Diagnostic test failed')
      } else {
        setSuccess('Connection successful!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      setError('Failed to run diagnostics: ' + err.message)
    } finally {
      setDiagnosing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-slate-800 rounded-lg p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-3" />
            <span className="text-white">Loading Soundtrack configuration...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-sm rounded-lg p-6 border border-purple-800/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Music2 className="w-6 h-6 mr-3 text-purple-400" />
              Soundtrack Your Brand Configuration
            </h2>
            <p className="text-slate-300 mt-2">
              Configure your Soundtrack API integration and manage sound zones
            </p>
          </div>
          {config && (
            <Badge variant={config.status === 'active' ? 'default' : 'secondary'}>
              {config.status === 'active' ? 'Active' : config.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-4"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 flex items-start">
          <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-green-200 font-medium">Success</p>
            <p className="text-green-300 text-sm mt-1">{success}</p>
          </div>
          <button 
            onClick={() => setSuccess(null)}
            className="text-green-400 hover:text-green-300 ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* API Token Configuration */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center mb-4">
          <Key className="w-5 h-5 text-blue-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">API Token</h3>
        </div>

        {config ? (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Current Token</span>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  Configured
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <code className="text-slate-300 font-mono text-sm">
                  {config.apiKey}
                </code>
              </div>
              {config.accountName && (
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <span className="text-sm text-slate-400">Account: </span>
                  <span className="text-white font-medium">{config.accountName}</span>
                </div>
              )}
              {config.lastTested && (
                <div className="mt-2">
                  <span className="text-sm text-slate-400">Last Tested: </span>
                  <span className="text-slate-300 text-sm">
                    {new Date(config.lastTested).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={runDiagnostics}
                disabled={diagnosing}
                variant="outline"
                className="flex items-center"
              >
                {diagnosing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>

              <Button
                onClick={clearTokenCache}
                disabled={clearingCache}
                variant="outline"
                className="flex items-center border-yellow-600 text-yellow-400 hover:bg-yellow-900/20"
              >
                {clearingCache ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {confirmClearCache ? 'Confirm Clear Cache?' : 'Clear Token Cache'}
                  </>
                )}
              </Button>

              {confirmClearCache && (
                <Button
                  onClick={() => setConfirmClearCache(false)}
                  variant="ghost"
                  className="text-slate-400"
                >
                  Cancel
                </Button>
              )}

              <Button
                onClick={deleteConfiguration}
                disabled={deleting}
                variant="outline"
                className="flex items-center border-red-600 text-red-400 hover:bg-red-900/20"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {confirmDelete ? 'Confirm Delete?' : 'Delete Configuration'}
                  </>
                )}
              </Button>

              {confirmDelete && (
                <Button
                  onClick={() => setConfirmDelete(false)}
                  variant="ghost"
                  className="text-slate-400"
                >
                  Cancel
                </Button>
              )}
            </div>

            {/* Cache Clear Info */}
            {confirmClearCache && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4 mt-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-yellow-200 font-medium">Clear Token Cache</p>
                    <p className="text-yellow-300 text-sm mt-1">
                      This will clear the cached authentication token and force fresh authentication on the next API request. 
                      Your API token will remain saved in the database, but the system will re-authenticate using it.
                    </p>
                    <p className="text-yellow-300 text-sm mt-2">
                      Use this if you're experiencing authentication issues or want to ensure you're using the latest token state.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Enter your Soundtrack Your Brand API Token
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API token..."
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        saveApiKey()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={saveApiKey}
                  disabled={saving || !apiKey.trim()}
                  className="flex items-center"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Token
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
              <p className="text-blue-200 text-sm">
                <strong>How to get your API token:</strong>
              </p>
              <ol className="text-blue-300 text-sm mt-2 space-y-1 list-decimal list-inside">
                <li>Log in to your Soundtrack Your Brand account</li>
                <li>Go to Settings → Integrations</li>
                <li>Create a new API token or copy an existing one</li>
                <li>Paste the token above and click Save</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Sound Zones / Players */}
      {config && players.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Music2 className="w-5 h-5 text-purple-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Sound Zones</h3>
            </div>
            <Badge variant="outline">
              {players.length} {players.length === 1 ? 'zone' : 'zones'}
            </Badge>
          </div>

          <div className="space-y-3">
            {players.map((player) => (
              <div
                key={player.id}
                className="bg-slate-900 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{player.playerName}</h4>
                    <p className="text-slate-400 text-sm mt-1">
                      Player ID: {player.playerId}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm text-slate-400">Order:</label>
                      <input
                        type="number"
                        value={player.displayOrder}
                        onChange={(e) => updateDisplayOrder(player, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      />
                    </div>
                    <Button
                      onClick={() => togglePlayerVisibility(player)}
                      variant="outline"
                      size="sm"
                      className={player.bartenderVisible ? 'border-green-600 text-green-400' : ''}
                    >
                      {player.bartenderVisible ? (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-4 h-4 mr-2" />
                          Hidden
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-blue-200 text-sm">
              <strong>Bartender Visibility:</strong> Toggle which sound zones appear in the bartender remote control interface.
            </p>
          </div>
        </div>
      )}

      {/* Diagnostic Results */}
      {diagnosticResult && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Diagnostic Results</h3>
          <pre className="bg-slate-900 rounded-lg p-4 text-sm text-slate-300 overflow-x-auto">
            {JSON.stringify(diagnosticResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}


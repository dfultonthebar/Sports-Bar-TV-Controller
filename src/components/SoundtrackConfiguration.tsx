
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
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
  Trash2
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
      console.error('Error loading Soundtrack configuration:', err)
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
              <Music2 className="w-8 h-8 mr-3 text-purple-400" />
              Soundtrack Your Brand Configuration
            </h2>
            <p className="text-slate-300 mt-2">
              Configure music streaming and select which players bartenders can control
            </p>
          </div>
          <Button onClick={loadConfiguration} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-400 mr-3 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 flex items-center">
          <CheckCircle2 className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
          <span className="text-green-300">{success}</span>
        </div>
      )}

      {/* Diagnostic Results */}
      {diagnosticResult && !diagnosticResult.success && (
        <div className="bg-orange-900/30 border border-orange-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-orange-300 mb-3 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Connection Diagnostic Results
          </h4>
          <div className="space-y-3">
            <p className="text-orange-200">{diagnosticResult.message}</p>
            {diagnosticResult.recommendations && diagnosticResult.recommendations.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-orange-300 mb-2">Recommendations:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-orange-200">
                  {diagnosticResult.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Token Configuration */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2 text-blue-400" />
          API Token
        </h3>
        
        {config ? (
          <div className="space-y-4">
            <div className="bg-green-900/30 border border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-green-300 font-medium">API Token Configured</div>
                  <div className="text-sm text-green-400 mt-1">
                    Account: {config.accountName || 'Connected'}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Last tested: {config.lastTested ? new Date(config.lastTested).toLocaleString() : 'Never'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-green-800/50 text-green-200">
                    {config.status}
                  </Badge>
                  <Button
                    onClick={deleteConfiguration}
                    disabled={deleting}
                    variant={confirmDelete ? "destructive" : "outline"}
                    size="sm"
                    className={confirmDelete ? 'bg-red-600 hover:bg-red-700' : ''}
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : confirmDelete ? (
                      <>
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Click to Confirm
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </>
                    )}
                  </Button>
                  {confirmDelete && (
                    <Button
                      onClick={() => setConfirmDelete(false)}
                      variant="ghost"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="text-sm text-slate-400">
              <p>To update the API token, enter a new one below:</p>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-yellow-400 mr-3 flex-shrink-0" />
              <div className="text-yellow-300">
                <div className="font-medium">No API token configured</div>
                <div className="text-sm opacity-90 mt-1">
                  Get your API token from{' '}
                  <a 
                    href="https://api.soundtrackyourbrand.com/v2/docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-200"
                  >
                    Soundtrack Your Brand API Docs
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Soundtrack API token"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 pr-24"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && apiKey.trim()) {
                  saveApiKey()
                }
              }}
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            onClick={saveApiKey}
            disabled={saving || !apiKey.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving & Testing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save API Token
              </>
            )}
          </Button>

          <div className="text-xs text-slate-500 space-y-1">
            <p>• API token format: Base64-encoded credentials from Soundtrack dashboard</p>
            <p>• Request API access at: <a href="https://api.soundtrackyourbrand.com/v2/docs" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Soundtrack API Docs</a></p>
            <p>• The token will be encrypted and stored securely</p>
            <p>• Token format example: {apiKey.slice(0, 20) || 'eG5uYUR1U2hhQ0hGW...'}</p>
          </div>

          {config && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <Button
                onClick={runDiagnostics}
                disabled={diagnosing}
                variant="outline"
                className="w-full"
              >
                {diagnosing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running Diagnostics...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Test API Connection
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Troubleshoot connection issues with the Soundtrack API
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sound Zone Selection */}
      {config && players.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Music2 className="w-5 h-5 mr-2 text-purple-400" />
            Sound Zones
          </h3>
          
          <div className="mb-4 text-sm text-slate-400">
            <p>Select which sound zones bartenders can control from the remote interface.</p>
            <p className="mt-1">Sound zones will appear in the order you specify.</p>
          </div>

          <div className="space-y-3">
            {players.map((player, index) => (
              <div
                key={player.id}
                className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={player.displayOrder}
                        onChange={(e) => updateDisplayOrder(player, parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                        placeholder="#"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-medium text-white">{player.playerName}</div>
                      <div className="text-sm text-slate-500">ID: {player.playerId}</div>
                    </div>
                  </div>

                  <Button
                    onClick={() => togglePlayerVisibility(player)}
                    variant={player.bartenderVisible ? "default" : "outline"}
                    size="sm"
                    className={player.bartenderVisible ? 'bg-green-600 hover:bg-green-700' : ''}
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
            ))}
          </div>

          {players.filter(p => p.bartenderVisible).length === 0 && (
            <div className="mt-4 bg-yellow-900/30 border border-yellow-800 rounded-lg p-4">
              <div className="flex items-center text-yellow-300">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                <span className="text-sm">
                  No sound zones are visible to bartenders. Click "Visible" to enable at least one zone.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {config && players.length === 0 && (
        <div className="bg-slate-800 rounded-lg p-6 text-center">
          <Music2 className="w-16 h-16 mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400">No sound zones found in your Soundtrack account</p>
          <Button onClick={loadConfiguration} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Sound Zones
          </Button>
        </div>
      )}
    </div>
  )
}


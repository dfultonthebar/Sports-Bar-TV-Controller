'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Tv, Check, X, Cable, Satellite, Smartphone, Monitor } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface Provider {
  id?: string
  name: string
  type: 'cable' | 'satellite' | 'streaming' | 'iptv'
  channels: string[]
  packages: string[]
  inputIds?: string[]
}

const PROVIDER_TYPES = [
  { value: 'cable', label: 'Cable', icon: Cable },
  { value: 'satellite', label: 'Satellite', icon: Satellite },
  { value: 'streaming', label: 'Streaming', icon: Smartphone },
  { value: 'iptv', label: 'IPTV', icon: Monitor }
]

const getProviderIcon = (type: string) => {
  const providerType = PROVIDER_TYPES.find(pt => pt.value === type)
  const Icon = providerType?.icon || Tv
  return <Icon className="w-5 h-5" />
}

export default function TVProvidersManager() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [providers, setProviders] = useState<Provider[]>([])

  const [newProvider, setNewProvider] = useState<Provider>({
    name: '',
    type: 'cable',
    channels: [] as any[],
    packages: [] as any[],
    inputIds: [] as any[]
  })

  useEffect(() => {
    loadProviders()
  }, [])

  const loadProviders = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/sports-guide-config')
      const result = await response.json()

      if (result.success) {
        setProviders(result.data.providers || [])
      }
    } catch (error) {
      logger.error('[TVProvidersManager] Error loading providers:', error)
      setSaveMessage({ type: 'error', text: 'Failed to load providers' })
    } finally {
      setIsLoading(false)
    }
  }

  const addProvider = () => {
    if (newProvider.name.trim()) {
      setProviders([...providers, { ...newProvider }])
      setNewProvider({
        name: '',
        type: 'cable',
        channels: [] as any[],
        packages: [] as any[],
        inputIds: [] as any[]
      })
    }
  }

  const removeProvider = (index: number) => {
    setProviders(providers.filter((_, i) => i !== index))
  }

  const saveProviders = async () => {
    try {
      setIsSaving(true)
      setSaveMessage(null)

      // Read-modify-write: the POST endpoint deletes all providers and
      // homeTeams before rewriting them from the request body, so we must
      // fetch the current state and send it back alongside our local edits
      // to avoid wiping data owned by other admin tabs.
      const currentResponse = await fetch('/api/sports-guide-config')
      const currentData = await currentResponse.json()
      const currentConfig = currentData?.data?.configuration || {}
      const currentHomeTeams = currentData?.data?.homeTeams || []

      const response = await fetch('/api/sports-guide-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentConfig,
          providers,
          homeTeams: currentHomeTeams,
        })
      })

      const result = await response.json()

      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Providers saved successfully!' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save providers' })
      }
    } catch (error) {
      logger.error('[TVProvidersManager] Error saving providers:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save providers' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-slate-300">Loading providers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
          saveMessage.type === 'success'
            ? 'bg-green-900/30 border-green-500/50 text-green-200'
            : 'bg-red-900/30 border-red-500/50 text-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {saveMessage.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span>{saveMessage.text}</span>
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4">TV Providers</h2>
        <p className="text-sm text-slate-300 mb-6">
          Configure your cable, satellite, and streaming providers
        </p>

        {/* Add Provider Form */}
        <div className="bg-sportsBar-800/50 rounded-lg p-4 mb-6 border border-slate-700">
          <h3 className="text-lg font-medium text-slate-100 mb-4">Add New Provider</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Provider Name
              </label>
              <input
                type="text"
                value={newProvider.name}
                onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                placeholder="e.g., Comcast, DirecTV, YouTube TV"
                className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Provider Type
              </label>
              <select
                value={newProvider.type}
                onChange={(e) => setNewProvider({ ...newProvider, type: e.target.value as any })}
                className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PROVIDER_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={addProvider}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider</span>
          </button>
        </div>

        {/* Providers List */}
        <div className="space-y-3">
          {providers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Tv className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No providers configured yet</p>
            </div>
          ) : (
            providers.map((provider, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-sportsBar-800/30 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-600/20 rounded-lg p-2 border border-blue-500/30">
                    {getProviderIcon(provider.type)}
                  </div>
                  <div>
                    <div className="font-medium text-white">{provider.name}</div>
                    <div className="text-sm text-slate-400 capitalize">{provider.type}</div>
                  </div>
                </div>

                <button
                  onClick={() => removeProvider(index)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={saveProviders}
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? 'Saving...' : 'Save Providers'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Save, Check, X } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface Configuration {
  zipCode?: string
  city?: string
  state?: string
  timezone: string
  updateSchedule?: {
    enabled: boolean
    time: string
    frequency: 'daily' | 'weekly'
  }
}

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time - Arizona (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' }
]

export default function LocationConfigPanel() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const [config, setConfig] = useState<Configuration>({
    timezone: 'America/New_York',
    updateSchedule: {
      enabled: true,
      time: '06:00',
      frequency: 'daily'
    }
  })

  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      setIsLoading(true)
      // Load location/timezone from the sports-guide-config endpoint
      // AND the update schedule from its dedicated settings endpoint.
      // They live in different tables — see route comments for why.
      const [cfgResponse, scheduleResponse] = await Promise.all([
        fetch('/api/sports-guide-config'),
        fetch('/api/settings/update-schedule'),
      ])
      const cfgResult = await cfgResponse.json()
      const scheduleResult = await scheduleResponse.json()

      const loadedConfig: Configuration = {
        timezone: 'America/New_York',
        updateSchedule: { enabled: true, time: '06:00', frequency: 'daily' },
      }

      if (cfgResult.success && cfgResult.data?.configuration) {
        const c = cfgResult.data.configuration
        loadedConfig.zipCode = c.zipCode ?? undefined
        loadedConfig.city = c.city ?? undefined
        loadedConfig.state = c.state ?? undefined
        if (c.timezone) loadedConfig.timezone = c.timezone
      }

      if (scheduleResult.success && scheduleResult.schedule) {
        loadedConfig.updateSchedule = scheduleResult.schedule
      }

      setConfig(loadedConfig)
    } catch (error) {
      logger.error('[LocationConfigPanel] Error loading configuration:', error)
      setSaveMessage({ type: 'error', text: 'Failed to load configuration' })
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfiguration = async () => {
    try {
      setIsSaving(true)
      setSaveMessage(null)

      // Read-modify-write: the sports-guide-config POST endpoint deletes all
      // providers and homeTeams before rewriting them from the request body,
      // so we must fetch the current state and send it back alongside our
      // local edits to avoid wiping data owned by other admin tabs.
      const currentResponse = await fetch('/api/sports-guide-config')
      const currentData = await currentResponse.json()
      const currentProviders = currentData?.data?.providers || []
      const currentHomeTeams = currentData?.data?.homeTeams || []

      // Save location/timezone via the legacy config endpoint, and the
      // update schedule via its own dedicated settings endpoint. The legacy
      // endpoint silently drops updateSchedule (no DB column) so it is
      // intentionally not included in that body.
      const [configResponse, scheduleResponse] = await Promise.all([
        fetch('/api/sports-guide-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zipCode: config.zipCode,
            city: config.city,
            state: config.state,
            timezone: config.timezone,
            providers: currentProviders,
            homeTeams: currentHomeTeams,
          })
        }),
        fetch('/api/settings/update-schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config.updateSchedule || {
            enabled: true, time: '06:00', frequency: 'daily',
          })
        })
      ])

      const configResult = await configResponse.json()
      const scheduleResult = await scheduleResponse.json()

      if (configResult.success && scheduleResult.success) {
        setSaveMessage({ type: 'success', text: 'Configuration saved successfully!' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        const errMsg = configResult.error || scheduleResult.error || 'Failed to save configuration'
        setSaveMessage({ type: 'error', text: errMsg })
      }
    } catch (error) {
      logger.error('[LocationConfigPanel] Error saving configuration:', error)
      setSaveMessage({ type: 'error', text: 'Failed to save configuration' })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-slate-300">Loading configuration...</p>
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
        <h2 className="text-xl font-bold text-slate-100 mb-4">Location & Timezone</h2>
        <p className="text-sm text-slate-300 mb-6">
          Set your location for accurate local programming and game times
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={config.zipCode || ''}
                onChange={(e) => setConfig({ ...config, zipCode: e.target.value })}
                placeholder="12345"
                className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                City
              </label>
              <input
                type="text"
                value={config.city || ''}
                onChange={(e) => setConfig({ ...config, city: e.target.value })}
                placeholder="City"
                className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                State
              </label>
              <input
                type="text"
                value={config.state || ''}
                onChange={(e) => setConfig({ ...config, state: e.target.value })}
                placeholder="State"
                className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-2">
              Timezone
            </label>
            <select
              value={config.timezone}
              onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
              className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Update Schedule</h3>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="updateEnabled"
                  checked={config.updateSchedule?.enabled || false}
                  onChange={(e) => setConfig({
                    ...config,
                    updateSchedule: {
                      ...config.updateSchedule!,
                      enabled: e.target.checked
                    }
                  })}
                  className="w-5 h-5 rounded border-slate-600 bg-sportsBar-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="updateEnabled" className="text-sm font-medium text-slate-200">
                  Enable automatic guide updates
                </label>
              </div>

              {config.updateSchedule?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Update Time
                    </label>
                    <input
                      type="time"
                      value={config.updateSchedule?.time || '06:00'}
                      onChange={(e) => setConfig({
                        ...config,
                        updateSchedule: {
                          ...config.updateSchedule!,
                          time: e.target.value
                        }
                      })}
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Frequency
                    </label>
                    <select
                      value={config.updateSchedule?.frequency || 'daily'}
                      onChange={(e) => setConfig({
                        ...config,
                        updateSchedule: {
                          ...config.updateSchedule!,
                          frequency: e.target.value as 'daily' | 'weekly'
                        }
                      })}
                      className="w-full px-4 py-2 bg-sportsBar-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={saveConfiguration}
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

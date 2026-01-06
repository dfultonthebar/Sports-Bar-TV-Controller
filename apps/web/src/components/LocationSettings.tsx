'use client'

import { useState, useEffect } from 'react'
import {
  MapPin,
  Save,
  RefreshCw,
  GitBranch,
  Building2,
  Clock,
  CheckCircle,
  AlertCircle,
  Copy,
  Globe
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { logger } from '@sports-bar/logger'

interface LocationData {
  id: string
  name: string
  description: string
  address: string
  city: string
  state: string
  zipCode: string
  timezone: string
  gitBranch: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (MT - no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

export default function LocationSettings() {
  const [location, setLocation] = useState<LocationData>({
    id: '',
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    timezone: 'America/Chicago',
    gitBranch: '',
    isActive: true,
    createdAt: '',
    updatedAt: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [backupStatus, setBackupStatus] = useState<{ lastBackup: string | null, branch: string | null } | null>(null)
  const [backingUp, setBackingUp] = useState(false)

  useEffect(() => {
    loadLocation()
    loadBackupStatus()
  }, [])

  const loadLocation = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/location')
      const data = await response.json()

      if (response.ok && data.success && data.location) {
        setLocation(data.location)
      }
    } catch (error) {
      logger.error('Error loading location:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadBackupStatus = async () => {
    try {
      const response = await fetch('/api/location/backup-status')
      const data = await response.json()

      if (response.ok && data.success) {
        setBackupStatus(data)
      }
    } catch (error) {
      logger.error('Error loading backup status:', error)
    }
  }

  const saveLocation = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: 'Location saved successfully!' })
        if (data.location) {
          setLocation(data.location)
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save location' })
      }
    } catch (error) {
      logger.error('Error saving location:', error)
      setMessage({ type: 'error', text: 'Failed to save location' })
    } finally {
      setSaving(false)
    }
  }

  const triggerBackup = async () => {
    try {
      setMessage(null)
      setBackingUp(true)

      // First, save the location to ensure gitBranch is persisted
      if (!location.name) {
        setMessage({ type: 'error', text: 'Please enter a location name first' })
        setBackingUp(false)
        return
      }

      if (!location.gitBranch) {
        setMessage({ type: 'error', text: 'Please set a GitHub branch name first (click Generate)' })
        setBackingUp(false)
        return
      }

      // Save location first to persist gitBranch
      setMessage({ type: 'success', text: 'Step 1/3: Saving location settings...' })
      const saveResponse = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
      })

      const saveData = await saveResponse.json()
      if (!saveResponse.ok || !saveData.success) {
        setMessage({ type: 'error', text: 'Failed to save location: ' + (saveData.error || 'Unknown error') })
        setBackingUp(false)
        return
      }

      // Update local state with saved location (including ID if newly created)
      if (saveData.location) {
        setLocation(prev => ({ ...prev, ...saveData.location, gitBranch: prev.gitBranch }))
      }

      // Now trigger the backup
      setMessage({ type: 'success', text: 'Step 2/3: Exporting database tables...' })

      // Small delay to show message
      await new Promise(resolve => setTimeout(resolve, 500))

      setMessage({ type: 'success', text: 'Step 3/3: Pushing to GitHub...' })
      const response = await fetch('/api/location/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'backup' })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setMessage({ type: 'success', text: `Backup successful! Pushed to branch: ${location.gitBranch}` })
        await loadBackupStatus()
      } else {
        setMessage({ type: 'error', text: data.error || 'Backup failed' })
      }
    } catch (error) {
      logger.error('Error triggering backup:', error)
      setMessage({ type: 'error', text: 'Failed to trigger backup' })
    } finally {
      setBackingUp(false)
    }
  }

  const generateBranchName = () => {
    if (location.name) {
      const slug = location.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      setLocation(prev => ({ ...prev, gitBranch: `location/${slug}` }))
    }
  }

  const copyLocationId = () => {
    if (location.id) {
      navigator.clipboard.writeText(location.id)
      setMessage({ type: 'success', text: 'Location ID copied to clipboard!' })
      setTimeout(() => setMessage(null), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
        <span className="ml-3 text-slate-300">Loading location settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {/* Location Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" />
            Location Information
          </CardTitle>
          <CardDescription>
            Configure this installation's location details for multi-location deployment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location ID */}
          {location.id && (
            <div className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Location ID</p>
                <code className="text-sm text-blue-400 font-mono">{location.id}</code>
              </div>
              <button
                onClick={copyLocationId}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Copy Location ID"
              >
                <Copy className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          )}

          {/* Location Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Location Name *
            </label>
            <input
              type="text"
              value={location.name}
              onChange={(e) => setLocation(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Main Street Sports Bar"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <input
              type="text"
              value={location.description}
              onChange={(e) => setLocation(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Downtown location with 24 TVs"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={location.address}
              onChange={(e) => setLocation(prev => ({ ...prev, address: e.target.value }))}
              placeholder="e.g., 123 Main Street"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City, State, Zip */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                City
              </label>
              <input
                type="text"
                value={location.city}
                onChange={(e) => setLocation(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Milwaukee"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                State
              </label>
              <select
                value={location.state}
                onChange={(e) => setLocation(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                ZIP Code
              </label>
              <input
                type="text"
                value={location.zipCode}
                onChange={(e) => setLocation(prev => ({ ...prev, zipCode: e.target.value }))}
                placeholder="53202"
                maxLength={10}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Timezone
            </label>
            <select
              value={location.timezone}
              onChange={(e) => setLocation(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Backup Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-green-400" />
            GitHub Backup Configuration
          </CardTitle>
          <CardDescription>
            Configure automatic backup of this location's configuration to GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Git Branch */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              GitHub Branch Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={location.gitBranch}
                onChange={(e) => setLocation(prev => ({ ...prev, gitBranch: e.target.value }))}
                placeholder="e.g., location/main-street-bar"
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <button
                onClick={generateBranchName}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                title="Generate from location name"
              >
                Generate
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              This branch will store all configuration backups for this location
            </p>
          </div>

          {/* Backup Status */}
          {backupStatus && (
            <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
              <h4 className="text-sm font-medium text-slate-300">Backup Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Current Branch</p>
                  <p className="text-white font-mono">{backupStatus.branch || 'Not configured'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Last Backup</p>
                  <p className="text-white">
                    {backupStatus.lastBackup
                      ? new Date(backupStatus.lastBackup).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Backup Now Button */}
          <button
            onClick={triggerBackup}
            disabled={!location.gitBranch || backingUp}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {backingUp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Backing up...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Save & Backup to GitHub
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* What Gets Backed Up */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            What Gets Backed Up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <h4 className="font-medium text-red-400 mb-2">Critical (Every Change)</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Matrix configurations</li>
                <li>• Audio processors & zones</li>
                <li>• Device inventory (FireTV, IR)</li>
                <li>• Learned IR codes</li>
              </ul>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <h4 className="font-medium text-yellow-400 mb-2">High (Daily)</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Channel presets</li>
                <li>• Home teams</li>
                <li>• Schedules</li>
                <li>• AI venue profile</li>
              </ul>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h4 className="font-medium text-blue-400 mb-2">Medium (Weekly)</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Device mappings</li>
                <li>• Audio scenes</li>
                <li>• Team name matches</li>
                <li>• Soundtrack config</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={saveLocation}
          disabled={saving || !location.name}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Location Settings
            </>
          )}
        </button>
      </div>
    </div>
  )
}

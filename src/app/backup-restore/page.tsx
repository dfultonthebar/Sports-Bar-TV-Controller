
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Upload, Trash2, Clock, HardDrive, AlertCircle, CheckCircle } from 'lucide-react'

interface Backup {
  filename: string
  size: number
  created: string
  timestamp: string
}

export default function BackupRestorePage() {
  const router = useRouter()
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backupDir, setBackupDir] = useState('')

  useEffect(() => {
    loadBackups()
  }, [])

  const loadBackups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/backup')
      const data = await response.json()
      
      if (response.ok) {
        setBackups(data.backups || [])
        setBackupDir(data.backupDir || '')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load backups' })
      }
    } catch (error) {
      console.error('Error loading backups:', error)
      setMessage({ type: 'error', text: 'Failed to load backups' })
    } finally {
      setLoading(false)
    }
  }

  const createBackup = async () => {
    try {
      setProcessing(true)
      setMessage(null)
      
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Backup created successfully!' })
        await loadBackups()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create backup' })
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      setMessage({ type: 'error', text: 'Failed to create backup' })
    } finally {
      setProcessing(false)
    }
  }

  const restoreBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore from "${filename}"?\n\nThis will replace your current configuration. A safety backup will be created first.`)) {
      return
    }

    try {
      setProcessing(true)
      setMessage(null)

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', filename }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: 'Backup restored successfully! Please restart the application for changes to take effect.' 
        })
        await loadBackups()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to restore backup' })
      }
    } catch (error) {
      console.error('Error restoring backup:', error)
      setMessage({ type: 'error', text: 'Failed to restore backup' })
    } finally {
      setProcessing(false)
    }
  }

  const deleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`)) {
      return
    }

    try {
      setProcessing(true)
      setMessage(null)

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', filename }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Backup deleted successfully' })
        await loadBackups()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete backup' })
      }
    } catch (error) {
      console.error('Error deleting backup:', error)
      setMessage({ type: 'error', text: 'Failed to delete backup' })
    } finally {
      setProcessing(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 rounded-lg bg-sportsBar-700/50 hover:bg-sportsBar-600/50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-200" />
              </button>
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <HardDrive className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">Backup & Restore</h1>
                <p className="text-sm text-slate-300">Manage system configuration backups</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info Box */}
        <div className="card mb-6">
          <div className="p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-slate-100 mb-2">About Backups</h3>
                <p className="text-slate-300 text-sm mb-2">
                  Backups include: Configuration files, environment variables, database, API keys, subscriptions, and device settings.
                </p>
                <p className="text-slate-400 text-xs">
                  Backup location: <code className="bg-sportsBar-900/50 px-2 py-0.5 rounded">{backupDir}</code>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`card mb-6 ${message.type === 'success' ? 'border-green-500/50' : 'border-red-500/50'}`}>
            <div className="p-4">
              <div className="flex items-start space-x-3">
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                )}
                <p className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                  {message.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create Backup Button */}
        <div className="card mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 mb-1">Create New Backup</h2>
                <p className="text-sm text-slate-400">
                  Manual backup of current system configuration
                </p>
              </div>
              <button
                onClick={createBackup}
                disabled={processing}
                className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span>{processing ? 'Creating...' : 'Create Backup'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Backups List */}
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Recent Backups (Last 6)</h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-400"></div>
                <p className="text-slate-400 mt-2">Loading backups...</p>
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8">
                <HardDrive className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No backups found</p>
                <p className="text-slate-500 text-sm mt-1">Create your first backup to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {backups.map((backup, index) => (
                  <div
                    key={backup.filename}
                    className="bg-sportsBar-700/50 rounded-lg p-4 border border-sportsBar-600/50 hover:bg-sportsBar-700/70 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Clock className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-200 font-medium">
                            {backup.timestamp || formatDate(backup.created)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-slate-400">
                          <span>{formatSize(backup.size)}</span>
                          <span className="text-slate-500">•</span>
                          <span className="font-mono text-xs">{backup.filename}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => restoreBackup(backup.filename)}
                          disabled={processing}
                          className="px-4 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => deleteBackup(backup.filename)}
                          disabled={processing}
                          className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Auto-Backup Info */}
        <div className="card mt-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Automatic Backups</h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                <span>Automatic backup created before every system update from GitHub</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                <span>Safety backup created before each restore operation</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5" />
                <span>Old backups automatically cleaned up (keeps last 10)</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

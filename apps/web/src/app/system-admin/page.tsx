'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  FileText,
  HardDrive,
  GitBranch,
  Activity,
  ArrowLeft,
  Download,
  Upload,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  RefreshCw,
  Filter,
  XCircle,
  Power,
  ListTodo,
  LayoutGrid,
  MapPin,
  Calendar,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LogAnalyticsDashboard from '@/components/LogAnalyticsDashboard'
import GitHubConfigSync from '@/components/GitHubConfigSync'
import SystemControlPanel from '@/components/SystemControlPanel'
import TodoList from '@/components/TodoList'
import TodoForm from '@/components/TodoForm'
import TodoDetails from '@/components/TodoDetails'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/cards'
import { Badge } from '@/components/ui/badge'
import SportsBarLayout from '@/components/SportsBarLayout'
import { SystemResourceMonitor } from '@/components/system/SystemResourceMonitor'
import LocationSettings from '@/components/LocationSettings'
import { SchedulerLogsDashboard } from '@/components/SchedulerLogsDashboard'
import { SystemLogsViewer } from '@/components/SystemLogsViewer'

import { logger } from '@sports-bar/logger'
interface Backup {
  filename: string
  size: number
  created: string
  timestamp: string
}

interface TestLog {
  id: string
  testType: string
  testName: string
  status: string
  inputChannel?: number
  outputChannel?: number
  command?: string
  response?: string
  errorMessage?: string
  duration?: number
  timestamp: string
  metadata?: string
}

interface TestResult {
  input: number
  inputLabel: string
  output: number
  outputLabel: string
  success: boolean
  response?: string
  error?: string
  duration: number
  logId: string
}

interface TestSummary {
  totalTests: number
  successCount: number
  failureCount: number
  successRate: string
  duration: number
}

export default function SystemAdminPage() {
  // Backup state
  const [backups, setBackups] = useState<Backup[]>([])
  const [loadingBackups, setLoadingBackups] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [backupDir, setBackupDir] = useState('')

  // Tests state
  const [isConnectionTesting, setIsConnectionTesting] = useState(false)
  const [isSwitchingTesting, setIsSwitchingTesting] = useState(false)
  const [connectionResult, setConnectionResult] = useState<any>(null)
  const [switchingResult, setSwitchingResult] = useState<any>(null)
  const [logs, setLogs] = useState<TestLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<TestLog[]>([])
  const [filterTestType, setFilterTestType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  // TODO state
  const [todoView, setTodoView] = useState<'list' | 'form' | 'details'>('list')
  const [selectedTodo, setSelectedTodo] = useState<any>(null)
  const [todoRefreshTrigger, setTodoRefreshTrigger] = useState(0)

  useEffect(() => {
    loadBackups()
    loadLogs()
  }, [])

  useEffect(() => {
    let filtered = logs

    if (filterTestType !== 'all') {
      filtered = filtered.filter(log => log.testType === filterTestType)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => log.status === filterStatus)
    }

    setFilteredLogs(filtered)
  }, [logs, filterTestType, filterStatus])

  const loadBackups = async () => {
    try {
      setLoadingBackups(true)
      const response = await fetch('/api/backup')
      const data = await response.json()
      
      if (response.ok) {
        setBackups(data.backups || [])
        setBackupDir(data.backupDir || '')
      } else {
        setBackupMessage({ type: 'error', text: data.error || 'Failed to load backups' })
      }
    } catch (error) {
      logger.error('Error loading backups:', error)
      setBackupMessage({ type: 'error', text: 'Failed to load backups' })
    } finally {
      setLoadingBackups(false)
    }
  }

  const createBackup = async () => {
    try {
      setProcessing(true)
      setBackupMessage(null)
      
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })

      const data = await response.json()

      if (response.ok) {
        setBackupMessage({ type: 'success', text: 'Backup created successfully!' })
        await loadBackups()
      } else {
        setBackupMessage({ type: 'error', text: data.error || 'Failed to create backup' })
      }
    } catch (error) {
      logger.error('Error creating backup:', error)
      setBackupMessage({ type: 'error', text: 'Failed to create backup' })
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
      setBackupMessage(null)

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', filename }),
      })

      const data = await response.json()

      if (response.ok) {
        setBackupMessage({ 
          type: 'success', 
          text: 'Backup restored successfully! Please restart the application for changes to take effect.' 
        })
        await loadBackups()
      } else {
        setBackupMessage({ type: 'error', text: data.error || 'Failed to restore backup' })
      }
    } catch (error) {
      logger.error('Error restoring backup:', error)
      setBackupMessage({ type: 'error', text: 'Failed to restore backup' })
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
      setBackupMessage(null)

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', filename }),
      })

      const data = await response.json()

      if (response.ok) {
        setBackupMessage({ type: 'success', text: 'Backup deleted successfully' })
        await loadBackups()
      } else {
        setBackupMessage({ type: 'error', text: data.error || 'Failed to delete backup' })
      }
    } catch (error) {
      logger.error('Error deleting backup:', error)
      setBackupMessage({ type: 'error', text: 'Failed to delete backup' })
    } finally {
      setProcessing(false)
    }
  }

  const loadLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const response = await fetch('/api/tests/logs?limit=200')
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
      }
    } catch (error) {
      logger.error('Error loading logs:', error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const testConnection = async () => {
    setIsConnectionTesting(true)
    setConnectionResult(null)
    
    try {
      const response = await fetch('/api/tests/wolfpack/connection', {
        method: 'POST'
      })
      const data = await response.json()
      setConnectionResult(data)
      await loadLogs()
    } catch (error) {
      setConnectionResult({ 
        success: false, 
        error: String(error) 
      })
    } finally {
      setIsConnectionTesting(false)
    }
  }

  const testSwitching = async () => {
    setIsSwitchingTesting(true)
    setSwitchingResult(null)
    
    try {
      const response = await fetch('/api/tests/wolfpack/switching', {
        method: 'POST'
      })
      const data = await response.json()
      setSwitchingResult(data)
      await loadLogs()
    } catch (error) {
      setSwitchingResult({ 
        success: false, 
        error: String(error) 
      })
    } finally {
      setIsSwitchingTesting(false)
    }
  }

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to delete all test logs?')) {
      return
    }

    try {
      const response = await fetch('/api/tests/logs', {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setLogs([])
        alert(data.message)
      }
    } catch (error) {
      logger.error('Error clearing logs:', error)
      alert('Failed to clear logs')
    }
  }

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `test-logs-${new Date().toISOString()}.json`
    link.click()
    URL.revokeObjectURL(url)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'failed':
      case 'error':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'running':
        return <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
      case 'partial':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      default:
        return <Clock className="w-5 h-5 text-slate-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-400 bg-green-400/10'
      case 'failed':
      case 'error':
        return 'text-red-400 bg-red-400/10'
      case 'running':
        return 'text-blue-400 bg-blue-400/10'
      case 'partial':
        return 'text-yellow-400 bg-yellow-400/10'
      default:
        return 'text-slate-400 bg-slate-400/10'
    }
  }

  return (
    <div className="min-h-screen bg-sports-gradient">
      <header className="sports-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link 
                href="/"
                className="p-2 rounded-lg bg-sportsBar-700/50 hover:bg-sportsBar-600/50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-200" />
              </Link>
              <div className="bg-primary-gradient rounded-xl p-2.5 shadow-lg">
                <Settings className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-100">System Admin Hub</h1>
                <p className="text-sm text-slate-300">Unified System Management & Monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="power" className="space-y-6">
          <TabsList className="grid w-full grid-cols-9 bg-sportsBar-800/50 p-1">
            <TabsTrigger value="power" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Power className="w-4 h-4 mr-2" />
              Power
            </TabsTrigger>
            <TabsTrigger value="location" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <MapPin className="w-4 h-4 mr-2" />
              Location
            </TabsTrigger>
            <TabsTrigger value="layout" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <LayoutGrid className="w-4 h-4 mr-2" />
              Layout
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-2" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="scheduler" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Scheduler
            </TabsTrigger>
            <TabsTrigger value="backup" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <HardDrive className="w-4 h-4 mr-2" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="sync" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <GitBranch className="w-4 h-4 mr-2" />
              Sync
            </TabsTrigger>
            <TabsTrigger value="tests" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Tests
            </TabsTrigger>
            <TabsTrigger value="todos" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <ListTodo className="w-4 h-4 mr-2" />
              TODOs
            </TabsTrigger>
          </TabsList>

          {/* Power Controls Tab */}
          <TabsContent value="power" className="space-y-6">
            <SystemResourceMonitor />
            <SystemControlPanel />
          </TabsContent>

          {/* Location Tab */}
          <TabsContent value="location" className="space-y-6">
            <LocationSettings />
          </TabsContent>

          {/* Layout Editor Tab */}
          <TabsContent value="layout" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5" />
                  TV Layout Editor
                </CardTitle>
                <CardDescription>
                  Upload, edit, and configure your bar's TV floor plan layout
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-3">Layout Management</h3>
                  <p className="text-slate-300 mb-4">
                    Access the full-featured Layout Editor to upload your bar's floor plan, automatically detect TV positions using AI, and manually adjust zones with drag-and-drop.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-slate-700/50 rounded-lg">
                      <h4 className="font-medium text-green-300 mb-2">✨ Features</h4>
                      <ul className="text-sm text-slate-300 space-y-1">
                        <li>• Upload floor plan images (PNG, JPG, PDF)</li>
                        <li>• AI-powered TV detection</li>
                        <li>• Drag & drop positioning</li>
                        <li>• Draw custom zones</li>
                        <li>• Edit labels and outputs</li>
                      </ul>
                    </div>

                    <div className="p-4 bg-slate-700/50 rounded-lg">
                      <h4 className="font-medium text-blue-300 mb-2">📊 Current Status</h4>
                      <ul className="text-sm text-slate-300 space-y-1">
                        <li>• 24 TVs configured</li>
                        <li>• All zones positioned</li>
                        <li>• Wolf Pack outputs mapped</li>
                        <li>• Layout active on /remote</li>
                      </ul>
                    </div>
                  </div>

                  <Link
                    href="/layout-editor"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Open Layout Editor
                  </Link>

                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-400">
                      💡 <strong>Tip:</strong> After editing, your layout appears immediately on the /remote page's Video tab
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <SystemLogsViewer />
            <div className="border-t border-slate-700 pt-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                Log Analytics
              </h3>
              <LogAnalyticsDashboard />
            </div>
          </TabsContent>

          {/* Scheduler Tab */}
          <TabsContent value="scheduler" className="space-y-6">
            <SchedulerLogsDashboard />
          </TabsContent>

          {/* Backup/Restore Tab */}
          <TabsContent value="backup" className="space-y-6">
            {/* Info Box */}
            <div className="card">
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
            {backupMessage && (
              <div className={`card ${backupMessage.type === 'success' ? 'border-green-500/50' : 'border-red-500/50'}`}>
                <div className="p-4">
                  <div className="flex items-start space-x-3">
                    {backupMessage.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                    )}
                    <p className={`text-sm ${backupMessage.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                      {backupMessage.text}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Create Backup Button */}
            <div className="card">
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

                {loadingBackups ? (
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
            <div className="card">
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
          </TabsContent>

          {/* Config Sync Tab */}
          <TabsContent value="sync" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-600" />
                  GitHub Configuration Sync
                </CardTitle>
                <CardDescription>
                  Manage and sync your Sports Bar configurations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🚀 Configuration Sync Overview</CardTitle>
                <CardDescription>
                  Your Sports Bar AI Assistant configurations are automatically tracked and can be synced to GitHub
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">📊 Tracked Configurations</h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Matrix routing settings</li>
                      <li>• Audio zone configurations</li>
                      <li>• IR device mappings</li>
                      <li>• DirectTV device settings</li>
                      <li>• TV layout positions</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-900 mb-2">⚡ Auto-Sync Features</h4>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• Real-time change detection</li>
                      <li>• Automatic commit generation</li>
                      <li>• Smart conflict resolution</li>
                      <li>• Rollback capabilities</li>
                      <li>• Version history tracking</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-2">🔄 Sync Benefits</h4>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• Configuration backup</li>
                      <li>• Multi-location sync</li>
                      <li>• Change auditing</li>
                      <li>• Team collaboration</li>
                      <li>• Disaster recovery</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <GitHubConfigSync />
          </TabsContent>

          {/* Tests Tab */}
          <TabsContent value="tests" className="space-y-6">
            {/* Wolf Pack Connection Test */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Wolf Pack Connection Test</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Test connectivity to the Wolf Pack matrix switcher
                  </p>
                </div>
                <button
                  onClick={testConnection}
                  disabled={isConnectionTesting}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isConnectionTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run Test</span>
                    </>
                  )}
                </button>
              </div>

              {connectionResult && (
                <div className={`p-4 rounded-lg ${
                  connectionResult.success 
                    ? 'bg-green-400/10 border border-green-400/20' 
                    : 'bg-red-400/10 border border-red-400/20'
                }`}>
                  <div className="flex items-start space-x-3">
                    {connectionResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        connectionResult.success ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {connectionResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </p>
                      <p className="text-sm text-slate-300 mt-1">
                        {connectionResult.message || connectionResult.error}
                      </p>
                      {connectionResult.config && (
                        <div className="text-xs text-slate-400 mt-2 space-y-1">
                          <p>IP: {connectionResult.config.ipAddress}</p>
                          <p>Port: {connectionResult.config.port}</p>
                          <p>Protocol: {connectionResult.config.protocol}</p>
                          {connectionResult.duration && (
                            <p>Duration: {connectionResult.duration}ms</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wolf Pack Switching Test */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Wolf Pack Switching Test</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Test all input/output combinations on active channels
                  </p>
                </div>
                <button
                  onClick={testSwitching}
                  disabled={isSwitchingTesting}
                  className="btn-primary flex items-center space-x-2"
                >
                  {isSwitchingTesting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Run Full Test</span>
                    </>
                  )}
                </button>
              </div>

              {isSwitchingTesting && (
                <div className="bg-blue-400/10 border border-blue-400/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                    <div>
                      <p className="font-medium text-blue-400">Test in Progress</p>
                      <p className="text-sm text-slate-300 mt-1">
                        Testing all input/output combinations. This may take several minutes...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {switchingResult && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className={`p-4 rounded-lg ${
                    switchingResult.success 
                      ? 'bg-green-400/10 border border-green-400/20' 
                      : 'bg-yellow-400/10 border border-yellow-400/20'
                  }`}>
                    <div className="flex items-start space-x-3">
                      {switchingResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className={`font-medium ${
                          switchingResult.success ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {switchingResult.summary || switchingResult.message}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
                          <div>
                            <p className="text-xs text-slate-400">Total Tests</p>
                            <p className="text-lg font-bold text-slate-100">
                              {switchingResult.totalTests}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Passed</p>
                            <p className="text-lg font-bold text-green-400">
                              {switchingResult.passedTests}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Failed</p>
                            <p className="text-lg font-bold text-red-400">
                              {switchingResult.failedTests}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Success Rate</p>
                            <p className="text-lg font-bold text-slate-100">
                              {switchingResult.successRate}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Avg Duration</p>
                            <p className="text-lg font-bold text-slate-100">
                              {switchingResult.averageDuration}ms
                            </p>
                          </div>
                        </div>
                        {switchingResult.duration && (
                          <p className="text-xs text-slate-400 mt-2">
                            Total Duration: {switchingResult.duration}ms
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Results */}
                  {switchingResult.results && switchingResult.results.length > 0 && (
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-slate-300 mb-3">
                        Detailed Results ({switchingResult.results.length} tests)
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {switchingResult.results.map((result: TestResult, index: number) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg flex items-center justify-between ${
                              result.success 
                                ? 'bg-green-400/5 border border-green-400/10' 
                                : 'bg-red-400/5 border border-red-400/10'
                            }`}>
                            <div className="flex items-center space-x-3 flex-1">
                              {result.success ? (
                                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-200">
                                  Input {result.input} ({result.inputLabel}) → Output {result.output} ({result.outputLabel})
                                </p>
                                {result.error && (
                                  <p className="text-xs text-red-400 mt-1 truncate">{result.error}</p>
                                )}
                                {result.response && !result.error && (
                                  <p className="text-xs text-green-400 mt-1 truncate">{result.response}</p>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 ml-3 flex-shrink-0">
                              {result.duration}ms
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Test Logs */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-100">Test Logs</h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadLogs}
                    disabled={isLoadingLogs}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={exportLogs}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </button>
                  <button
                    onClick={clearLogs}
                    className="btn-secondary flex items-center space-x-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={filterTestType}
                    onChange={(e) => setFilterTestType(e.target.value)}
                    className="input-field text-sm py-1"
                  >
                    <option value="all">All Test Types</option>
                    <option value="wolfpack_connection">Connection Tests</option>
                    <option value="wolfpack_switching">Switching Tests</option>
                  </select>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input-field text-sm py-1"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="error">Error</option>
                  <option value="running">Running</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {/* Logs Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                        Test Name
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                        Details
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                        Duration
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400">
                          {isLoadingLogs ? 'Loading logs...' : 'No logs found'}
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(log.status)}
                              <span className={`text-xs px-2 py-1 rounded ${getStatusColor(log.status)}`}>
                                {log.status}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <p className="text-sm text-slate-200">{log.testName}</p>
                            <p className="text-xs text-slate-400">{log.testType}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs text-slate-300 space-y-1">
                              {log.inputChannel && log.outputChannel && (
                                <p>Input {log.inputChannel} → Output {log.outputChannel}</p>
                              )}
                              {log.command && (
                                <p className="text-slate-400">Command: {log.command}</p>
                              )}
                              {log.errorMessage && (
                                <p className="text-red-400">{log.errorMessage}</p>
                              )}
                              {log.response && !log.errorMessage && (
                                <p className="text-green-400">{log.response}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-300">
                            {log.duration ? `${log.duration}ms` : '-'}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-400">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredLogs.length > 0 && (
                <div className="mt-4 text-sm text-slate-400 text-center">
                  Showing {filteredLogs.length} of {logs.length} logs
                </div>
              )}
            </div>
          </TabsContent>

          {/* TODOs Tab */}
          <TabsContent value="todos" className="space-y-6">
            <div className="space-y-6">
              {todoView === 'list' && (
                <TodoList
                  onSelectTodo={(todo) => {
                    setSelectedTodo(todo)
                    setTodoView('details')
                  }}
                  onNewTodo={() => {
                    setSelectedTodo(null)
                    setTodoView('form')
                  }}
                  refreshTrigger={todoRefreshTrigger}
                />
              )}

              {todoView === 'form' && (
                <div className="card p-6">
                  <TodoForm
                    todo={selectedTodo}
                    onSave={() => {
                      setTodoView('list')
                      setSelectedTodo(null)
                      setTodoRefreshTrigger(prev => prev + 1)
                    }}
                    onCancel={() => {
                      setTodoView('list')
                      setSelectedTodo(null)
                    }}
                  />
                </div>
              )}

              {todoView === 'details' && selectedTodo && (
                <TodoDetails
                  todoId={selectedTodo.id}
                  onEdit={() => setTodoView('form')}
                  onDelete={async () => {
                    if (confirm('Are you sure you want to delete this TODO?')) {
                      try {
                        const response = await fetch(`/api/todos/${selectedTodo.id}`, {
                          method: 'DELETE'
                        })
                        const result = await response.json()
                        if (result.success) {
                          setTodoView('list')
                          setSelectedTodo(null)
                          setTodoRefreshTrigger(prev => prev + 1)
                        }
                      } catch (error) {
                        logger.error('Error deleting todo:', error)
                        alert('Failed to delete TODO')
                      }
                    }
                  }}
                  onClose={() => {
                    setTodoView('list')
                    setSelectedTodo(null)
                  }}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

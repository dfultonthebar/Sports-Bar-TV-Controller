
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/cards'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Alert, AlertDescription } from './ui/alert'
import { 
  GitBranch,
  Upload,
  Settings,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  GitCommit,
  Zap,
  Eye
} from 'lucide-react'

interface ConfigChange {
  type: 'matrix' | 'audio' | 'ir' | 'tv' | 'directv' | 'general'
  description: string
  files: string[]
  metadata?: any
}

interface GitStatus {
  hasChanges: boolean
  hasUnpushedCommits: boolean
  branch: string
  status: string[]
  recentCommits: string[]
  unpushedCommits: string[]
}

interface AutoSyncConfig {
  enabled: boolean
  syncInterval: number
  autoCommitOnConfigChange: boolean
  monitoredPaths: string[]
  lastSync: string
}

export default function GitHubConfigSync() {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [autoSyncConfig, setAutoSyncConfig] = useState<AutoSyncConfig | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [lastOperation, setLastOperation] = useState<string>('')
  const [configChanges, setConfigChanges] = useState<ConfigChange[]>([])

  // Fetch git status and auto-sync config
  const fetchStatus = async () => {
    try {
      const [gitResponse, autoSyncResponse] = await Promise.all([
        fetch('/api/github/push-config'),
        fetch('/api/github/auto-config-sync')
      ])
      
      if (gitResponse.ok) {
        setGitStatus(await gitResponse.json())
      }
      
      if (autoSyncResponse.ok) {
        setAutoSyncConfig(await autoSyncResponse.json())
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  useEffect(() => {
    fetchStatus()
    
    // Auto-refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  // Detect common configuration changes
  useEffect(() => {
    if (gitStatus?.status) {
      const changes: ConfigChange[] = []
      
      gitStatus.status.forEach(statusLine => {
        const file = statusLine.substring(3) // Remove git status prefix
        
        if (file.includes('matrix-config')) {
          changes.push({
            type: 'matrix',
            description: 'Matrix configuration updated',
            files: [file]
          })
        } else if (file.includes('device-mappings')) {
          changes.push({
            type: 'general',
            description: 'Device mappings updated',
            files: [file]
          })
        } else if (file.includes('ir-devices')) {
          changes.push({
            type: 'ir',
            description: 'IR device configuration updated',
            files: [file]
          })
        } else if (file.includes('audio-zones')) {
          changes.push({
            type: 'audio',
            description: 'Audio zone configuration updated',
            files: [file]
          })
        } else if (file.includes('directv')) {
          changes.push({
            type: 'directv',
            description: 'DirecTV configuration updated',
            files: [file]
          })
        } else {
          changes.push({
            type: 'general',
            description: `Configuration file updated: ${file}`,
            files: [file]
          })
        }
      })
      
      setConfigChanges(changes)
    }
  }, [gitStatus])

  const handlePushChanges = async () => {
    setIsLoading(true)
    setLastOperation('Pushing configuration changes...')

    try {
      const response = await fetch('/api/github/push-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitMessage: commitMessage || undefined,
          configChanges,
          autoCommit: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setLastOperation(`✅ Successfully pushed changes. Commit: ${result.commit.hash}`)
        setCommitMessage('')
        await fetchStatus()
      } else {
        setLastOperation(`❌ Failed to push changes: ${result.message}`)
      }
    } catch (error) {
      setLastOperation(`❌ Error: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateAutoSync = async (updates: Partial<AutoSyncConfig>) => {
    try {
      const response = await fetch('/api/github/auto-config-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (response.ok) {
        await fetchStatus()
        setLastOperation('✅ Auto-sync configuration updated')
      }
    } catch (error) {
      setLastOperation(`❌ Failed to update auto-sync: ${error}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* GitHub Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            GitHub Configuration Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gitStatus && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={gitStatus.hasChanges ? 'destructive' : 'success'}>
                  {gitStatus.hasChanges ? 'Changes Pending' : 'Up to Date'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                <span className="font-medium">{gitStatus.branch}</span>
              </div>
              <div className="flex items-center gap-2">
                {gitStatus.hasUnpushedCommits && (
                  <Badge variant="warning">
                    {gitStatus.unpushedCommits.length} Unpushed
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Configuration Changes */}
          {configChanges.length > 0 && (
            <div className="space-y-2">
              <Label>Detected Configuration Changes:</Label>
              <div className="space-y-1">
                {configChanges.map((change, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Badge variant="outline">{change.type}</Badge>
                    <span className="text-sm">{change.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commit Message Input */}
          <div className="space-y-2">
            <Label htmlFor="commit-message">Commit Message (optional)</Label>
            <Textarea
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your configuration changes..."
              rows={3}
            />
          </div>

          {/* Push Button */}
          <div className="flex gap-2">
            <Button 
              onClick={handlePushChanges} 
              disabled={!gitStatus?.hasChanges || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isLoading ? 'Pushing...' : 'Push Configuration Changes'}
            </Button>
            
            <Button variant="outline" onClick={fetchStatus}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Last Operation Status */}
          {lastOperation && (
            <Alert>
              <AlertDescription>{lastOperation}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Auto-Sync Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Auto-Sync Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {autoSyncConfig && (
            <>
              <div className="flex items-center justify-between">
                <Label>Enable Auto-Sync</Label>
                <Switch
                  checked={autoSyncConfig.enabled}
                  onCheckedChange={(enabled) => handleUpdateAutoSync({ enabled })}
                />
              </div>

              <div className="space-y-2">
                <Label>Sync Interval (minutes)</Label>
                <Input
                  type="number"
                  value={autoSyncConfig.syncInterval}
                  onChange={(e) => handleUpdateAutoSync({ 
                    syncInterval: parseInt(e.target.value) || 30 
                  })}
                  min="5"
                  max="1440"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Auto-commit on configuration changes</Label>
                <Switch
                  checked={autoSyncConfig.autoCommitOnConfigChange}
                  onCheckedChange={(autoCommitOnConfigChange) => 
                    handleUpdateAutoSync({ autoCommitOnConfigChange })
                  }
                />
              </div>

              <div className="text-sm text-muted-foreground">
                Last sync: {new Date(autoSyncConfig.lastSync).toLocaleString()}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Commits */}
      {gitStatus?.recentCommits && gitStatus.recentCommits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="w-5 h-5" />
              Recent Commits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gitStatus.recentCommits.map((commit, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded text-sm font-mono">
                  <GitCommit className="w-3 h-3" />
                  {commit}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

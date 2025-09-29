
'use client'

import React, { useState, useEffect } from 'react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { 
  GitBranch,
  Upload,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react'

interface GitStatus {
  hasChanges: boolean
  hasUnpushedCommits: boolean
  branch: string
  status: string[]
  recentCommits: string[]
  unpushedCommits: string[]
}

interface ConfigSyncIndicatorProps {
  className?: string
  showQuickPush?: boolean
  onQuickPush?: () => void
}

export default function ConfigSyncIndicator({ 
  className = '', 
  showQuickPush = true, 
  onQuickPush 
}: ConfigSyncIndicatorProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchGitStatus = async () => {
    try {
      const response = await fetch('/api/github/push-config')
      if (response.ok) {
        const status = await response.json()
        setGitStatus(status)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching git status:', error)
    }
  }

  useEffect(() => {
    fetchGitStatus()
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchGitStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleQuickPush = async () => {
    if (!gitStatus?.hasChanges) return
    
    setIsLoading(true)
    try {
      const response = await fetch('/api/github/push-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitMessage: 'Quick configuration sync',
          configChanges: [],
          autoCommit: true
        })
      })

      if (response.ok) {
        await fetchGitStatus()
        onQuickPush?.()
      }
    } catch (error) {
      console.error('Error pushing changes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!gitStatus) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading git status...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Git Status Badge */}
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">{gitStatus.branch}</span>
        
        {gitStatus.hasChanges && (
          <Badge variant="destructive" className="text-xs">
            Changes
          </Badge>
        )}
        
        {gitStatus.hasUnpushedCommits && (
          <Badge variant="outline" className="text-xs text-orange-700">
            {gitStatus.unpushedCommits.length} Unpushed
          </Badge>
        )}
        
        {!gitStatus.hasChanges && !gitStatus.hasUnpushedCommits && (
          <Badge variant="secondary" className="text-xs text-green-700">
            <CheckCircle className="w-3 h-3 mr-1" />
            Clean
          </Badge>
        )}
      </div>

      {/* Quick Push Button */}
      {showQuickPush && gitStatus.hasChanges && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleQuickPush}
          disabled={isLoading}
          className="flex items-center gap-1 text-xs"
        >
          {isLoading ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
          Quick Push
        </Button>
      )}

      {/* Last Update Time */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>
          {lastUpdate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
    </div>
  )
}

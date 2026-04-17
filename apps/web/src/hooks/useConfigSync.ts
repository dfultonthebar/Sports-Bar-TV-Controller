
import { useState, useCallback } from 'react'

export interface ConfigChangeEvent {
  type: 'matrix' | 'audio' | 'ir' | 'tv' | 'directv' | 'general'
  file: string
  action: 'created' | 'modified' | 'deleted'
  timestamp: string
  checksum?: string
  previousChecksum?: string
  changes?: any
}

export interface UseConfigSyncReturn {
  trackChange: (type: ConfigChangeEvent['type'], file: string, changes: any, action?: ConfigChangeEvent['action']) => Promise<void>
  pushToGitHub: (commitMessage?: string, configChanges?: any[]) => Promise<{ success: boolean; message: string }>
  isTracking: boolean
  isPushing: boolean
  lastOperation: string | null
  error: string | null
}

export function useConfigSync(): UseConfigSyncReturn {
  const [isTracking, setIsTracking] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [lastOperation, setLastOperation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trackChange = useCallback(async (
    type: ConfigChangeEvent['type'],
    file: string,
    changes: any,
    action: ConfigChangeEvent['action'] = 'modified'
  ) => {
    setIsTracking(true)
    setError(null)
    
    try {
      const response = await fetch('/api/config/track-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, file, changes, action })
      })

      const result = await response.json()
      
      if (result.success) {
        setLastOperation(`Configuration change tracked: ${file}`)
      } else {
        throw new Error(result.error || 'Failed to track configuration change')
      }
    } catch (err: any) {
      setError(err.message)
      setLastOperation(`Error tracking change: ${err.message}`)
    } finally {
      setIsTracking(false)
    }
  }, [])

  const pushToGitHub = useCallback(async (
    commitMessage?: string,
    configChanges?: any[]
  ) => {
    setIsPushing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/github/push-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commitMessage,
          configChanges: configChanges || [],
          autoCommit: true
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setLastOperation(`Successfully pushed to GitHub: ${result.commit?.hash || 'latest'}`)
        return { success: true, message: result.message }
      } else {
        throw new Error(result.message || 'Failed to push to GitHub')
      }
    } catch (err: any) {
      setError(err.message)
      setLastOperation(`Error pushing to GitHub: ${err.message}`)
      return { success: false, message: err.message }
    } finally {
      setIsPushing(false)
    }
  }, [])

  return {
    trackChange,
    pushToGitHub,
    isTracking,
    isPushing,
    lastOperation,
    error
  }
}

// Helper function to automatically track and optionally push configuration changes
export function useAutoConfigSync() {
  const { trackChange, pushToGitHub, isTracking, isPushing } = useConfigSync()
  
  const trackAndPush = useCallback(async (
    type: ConfigChangeEvent['type'],
    file: string,
    changes: any,
    options: {
      commitMessage?: string
      autoPush?: boolean
      action?: ConfigChangeEvent['action']
    } = {}
  ) => {
    const { commitMessage, autoPush = false, action = 'modified' } = options
    
    // First track the change
    await trackChange(type, file, changes, action)
    
    // Optionally push to GitHub
    if (autoPush) {
      const finalCommitMessage = commitMessage || `Configuration update: ${type} - ${file}`
      return await pushToGitHub(finalCommitMessage, [{
        type,
        description: `Updated ${file}`,
        files: [file],
        metadata: changes
      }])
    }
    
    return { success: true, message: 'Change tracked successfully' }
  }, [trackChange, pushToGitHub])

  return {
    trackAndPush,
    isTracking,
    isPushing
  }
}

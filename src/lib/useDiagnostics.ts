
import { useState, useEffect, useCallback } from 'react'

interface DiagnosticsStatus {
  overallHealth: string
  activeIssues: number
  criticalIssues: number
  recentFixes: number
  uptime: number
  components: any[]
  recentChecks: any[]
  issues: any[]
  fixes: any[]
  patterns: any[]
  lastUpdated: string
}

export function useDiagnostics() {
  const [status, setStatus] = useState<DiagnosticsStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRunningCheck, setIsRunningCheck] = useState(false)
  const [isRunningDeep, setIsRunningDeep] = useState(false)
  const [isRunningHeal, setIsRunningHeal] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch('/api/diagnostics/status')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.data)
      } else {
        throw new Error(data.error || 'Failed to fetch diagnostics status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching diagnostics status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runLightCheck = async () => {
    try {
      setIsRunningCheck(true)
      setError(null)
      
      const response = await fetch('/api/diagnostics/light-check', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh status after check
        await fetchStatus()
      } else {
        throw new Error(data.error || 'Light check failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRunningCheck(false)
    }
  }

  const runDeepDiagnostics = async () => {
    try {
      setIsRunningDeep(true)
      setError(null)
      
      const response = await fetch('/api/diagnostics/deep', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh status after diagnostics
        await fetchStatus()
      } else {
        throw new Error(data.error || 'Deep diagnostics failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRunningDeep(false)
    }
  }

  const runSelfHeal = async () => {
    try {
      setIsRunningHeal(true)
      setError(null)
      
      const response = await fetch('/api/diagnostics/self-heal', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Refresh status after healing
        await fetchStatus()
      } else {
        throw new Error(data.error || 'Self-healing failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsRunningHeal(false)
    }
  }

  const refresh = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    fetchStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    
    return () => clearInterval(interval)
  }, [fetchStatus])

  return {
    status,
    isLoading,
    error,
    refresh,
    runLightCheck,
    runDeepDiagnostics,
    runSelfHeal,
    isRunningCheck,
    isRunningDeep,
    isRunningHeal
  }
}

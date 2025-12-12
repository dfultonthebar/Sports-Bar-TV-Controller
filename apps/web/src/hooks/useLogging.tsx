
'use client'

import React, { useCallback, useRef, useEffect } from 'react'
import { enhancedLogger } from '@/lib/enhanced-logger'

interface PerformanceTimer {
  [key: string]: number
}

export const useLogging = (componentName?: string) => {
  const performanceTimers = useRef<PerformanceTimer>({})

  const logUserAction = useCallback((action: string, details?: any, userId?: string) => {
    if (typeof window !== 'undefined') {
      // Send to backend for proper logging
      fetch('/api/logs/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          details,
          userId,
          component: componentName,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(console.error)
    }
  }, [componentName])

  const logError = useCallback((error: Error, context?: string, additionalDetails?: any) => {
    if (typeof window !== 'undefined') {
      fetch('/api/logs/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context: context || componentName,
          details: additionalDetails,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        })
      }).catch(console.error)
    }
  }, [componentName])

  const startPerformanceTimer = useCallback((operation: string) => {
    performanceTimers.current[operation] = Date.now()
  }, [])

  const endPerformanceTimer = useCallback((operation: string, metadata?: any) => {
    const startTime = performanceTimers.current[operation]
    if (startTime) {
      const duration = Date.now() - startTime
      delete performanceTimers.current[operation]
      
      if (typeof window !== 'undefined') {
        fetch('/api/logs/performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation,
            duration,
            metadata,
            component: componentName,
            timestamp: new Date().toISOString()
          })
        }).catch(console.error)
      }
      
      return duration
    }
    return 0
  }, [componentName])

  const logConfigChange = useCallback((setting: string, oldValue: any, newValue: any, userId?: string) => {
    if (typeof window !== 'undefined') {
      fetch('/api/logs/config-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: componentName,
          setting,
          oldValue,
          newValue,
          userId,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error)
    }
  }, [componentName])

  const logButtonClick = useCallback((buttonName: string, additionalData?: any) => {
    logUserAction('button_click', {
      button: buttonName,
      ...additionalData
    })
  }, [logUserAction])

  const logFormSubmit = useCallback((formName: string, formData?: any, success?: boolean) => {
    logUserAction('form_submit', {
      form: formName,
      data: formData,
      success
    })
  }, [logUserAction])

  const logNavigation = useCallback((from: string, to: string) => {
    logUserAction('navigation', {
      from,
      to,
      timestamp: Date.now()
    })
  }, [logUserAction])

  const logDeviceInteraction = useCallback((deviceType: string, deviceId: string, action: string, success: boolean, details?: any) => {
    if (typeof window !== 'undefined') {
      fetch('/api/logs/device-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceType,
          deviceId,
          action,
          success,
          details,
          component: componentName,
          timestamp: new Date().toISOString()
        })
      }).catch(console.error)
    }
  }, [componentName])

  return {
    logUserAction,
    logError,
    startPerformanceTimer,
    endPerformanceTimer,
    logConfigChange,
    logButtonClick,
    logFormSubmit,
    logNavigation,
    logDeviceInteraction
  }
}

// HOC for automatic component logging
export const withLogging = <P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) => {
  return function WrappedComponent(props: P) {
    const { logUserAction, logError } = useLogging(componentName)

    // Log component mount
    useEffect(() => {
      logUserAction('component_mount', { component: componentName })
      
      return () => {
        logUserAction('component_unmount', { component: componentName })
      }
    }, [logUserAction])

    // Global error boundary logging
    useEffect(() => {
      const handleError = (error: ErrorEvent) => {
        logError(new Error(error.message), 'window_error', {
          filename: error.filename,
          lineno: error.lineno,
          colno: error.colno
        })
      }

      window.addEventListener('error', handleError)
      return () => window.removeEventListener('error', handleError)
    }, [logError])

    return <Component {...props} />
  }
}

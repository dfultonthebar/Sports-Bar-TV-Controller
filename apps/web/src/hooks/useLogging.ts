

'use client'

import { useCallback, useRef } from 'react'
import { enhancedLogger } from '@/lib/enhanced-logger'

import { logger } from '@sports-bar/logger'
export interface LoggingHookOptions {
  component?: string
  sessionId?: string
  userId?: string
}

export function useLogging(component?: string, options?: LoggingHookOptions) {
  const performanceTimers = useRef<Map<string, number>>(new Map())
  const sessionId = useRef(Math.random().toString(36).substring(2, 15))

  // User action logging with enhanced tracking
  const logUserAction = useCallback(async (action: string, details?: any, metadata?: any) => {
    try {
      await enhancedLogger.logUserInteraction(
        action,
        {
          component: component || options?.component,
          details,
          metadata,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
        },
        options?.userId,
        sessionId.current
      )
    } catch (error) {
      logger.error('Failed to log user action:', error)
    }
  }, [component, options])

  // Button click logging with specific tracking
  const logButtonClick = useCallback(async (buttonId: string, buttonText?: string, context?: any) => {
    const actionDetails = {
      buttonId,
      buttonText,
      component,
      context,
      clickTime: Date.now(),
      position: context?.position || null
    }

    await logUserAction('button_click', actionDetails)
  }, [logUserAction, component])

  // Configuration change logging
  const logConfigChange = useCallback(async (
    setting: string, 
    oldValue: any, 
    newValue: any, 
    section?: string
  ) => {
    try {
      await enhancedLogger.logConfigurationChange(
        component || 'unknown',
        setting,
        oldValue,
        newValue,
        options?.userId
      )

      // Also log as user action for UI tracking
      await logUserAction('config_change', {
        setting,
        oldValue,
        newValue,
        section
      })
    } catch (error) {
      logger.error('Failed to log configuration change:', error)
    }
  }, [component, options?.userId, logUserAction])

  // Device interaction logging
  const logDeviceInteraction = useCallback(async (
    deviceType: string,
    deviceId: string,
    operation: string,
    success: boolean,
    responseTime?: number,
    details?: any
  ) => {
    try {
      await enhancedLogger.logHardwareOperation(
        deviceType as any,
        deviceId,
        operation,
        success,
        {
          ...details,
          component,
          triggeredBy: 'user_interaction'
        },
        responseTime
      )

      // Also log as user action
      await logUserAction('device_interaction', {
        deviceType,
        deviceId,
        operation,
        success,
        responseTime,
        details
      })
    } catch (error) {
      logger.error('Failed to log device interaction:', error)
    }
  }, [component, logUserAction])

  // Remote control specific logging
  const logRemoteControlAction = useCallback(async (
    action: 'input_change' | 'volume_adjust' | 'power_toggle' | 'channel_change' | 'guide_access',
    details: any
  ) => {
    const actionDetails = {
      ...details,
      actionType: action,
      component: 'BartenderRemote',
      timestamp: Date.now()
    }

    await logUserAction(`remote_${action}`, actionDetails)
  }, [logUserAction])

  // Channel guide interaction logging
  const logChannelGuideAction = useCallback(async (
    action: 'view_guide' | 'select_channel' | 'filter_content' | 'search' | 'bookmark',
    details: any
  ) => {
    const guideDetails = {
      ...details,
      guideAction: action,
      timestamp: Date.now(),
      currentTime: new Date().toISOString()
    }

    await logUserAction(`guide_${action}`, guideDetails)
  }, [logUserAction])

  // Performance timing
  const startPerformanceTimer = useCallback((operation: string) => {
    performanceTimers.current.set(operation, Date.now())
    return operation
  }, [])

  const endPerformanceTimer = useCallback(async (operation: string, metadata?: any) => {
    const startTime = performanceTimers.current.get(operation)
    if (!startTime) return 0

    const duration = Date.now() - startTime
    performanceTimers.current.delete(operation)

    try {
      await enhancedLogger.logPerformanceMetric(operation, duration, {
        component,
        ...metadata
      })
    } catch (error) {
      logger.error('Failed to log performance metric:', error)
    }

    return duration
  }, [component])

  // Error logging with context
  const logError = useCallback(async (error: Error, context?: string, details?: any) => {
    try {
      await enhancedLogger.error(
        'system',
        component || context || 'unknown',
        'error_occurred',
        error.message,
        {
          name: error.name,
          stack: error.stack,
          details,
          component,
          context,
          url: typeof window !== 'undefined' ? window.location.href : undefined
        },
        error.stack
      )
    } catch (logError) {
      logger.error('Failed to log error:', logError)
    }
  }, [component])

  // Page view logging
  const logPageView = useCallback(async (page: string, details?: any) => {
    await logUserAction('page_view', {
      page,
      details,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined
    })
  }, [logUserAction])

  // Search logging
  const logSearch = useCallback(async (query: string, results?: number, filters?: any) => {
    await logUserAction('search', {
      query,
      resultsCount: results,
      filters,
      searchTime: Date.now()
    })
  }, [logUserAction])

  return {
    logUserAction,
    logButtonClick,
    logConfigChange,
    logDeviceInteraction,
    logRemoteControlAction,
    logChannelGuideAction,
    logError,
    logPageView,
    logSearch,
    startPerformanceTimer,
    endPerformanceTimer,
    sessionId: sessionId.current
  }
}

// Specific hook for bartender remote
export function useBartenderLogging() {
  const logging = useLogging('BartenderRemote')

  const logInputSelection = useCallback(async (
    inputNumber: number, 
    inputLabel: string, 
    tvNumber?: number
  ) => {
    await logging.logRemoteControlAction('input_change', {
      inputNumber,
      inputLabel,
      tvNumber,
      previousInput: null // Could be tracked
    })
  }, [logging])

  const logVolumeChange = useCallback(async (
    newVolume: number, 
    oldVolume: number, 
    deviceId: string
  ) => {
    await logging.logRemoteControlAction('volume_adjust', {
      newVolume,
      oldVolume,
      change: newVolume - oldVolume,
      deviceId
    })
  }, [logging])

  const logChannelChange = useCallback(async (
    channelNumber: string, 
    channelName?: string, 
    deviceId?: string
  ) => {
    await logging.logRemoteControlAction('channel_change', {
      channelNumber,
      channelName,
      deviceId,
      method: 'remote_control'
    })
  }, [logging])

  const logMatrixOperation = useCallback(async (
    operation: 'input_switch' | 'output_select' | 'volume_control',
    input?: number,
    output?: number,
    success?: boolean,
    responseTime?: number
  ) => {
    await logging.logDeviceInteraction(
      'wolf_pack',
      'main_matrix',
      operation,
      success || true,
      responseTime,
      { input, output, timestamp: Date.now() }
    )
  }, [logging])

  return {
    ...logging,
    logInputSelection,
    logVolumeChange,
    logChannelChange,
    logMatrixOperation
  }
}

'use client'

import { useEffect } from 'react'

export function ErrorHandler() {
  useEffect(() => {
    // Suppress known external errors from browser extensions
    const originalConsoleError = console.error
    
    console.error = (...args: any[]) => {
      // Filter out known browser extension errors
      const errorString = args.join(' ')
      
      if (
        errorString.includes('RegisterClientLocalizationsError') ||
        errorString.includes('translations') && errorString.includes('undefined')
      ) {
        // Silently ignore these external errors
        return
      }
      
      // Log all other errors normally
      originalConsoleError.apply(console, args)
    }

    // Global error handler for uncaught errors
    const handleError = (event: ErrorEvent) => {
      if (
        event.message.includes('RegisterClientLocalizationsError') ||
        (event.message.includes('translations') && event.message.includes('undefined'))
      ) {
        // Prevent the error from being logged
        event.preventDefault()
        return
      }
    }

    // Global promise rejection handler
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason)
      if (
        reason.includes('RegisterClientLocalizationsError') ||
        (reason.includes('translations') && reason.includes('undefined'))
      ) {
        // Prevent the error from being logged
        event.preventDefault()
        return
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      console.error = originalConsoleError
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  return null
}

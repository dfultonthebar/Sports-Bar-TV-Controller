'use client'

import { useEffect } from 'react'

import { logger } from '@sports-bar/logger'
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to console for debugging
    logger.error('Application error:', { error: error })
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md w-full rounded-lg bg-slate-800/50 border border-slate-700 p-8 shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-red-400">Something went wrong</h2>
        <p className="mb-2 text-slate-100">
          An error occurred in the application.
        </p>
        <p className="mb-6 text-sm text-slate-400">
          This is sometimes a temporary issue or a browser extension. Try again first. If it keeps happening, refresh the page or text the manager with what you were doing.
        </p>
        <button
          onClick={reset}
          className="w-full rounded bg-purple-600 hover:bg-purple-500 px-4 py-3 min-h-[44px] text-white font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

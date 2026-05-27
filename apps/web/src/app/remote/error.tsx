'use client'

/**
 * Bartender remote error boundary. Renders when a /remote subtree throws
 * an unhandled error. Tighter + more reassuring copy than the global
 * error.tsx because the audience is a bartender on an iPad mid-shift,
 * not an admin. Keeps the "you can't break it" voice the bartender-help
 * docs use. v2.54.56.
 */
import { useEffect } from 'react'
import { logger } from '@sports-bar/logger'

export default function RemoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('[REMOTE] Bartender remote error boundary fired:', { error: error })
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
      <div className="max-w-md w-full rounded-lg bg-slate-800/50 border border-slate-700 p-6 shadow-lg">
        <h2 className="mb-3 text-xl font-bold text-amber-400">Something hiccuped</h2>
        <p className="mb-2 text-slate-100">
          The remote ran into a problem. You didn&apos;t do anything wrong.
        </p>
        <p className="mb-4 text-sm text-slate-300">
          Tap <strong>Try again</strong> first. If that doesn&apos;t bring the screen back, refresh the iPad browser. If it keeps happening, text the manager — include a photo of what you were doing.
        </p>
        <p className="mb-6 text-xs text-slate-500">
          TV channels, audio zones, and lighting are unaffected — they keep running while this screen is broken.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full rounded bg-purple-600 hover:bg-purple-500 px-4 py-3 min-h-[44px] text-white font-medium transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded bg-slate-700 hover:bg-slate-600 px-4 py-3 min-h-[44px] text-slate-100 font-medium transition-colors"
          >
            Refresh the page
          </button>
        </div>
      </div>
    </div>
  )
}

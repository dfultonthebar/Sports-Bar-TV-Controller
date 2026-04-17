'use client'

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface VersionInfo {
  version: string
  sha: string
  startedAt: number
}

const POLL_INTERVAL_MS = 60_000
const IDLE_AUTO_RELOAD_MS = 2 * 60_000

export default function UpdateAvailableBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const baselineRef = useRef<VersionInfo | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const data: VersionInfo = await res.json()
        if (cancelled) return

        if (!baselineRef.current) {
          baselineRef.current = data
          return
        }

        const changed =
          data.version !== baselineRef.current.version ||
          data.sha !== baselineRef.current.sha ||
          data.startedAt !== baselineRef.current.startedAt

        if (changed && !updateAvailable) {
          setUpdateAvailable(true)
        }
      } catch {
        // network blip — try again next tick
      }
    }

    check()
    const t = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [updateAvailable])

  useEffect(() => {
    const bump = () => {
      lastActivityRef.current = Date.now()
    }
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll']
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [])

  useEffect(() => {
    if (!updateAvailable) {
      setCountdown(null)
      return
    }

    const tick = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current
      const remaining = IDLE_AUTO_RELOAD_MS - idleFor
      if (remaining <= 0) {
        window.location.reload()
        return
      }
      setCountdown(Math.ceil(remaining / 1000))
    }, 1000)

    return () => clearInterval(tick)
  }, [updateAvailable])

  if (!updateAvailable) return null

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div
      className="fixed top-0 inset-x-0 z-9999 bg-blue-600 text-white shadow-lg border-b border-blue-400"
      role="alert"
    >
      <button
        onClick={handleRefresh}
        className="w-full flex items-center justify-center gap-3 px-4 py-4 active:bg-blue-700 transition"
      >
        <RefreshCw className="h-5 w-5 shrink-0" />
        <span className="font-semibold text-base">
          New version available — tap to refresh
        </span>
        {countdown !== null && countdown <= 30 && (
          <span className="ml-2 text-sm opacity-90 bg-blue-700 rounded-sm px-2 py-0.5">
            auto in {countdown}s
          </span>
        )}
      </button>
    </div>
  )
}

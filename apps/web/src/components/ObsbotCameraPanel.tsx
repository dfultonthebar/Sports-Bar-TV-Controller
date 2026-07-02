'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Home, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import { logger } from '@sports-bar/logger'

interface Camera {
  id: string
  name: string
  mediamtxPath: string | null
}

const PRESET_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8]
const LONG_PRESS_MS = 700

/**
 * Bartender remote's OBSBOT Tail 2 camera tab — live LL-HLS preview + PTZ
 * touch pad + zoom + home + presets. Only rendered when the location has an
 * active camera row (see remote/page.tsx's cameraAvailable gate).
 */
export default function ObsbotCameraPanel() {
  const [camera, setCamera] = useState<Camera | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyPreset, setBusyPreset] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/obsbot/cameras')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.cameras) && data.cameras.length > 0) {
          setCamera(data.cameras[0])
        } else {
          setError('No camera configured')
        }
      })
      .catch(() => setError('Could not load camera'))
      .finally(() => setLoading(false))
  }, [])

  const hlsUrl = camera?.mediamtxPath
    ? `http://${typeof window !== 'undefined' ? window.location.hostname : ''}:8888/${camera.mediamtxPath}/index.m3u8`
    : null

  const command = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      if (!camera) return
      try {
        await fetch(`/api/obsbot/cameras/${camera.id}/${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch (err) {
        logger.error(`[ObsbotCameraPanel] ${path} command failed:`, err)
      }
    },
    [camera]
  )

  const stopMove = useCallback(() => command('move', { pan: 'stop', tilt: 'stop' }), [command])

  // Touch-drag PTZ pad: direction/speed derived from drag distance from the
  // pointer-down origin, re-sent on every move, stopped on release.
  const handlePadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragOriginRef.current = { x: e.clientX, y: e.clientY }
  }
  const handlePadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOriginRef.current) return
    const dx = e.clientX - dragOriginRef.current.x
    const dy = e.clientY - dragOriginRef.current.y
    const DEADZONE = 12
    if (Math.abs(dx) < DEADZONE && Math.abs(dy) < DEADZONE) return
    const pan = dx > DEADZONE ? 'right' : dx < -DEADZONE ? 'left' : 'stop'
    const tilt = dy > DEADZONE ? 'down' : dy < -DEADZONE ? 'up' : 'stop'
    const magnitude = Math.min(24, Math.round(Math.hypot(dx, dy) / 4) + 6)
    command('move', { pan, tilt, speed: magnitude })
  }
  const handlePadPointerUp = () => {
    dragOriginRef.current = null
    stopMove()
  }

  const handlePresetPointerDown = (slot: number) => {
    longPressTimerRef.current = setTimeout(() => {
      setBusyPreset(slot)
      command('preset', { action: 'save', slot }).finally(() => setBusyPreset(null))
      longPressTimerRef.current = null
    }, LONG_PRESS_MS)
  }
  const handlePresetPointerUp = (slot: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      command('preset', { action: 'recall', slot })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading camera…
      </div>
    )
  }

  if (error || !camera) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-slate-400">
        {error || 'No camera configured'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-lg font-bold text-white">{camera.name}</h3>
        </div>
        {hlsUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            ref={videoRef}
            src={hlsUrl}
            autoPlay
            muted
            playsInline
            controls={false}
            className="w-full aspect-video bg-black"
          />
        ) : (
          <div className="w-full aspect-video bg-black flex items-center justify-center text-slate-500">
            Stream not configured
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div
          onPointerDown={handlePadPointerDown}
          onPointerMove={handlePadPointerMove}
          onPointerUp={handlePadPointerUp}
          onPointerCancel={handlePadPointerUp}
          className="aspect-square backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center touch-none select-none"
        >
          <span className="text-slate-500 text-sm px-4 text-center">Drag to pan/tilt</span>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onPointerDown={() => command('zoom', { direction: 'in' })}
            onPointerUp={() => command('zoom', { direction: 'stop' })}
            onPointerCancel={() => command('zoom', { direction: 'stop' })}
            className="min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 active:bg-white/15"
          >
            <ZoomIn className="h-5 w-5" /> Zoom In
          </button>
          <button
            onPointerDown={() => command('zoom', { direction: 'out' })}
            onPointerUp={() => command('zoom', { direction: 'stop' })}
            onPointerCancel={() => command('zoom', { direction: 'stop' })}
            className="min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 active:bg-white/15"
          >
            <ZoomOut className="h-5 w-5" /> Zoom Out
          </button>
          <button
            onClick={() => command('home', {})}
            className="min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-slate-200 active:bg-white/15"
          >
            <Home className="h-5 w-5" /> Home
          </button>
        </div>
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-xs text-slate-400 mb-3">Presets — tap to recall, hold to save current position</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_SLOTS.map((slot) => (
            <button
              key={slot}
              onPointerDown={() => handlePresetPointerDown(slot)}
              onPointerUp={() => handlePresetPointerUp(slot)}
              onPointerCancel={() => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current)
                  longPressTimerRef.current = null
                }
              }}
              className="min-h-[48px] min-w-[48px] rounded-xl bg-white/5 border border-white/10 text-slate-200 active:bg-white/15 relative"
            >
              {busyPreset === slot ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : slot}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

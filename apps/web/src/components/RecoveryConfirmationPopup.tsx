'use client'

import { useState, useEffect, useCallback } from 'react'
import { logger } from '@sports-bar/logger'

interface RecoveryItem {
  id: string
  inputLabel: string
  inputSourceId: string
  inputSourceType: string
  channelNumber: string
  homeTeam: string
  awayTeam: string
  league: string
  scheduledTime: string
}

export default function RecoveryConfirmationPopup() {
  const [pendingItems, setPendingItems] = useState<RecoveryItem[]>([])
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [processingAll, setProcessingAll] = useState<'resume' | 'skip' | null>(null)

  const fetchPendingRecovery = useCallback(async () => {
    try {
      const res = await fetch('/api/schedules/recovery')
      if (!res.ok) return
      const data = await res.json()
      if (data.success && Array.isArray(data.pendingRecovery)) {
        setPendingItems(data.pendingRecovery)
      }
    } catch (err) {
      logger.error('[RECOVERY-POPUP] Failed to fetch pending recovery:', err)
    }
  }, [])

  // Poll every 10 seconds
  useEffect(() => {
    fetchPendingRecovery()
    const interval = setInterval(fetchPendingRecovery, 10000)
    return () => clearInterval(interval)
  }, [fetchPendingRecovery])

  const handleAction = useCallback(async (allocationId: string, action: 'resume' | 'skip') => {
    setProcessingIds(prev => new Set(prev).add(allocationId))
    try {
      const res = await fetch('/api/schedules/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocationId, action }),
      })
      const data = await res.json()
      if (data.success) {
        setPendingItems(prev => prev.filter(item => item.id !== allocationId))
        logger.info(`[RECOVERY-POPUP] ${action === 'resume' ? 'Resumed' : 'Skipped'} allocation ${allocationId}`)
      } else {
        logger.error(`[RECOVERY-POPUP] Action failed for ${allocationId}:`, data.error)
      }
    } catch (err) {
      logger.error(`[RECOVERY-POPUP] Error performing ${action} on ${allocationId}:`, err)
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev)
        next.delete(allocationId)
        return next
      })
    }
  }, [])

  const handleAll = useCallback(async (action: 'resume' | 'skip') => {
    setProcessingAll(action)
    const items = [...pendingItems]
    for (const item of items) {
      await handleAction(item.id, action)
    }
    setProcessingAll(null)
  }, [pendingItems, handleAction])

  // Don't render if nothing pending
  if (pendingItems.length === 0) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-white mb-1">System Restarted</h2>
          <p className="text-slate-400 text-base">
            Resume these scheduled games?
          </p>
        </div>

        {/* Items list */}
        <div className="space-y-3 mb-6">
          {pendingItems.map(item => {
            const isProcessing = processingIds.has(item.id)
            return (
              <div
                key={item.id}
                className="bg-slate-800 border border-slate-600 rounded-xl p-4"
              >
                <div className="mb-3">
                  <p className="text-white font-semibold text-base">
                    {item.awayTeam} @ {item.homeTeam}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    {item.league} &middot; Ch {item.channelNumber} &middot; {item.inputLabel}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction(item.id, 'resume')}
                    disabled={isProcessing || processingAll !== null}
                    className="flex-1 py-3 px-6 rounded-xl text-base font-semibold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? 'Resuming...' : 'Resume'}
                  </button>
                  <button
                    onClick={() => handleAction(item.id, 'skip')}
                    disabled={isProcessing || processingAll !== null}
                    className="flex-1 py-3 px-6 rounded-xl text-base font-semibold bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? 'Skipping...' : 'Skip'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Bulk actions */}
        {pendingItems.length > 1 && (
          <div className="flex gap-3 pt-3 border-t border-slate-700">
            <button
              onClick={() => handleAll('resume')}
              disabled={processingAll !== null || processingIds.size > 0}
              className="flex-1 py-3 px-6 rounded-xl text-base font-semibold bg-green-600 hover:bg-green-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {processingAll === 'resume' ? 'Resuming All...' : 'Resume All'}
            </button>
            <button
              onClick={() => handleAll('skip')}
              disabled={processingAll !== null || processingIds.size > 0}
              className="flex-1 py-3 px-6 rounded-xl text-base font-semibold bg-slate-600 hover:bg-slate-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {processingAll === 'skip' ? 'Skipping All...' : 'Skip All'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

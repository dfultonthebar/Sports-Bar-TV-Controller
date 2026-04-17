'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Power, PowerOff, Sun, Moon, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { logger } from '@sports-bar/logger'

export function QuickActions() {
  const [loading, setLoading] = useState(false)
  const [activeRoutine, setActiveRoutine] = useState<string | null>(null)

  async function executeBulkPower(operation: 'on' | 'off', routineName: string) {
    setLoading(true)
    setActiveRoutine(routineName)

    try {
      logger.info(`[QUICK ACTIONS] Starting ${routineName}`)

      const response = await fetch('/api/bulk-operations/power', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          deviceTypes: ['all'],
          delay: 500,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const { successful, failed, total } = data.data

        if (failed === 0) {
          toast.success(`${routineName} completed! ${successful} devices ${operation === 'on' ? 'powered on' : 'powered off'}`)
        } else {
          toast.error(`${routineName} partially completed: ${successful}/${total} successful`)
        }

        logger.info(`[QUICK ACTIONS] ${routineName} completed: ${successful}/${total} successful`)
      } else {
        toast.error(`${routineName} failed: ${data.error}`)
        logger.error(`[QUICK ACTIONS] ${routineName} failed:`, data.error)
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`)
      logger.error(`[QUICK ACTIONS] ${routineName} error:`, error)
    } finally {
      setLoading(false)
      setActiveRoutine(null)
    }
  }

  async function openingRoutine() {
    logger.info('[QUICK ACTIONS] Starting opening routine')
    toast.loading('Starting opening routine...', { duration: 2000 })

    try {
      // Power on all TVs
      await executeBulkPower('on', 'Opening Routine')

      // TODO: Future enhancements
      // - Set default channels for each zone
      // - Adjust audio levels
      // - Enable background music
    } catch (error: any) {
      logger.error('[QUICK ACTIONS] Opening routine error:', error)
    }
  }

  async function closingRoutine() {
    logger.info('[QUICK ACTIONS] Starting closing routine')
    toast.loading('Starting closing routine...', { duration: 2000 })

    try {
      // Power off all TVs
      await executeBulkPower('off', 'Closing Routine')

      // TODO: Future enhancements
      // - Save current channel states
      // - Stop background music
      // - Disable auto-wake features
    } catch (error: any) {
      logger.error('[QUICK ACTIONS] Closing routine error:', error)
    }
  }

  const isOpeningLoading = loading && activeRoutine === 'Opening Routine'
  const isClosingLoading = loading && activeRoutine === 'Closing Routine'

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={openingRoutine}
        disabled={loading}
        variant="outline"
        className="bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-300"
      >
        {isOpeningLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sun className="w-4 h-4 mr-2" />
        )}
        Opening Routine
      </Button>

      <Button
        onClick={closingRoutine}
        disabled={loading}
        variant="outline"
        className="bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/30 text-indigo-300"
      >
        {isClosingLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Moon className="w-4 h-4 mr-2" />
        )}
        Closing Routine
      </Button>
    </div>
  )
}

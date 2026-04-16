import { logger } from '@sports-bar/logger'

/**
 * Next.js Instrumentation File
 * 
 * This file runs once when the Next.js server starts.
 * Use it to initialize services that should run continuously.
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 [INSTRUMENTATION] Initializing services...')
    logger.info('[INSTRUMENTATION] Initializing services...')

    // Auto-seed DB tables from JSON on first startup (before any device-loading services)
    try {
      const { seedFromJson } = await import('./lib/seed-from-json')
      const result = await seedFromJson()
      if (result.direcTV.seeded || result.fireTV.seeded || result.stationAliases.seeded) {
        logger.info(`[STARTUP] Auto-seeded from JSON: DirecTV=${result.direcTV.count}, FireTV=${result.fireTV.count}, Aliases=${result.stationAliases.count}`)
      }
    } catch (error) {
      logger.error('[STARTUP] Failed to seed from JSON:', error)
    }

    try {
      // Import health monitor singleton
      const { healthMonitor } = await import('./services/firetv-health-monitor')

      // Explicitly start the health monitor
      // (Previously had auto-start code in module which caused duplicate instances)
      await healthMonitor.start()

      logger.info('[INSTRUMENTATION] Fire TV health monitor started successfully')
    } catch (error) {
      logger.error('[INSTRUMENTATION] Failed to initialize Fire TV services:', error)
    }

    try {
      // Import auto-reallocator worker
      const { autoReallocatorWorker } = await import('./lib/scheduling/auto-reallocator-worker')

      // Start the auto-reallocator worker
      autoReallocatorWorker.start()

      logger.info('[INSTRUMENTATION] Auto-reallocator worker started successfully')
    } catch (error) {
      logger.error('[INSTRUMENTATION] Failed to initialize auto-reallocator worker:', error)
    }

    try {
      // Import and start the scheduler service for continuous game monitoring
      const { schedulerService } = await import('./lib/scheduler-service')

      // Start the scheduler service (checks every minute for schedules to execute)
      schedulerService.start()

      logger.info('[INSTRUMENTATION] ✅ Scheduler service started - monitoring for continuous schedules every 60 seconds')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize scheduler service:', error)
    }

    try {
      // Initialize cron jobs: monthly preset reorder + daily channel sync from Rail Media
      const { initializePresetCronJob, initializeChannelSyncCronJob } = await import('./services/presetCronService')
      initializePresetCronJob()
      initializeChannelSyncCronJob()

      logger.info('[INSTRUMENTATION] ✅ Cron jobs initialized (preset reorder + channel sync)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize cron jobs:', error)
    }

    try {
      // Initialize Wolf Pack AI learning cycle (every 6 hours)
      const { runLearningCycle } = await import('@sports-bar/wolfpack')

      // Run initial cycle after 60s warm-up delay
      setTimeout(() => {
        runLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Initial learning cycle failed:', err)
        })
      }, 60_000)

      // Schedule recurring cycle every 6 hours
      setInterval(() => {
        runLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Learning cycle failed:', err)
        })
      }, 6 * 60 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ Wolf Pack AI learning cycle initialized (every 6 hours)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize Wolf Pack learning cycle:', error)
    }

    try {
      // Initialize ESPN game schedule sync (runs on startup + hourly)
      // Syncs a 7-day window of games into game_schedules so the bartender
      // channel guide has live game data to display.
      const { espnSyncService } = await import('@sports-bar/scheduler')

      const ESPN_SYNC_LEAGUES: Array<{ sport: string; league: string }> = [
        { sport: 'baseball', league: 'mlb' },
        { sport: 'basketball', league: 'nba' },
        { sport: 'hockey', league: 'nhl' },
        { sport: 'football', league: 'nfl' },
        { sport: 'football', league: 'college-football' },
        { sport: 'basketball', league: 'mens-college-basketball' },
        { sport: 'basketball', league: 'womens-college-basketball' },
      ]

      const runEspnSyncAll = async () => {
        for (const { sport, league } of ESPN_SYNC_LEAGUES) {
          try {
            const result = await espnSyncService.syncLeague(sport, league)
            logger.info(
              `[INSTRUMENTATION][ESPN SYNC] ${sport}/${league}: +${result.gamesAdded} new, ~${result.gamesUpdated} updated, ${result.errors.length} errors`
            )
          } catch (err) {
            logger.error(`[INSTRUMENTATION][ESPN SYNC] ${sport}/${league} failed:`, err)
          }
        }
      }

      // Initial sync after 30s warm-up delay (lets DB/other services settle)
      setTimeout(() => {
        runEspnSyncAll().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Initial ESPN sync failed:', err)
        })
      }, 30_000)

      // Recurring sync every 10 minutes — fast enough to detect game completion
      // for the auto-reallocator to revert cable boxes to default channels
      setInterval(() => {
        runEspnSyncAll().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Recurring ESPN sync failed:', err)
        })
      }, 10 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ ESPN game schedule sync initialized (every 10 minutes)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize ESPN sync:', error)
    }

    try {
      // Refresh Samsung TV model catalog from live :8001/api/v2/ probes.
      // Replaces any stale/bogus model strings (e.g. "LG WebOS" on Samsung
      // TVs) with the real modelName so the UI shows accurate hardware.
      // Runs 45s after startup and every 4 hours.
      const { refreshSamsungModelCatalog } = await import('./lib/samsung-model-probe')

      const runSamsungProbe = async () => {
        try {
          const r = await refreshSamsungModelCatalog()
          logger.info(
            `[INSTRUMENTATION][SAMSUNG PROBE] probed=${r.probed}, updated=${r.updated}, unreachable=${r.unreachable}`
          )
        } catch (err) {
          logger.error('[INSTRUMENTATION][SAMSUNG PROBE] failed:', err)
        }
      }

      setTimeout(runSamsungProbe, 45_000)
      setInterval(runSamsungProbe, 4 * 60 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ Samsung TV model probe scheduled (every 4 hours)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize Samsung model probe:', error)
    }

    try {
      // Refresh LG TV model catalog from live SSAP getSystemInfo probes.
      // Replaces stale/generic strings like "LG WebOS" with the real
      // modelName (e.g. "65UT8000AUA.BUSYLKR") so the UI shows accurate
      // hardware. Requires each LG row to have a clientKey from a prior
      // successful pairing. Staggered 15s after Samsung so both probes
      // don't contend for DB writes at exactly the same tick.
      const { refreshLGModelCatalog } = await import('./lib/lg-model-probe')

      const runLGProbe = async () => {
        try {
          const r = await refreshLGModelCatalog()
          logger.info(
            `[INSTRUMENTATION][LG PROBE] probed=${r.probed}, updated=${r.updated}, unreachable=${r.unreachable}`
          )
        } catch (err) {
          logger.error('[INSTRUMENTATION][LG PROBE] failed:', err)
        }
      }

      setTimeout(runLGProbe, 60_000)
      setInterval(runLGProbe, 4 * 60 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ LG TV model probe scheduled (every 4 hours)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize LG model probe:', error)
    }

    try {
      // Initialize Atlas Audio AI learning cycle (every 6 hours, staggered 90s after wolfpack)
      const { runAtlasLearningCycle } = await import('@sports-bar/atlas')

      // Run initial cycle after 90s warm-up delay (staggered from wolfpack's 60s)
      setTimeout(() => {
        runAtlasLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Initial Atlas learning cycle failed:', err)
        })
      }, 90_000)

      // Schedule recurring cycle every 6 hours
      setInterval(() => {
        runAtlasLearningCycle().catch((err: unknown) => {
          logger.error('[INSTRUMENTATION] Atlas learning cycle failed:', err)
        })
      }, 6 * 60 * 60 * 1000)

      logger.info('[INSTRUMENTATION] ✅ Atlas Audio AI learning cycle initialized (every 6 hours)')
    } catch (error) {
      logger.error('[INSTRUMENTATION] ❌ Failed to initialize Atlas learning cycle:', error)
    }
  }
}

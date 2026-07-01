/**
 * Background Scheduler Service
 *
 * This service runs in the background and executes schedules at their specified times.
 * It checks every minute for schedules that need to be executed.
 */

import { db, schema, eq, and, findMany } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { parseHardwareResult } from '@sports-bar/utils'
import { schedulerLogger } from './scheduler-logger'
import { runContentionDigest } from './contention-digest'
import { probeAllDirecTVTuned } from './directv-probe'
import { runFiretvAppSyncSweep } from './firetv-app-sync'
import { runFiretvCatalogWalk } from './firetv-catalog-walker'
import { runBananasIngestion } from './bananas-ingestion'
import { runTicketmasterIngestion } from './ticketmaster-ingestion'
import { verifyAndRetryRoute, persistVerifyState } from './route-verify'
import { reportSchedulerToFlywheel } from './flywheel-report'
import { autoReallocator } from './auto-reallocator'

// Get API port from environment or default to 3001
const API_PORT = process.env.PORT || 3001
// Wave 3c: closed-loop route verification. OFF by default — opt-in per location
// (Holmgren canary) via env, matching the RAG_RERANK_ENABLED / TICKETMASTER_API_KEY
// canary pattern. When on, after each route the scheduler reads the crossbar back
// and (only on a genuine mismatch) re-issues the idempotent SET, then records the
// verify outcome on the allocation's advisory columns.
const ROUTE_VERIFY_ENABLED = process.env.ROUTE_VERIFY_ENABLED === 'true'

// Venue timezone for schedule calculations (Central Time)
const VENUE_TIMEZONE = 'America/Chicago'

class SchedulerService {
  // v2.31.8 — Polling intervals are now registered via registerPoll() and
  // tracked centrally in this Map. stop() iterates this map and clears
  // everything, which structurally prevents the per-interval leak we had
  // before (ppv, firetv-app-sync, firetv-catalog-walk handles were never
  // cleared on stop).
  private polls = new Map<string, NodeJS.Timeout>();

  // intervalId + fastPollIntervalId have special lifecycle (sequenced
  // startup, conditional creation toggled by hasDelayedGames) so they
  // remain as named fields rather than living in `polls`.
  private intervalId: NodeJS.Timeout | null = null;
  private fastPollIntervalId: NodeJS.Timeout | null = null;
  private lastCatalogWalk: Date | null = null;
  private isRunning = false;
  private hasDelayedGames = false;
  private lastCleanup: Date | null = null;
  private lastWeeklySummary: Date | null = null;
  // v2.85.0 — guards the daily 04:00 CT morning-reset so it fires once per day,
  // not on every poll tick during the 04:00 window. Holds the date-key
  // (YYYY-M-D in venue tz) of the last day the reset ran.
  private lastMorningReset: Date | null = null;
  private executingSchedules = new Set<string>();

  // v2.31.8 — Hardware/config caches. These rows essentially never change
  // at runtime, but the original code re-queried them on every tick (every
  // 5 minutes for VAVA, once per allocation-with-audio-zone for audio
  // processors). Cleared on stop() in case a new instance loads different
  // hardware on next start.
  private cachedVavaDevices: any[] | null = null;
  private cachedAudioProcessor: any | null = null;
  private cachedMatrixConfig: any | null = null; // Wave 3c: active Wolf Pack config for route read-back (per-tick cache)

  /**
   * v2.31.8 — Register a polling job. Replaces the boilerplate triplet
   * (clear-existing + setInterval + setTimeout-for-initial) that was
   * copy-pasted four times in start(). Stored in this.polls so stop()
   * can clear every registered poll without per-name knowledge.
   */
  private registerPoll(name: string, fn: () => void, intervalMs: number, initialDelayMs: number): void {
    const existing = this.polls.get(name);
    if (existing) clearInterval(existing);
    this.polls.set(name, setInterval(fn, intervalMs));
    setTimeout(fn, initialDelayMs);
  }

  /**
   * Start the scheduler service
   */
  start() {
    if (this.isRunning) {
      logger.debug('Scheduler service is already running');
      return;
    }

    // Initialize the scheduler logger
    schedulerLogger.init();

    const correlationId = schedulerLogger.generateCorrelationId();
    logger.info('[SCHEDULER] Starting scheduler service...');

    schedulerLogger.info(
      'scheduler-service',
      'startup',
      'Scheduler service starting',
      correlationId
    );

    this.isRunning = true;

    // Clear existing interval if any to prevent memory leaks
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // On startup, flag any missed bartender-scheduled tunes for confirmation FIRST,
    // then start the regular check cycle. This prevents a race condition where
    // checkAndExecuteBartenderSchedules could pick up past-due pending allocations
    // and auto-tune them before flagMissedBartenderSchedules can flag them for confirmation.
    this.flagMissedBartenderSchedules().then(() => {
      // Only start the regular schedule checks after missed schedules are flagged
      // Check every minute for schedules to execute
      this.intervalId = setInterval(() => {
        this.checkAndExecuteSchedules();
      }, 60000); // 60 seconds

      // Also check immediately now that missed schedules have been flagged
      this.checkAndExecuteSchedules();

      logger.info('[SCHEDULER] Regular schedule checks started (after missed-schedule flagging)');
    }).catch((error) => {
      // Even if flagging fails, start the regular checks so the scheduler isn't dead
      logger.error('[SCHEDULER] Error flagging missed schedules, starting checks anyway:', { error });
      this.intervalId = setInterval(() => {
        this.checkAndExecuteSchedules();
      }, 60000);
      this.checkAndExecuteSchedules();
    });

    // v2.31.8 — Polling jobs registered via shared helper. See registerPoll()
    // for the rationale (handles tracked centrally so stop() can clear all
    // of them; previous code leaked ppv/firetv-app-sync/firetv-catalog-walk
    // handles on stop+restart).
    this.registerPoll('pollTVStatus', () => this.pollTVStatus(), 300000, 30000);
    this.registerPoll('runPpvProbe', () => this.runPpvProbe(), 600000, 90000);
    this.registerPoll('runFiretvAppSync', () => this.runFiretvAppSync(), 300000, 60000);
    this.registerPoll('maybeRunCatalogWalk', () => this.maybeRunCatalogWalk(), 300000, 300000);
    this.registerPoll('pollFiretvCurrentApp', () => this.pollFiretvCurrentApp(), 60000, 45000);

    // v2.85.0 — daily 04:00 CT "morning reset to defaults". Polls every
    // minute and fires once when the venue-local clock is in the 04:00-04:04
    // window, guarded by lastMorningReset so it runs exactly once per day (not
    // every minute of that window). Calls autoReallocator.resetAllToDefaults()
    // which routes every configured output to its default input and tunes every
    // cable/DirecTV box to its default channel — respecting live-game
    // protection. Initial delay 120s so it never races first-boot load.
    this.registerPoll('maybeRunMorningReset', () => { void this.maybeRunMorningReset(); }, 60000, 120000);
    logger.info('[SCHEDULER] Registered daily 04:00 CT morning-reset job (full revert-to-defaults)');

    // #349 Wave 3.7/Hermes — daily contention roll-up. Files ONE operator TODO
    // per ISO week ("N games had no screen") from distribution-engine 'drop'
    // rows; the dedupeKey collapses the daily runs to one TODO/week. Fail-open.
    this.registerPoll('runContentionDigest', () => { void runContentionDigest(); }, 86400000, 180000);

    // v2.51.0 — Bananas Entertainment ingestion for the Neighborhood RF
    // Interference Prediction subsystem. Pulls the agency's public
    // schedule page and upserts events into NeighborhoodEvent. Bananas
    // adds new events daily-ish; v2.51.1 changed cadence from 6h to 24h
    // since intra-day scrapes pulled identical payloads. Initial delay
    // 2 min so we don't pile onto first-boot load.
    this.registerPoll('runBananasIngestion', () => this.runBananasIngestionSafe(), 86400000, 120000);

    // v2.53.1 — Ticketmaster Discovery API ingestion (task #161). Second
    // neighborhood-events source covering Lambeau, Resch Center, Brown
    // County Arena, etc. Default OFF: scraper no-ops if
    // TICKETMASTER_API_KEY env is unset, so locations without a key keep
    // running Bananas-only. 6h cadence + 5-min initial delay (lands a
    // few minutes after Bananas so the venue/alias cache is warm).
    this.registerPoll('runTicketmasterIngestion', () => this.runTicketmasterIngestionSafe(), 6 * 60 * 60 * 1000, 5 * 60 * 1000);

    // v2.51.1 — Weekly Overpass+Ollama venue re-discovery. Catches new
    // bars/clubs opening near the bar over time without operator
    // intervention. Writes pending_review rows; correlation engine
    // ignores them until operator approves via admin UI. Reads LOCATION_LAT
    // / LOCATION_LON from env; gracefully skips if unset. 7-day cadence
    // + 30-min initial delay (lets daily Bananas ingest land first).
    this.registerPoll('runVenueDiscovery', () => this.runScheduledVenueDiscoverySafe(), 604800000, 1800000);

    // v2.51.0 — Neighborhood RF interference prediction pipeline:
    //   correlator       → joins fresh rf_interference rows with nearby
    //                      venue events, writes InterferenceAttribution
    //                      rows (every 10 min, +3 min initial delay).
    //   profileBuilder   → aggregates attributions per artist, generates
    //                      Ollama recommendation for high-confidence
    //                      artists (every 6h, +10 min initial delay —
    //                      expensive due to Ollama).
    //   preemptiveStrike → 1h forward scan; logs [PREEMPTIVE] warnings
    //                      for upcoming nearby bookings by known
    //                      interferers. Stage 1 — does NOT retune mics.
    // All three wrappers catch errors so a failure in one doesn't break
    // the others (or the scheduler tick).
    this.registerPoll('correlateInterference', () => this.runCorrelateInterferenceSafe(), 600000, 180000);
    this.registerPoll('rebuildArtistProfiles', () => this.runRebuildArtistProfilesSafe(), 21600000, 600000);
    this.registerPoll('runPreemptiveStrike', () => this.runPreemptiveStrikeSafe(), 3600000, 900000);
    // v2.52.14 — Tier 3 AI: daily Ollama-powered RF Pattern Digest.
    // Runs once every 24h (86_400_000 ms) with an initial 30-minute delay
    // (1_800_000 ms) so the watcher has time to populate sdr_spectrum
    // after a fresh start before the digest tries to summarize it.
    this.registerPoll('generateRfPatternDigest', () => this.runRfPatternDigestSafe(), 86_400_000, 1_800_000);

    schedulerLogger.info(
      'scheduler-service',
      'startup',
      'Scheduler service started successfully',
      correlationId
    );
  }

  /**
   * Run a single sweep of the DirecTV PPV-channel probe. Wrapper around
   * probeAllDirecTVTuned() that catches errors so a probe failure never
   * crashes the scheduler tick. Per-box errors are already swallowed inside
   * the probe; this catch is for the unexpected (DB unavailable, etc.).
   */
  private async runPpvProbe() {
    try {
      await probeAllDirecTVTuned();
    } catch (error: any) {
      logger.error('[DTV-PROBE] Unexpected probe sweep failure:', { error });
    }
  }

  /**
   * Run a single sweep of the Fire TV app sync. Wrapper around
   * runFiretvAppSyncSweep() that catches errors so a sync failure never
   * crashes the scheduler tick. Per-input errors are already swallowed
   * inside the sweep; this catch is for the unexpected (DB unavailable, etc.).
   */
  private async runFiretvAppSync() {
    try {
      await runFiretvAppSyncSweep();
    } catch (error: any) {
      logger.error('[FIRETV-APP-SYNC] Unexpected sweep failure:', { error });
    }
  }

  /**
   * Run a single Bananas Entertainment ingestion sweep. Wrapper around
   * runBananasIngestion() with a top-level catch so a fetch/parse failure
   * never crashes the scheduler tick. The ingestion module already has
   * per-event try/catch + returns stats rather than throwing on the happy
   * path; this guards the unexpected (DB unavailable, module import error).
   */
  private async runBananasIngestionSafe() {
    try {
      await runBananasIngestion();
    } catch (error: any) {
      logger.error('[BANANAS-INGEST] Unexpected ingestion failure:', { error });
    }
  }

  /**
   * v2.53.1 — Run a single Ticketmaster Discovery API ingestion sweep.
   * Wrapper around runTicketmasterIngestion() with a top-level catch so a
   * fetch/parse failure never crashes the scheduler tick. The ingestion
   * module already has per-event try/catch + returns stats rather than
   * throwing on the happy path; this guards the unexpected (DB unavailable,
   * module import error). Scraper itself no-ops when TICKETMASTER_API_KEY
   * is unset — no error path needed for the disabled case.
   */
  private async runTicketmasterIngestionSafe() {
    try {
      await runTicketmasterIngestion();
    } catch (error: any) {
      logger.error('[TM-INGEST] Unexpected ingestion failure:', { error });
    }
  }

  /**
   * v2.51.1 — Weekly Overpass+Ollama venue re-discovery, wrapped for
   * scheduler safety. Reads LOCATION_LAT / LOCATION_LON from env;
   * gracefully no-ops if unset (logs the skip but doesn't error).
   * The discovery script runs as a child process so a hung Ollama
   * call can't block the main tick.
   */
  private async runScheduledVenueDiscoverySafe() {
    try {
      const { runScheduledVenueDiscovery } = await import('./venue-discovery');
      await runScheduledVenueDiscovery();
    } catch (error: any) {
      logger.error('[VENUE-DISCOVERY] Unexpected discovery failure:', { error });
    }
  }

  /**
   * v2.51.0 — Run the Shure↔neighborhood correlation pass. Errors are
   * caught so the scheduler doesn't die when (e.g.) the DB is briefly
   * unavailable, and so a failure here does NOT prevent the artist
   * profile builder or the preemptive-strike pass from running.
   */
  private async runCorrelateInterferenceSafe() {
    try {
      // v2.52.12: correlateAllInterference runs BOTH Shure and SDR
      // passes. The SDR pass narrows to carriers within ±0.1 MHz of
      // our Shure receiver freqs so we attribute "Anduzzi DJ 8pm" to
      // real mic-band interference, not the continuous WCWF broadcast.
      const { correlateAllInterference } = await import('./interference-correlator');
      const { shure, sdr } = await correlateAllInterference();
      logger.info(`[CORRELATOR] Shure: ${shure.attributionsWritten} attributions; SDR: ${sdr.attributionsWritten} attributions`);
    } catch (error: any) {
      logger.error('[CORRELATOR] Unexpected correlation failure:', { error });
    }
  }

  /**
   * v2.51.0 — Rebuild per-artist interference profiles. Requires
   * LOCATION_ID — skipped with a warn if absent (locations without
   * LOCATION_ID set haven't completed bootstrap).
   */
  private async runRebuildArtistProfilesSafe() {
    const locationId = process.env.LOCATION_ID;
    if (!locationId) {
      logger.warn('[ARTIST-PROFILE] Skipping rebuild: LOCATION_ID env not set');
      return;
    }
    try {
      const { rebuildArtistProfiles } = await import('./artist-profile-builder');
      await rebuildArtistProfiles({ locationId });
    } catch (error: any) {
      logger.error('[ARTIST-PROFILE] Unexpected profile rebuild failure:', { error });
    }
  }

  /**
   * v2.51.0 — 1h forward scan for upcoming nearby bookings by
   * known-interferer artists. Logs [PREEMPTIVE] warnings. Stage 1 only;
   * does NOT retune mics.
   */
  private async runPreemptiveStrikeSafe() {
    const locationId = process.env.LOCATION_ID;
    if (!locationId) {
      logger.warn('[PREEMPTIVE] Skipping strike pass: LOCATION_ID env not set');
      return;
    }
    try {
      const { runPreemptiveStrike } = await import('./preemptive-strike');
      await runPreemptiveStrike({ locationId });
    } catch (error: any) {
      logger.error('[PREEMPTIVE] Unexpected strike pass failure:', { error });
    }
  }

  /**
   * v2.52.14 — Tier 3 AI integration. Generate the daily Ollama-powered
   * RF Pattern Digest. Skips silently when LOCATION_ID is unset. The
   * underlying generator is itself defensive (falls back to a raw-counts
   * summary if Ollama is unreachable), so the only thing we need to do
   * here is wrap in try/catch so a digest failure doesn't take down the
   * scheduler tick.
   */
  private async runRfPatternDigestSafe() {
    const locationId = process.env.LOCATION_ID;
    if (!locationId) {
      logger.warn('[RF-DIGEST] Skipping: LOCATION_ID env not set');
      return;
    }
    try {
      const { generateRfPatternDigest } = await import('./rf-pattern-digest');
      await generateRfPatternDigest({ locationId });
    } catch (error: any) {
      logger.error('[RF-DIGEST] Unexpected digest failure:', { error });
    }
  }

  /**
   * Poll each online Fire TV for its current foreground app and mirror
   * into InputCurrentChannel. Pairs with v2.32.13 InputCurrentChannel
   * mirror — the GET /api/firetv-devices/[id]/current-app handler does
   * the ADB call AND the upsert, so this scheduler tick just needs to
   * trigger it on a cadence. The scout heartbeat path also writes the
   * same row when scout reports a current app, so this poll only matters
   * for boxes whose scout doesn't report (older builds, scout-disabled).
   */
  private async pollFiretvCurrentApp() {
    try {
      const { db, schema } = await import('@sports-bar/database');
      const devices = await db.select().from(schema.fireTVDevices).all();
      const online = devices.filter((d: any) => d.isOnline && !d.disabled && d.inputChannel);
      const port = process.env.PORT || 3001;
      await Promise.allSettled(
        online.map(async (d: any) => {
          try {
            await fetch(`http://localhost:${port}/api/firetv-devices/${encodeURIComponent(d.id)}/current-app`, {
              signal: AbortSignal.timeout(5000),
            });
          } catch {
            // Per-device failures are silent; the endpoint logs internally.
          }
        })
      );
    } catch (error: any) {
      logger.error('[FIRETV-CURRENT-APP-POLL] Unexpected failure:', { error: error.message });
    }
  }

  /**
   * Decide whether to run a catalog walk and execute if so.
   *
   * v2.33.23 — OPERATOR-VISIBLE BEHAVIOR change. Operator reported
   * 2026-05-11: walker force-stops apps to run uiautomator dumps,
   * which kicks customers out of whatever they're watching mid-show.
   * Previous schedule (04:00 / 12:00 / 17:00) hit the noon and 5pm
   * lunch/dinner windows when bar was busy. Now: NIGHT-ONLY by default
   * — walker only runs between 02:00 and 06:00 local time (2-6 AM
   * Central). Bar is closed; no customer disruption.
   *
   * Two windows kept inside the night block:
   *   - 02:30 — early post-close refresh (catches west-coast late games)
   *   - 05:30 — pre-open refresh with current-day game schedule
   *
   * Long-gap catch-up retained at 24h (was 9h) — won't aggressively
   * re-fire after a daytime PM2 restart; will wait for the next
   * overnight window.
   */
  private async maybeRunCatalogWalk() {
    const now = new Date();
    const localHour = parseInt(
      now.toLocaleString('en-US', { timeZone: VENUE_TIMEZONE, hour: 'numeric', hourCycle: 'h23' }),
      10
    );
    const localMinute = parseInt(
      now.toLocaleString('en-US', { timeZone: VENUE_TIMEZONE, minute: 'numeric' }),
      10
    );
    // v2.33.23 — Walks are night-only. Two windows: 02:30 + 05:30
    // Central. The actual trigger fires when within ±5 minutes of
    // each window's start, gated by the cooldown.
    const isQuietHours = localHour >= 2 && localHour < 6
    const inEarlyWindow = localHour === 2 && localMinute >= 30 && localMinute < 35
    const inLateWindow = localHour === 5 && localMinute >= 30 && localMinute < 35
    const inWindow = inEarlyWindow || inLateWindow
    const last = this.lastCatalogWalk;
    // Long-gap catch-up bumped to 24h — only trigger an off-schedule
    // walk after a full day of nothing (e.g. host was down through
    // both windows). Even then, ONLY during quiet hours so we don't
    // interrupt customers.
    const longGap = !last || (now.getTime() - last.getTime() > 24 * 60 * 60 * 1000);

    // Cooldown 2h — covers the 3h gap between early/late windows.
    const recent = last && (now.getTime() - last.getTime() < 2 * 60 * 60 * 1000);
    if (recent) return;

    // STRICT quiet-hours gate: no daytime walks ever (even long-gap).
    if (!isQuietHours) return;
    if (!inWindow && !longGap) return;

    logger.info(`[FIRETV-CATALOG] Triggering walk (window=${inWindow}, longGap=${longGap}, hour=${localHour}:${String(localMinute).padStart(2,'0')})`);
    this.lastCatalogWalk = now;
    try {
      await runFiretvCatalogWalk();
    } catch (error: any) {
      logger.error('[FIRETV-CATALOG] Unexpected walk failure:', { error });
    }
  }

  /**
   * Manual trigger for the catalog walk — used by /api/firestick-scout/catalog/walk
   * and the daily-cron internal trigger. Always runs regardless of cooldown.
   */
  public async triggerCatalogWalkNow() {
    this.lastCatalogWalk = new Date();
    return runFiretvCatalogWalk();
  }

  /**
   * v2.85.0 — Decide whether to run the daily 04:00 CT morning reset and
   * execute if so. Polled every minute. Fires once when the venue-local clock
   * is in the 04:00-04:04 window (the ±poll-jitter tolerance), guarded by
   * lastMorningReset (date-key in venue tz) so it runs exactly ONCE per day
   * rather than every minute of that window. The reset itself (full
   * revert-to-defaults across all outputs/boxes) lives in
   * autoReallocator.resetAllToDefaults() and respects live-game protection.
   */
  private async maybeRunMorningReset() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: VENUE_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(now);
    const getPart = (t: string) => parts.find((p) => p.type === t)?.value || '0';
    const localHour = parseInt(getPart('hour'), 10);
    const localMinute = parseInt(getPart('minute'), 10);
    const dayKey = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;

    // Only inside the 04:00-04:04 CT window.
    if (localHour !== 4 || localMinute >= 5) return;

    // Once-per-day guard: compare against the venue-tz date-key of the last run.
    const lastKey = this.lastMorningReset
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: VENUE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        }).formatToParts(this.lastMorningReset)
          .reduce((acc: Record<string, string>, p) => { acc[p.type] = p.value; return acc; }, {})
      : null;
    const lastDayKey = lastKey ? `${lastKey.year}-${lastKey.month}-${lastKey.day}` : null;
    if (lastDayKey === dayKey) return;

    this.lastMorningReset = now;
    logger.info(`[SCHEDULER] ⏰ Triggering daily 04:00 CT morning reset (full revert-to-defaults)`);
    try {
      await autoReallocator.resetAllToDefaults({ trigger: 'daily-4am' });
    } catch (error: any) {
      logger.error('[SCHEDULER] Morning reset failed:', { error: error.message });
    }
  }

  /**
   * v2.85.0 — Manual trigger for the morning reset. Used by
   * POST /api/scheduling/morning-reset so the operator can force a
   * full revert-to-defaults on demand, or verify resolution via dryRun
   * without issuing any hardware command. Always runs (no time-window /
   * once-per-day guard); does NOT update lastMorningReset so it can't
   * suppress the scheduled 4 AM run.
   */
  public async triggerMorningResetNow(opts: { dryRun?: boolean } = {}) {
    return autoReallocator.resetAllToDefaults({
      dryRun: opts.dryRun === true,
      trigger: opts.dryRun ? 'manual-dry-run' : 'manual',
    });
  }

  /**
   * Flag missed bartender-scheduled tunes for confirmation instead of auto-recovering.
   * Sets status to 'needs_confirmation' so the bartender remote can show a popup
   * asking whether to resume these schedules.
   */
  private async flagMissedBartenderSchedules() {
    const correlationId = schedulerLogger.generateCorrelationId();

    try {
      const nowUnix = Math.floor(Date.now() / 1000);

      logger.info('[SCHEDULER] 🔄 Checking for missed bartender-scheduled tunes after startup...');

      // Find pending bartender allocations that are past due
      const pendingAllocations = await db.select({
        allocation: schema.inputSourceAllocations,
        inputSource: schema.inputSources,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(eq(schema.inputSourceAllocations.status, 'pending'))
      .all();

      const missedAllocations = pendingAllocations.filter((r) => {
        if (r.allocation.scheduledBy !== 'bartender') return false;
        // Only flag allocations whose scheduled time has passed (overdue)
        if ((r.allocation.allocatedAt || 0) > nowUnix) return false;
        // Skip allocations where the game is already over (estimatedEnd + 30 min buffer)
        const estimatedEnd = r.game.estimatedEnd || 0;
        if (estimatedEnd > 0) {
          const gameEndBuffer = estimatedEnd + 30 * 60;
          if (nowUnix > gameEndBuffer) return false;
        }
        return true;
      });

      if (missedAllocations.length === 0) {
        logger.info('[SCHEDULER] ✅ No missed bartender-scheduled tunes');
        await schedulerLogger.info('scheduler-service', 'recover', 'No missed bartender-scheduled tunes to recover', correlationId);
        return;
      }

      // Flag them as needs_confirmation instead of auto-tuning
      for (const { allocation, inputSource, game } of missedAllocations) {
        await db.update(schema.inputSourceAllocations)
          .set({ status: 'needs_confirmation', updatedAt: nowUnix })
          .where(eq(schema.inputSourceAllocations.id, allocation.id));

        logger.info(`[SCHEDULER] 🔔 Flagged for confirmation: ${inputSource.name} → ch ${allocation.channelNumber} (${game.homeTeamName} vs ${game.awayTeamName})`);
      }

      await schedulerLogger.info(
        'scheduler-service', 'recover',
        `Flagged ${missedAllocations.length} missed schedules for bartender confirmation`,
        correlationId
      );
    } catch (error: any) {
      logger.error('[SCHEDULER] ❌ Error flagging missed schedules:', { error });
    }
  }

  /**
   * Poll all TV statuses via the status check API
   * Runs every 5 minutes to keep the bartender remote's TV status accurate
   * Also pings the VAVA projector to prevent deep sleep
   */
  private async pollTVStatus() {
    try {
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api/tv-discovery/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        logger.debug(`[TV-POLL] Status check: ${data.online}/${data.count} TVs online`);
      }
    } catch (error) {
      logger.debug('[TV-POLL] Status check failed (app may still be starting)');
    }

    // Keep VAVA projector alive - send a harmless volume query to prevent deep sleep
    // VAVA shuts down all network services when it sleeps, making it uncontrollable
    // v2.31.8 — Cache the device list; it never changes at runtime.
    try {
      if (!this.cachedVavaDevices) {
        this.cachedVavaDevices = await db.select()
          .from(schema.networkTVDevices)
          .where(eq(schema.networkTVDevices.brand, 'VAVA'))
          .all();
      }
      const vavaDevices = this.cachedVavaDevices;

      for (const vava of vavaDevices) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          await fetch(`http://${vava.ipAddress}:${vava.port || 8000}/remote/get_volume`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          logger.debug(`[TV-POLL] VAVA keep-alive ping sent to ${vava.ipAddress}`);
        } catch {
          // VAVA may already be in deep sleep — nothing we can do
        }
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Stop the scheduler service
   */
  async stop() {
    const correlationId = schedulerLogger.generateCorrelationId();

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.fastPollIntervalId) {
      clearInterval(this.fastPollIntervalId);
      this.fastPollIntervalId = null;
    }
    // v2.31.8 — Clear every poll registered via registerPoll() in one
    // shot. Previously the per-named-field clearing in stop() forgot
    // ppvProbeIntervalId, firetvAppSyncIntervalId, and
    // firetvCatalogWalkIntervalId (added at different times); the Map
    // pattern is leak-proof.
    for (const handle of this.polls.values()) clearInterval(handle);
    this.polls.clear();

    // Drop runtime caches so a subsequent start() reloads from DB.
    this.cachedVavaDevices = null;
    this.cachedAudioProcessor = null;
    this.cachedMatrixConfig = null;

    this.isRunning = false;

    await schedulerLogger.info(
      'scheduler-service',
      'cleanup',
      'Scheduler service stopped',
      correlationId
    );

    // Stop the scheduler logger and flush remaining metrics
    await schedulerLogger.stop();

    logger.debug('Scheduler service stopped');
  }

  /**
   * Route a scheduled game's Wolf Pack input into the audio-feed output that
   * feeds the chosen Atlas source, so the zones (which we point at that source
   * separately) actually HEAR the game.
   *
   * Why this exists: setting an Atlas zone's source only tells the zone which
   * Atlas INPUT to listen to. It does NOT get the game's audio onto that input.
   * The audio reaches the Atlas over dedicated Wolf Pack "Matrix Audio" outputs
   * (Greenville 33-36, Holmgren 37-40 — bigger matrix). Atlas source index N is
   * fed by the Nth such output. Prior to this, scheduling a game with audio set
   * the zones to source N but never routed the game into feed-output N, so the
   * zones listened to a stale/silent feed (Stoneyard Greenville Brewers,
   * 2026-06-30 — video switched, audio didn't). Feed outputs are derived from
   * MatrixOutput.audioOutput='audio' per-location; NEVER hardcode them.
   *
   * Advisory: logs and returns on any problem, never throws into the tune path.
   */
  private async routeGameAudioFeed(
    inputSource: any,
    audioSourceIndex: number,
    correlationId: string,
    game: any,
    allocation: any,
  ): Promise<void> {
    try {
      // Resolve the game's physical Wolf Pack input channel (same UUID→channel
      // resolution + bare-integer fallback the video-routing block uses).
      let matrixInput = NaN;
      if (inputSource?.matrixInputId) {
        const row = await db.select({ channelNumber: schema.matrixInputs.channelNumber })
          .from(schema.matrixInputs)
          .where(eq(schema.matrixInputs.id, inputSource.matrixInputId))
          .limit(1).all();
        matrixInput = row[0]?.channelNumber ?? NaN;
        if (isNaN(matrixInput) && /^\d+$/.test(String(inputSource.matrixInputId))) {
          matrixInput = Number(inputSource.matrixInputId);
        }
      }
      if (isNaN(matrixInput)) {
        logger.warn(`[SCHEDULER] 🔊 Audio-feed routing skipped — could not resolve matrix input for source "${inputSource?.name}"`);
        return;
      }

      // Delegate the source-index → audio-feed-output derivation + routing to the
      // shared /api/matrix/audio-feed-route endpoint. That endpoint is the SINGLE
      // source of truth (also used by the manual "apply now" button), so the two
      // paths can never drift — the drift between two audio apply paths is what
      // caused this bug. Feed outputs are derived per-location from
      // MatrixOutput.audioOutput there, never hardcoded.
      const fr = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/audio-feed-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: matrixInput, audioSourceIndex }),
      });
      const frBody = await fr.json().catch(() => ({} as any));
      if (fr.ok && frBody?.success) {
        logger.info(`[SCHEDULER] 🔊 Routed input ${matrixInput} → audio-feed output ${frBody.feedOutput} (Atlas source ${audioSourceIndex})`);
        await schedulerLogger.info(
          'scheduler-service',
          'tune',
          `Audio feed routed: input ${matrixInput} → output ${frBody.feedOutput} (Atlas source ${audioSourceIndex})`,
          correlationId,
          { gameId: game?.id, inputSourceId: inputSource?.id, allocationId: allocation?.id, metadata: { matrixInput, feedOutput: frBody.feedOutput, audioSourceIndex } },
        );
      } else if (frBody?.skipped) {
        logger.warn(`[SCHEDULER] 🔊 No audio-feed output for source index ${audioSourceIndex} (feeds=[${(frBody.availableFeeds || []).join(',')}]) — zones will listen but game audio not routed. Check MatrixOutput.audioOutput flags.`);
      } else {
        logger.error(`[SCHEDULER] ❌ Failed to route audio feed input ${matrixInput} → source ${audioSourceIndex}: ${frBody?.error || fr.status}`);
      }
    } catch (err: any) {
      logger.error(`[SCHEDULER] ❌ Error routing audio feed:`, { error: err?.message || err });
    }
  }

  /**
   * Check for schedules that need to be executed and execute them
   */
  private async checkAndExecuteSchedules() {
    try {
      const now = new Date();

      // Reset delayed flag — will be set again if any games are still delayed
      this.hasDelayedGames = false;

      // Check for pending bartender-scheduled channel tunes
      await this.checkAndExecuteBartenderSchedules(now);

      // Manage fast polling: when games are delayed, check every 15s instead of 60s
      if (this.hasDelayedGames && !this.fastPollIntervalId) {
        logger.info('[SCHEDULER] 🔄 Enabling fast polling (15s) — games are delayed');
        this.fastPollIntervalId = setInterval(() => {
          this.checkAndExecuteBartenderSchedules(new Date());
        }, 15000);
      } else if (!this.hasDelayedGames && this.fastPollIntervalId) {
        logger.info('[SCHEDULER] ✅ Disabling fast polling — no more delayed games');
        clearInterval(this.fastPollIntervalId);
        this.fastPollIntervalId = null;
      }

      // Hourly tasks
      if (!this.lastCleanup || (now.getTime() - this.lastCleanup.getTime()) >= 3600000) {
        // Cleanup: Remove games that started 2+ hours ago
        this.cleanupOldGames();

        // Run pattern analysis on scheduling history (learns from bartender TV routing)
        try {
          const { patternAnalyzer } = await import('./pattern-analyzer');
          patternAnalyzer.analyzeAll().then(result => {
            logger.info(`[SCHEDULER] Pattern analysis: ${result.teamRouting?.length || 0} team, ${result.leaguePriority?.length || 0} league, ${result.leagueDuration?.length || 0} league-duration, ${result.timeSlots?.length || 0} timeslot patterns`);
          }).catch((err) => logger.warn('[SCHEDULER] Pattern analysis run failed:', err));
        } catch (err) {
          // v2.31.8 — log import failures instead of swallowing. A missing
          // build artifact (Turbo cache miss, syntax error in module) used
          // to silently disable the hourly task forever.
          logger.warn('[SCHEDULER] Failed to load pattern-analyzer module:', err);
        }

        // Digest recent bartender overrides into stable recommendations.
        // Complements pattern-analyzer: that reads post-correction state
        // for AI Suggest; this reads the delta (add/remove events) to
        // surface recurring corrections that might warrant updating the
        // default tv_output_ids for a team.
        try {
          const { runOverrideDigest } = await import('./override-digester');
          runOverrideDigest().then(r => {
            logger.info(`[SCHEDULER] Override digest: ${r.totalEventsScanned} events → ${r.patterns.length} stable patterns`);
          }).catch((err) => {
            logger.warn('[SCHEDULER] Override digest failed:', err);
          });
        } catch (err) {
          logger.warn('[SCHEDULER] Failed to load override-digester module:', err);
        }

        // Scan recent SchedulerLog failures for recurring clusters and
        // promote them to high-visibility warn rows. This is how new
        // systemic bugs surface before an operator notices — tonight's
        // UUID parseInt bug would have been flagged within an hour of
        // the first failed tune cluster.
        try {
          const { runFailureSweep } = await import('./failure-sweeper');
          runFailureSweep().then(r => {
            logger.info(`[SCHEDULER] Failure sweep: ${r.scanned} events → ${r.clusters.length} clusters`);
          }).catch((err) => {
            logger.warn('[SCHEDULER] Failure sweep failed:', err);
          });
        } catch (err) {
          logger.warn('[SCHEDULER] Failed to load failure-sweeper module:', err);
        }

        this.lastCleanup = now;
      }

      // Weekly owner summary — fires on Monday between 06:00 and 06:59
      // local time (the scheduler checks every ~60s so this catches it
      // reliably in that hour). The POST handler writes
      // data/reports/week-YYYY-Www.md.
      try {
        const local = new Date(now.toLocaleString('en-US', { timeZone: process.env.LOCATION_TIMEZONE || 'America/Chicago' }));
        const isMonday = local.getDay() === 1;
        const isSixAmHour = local.getHours() === 6;
        const dayKey = `${local.getFullYear()}-${local.getMonth()}-${local.getDate()}`;
        const alreadyRanToday = this.lastWeeklySummary
          ? `${this.lastWeeklySummary.getFullYear()}-${this.lastWeeklySummary.getMonth()}-${this.lastWeeklySummary.getDate()}` === dayKey
          : false;
        if (isMonday && isSixAmHour && !alreadyRanToday) {
          logger.info('[SCHEDULER] Triggering weekly owner summary');
          fetch(`http://127.0.0.1:${API_PORT}/api/ai/weekly-summary`, { method: 'POST' })
            .then(r => r.json())
            .then((r: any) => logger.info(`[SCHEDULER] Weekly summary: ${r.success ? r.writtenTo : r.error}`))
            .catch(err => logger.warn('[SCHEDULER] Weekly summary request failed:', err));
          this.lastWeeklySummary = now;
        }
      } catch (err: any) {
        logger.warn('[SCHEDULER] Weekly summary check error:', err);
      }

      // Get all enabled schedules
      const schedules = await findMany('schedules', {
        where: eq(schema.schedules.enabled, true)
      });

      logger.debug(`[SCHEDULER] Checking ${schedules.length} enabled schedules...`);

      for (const schedule of schedules) {
        let shouldExecute = false;

        // Special handling for continuous schedules (like AI Game Monitor)
        // These run every 5 minutes based on time since last execution
        if (schedule.scheduleType === 'continuous') {
          const intervalMs = 5 * 60 * 1000; // 5 minutes
          const lastExec = schedule.lastExecuted ? new Date(schedule.lastExecuted) : null;
          const timeSinceLastExec = lastExec ? now.getTime() - lastExec.getTime() : Infinity;
          const minutesSinceLastExec = lastExec ? Math.floor(timeSinceLastExec / 60000) : null;

          // Execute if never run, or if interval has passed
          shouldExecute = !lastExec || timeSinceLastExec >= intervalMs;

          const nextIn = lastExec ? Math.max(0, Math.ceil((intervalMs - timeSinceLastExec) / 60000)) : 0;
          logger.debug(`[SCHEDULER] 📺 Continuous schedule "${schedule.name}": Last exec ${minutesSinceLastExec !== null ? minutesSinceLastExec + ' min ago' : 'never'}, ${shouldExecute ? 'EXECUTING NOW' : `next in ${nextIn} min`}`);
        } else {
          // For time-based schedules (once, daily, weekly), use calculateNextExecution
          const nextExecution = this.calculateNextExecution(schedule);

          if (!nextExecution) {
            logger.debug(`[SCHEDULER] No next execution time for schedule: ${schedule.name} (type: ${schedule.scheduleType})`);
            continue;
          }

          // Check if it's time to execute (within the last minute)
          const timeDiff = now.getTime() - nextExecution.getTime();
          shouldExecute = timeDiff >= 0 && timeDiff < 60000;
        }

        if (shouldExecute) {
          // Prevent concurrent execution of same schedule
          if (this.executingSchedules.has(schedule.id)) {
            logger.warn(`[SCHEDULER] Schedule ${schedule.name} already executing, skipping`);
            continue;
          }

          logger.info(`[SCHEDULER] ⚡ Executing schedule: ${schedule.name} (type: ${schedule.scheduleType})`);

          // Add to executing set
          this.executingSchedules.add(schedule.id);

          // Execute schedule asynchronously
          this.executeSchedule(schedule.id)
            .catch(error => {
              logger.error(`[SCHEDULER] ❌ Error executing schedule ${schedule.name}:`, { error });
            })
            .finally(() => {
              // Remove from executing set when complete
              this.executingSchedules.delete(schedule.id);
            });
        }
      }
    } catch (error) {
      logger.error('[SCHEDULER] Error checking schedules:', { error });
    }
  }

  /**
   * Execute a schedule by calling the API endpoint
   */
  private async executeSchedule(scheduleId: string) {
    try {
      const startTime = Date.now();
      const response = await fetch(`http://localhost:${API_PORT}/api/schedules/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      if (result.result?.success) {
        logger.info(`[SCHEDULER] ✅ Schedule executed successfully in ${duration}ms - Games: ${result.result.gamesFound || 0}, Channels: ${result.result.channelsSet || 0}`);
      } else {
        // "No TVs to control" is a benign condition: the AI Game Monitor
        // fires every 5 minutes by design, and most of the time there is
        // no active allocation to act on. Don't spam WARN for this — real
        // problems are easier to spot without 288 benign entries per day.
        const msg = result.result?.message;
        if (msg === 'No TVs to control') {
          logger.debug(`[SCHEDULER] Schedule tick: no active TV allocations (${duration}ms)`);
        } else {
          logger.warn(`[SCHEDULER] ⚠️  Schedule execution completed with issues (${duration}ms): ${msg}`);
        }
      }
    } catch (error) {
      logger.error(`[SCHEDULER] ❌ Failed to execute schedule ${scheduleId}:`, { error });
    }
  }

  /**
   * Calculate the next execution time for a schedule
   */
  private calculateNextExecution(schedule: any): Date | null {
    if (!schedule.enabled) {
      return null;
    }

    const now = new Date();

    // CONTINUOUS: AI-powered game monitoring - runs every 5 minutes
    if (schedule.scheduleType === 'continuous') {
      // If never executed or no lastExecuted, run immediately
      if (!schedule.lastExecuted) {
        return now;
      }

      // Calculate next execution based on lastExecuted + 5 minutes
      const lastExec = new Date(schedule.lastExecuted);
      const intervalMs = 5 * 60 * 1000; // 5 minutes
      const next = new Date(lastExec.getTime() + intervalMs);

      // If multiple intervals have passed, schedule for the next upcoming interval
      // This ensures we don't spam executions if the system was down
      while (next < now) {
        next.setTime(next.getTime() + intervalMs);
      }

      return next;
    }

    // For time-based schedules, executionTime is required
    if (!schedule.executionTime) {
      return null;
    }

    if (schedule.scheduleType === 'once') {
      const once = new Date(schedule.executionTime);
      return once > now ? once : null;
    }

    if (schedule.scheduleType === 'daily') {
      const [hours, minutes] = schedule.executionTime.split(':').map(Number);

      // Get current time in venue timezone using Intl API
      // This properly handles DST transitions
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: VENUE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

      const currentYear = parseInt(getPart('year'));
      const currentMonth = parseInt(getPart('month')) - 1; // JS months are 0-indexed
      const currentDay = parseInt(getPart('day'));
      const currentHour = parseInt(getPart('hour'));
      const currentMinute = parseInt(getPart('minute'));

      // Create today's scheduled time in venue timezone
      const next = new Date(currentYear, currentMonth, currentDay, hours, minutes, 0, 0);

      // If scheduled time has already passed today, schedule for tomorrow
      const todayScheduledTime = new Date(currentYear, currentMonth, currentDay, hours, minutes, 0, 0);
      const currentTimeInVenue = new Date(currentYear, currentMonth, currentDay, currentHour, currentMinute, 0, 0);

      if (todayScheduledTime <= currentTimeInVenue) {
        next.setDate(next.getDate() + 1);
      }

      // Note: For proper DST handling with external library, consider:
      // npm install date-fns date-fns-tz
      // import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'
      // const nextInVenue = zonedTimeToUtc(next, VENUE_TIMEZONE)

      return next;
    }

    if (schedule.scheduleType === 'weekly') {
      const daysOfWeek = schedule.daysOfWeek ? JSON.parse(schedule.daysOfWeek) : [];
      if (daysOfWeek.length === 0) return null;

      const [hours, minutes] = schedule.executionTime.split(':').map(Number);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

      // Get current time in venue timezone using Intl API
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: VENUE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        hour12: false
      });

      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';

      const currentYear = parseInt(getPart('year'));
      const currentMonth = parseInt(getPart('month')) - 1; // JS months are 0-indexed
      const currentDay = parseInt(getPart('day'));
      const currentHour = parseInt(getPart('hour'));
      const currentMinute = parseInt(getPart('minute'));

      // Create a date object representing current time in venue timezone
      const localNow = new Date(currentYear, currentMonth, currentDay, currentHour, currentMinute, 0, 0);
      const currentDayOfWeek = localNow.getDay();

      // Find next matching day
      for (let i = 0; i < 7; i++) {
        const checkDay = (currentDayOfWeek + i) % 7;
        const dayName = dayNames[checkDay];

        if (daysOfWeek.includes(dayName)) {
          // Create next execution time
          const next = new Date(localNow);
          next.setDate(next.getDate() + i);
          next.setHours(hours, minutes, 0, 0);

          if (next > localNow) {
            return next;
          }
        }
      }
    }

    return null;
  }

  /**
   * Clean up old games from the sports guide cache
   * Removes games that started more than 2 hours ago
   */
  private async cleanupOldGames() {
    try {
      logger.info('[SCHEDULER] 🧹 Running hourly cleanup of old games (started 2+ hours ago)');

      const response = await fetch(`http://localhost:${API_PORT}/api/sports-guide/cleanup-old`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hoursOld: 2 })
      });

      if (response.ok) {
        const result = await response.json();
        logger.info(`[SCHEDULER] ✅ Cleanup complete: ${result.removed || 0} old games removed`);
      } else {
        logger.warn('[SCHEDULER] ⚠️  Cleanup request failed');
      }
    } catch (error) {
      logger.error('[SCHEDULER] ❌ Error during cleanup:', { error });
    }
  }

  /**
   * Check for pending bartender-scheduled channel tunes and execute them
   * These are tunes scheduled by bartenders via the channel guide "Schedule" button
   */
  private async checkAndExecuteBartenderSchedules(now: Date) {
    const correlationId = schedulerLogger.generateCorrelationId();
    const startTime = Date.now();

    try {
      const nowUnix = Math.floor(now.getTime() / 1000);

      // Find pending allocations where allocatedAt <= now (time to tune)
      const pendingAllocations = await db.select({
        allocation: schema.inputSourceAllocations,
        inputSource: schema.inputSources,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.inputSources, eq(schema.inputSourceAllocations.inputSourceId, schema.inputSources.id))
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(eq(schema.inputSourceAllocations.status, 'pending'))
      .all();

      // Filter to allocations that are due. EARLY_BUFFER = how many minutes BEFORE the game's
      // scheduled start (kickoff — ESPN gives kickoff, not the pregame slot) we tune the channel.
      // Per-location tunable via TUNE_LEAD_MINUTES (.env); default 5. Bump it (e.g. 20-30) to land
      // on the pregame. Requires the var in ecosystem.config.js env: block + pm2 delete/start.
      const TUNE_LEAD_MINUTES = Number(process.env.TUNE_LEAD_MINUTES);
      const EARLY_BUFFER_SECONDS =
        (Number.isFinite(TUNE_LEAD_MINUTES) && TUNE_LEAD_MINUTES >= 0 ? TUNE_LEAD_MINUTES : 5) * 60;
      // v2.82.52 — the old MAX_DELAY_SECONDS (30-min) force-override was removed.
      // It cut CONFIRMED-live games off their TVs as soon as the NEXT game ran
      // 30min late. Live-game protection is now state-based: see the
      // confirmedLive / outputsOverlap / assumedLiveButStale logic below.

      const dueAllocations = pendingAllocations.filter(
        (r) => ((r.allocation.allocatedAt || 0) - EARLY_BUFFER_SECONDS) <= nowUnix
      );

      if (dueAllocations.length === 0) {
        return;
      }

      await schedulerLogger.info(
        'scheduler-service',
        'check',
        `Found ${dueAllocations.length} pending bartender-scheduled tunes to execute`,
        correlationId,
        { metadata: { dueCount: dueAllocations.length } }
      );

      logger.info(`[SCHEDULER] 📺 Found ${dueAllocations.length} pending bartender-scheduled tunes to execute`);

      // v2.31.8 — Hoist active-allocations query out of the per-allocation
      // loop. Previously each successful tune fired a full
      // `SELECT * FROM input_source_allocations WHERE status='active'`
      // (N due allocations × full table scan). Fetch once per tick; we'll
      // mutate the local Set as we route outputs in this batch.
      const tickActiveAllocations = await db.select()
        .from(schema.inputSourceAllocations)
        .where(eq(schema.inputSourceAllocations.status, 'active'))
        .all();
      const tickClaimedOutputs = new Set<number>();
      for (const a of tickActiveAllocations) {
        if (!a.tvOutputIds) continue;
        try {
          const ids: number[] = JSON.parse(a.tvOutputIds);
          ids.forEach((o) => tickClaimedOutputs.add(o));
        } catch (parseErr: any) {
          // v2.32.92 — Surface parse failures instead of silently dropping.
          // Pre-fix bare `catch {}` masked malformed tvOutputIds rows: a
          // partially-written JSON value (e.g. from a crashed write) would
          // silently exclude that allocation's outputs from
          // tickClaimedOutputs, allowing a separate tune to claim the same
          // physical TV in the same tick — two sources routed to one TV
          // with no operator-visible signal. Logging here makes the bad
          // row visible in PM2 / System Admin logs.
          logger.warn(
            `[SCHEDULER] Skipping allocation ${a.id} — malformed tvOutputIds: ${a.tvOutputIds} (${parseErr.message})`,
          );
        }
      }

      // v2.31.8 — One ESPN live-status fetch per tick instead of per
      // allocation. checkCurrentGameStatus accepts liveData as an optional
      // argument; pass the cached snapshot to skip the loopback fetch.
      let tickLiveData: any = null;
      try {
        const espnResp = await fetch(`http://127.0.0.1:${API_PORT}/api/scheduling/live-status`);
        if (espnResp.ok) tickLiveData = await espnResp.json();
      } catch { /* fall back to per-call fetch inside checkCurrentGameStatus */ }

      for (const { allocation, inputSource, game } of dueAllocations) {
        const tuneStartTime = Date.now();

        // v2.28.6 — Skip + cancel allocations whose game already ended.
        // Without this, a pending allocation whose tune keeps failing (e.g.
        // bad channel for the device) is retried every minute forever: the
        // revert sweep never runs because the allocation never went 'active',
        // and there's no failure cap. On 2026-04-21 a stuck Celtics@76ers
        // allocation pointed at DirecTV ch 220 (NBCSN, doesn't exist on
        // DirecTV) racked up 2,094 failed tunes over 41 hours before manual
        // cleanup. Cancel anything where the game is over by status OR is
        // 30+ min past its estimated end.
        const POST_END_GRACE_SECONDS = 30 * 60;
        const gameEndedStatuses = new Set(['completed', 'final', 'postponed', 'canceled', 'cancelled']);
        const gameStatusOver = gameEndedStatuses.has(String(game.status || '').toLowerCase());
        const estimatedEndUnix = game.estimatedEnd || 0;
        const wallClockOver = estimatedEndUnix > 0 && nowUnix > estimatedEndUnix + POST_END_GRACE_SECONDS;

        if (gameStatusOver || wallClockOver) {
          await db.update(schema.inputSourceAllocations)
            .set({
              status: 'cancelled',
              actuallyFreedAt: nowUnix,
              qualityNotes: `Cancelled before tune: game already ended (status=${game.status}${wallClockOver ? ', wall-clock past est_end+30min' : ''})`,
              updatedAt: nowUnix,
            })
            .where(eq(schema.inputSourceAllocations.id, allocation.id));

          await schedulerLogger.info(
            'scheduler-service',
            'tune',
            `Cancelled stale pending allocation for ${game.homeTeamName} vs ${game.awayTeamName} — game already ended (${game.status})`,
            correlationId,
            {
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              metadata: { gameStatus: game.status, estimatedEnd: estimatedEndUnix, wallClockOver, reason: 'game_ended_before_tune' },
            }
          );

          logger.info(`[SCHEDULER] 🚫 Cancelled stale pending allocation for ${game.homeTeamName} vs ${game.awayTeamName} (game ${game.status}, channel ${allocation.channelNumber})`);
          continue;
        }

        try {
          logger.info(`[SCHEDULER] 🎯 Checking if ready to tune: ${inputSource.name} to channel ${allocation.channelNumber} for ${game.homeTeamName} vs ${game.awayTeamName}`);

          // Check if there's a scheduled game currently on this input that's still in progress.
          // v2.31.8 — pass the per-tick live-status snapshot to avoid N loopback fetches.
          const currentGameStatus = await this.checkCurrentGameStatus(inputSource.id, tickLiveData);
          const timePastScheduled = nowUnix - (allocation.allocatedAt || 0);

          // v2.82.52 — HARD RULE: never switch a TV off a CONFIRMED in-progress
          // game. The old `forceOverride = timePastScheduled >= 30min` cut a
          // genuinely-live game off as soon as the NEXT game ran 30min late
          // (the Brewers extra-innings bug). Restructure:
          //   • ESPN-confirmed live  → HOLD indefinitely (next game waits).
          //   • only-assumed live (no ESPN confirmation) → keep a safety valve,
          //     but base it on THIS game's own state (large margin past its
          //     estimated end ⇒ live data stale), NOT the next game's lateness.
          //   • no output overlap → no conflict; tune freely (the next game
          //     isn't stealing any TV the live game is using).
          const nextOutputIds: number[] = (() => {
            try { return JSON.parse(allocation.tvOutputIds || '[]'); } catch { return []; }
          })();
          const liveOutputIds = currentGameStatus.activeOutputIds || [];
          const outputsOverlap =
            nextOutputIds.length === 0 || // unknown next-outputs → be safe, treat as overlap
            liveOutputIds.length === 0 ||  // unknown live-outputs → be safe, treat as overlap
            nextOutputIds.some((o) => liveOutputIds.includes(o));

          // Safety valve applies ONLY to the unconfirmable (assumed-live) case,
          // and is gated on the CURRENT game's estimated end + a large margin.
          const STALE_ASSUMED_MARGIN_SECONDS = 3 * 3600;
          const liveEstEnd = (game as any).estimatedEnd || 0; // current allocation's own game
          const assumedLiveButStale =
            !currentGameStatus.confirmedLive &&
            liveEstEnd > 0 &&
            nowUnix > liveEstEnd + STALE_ASSUMED_MARGIN_SECONDS;

          // forceOverride is now allowed ONLY when the live game is NOT
          // ESPN-confirmed AND its own data looks stale. A confirmed-live game
          // can NEVER be force-overridden.
          const forceOverride = !currentGameStatus.confirmedLive && assumedLiveButStale;

          // No conflict if the next game's TVs don't overlap the live game's.
          if (currentGameStatus.gameInProgress && !outputsOverlap) {
            logger.info(`[SCHEDULER] ▶️ Tuning ${game.homeTeamName} — no TV overlap with in-progress ${currentGameStatus.gameDescription}; no conflict`);
          } else if (currentGameStatus.gameInProgress && !forceOverride) {
            await schedulerLogger.info(
              'scheduler-service',
              'tune',
              `Delaying tune - scheduled game still in progress: ${currentGameStatus.gameDescription} (${Math.round(timePastScheduled / 60)}min past scheduled)`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                metadata: { status: currentGameStatus.status, timePastScheduled },
              }
            );

            logger.info(`[SCHEDULER] ⏳ Delaying tune - scheduled game still in progress: ${currentGameStatus.gameDescription} (${currentGameStatus.status}) - ${Math.round(timePastScheduled / 60)}min past scheduled`);

            // Enable fast polling (every 15s) while games are delayed
            this.hasDelayedGames = true;

            // Skip this allocation for now, will check again next cycle
            continue;
          }

          if (currentGameStatus.gameInProgress && forceOverride) {
            // Only reachable when the live game is NOT ESPN-confirmed and is 3h+
            // past its own estimated end (live data presumed stale). A
            // confirmed-live game never sets forceOverride, so this can't cut one off.
            logger.warn(`[SCHEDULER] ⚠️ Force-tuning over assumed-but-unconfirmed game (3h+ past its estimated end, live data presumed stale): ${currentGameStatus.gameDescription}`);
          }

          logger.info(`[SCHEDULER] ✅ Ready to execute tune - no game in progress or game has ended`);

          // Call the channel tune API
          const response = await fetch(`http://localhost:${API_PORT}/api/channel-presets/tune`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType,
              // Pass the device ID based on type
              cableBoxId: allocation.inputSourceType === 'cable' ? inputSource.deviceId : undefined,
              directTVId: allocation.inputSourceType === 'directv' ? inputSource.deviceId : undefined,
              fireTVId: allocation.inputSourceType === 'firetv' ? inputSource.deviceId : undefined,
              // v2.32.85 — forward per-event deep link captured at schedule
              // time so streaming tunes can autoplay the specific game
              // instead of landing on the app's home screen. Only set for
              // firetv allocations; null otherwise.
              ...(allocation.inputSourceType === 'firetv' && allocation.deepLink
                ? { deepLink: allocation.deepLink }
                : {}),
            })
          });

          // v2.55.41 OR-gate fix, now routed through the shared parseHardwareResult
          // helper (Wave-1 "one place" invariant — the inline copy used to drift from
          // the matrix/audio route sites). The tune endpoint returns HTTP 200 with
          // {success:false,error:'…'} for soft failures (cable box not found, device
          // offline, channel missing); a raw `result.success || response.ok` flipped
          // the allocation to 'active' + mirrored currentlyAllocated + fired Wolf Pack
          // routing for the WRONG channel while the bartender saw a green tile. Every
          // path (manual/ai/auto/override-learn) routes through here — the single most
          // likely cause of the Greenville-Brewers 'didn't switch'. success===true only.
          const tuneHw = await parseHardwareResult(response);
          const result = tuneHw.body; // alias so downstream result.* references are unchanged
          const tuneDurationMs = Date.now() - tuneStartTime;
          const tuneSucceeded = tuneHw.ok;
          const malformedOk = tuneHw.malformedOk;

          if (malformedOk) {
            // HTTP 200 but no explicit success flag — neither a clear success nor an
            // explicit failure. Log loudly so we catch any tune endpoint that drifts
            // off the {success:true|false, ...} contract; then fall through to the
            // failure branch so we DON'T flip the allocation to 'active' based on a
            // weak signal.
            await schedulerLogger.warn(
              'scheduler-service',
              'tune',
              `Tune returned HTTP 200 but no success flag — treating as failure for allocation ${allocation.id}: ${JSON.stringify(result)}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                channelNumber: allocation.channelNumber,
                deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
                durationMs: tuneDurationMs,
              }
            );
            logger.warn(`[SCHEDULER] ⚠️ Tune returned HTTP 200 but no success flag: ${JSON.stringify(result)}`);
          }

          if (tuneSucceeded) {
            await schedulerLogger.info(
              'scheduler-service',
              'tune',
              `Tune confirmed by API: success=true for allocation ${allocation.id}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                channelNumber: allocation.channelNumber,
                deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              }
            );

            // Update allocation status to 'active' + record the successful tune (v2.82.x telemetry)
            await db.update(schema.inputSourceAllocations)
              .set({
                status: 'active',
                tuneSuccess: true,
                tuneError: null,
                tuneAttempts: ((allocation as any).tuneAttempts ?? 0) + 1,
                tuneLastAttemptAt: nowUnix,
                tuneLatencyMs: tuneDurationMs,
                updatedAt: nowUnix,
              })
              .where(eq(schema.inputSourceAllocations.id, allocation.id));

            // Mirror the active state onto the input_sources row so the
            // scheduler UI (which reads currentlyAllocated / currentChannel)
            // shows the game against the correct cable box / fire TV. Prior
            // to v2.18.0 only the auto-reallocator did this, but it only
            // fires on still-pending allocations — once scheduler-service
            // flipped to 'active' first, the source row never got updated
            // and the UI showed "no game" on that box until restart.
            await db.update(schema.inputSources)
              .set({
                currentlyAllocated: true,
                currentChannel: allocation.channelNumber,
                updatedAt: nowUnix,
              })
              .where(eq(schema.inputSources.id, inputSource.id));

            await schedulerLogger.info(
              'scheduler-service',
              'tune',
              `Successfully tuned ${inputSource.name} to channel ${allocation.channelNumber}`,
              correlationId,
              {
                gameId: game.id,
                inputSourceId: inputSource.id,
                allocationId: allocation.id,
                channelNumber: allocation.channelNumber,
                deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
                durationMs: tuneDurationMs,
              }
            );

            logger.info(`[SCHEDULER] ✅ Successfully tuned ${inputSource.name} to channel ${allocation.channelNumber}`);

            // v2.82.x — Hermes/flywheel capture of the scheduled auto-tune outcome.
            // Success path reports ch + device + TV count + latency; the 0-TV
            // guardrail catches the Greenville mode (game tuned on the box but routed
            // to no screens). Fire-and-forget — never blocks the tune.
            {
              const flLoc = process.env.LOCATION_NAME || process.env.LOCATION_ID || 'unknown';
              const flGame = `${game.homeTeamName} vs ${game.awayTeamName}`;
              let flTvCount = 0;
              try {
                if (allocation.tvOutputIds) {
                  const flOut = JSON.parse(allocation.tvOutputIds);
                  if (Array.isArray(flOut)) flTvCount = flOut.length;
                }
              } catch { /* malformed tvOutputIds — treat as 0, the guardrail will fire */ }
              if (flTvCount === 0) {
                reportSchedulerToFlywheel('fleet-scheduler', `⚠ Scheduler: ${flGame} tuned to ch ${allocation.channelNumber} but 0 TVs routed — game is on no screens @ ${flLoc}`);
              } else {
                reportSchedulerToFlywheel('fleet-scheduler', `Scheduler tuned ${flGame} → ch ${allocation.channelNumber} on ${inputSource.name} for ${flTvCount} TVs (${tuneDurationMs}ms) @ ${flLoc}`);
              }
            }

            // Route matrix inputs to TV outputs if tvOutputIds is set.
            // inputSource.matrixInputId is a UUID FK to MatrixInput.id, NOT the
            // physical input channel. Prior to v2.18.2 this code did
            // parseInt(matrixInputId, 10), which returned NaN for UUIDs that
            // start with a letter and garbage numbers for UUIDs that start
            // with digits (e.g., "99ad..." parsed to 99). Either way the
            // Wolf Pack either rejected the route silently or landed TVs on
            // unrelated inputs, and the bartender had to rescue every
            // scheduled tune by hand. Fix: resolve the UUID to the physical
            // channelNumber via MatrixInput.
            if (allocation.tvOutputIds && inputSource.matrixInputId) {
              try {
                const outputIds: number[] = JSON.parse(allocation.tvOutputIds);
                const matrixInputRow = await db.select({
                    channelNumber: schema.matrixInputs.channelNumber,
                  })
                  .from(schema.matrixInputs)
                  .where(eq(schema.matrixInputs.id, inputSource.matrixInputId))
                  .limit(1)
                  .all();
                let matrixInput = matrixInputRow[0]?.channelNumber ?? NaN;
                // v2.82.55 — tolerate legacy/mis-seeded data where matrix_input_id holds the
                // integer Wolf Pack input number (the MatrixInput.channelNumber) instead of the
                // MatrixInput UUID FK. Without this the UUID lookup above returns nothing →
                // matrixInput=NaN → the route block below is SILENTLY skipped: the channel tunes
                // but the TVs never switch (Holmgren, 2026-06-26 — every scheduled cable/DirecTV
                // tune routed to no screens). If the UUID lookup missed but matrixInputId is a
                // bare integer, use it directly as the Wolf Pack input number.
                if (isNaN(matrixInput) && /^\d+$/.test(String(inputSource.matrixInputId))) {
                  matrixInput = Number(inputSource.matrixInputId);
                  logger.warn(`[SCHEDULER] matrix_input_id="${inputSource.matrixInputId}" is a bare integer, not a MatrixInput UUID — using it directly as Wolf Pack input ${matrixInput}. Run the matrix_input_id→UUID data fix to clean this up.`);
                }

                if (outputIds.length > 0 && !isNaN(matrixInput)) {
                  // v2.31.8 — Use the per-tick claimedOutputs set hoisted
                  // above; previously each successful tune fired a fresh
                  // full-table active-allocations scan inside this loop.
                  // Add this allocation's outputs to the set so subsequent
                  // iterations see the same view (live mutation across
                  // batched tunes, same semantics as the old query result).
                  const safeOutputs = outputIds.filter(o => !tickClaimedOutputs.has(o));
                  const skippedOutputs = outputIds.filter(o => tickClaimedOutputs.has(o));
                  for (const o of safeOutputs) tickClaimedOutputs.add(o);

                  if (skippedOutputs.length > 0) {
                    logger.info(`[SCHEDULER] ⚠️ Skipping outputs [${skippedOutputs.join(', ')}] — already claimed by another active game`);
                  }

                  logger.info(`[SCHEDULER] 🔀 Routing matrix input ${matrixInput} to ${safeOutputs.length} TV outputs: [${safeOutputs.join(', ')}]${skippedOutputs.length > 0 ? ` (skipped ${skippedOutputs.length} conflicting)` : ''}`);

                  for (const outputNumber of safeOutputs) {
                    try {
                      const routeResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/route`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          input: matrixInput,
                          output: outputNumber,
                        }),
                      });

                      // OR-gate fix (Wave 1, intelligence roadmap): a raw
                      // `if (routeResponse.ok)` here treated HTTP 200 +
                      // {success:false} as a routed TV — the allocation was
                      // already flipped to 'active' above, so the TV silently
                      // stayed on the wrong feed. Strict success===true only;
                      // malformed-OK (contract drift) logs loud and is a failure.
                      const routeHw = await parseHardwareResult(routeResponse);
                      if (routeHw.ok) {
                        logger.info(`[SCHEDULER] ✅ Routed matrix input ${matrixInput} → output ${outputNumber}`);

                        // Wave 3c: closed-loop verify (opt-in via ROUTE_VERIFY_ENABLED).
                        // Read the crossbar back; on a GENUINE mismatch re-issue the
                        // idempotent SET, then record the outcome on the allocation's
                        // advisory verify_* columns. Advisory only — never throws into
                        // the tune path, never blocks the allocation lifecycle.
                        if (ROUTE_VERIFY_ENABLED) {
                          try {
                            if (!this.cachedMatrixConfig) {
                              this.cachedMatrixConfig = await db.select()
                                .from(schema.matrixConfigurations)
                                .where(eq(schema.matrixConfigurations.isActive, true))
                                .limit(1).get();
                            }
                            const cfg = this.cachedMatrixConfig;
                            if (cfg?.ipAddress) {
                              const verifyResult = await verifyAndRetryRoute(
                                matrixInput,
                                outputNumber,
                                { ipAddress: cfg.ipAddress },
                                async () => {
                                  const r = await fetch(`http://127.0.0.1:${API_PORT}/api/matrix/route`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ input: matrixInput, output: outputNumber }),
                                  });
                                  return (await parseHardwareResult(r)).ok;
                                },
                              );
                              await persistVerifyState(allocation.id, verifyResult);
                              if (verifyResult.state === 'failed') {
                                logger.error(`[SCHEDULER] ⚠️ Route verify FAILED input ${matrixInput} → output ${outputNumber} after ${verifyResult.attempts} resend(s): ${verifyResult.error || 'persistent mismatch'} (actualInput=${verifyResult.actualInput})`);
                              } else {
                                logger.info(`[SCHEDULER] 🔎 Route verify ${verifyResult.state} input ${matrixInput} → output ${outputNumber} (attempts=${verifyResult.attempts})`);
                              }
                            }
                          } catch (verifyError: any) {
                            logger.warn(`[SCHEDULER] route verify errored (advisory, ignored) input ${matrixInput} → output ${outputNumber}:`, { error: verifyError?.message || verifyError });
                          }
                        }
                      } else {
                        if (routeHw.malformedOk) {
                          logger.warn(`[SCHEDULER] ⚠️ Matrix route returned HTTP 200 but no success flag (contract drift) input ${matrixInput} → output ${outputNumber}: ${JSON.stringify(routeHw.body)} — treating as FAILURE`);
                        }
                        logger.error(`[SCHEDULER] ❌ Failed to route matrix input ${matrixInput} → output ${outputNumber}: ${routeHw.error}`);
                      }
                    } catch (routeError: any) {
                      logger.error(`[SCHEDULER] ❌ Error routing matrix input ${matrixInput} → output ${outputNumber}:`, { error: routeError });
                    }
                  }

                  await schedulerLogger.info(
                    'scheduler-service',
                    'tune',
                    `Matrix routing complete: input ${matrixInput} → outputs [${outputIds.join(', ')}]`,
                    correlationId,
                    {
                      gameId: game.id,
                      inputSourceId: inputSource.id,
                      allocationId: allocation.id,
                      metadata: { matrixInput, outputIds },
                    }
                  );
                }
              } catch (parseError: any) {
                logger.error(`[SCHEDULER] ❌ Error parsing tvOutputIds for allocation ${allocation.id}:`, { error: parseError, tvOutputIds: allocation.tvOutputIds });
              }
            }

            // Switch audio zones if audio source is configured
            if (allocation.audioSourceIndex != null && allocation.audioZoneIds) {
              try {
                // Get the game's audio physically onto the Atlas source FIRST by
                // routing its Wolf Pack input into the per-location audio-feed
                // output. Pointing the zones at the source (below) is useless if
                // nothing routed the game into that feed. (Greenville Brewers,
                // 2026-06-30: zones followed, audio didn't — feed never routed.)
                await this.routeGameAudioFeed(inputSource, allocation.audioSourceIndex, correlationId, game, allocation);

                const audioZones: number[] = JSON.parse(allocation.audioZoneIds);
                if (audioZones.length > 0) {
                  // v2.31.8 — Cache the audio processor lookup. It's a single
                  // hardware row that never changes at runtime; previously
                  // re-queried for every allocation that had audio zones.
                  if (!this.cachedAudioProcessor) {
                    this.cachedAudioProcessor = await db.select().from(schema.audioProcessors).get();
                  }
                  const processor = this.cachedAudioProcessor;
                  if (!processor) {
                    logger.error('[SCHEDULER] ❌ No audio processor found in database — skipping audio zone switching');
                  } else {
                    logger.info(`[SCHEDULER] 🔊 Switching ${audioZones.length} audio zone(s) to source ${allocation.audioSourceIndex}${allocation.audioSourceName ? ` (${allocation.audioSourceName})` : ''}`);

                    const failedZones: number[] = []
                    for (const zoneNumber of audioZones) {
                      try {
                        const audioResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/audio-processor/control`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            processorId: processor.id,
                            command: {
                              action: 'source',
                              zone: zoneNumber + 1,
                              value: allocation.audioSourceIndex,
                            },
                          }),
                        });

                        const audioHw = await parseHardwareResult(audioResponse);
                        if (audioHw.ok) {
                          logger.info(`[SCHEDULER] ✅ Audio zone ${zoneNumber} → source ${allocation.audioSourceIndex}`);
                        } else {
                          if (audioHw.malformedOk) {
                            logger.warn(`[SCHEDULER] ⚠️ Audio switch returned HTTP 200 but no success flag (contract drift) zone ${zoneNumber}: ${JSON.stringify(audioHw.body)} — treating as FAILURE`);
                          }
                          logger.error(`[SCHEDULER] ❌ Failed to switch audio zone ${zoneNumber}: ${audioHw.error}`);
                          failedZones.push(zoneNumber)
                        }
                      } catch (audioError: any) {
                        logger.error(`[SCHEDULER] ❌ Error switching audio zone ${zoneNumber}:`, { error: audioError });
                        failedZones.push(zoneNumber)
                      }
                    }

                    // v2.82.x — persist the audio-zone switch outcome so an "audio didn't follow
                    // video" failure is visible on the allocation, not just in PM2 logs.
                    await db.update(schema.inputSourceAllocations)
                      .set({
                        audioZoneSuccess: failedZones.length === 0,
                        audioZoneError: failedZones.length
                          ? `zones [${failedZones.join(', ')}] failed to switch to source ${allocation.audioSourceIndex}`
                          : null,
                        updatedAt: nowUnix,
                      })
                      .where(eq(schema.inputSourceAllocations.id, allocation.id))

                    await schedulerLogger.info(
                      'scheduler-service',
                      'tune',
                      `Audio zone switching complete: zones [${audioZones.join(', ')}] → source ${allocation.audioSourceIndex}`,
                      correlationId,
                      {
                        gameId: game.id,
                        inputSourceId: inputSource.id,
                        allocationId: allocation.id,
                        metadata: { audioSourceIndex: allocation.audioSourceIndex, audioZones },
                      }
                    );
                  }
                }
              } catch (audioParseError: any) {
                logger.error(`[SCHEDULER] ❌ Error parsing audioZoneIds for allocation ${allocation.id}:`, { error: audioParseError, audioZoneIds: allocation.audioZoneIds });
              }
            }
          } else {
            await schedulerLogger.log({
              correlationId,
              component: 'scheduler-service',
              operation: 'tune',
              level: 'error',
              message: `Failed to tune ${inputSource.name}`,
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              success: false,
              durationMs: tuneDurationMs,
              errorMessage: result.error || result.message || 'Unknown error',
            });

            logger.error(`[SCHEDULER] ❌ Failed to tune ${inputSource.name}: ${result.error || result.message}`);

            // v2.82.x — Hermes/flywheel capture of the failed scheduled tune.
            {
              const flLoc = process.env.LOCATION_NAME || process.env.LOCATION_ID || 'unknown';
              const flErr = String(result.error || result.message || 'Unknown error').slice(0, 300);
              reportSchedulerToFlywheel('fleet-scheduler', `Scheduler FAILED to tune ${game.homeTeamName} vs ${game.awayTeamName} → ch ${allocation.channelNumber} on ${inputSource.name}: ${flErr} @ ${flLoc}`);
            }

            // v2.82.x — record the failed tune + give up after a cap OR once the game window has
            // passed, so a bad tune (box offline, unknown channel) stops re-hammering every tick
            // and the failure becomes visible instead of the allocation hanging 'pending' forever.
            const attempts = ((allocation as any).tuneAttempts ?? 0) + 1
            const reason = String(result.error || result.message || 'Unknown tune error').slice(0, 500)
            const giveUp = attempts >= 5 || nowUnix > (allocation.allocatedAt + 2 * 3600)
            await db.update(schema.inputSourceAllocations)
              .set({
                tuneSuccess: false,
                tuneError: reason,
                tuneAttempts: attempts,
                tuneLastAttemptAt: nowUnix,
                tuneLatencyMs: tuneDurationMs,
                ...(giveUp ? { status: 'failed' as const } : {}),
                updatedAt: nowUnix,
              })
              .where(eq(schema.inputSourceAllocations.id, allocation.id))
            if (giveUp) {
              logger.error(`[SCHEDULER] ⛔ Allocation ${allocation.id} marked FAILED after ${attempts} tune attempt(s) — last error: ${reason}`)
              await schedulerLogger.warn('scheduler-service', 'tune', `Allocation ${allocation.id} FAILED after ${attempts} attempts: ${reason}`, correlationId, { gameId: game.id, inputSourceId: inputSource.id, allocationId: allocation.id })
            }
          }
        } catch (tuneError: any) {
          await schedulerLogger.error(
            'scheduler-service',
            'tune',
            `Error executing scheduled tune for ${inputSource.name}`,
            correlationId,
            tuneError,
            {
              gameId: game.id,
              inputSourceId: inputSource.id,
              allocationId: allocation.id,
              channelNumber: allocation.channelNumber,
              deviceType: allocation.inputSourceType as 'cable' | 'directv' | 'firetv',
              durationMs: Date.now() - tuneStartTime,
            }
          );

          logger.error(`[SCHEDULER] ❌ Error executing scheduled tune for ${inputSource.name}:`, { error: tuneError });
          // v2.82.x — Hermes/flywheel capture of the exception-path tune failure.
          {
            const flLoc = process.env.LOCATION_NAME || process.env.LOCATION_ID || 'unknown';
            const flErr = String(tuneError?.message || tuneError || 'tune exception').slice(0, 300);
            reportSchedulerToFlywheel('fleet-scheduler', `Scheduler FAILED to tune ${game.homeTeamName} vs ${game.awayTeamName} → ch ${allocation.channelNumber} on ${inputSource.name}: ${flErr} @ ${flLoc}`);
          }
          // v2.82.x — exception path (box unreachable / fetch threw) also records the failure +
          // gives up after the cap/window so it doesn't hang 'pending' forever. Best-effort.
          try {
            const attempts = ((allocation as any).tuneAttempts ?? 0) + 1
            const reason = String(tuneError?.message || tuneError || 'tune exception').slice(0, 500)
            const giveUp = attempts >= 5 || nowUnix > (allocation.allocatedAt + 2 * 3600)
            await db.update(schema.inputSourceAllocations)
              .set({ tuneSuccess: false, tuneError: reason, tuneAttempts: attempts, tuneLastAttemptAt: nowUnix, tuneLatencyMs: (Date.now() - tuneStartTime), ...(giveUp ? { status: 'failed' as const } : {}), updatedAt: nowUnix })
              .where(eq(schema.inputSourceAllocations.id, allocation.id))
            if (giveUp) logger.error(`[SCHEDULER] ⛔ Allocation ${allocation.id} marked FAILED after ${attempts} attempt(s) (exception): ${reason}`)
          } catch { /* best-effort telemetry — never let it mask the original error */ }
        }
      }

      await schedulerLogger.debug(
        'scheduler-service',
        'check',
        `Bartender schedule check complete - processed ${dueAllocations.length} allocations`,
        correlationId,
        { durationMs: Date.now() - startTime }
      );
    } catch (error: any) {
      await schedulerLogger.error(
        'scheduler-service',
        'check',
        'Error checking bartender schedules',
        correlationId,
        error,
        { durationMs: Date.now() - startTime }
      );

      logger.error('[SCHEDULER] ❌ Error checking bartender schedules:', { error });
    }
  }

  /**
   * Check if there's a game currently in progress on a given input source
   * Uses ESPN API to verify game status.
   *
   * v2.31.8 — Optimizations:
   *  * status='active' filter pushed into the SQL WHERE (was fetching the
   *    full per-input allocation history and filtering in JS — full-table
   *    scan brought into Node memory every tick on a long-running install).
   *  * Optional `liveData` parameter lets the caller pass in the ESPN
   *    snapshot once per tick instead of refetching it per allocation
   *    (callers that do N invocations per tick previously triggered N
   *    loopback fetches to the same endpoint within the same scheduler run).
   */
  private async checkCurrentGameStatus(inputSourceId: string, liveData?: any): Promise<{
    gameInProgress: boolean;
    gameDescription?: string;
    status?: string;
    // v2.82.52 — true ONLY when ESPN positively confirms in-progress (incl.
    // extra innings / OT). Distinct from gameInProgress, which is also true for
    // the 'assumed_in_progress' wall-clock fallback when ESPN can't confirm.
    // The caller's safety-valve override must NEVER fire on a confirmedLive game.
    confirmedLive?: boolean;
    activeAllocationId?: string;
    activeOutputIds?: number[];
  }> {
    try {
      const activeAlloc = await db.select({
        allocation: schema.inputSourceAllocations,
        game: schema.gameSchedules,
      })
      .from(schema.inputSourceAllocations)
      .innerJoin(schema.gameSchedules, eq(schema.inputSourceAllocations.gameScheduleId, schema.gameSchedules.id))
      .where(and(
        eq(schema.inputSourceAllocations.inputSourceId, inputSourceId),
        eq(schema.inputSourceAllocations.status, 'active')
      ))
      .limit(1)
      .get();

      if (!activeAlloc) {
        return { gameInProgress: false };
      }

      const { game } = activeAlloc;
      const gameDescription = `${game.awayTeamName} @ ${game.homeTeamName}`;

      // v2.82.52 — capture the live game's claimed outputs so the caller can
      // tell whether a NEXT game would actually steal a TV from it.
      let activeOutputIds: number[] = [];
      try {
        activeOutputIds = JSON.parse(activeAlloc.allocation.tvOutputIds || '[]');
      } catch { /* malformed → treat as no known outputs */ }
      const activeAllocationId = activeAlloc.allocation.id;

      // Check ESPN API for live game status
      if (game.espnEventId && !game.espnEventId.startsWith('bartender-')) {
        try {
          if (!liveData) {
            const espnResponse = await fetch(`http://127.0.0.1:${API_PORT}/api/scheduling/live-status`);
            if (espnResponse.ok) {
              liveData = await espnResponse.json();
            }
          }
          if (liveData) {

            if (liveData.success && liveData.games) {
              // Find this specific game in live data
              const liveGame = liveData.games.find((g: any) =>
                g.espnGameId === game.espnEventId ||
                (g.homeTeam === game.homeTeamName && g.awayTeam === game.awayTeamName)
              );

              if (liveGame) {
                const status = liveGame.status?.toLowerCase() || '';
                const isInProgress = liveGame.isLive === true ||
                  status.includes('in progress') ||
                  status.includes('halftime') ||
                  status.includes('inning') || // v2.82.52 — MLB incl. extra innings
                  status.includes('1st') ||
                  status.includes('2nd') ||
                  status.includes('3rd') ||
                  status.includes('4th') ||
                  status.includes('quarter') ||
                  status.includes('period') ||
                  status.includes('overtime');

                const isCompleted = status.includes('final') ||
                  status.includes('end') ||
                  status.includes('completed') ||
                  status.includes('postponed') ||
                  status.includes('cancelled');

                if (isCompleted) {
                  logger.info(`[SCHEDULER] Game ${gameDescription} has ended (${liveGame.status})`);

                  // Mark the allocation as completed
                  await db.update(schema.inputSourceAllocations)
                    .set({
                      status: 'completed',
                      actuallyFreedAt: Math.floor(Date.now() / 1000),
                      updatedAt: Math.floor(Date.now() / 1000),
                    })
                    .where(eq(schema.inputSourceAllocations.id, activeAlloc.allocation.id));

                  return { gameInProgress: false, gameDescription, status: liveGame.status };
                }

                if (isInProgress) {
                  return {
                    gameInProgress: true,
                    confirmedLive: true, // ESPN positively confirms in-progress
                    gameDescription,
                    status: liveGame.status || liveGame.timeRemaining,
                    activeAllocationId,
                    activeOutputIds,
                  };
                }
              }
            }
          }
        } catch (espnError) {
          logger.warn(`[SCHEDULER] Could not fetch ESPN status for ${gameDescription}:`, { error: espnError });
        }
      }

      // Fallback: Check estimated end time
      const now = Math.floor(Date.now() / 1000);
      const estimatedEnd = game.estimatedEnd || 0;

      if (estimatedEnd > 0 && now >= estimatedEnd) {
        // Game should be over based on estimated time
        logger.info(`[SCHEDULER] Game ${gameDescription} should be over (estimated end passed)`);

        // Mark as completed
        await db.update(schema.inputSourceAllocations)
          .set({
            status: 'completed',
            actuallyFreedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.inputSourceAllocations.id, activeAlloc.allocation.id));

        return { gameInProgress: false, gameDescription, status: 'estimated_complete' };
      }

      // If scheduled start is in the past but we can't confirm status, assume it might still be on
      const scheduledStart = game.scheduledStart || 0;
      if (scheduledStart > 0 && now > scheduledStart && now < (estimatedEnd || scheduledStart + 4 * 3600)) {
        return {
          gameInProgress: true,
          confirmedLive: false, // wall-clock assumption only — ESPN did not confirm
          gameDescription,
          status: 'assumed_in_progress',
          activeAllocationId,
          activeOutputIds,
        };
      }

      return { gameInProgress: false };
    } catch (error) {
      logger.error('[SCHEDULER] Error checking current game status:', { error });
      // On error, assume no game in progress to avoid blocking scheduled tunes
      return { gameInProgress: false };
    }
  }
}

// Export a singleton instance
export const schedulerService = new SchedulerService();

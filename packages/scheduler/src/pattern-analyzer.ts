/**
 * Pattern Analyzer Service
 *
 * Analyzes scheduling history from the database to extract patterns
 * that the AI can use for future scheduling suggestions.
 *
 * READ ONLY against existing tables (input_source_allocations, game_schedules,
 * input_sources, audio_volume_logs, etc.). Writes ONLY to new tables:
 * scheduling_patterns, scheduling_preferences.
 */

import { db, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { HARDWARE_CONFIG } from '@sports-bar/config'

// ============================================================================
// Types
// ============================================================================

export interface TeamRoutingPattern {
  team: string;
  preferredInput: string;
  preferredInputId: string;
  preferredOutputs: number[];
  frequency: number;
}

export interface LeaguePriorityPattern {
  league: string;
  avgTVs: number;
  scheduleCount: number;
}

export interface TimeSlotPattern {
  hourRange: string;
  avgBoxes: number;
  peakBoxes: number;
}

export interface AudioVolumePattern {
  patternKey: string;
  patternType: 'team_volume' | 'timeslot_volume' | 'dj_volume';
  data: {
    teamName?: string;
    timeSlot?: string;
    zoneNumber: number;
    zoneName: string;
    avgVolume: number;
    isHomeGame?: boolean;
    sampleCount: number;
  };
}

export interface PatternAnalysisResult {
  teamRouting: TeamRoutingPattern[];
  leaguePriority: LeaguePriorityPattern[];
  timeSlots: TimeSlotPattern[];
  audioVolume: AudioVolumePattern[];
  analyzedAt: number;
}

// ============================================================================
// Table Creation SQL
// ============================================================================

const CREATE_SCHEDULING_PATTERNS_TABLE = `
  CREATE TABLE IF NOT EXISTS scheduling_patterns (
    id TEXT PRIMARY KEY NOT NULL,
    pattern_type TEXT NOT NULL,
    pattern_key TEXT NOT NULL,
    pattern_data TEXT NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    confidence REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(pattern_type, pattern_key)
  )
`

const CREATE_SCHEDULING_PREFERENCES_TABLE = `
  CREATE TABLE IF NOT EXISTS scheduling_preferences (
    id TEXT PRIMARY KEY NOT NULL,
    preference_type TEXT NOT NULL,
    team_id TEXT,
    team_name TEXT,
    league TEXT,
    preference_data TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 50,
    confidence REAL NOT NULL DEFAULT 0.5,
    source TEXT NOT NULL DEFAULT 'learned',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`

// ============================================================================
// Pattern Analyzer Class
// ============================================================================

class PatternAnalyzer {
  private tablesInitialized = false;

  /**
   * Ensure the scheduling_patterns and scheduling_preferences tables exist.
   * Called lazily before any write operation.
   */
  private async ensureTables(): Promise<void> {
    if (this.tablesInitialized) return;

    try {
      await db.run(sql.raw(CREATE_SCHEDULING_PATTERNS_TABLE));
      await db.run(sql.raw(CREATE_SCHEDULING_PREFERENCES_TABLE));
      this.tablesInitialized = true;
      logger.debug('[PATTERN-ANALYZER] Tables initialized');
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Failed to create tables:', { error });
      throw error;
    }
  }

  /**
   * Generate a simple UUID-like ID for new rows.
   */
  private generateId(): string {
    return `pat_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  // ==========================================================================
  // 1. Team Routing Patterns
  // ==========================================================================

  /**
   * For each team, determine which cable box (input source) and TV outputs
   * are typically assigned.
   *
   * Queries completed/active allocations joined with game_schedules.
   * Groups by team name, counts which input_source is used most and
   * which tv_output_ids combinations are used most.
   */
  async analyzeTeamRoutingPatterns(): Promise<TeamRoutingPattern[]> {
    try {
      logger.info('[PATTERN-ANALYZER] Analyzing team routing patterns...');

      // Query allocations joined with games and input sources.
      // We look at both home and away teams in separate passes, then merge.
      const rows = await db.all(sql`
        SELECT
          gs.home_team_name AS team_name,
          isa.input_source_id,
          ins.name AS input_source_name,
          isa.tv_output_ids,
          COUNT(*) AS use_count
        FROM input_source_allocations isa
        INNER JOIN game_schedules gs
          ON isa.game_schedule_id = gs.id
        INNER JOIN input_sources ins
          ON isa.input_source_id = ins.id
        WHERE isa.status IN ('active', 'completed')
        GROUP BY gs.home_team_name, isa.input_source_id
        UNION ALL
        SELECT
          gs.away_team_name AS team_name,
          isa.input_source_id,
          ins.name AS input_source_name,
          isa.tv_output_ids,
          COUNT(*) AS use_count
        FROM input_source_allocations isa
        INNER JOIN game_schedules gs
          ON isa.game_schedule_id = gs.id
        INNER JOIN input_sources ins
          ON isa.input_source_id = ins.id
        WHERE isa.status IN ('active', 'completed')
        GROUP BY gs.away_team_name, isa.input_source_id
      `) as Array<{
        team_name: string;
        input_source_id: string;
        input_source_name: string;
        tv_output_ids: string;
        use_count: number;
      }>;

      if (!rows || rows.length === 0) {
        logger.info('[PATTERN-ANALYZER] No team routing data found');
        return [];
      }

      // Aggregate: for each team, find the most-used input and collect all output IDs
      const teamMap = new Map<string, {
        inputCounts: Map<string, { name: string; count: number }>;
        allOutputs: Map<number, number>; // output ID -> frequency
        totalFrequency: number;
      }>();

      for (const row of rows) {
        if (!row.team_name) continue;

        let entry = teamMap.get(row.team_name);
        if (!entry) {
          entry = {
            inputCounts: new Map(),
            allOutputs: new Map(),
            totalFrequency: 0,
          };
          teamMap.set(row.team_name, entry);
        }

        // Count input source usage
        const existing = entry.inputCounts.get(row.input_source_id);
        if (existing) {
          existing.count += row.use_count;
        } else {
          entry.inputCounts.set(row.input_source_id, {
            name: row.input_source_name,
            count: row.use_count,
          });
        }

        // Parse and count TV output IDs
        if (row.tv_output_ids) {
          try {
            const outputIds: number[] = JSON.parse(row.tv_output_ids);
            for (const outputId of outputIds) {
              entry.allOutputs.set(outputId, (entry.allOutputs.get(outputId) || 0) + row.use_count);
            }
          } catch {
            // tv_output_ids might be comma-separated instead of JSON
            const parts = row.tv_output_ids.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            for (const outputId of parts) {
              entry.allOutputs.set(outputId, (entry.allOutputs.get(outputId) || 0) + row.use_count);
            }
          }
        }

        entry.totalFrequency += row.use_count;
      }

      // Build result array
      const patterns: TeamRoutingPattern[] = [];

      for (const [team, entry] of teamMap) {
        // Find the most-used input source
        let bestInputId = '';
        let bestInputName = '';
        let bestInputCount = 0;

        for (const [inputId, data] of entry.inputCounts) {
          if (data.count > bestInputCount) {
            bestInputCount = data.count;
            bestInputId = inputId;
            bestInputName = data.name;
          }
        }

        // Sort outputs by frequency (descending) and take the ones used more than once
        const sortedOutputs = [...entry.allOutputs.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([outputId]) => outputId);

        patterns.push({
          team,
          preferredInput: bestInputName,
          preferredInputId: bestInputId,
          preferredOutputs: sortedOutputs,
          frequency: entry.totalFrequency,
        });
      }

      // Sort by frequency descending
      patterns.sort((a, b) => b.frequency - a.frequency);

      logger.info(`[PATTERN-ANALYZER] Found routing patterns for ${patterns.length} teams`);
      return patterns;
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Error analyzing team routing patterns:', { error });
      return [];
    }
  }

  // ==========================================================================
  // 2. League Priority Patterns
  // ==========================================================================

  /**
   * Determine which leagues tend to get more TVs and are scheduled more often.
   *
   * Counts the average number of TV outputs per allocation per league and
   * how often each league gets scheduled.
   */
  async analyzeLeaguePriorityPatterns(): Promise<LeaguePriorityPattern[]> {
    try {
      logger.info('[PATTERN-ANALYZER] Analyzing league priority patterns...');

      const rows = await db.all(sql`
        SELECT
          gs.league,
          COUNT(DISTINCT isa.id) AS schedule_count,
          SUM(isa.tv_count) AS total_tvs,
          CAST(SUM(isa.tv_count) AS REAL) / COUNT(DISTINCT isa.id) AS avg_tvs
        FROM input_source_allocations isa
        INNER JOIN game_schedules gs
          ON isa.game_schedule_id = gs.id
        WHERE isa.status IN ('active', 'completed')
        GROUP BY gs.league
        ORDER BY avg_tvs DESC
      `) as Array<{
        league: string;
        schedule_count: number;
        total_tvs: number;
        avg_tvs: number;
      }>;

      if (!rows || rows.length === 0) {
        logger.info('[PATTERN-ANALYZER] No league priority data found');
        return [];
      }

      const patterns: LeaguePriorityPattern[] = rows.map(row => ({
        league: row.league,
        avgTVs: Math.round(row.avg_tvs * 10) / 10, // Round to 1 decimal
        scheduleCount: row.schedule_count,
      }));

      logger.info(`[PATTERN-ANALYZER] Found priority patterns for ${patterns.length} leagues`);
      return patterns;
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Error analyzing league priority patterns:', { error });
      return [];
    }
  }

  // ==========================================================================
  // 3. Time Slot Patterns
  // ==========================================================================

  /**
   * Analyze how many input sources (cable boxes) are used by time of day.
   *
   * Groups allocations by hour of day based on the game's scheduled_start,
   * counts active boxes per time slot, and calculates average and peak usage.
   */
  async analyzeTimeSlotPatterns(): Promise<TimeSlotPattern[]> {
    try {
      logger.info('[PATTERN-ANALYZER] Analyzing time slot patterns...');

      // Get allocation data with the game's scheduled start time.
      // We use the venue timezone to extract the local hour.
      // SQLite doesn't natively handle timezones in strftime, so we do the
      // hour extraction in JS after fetching.
      const rows = await db.all(sql`
        SELECT
          gs.scheduled_start,
          isa.id AS allocation_id,
          isa.input_source_id
        FROM input_source_allocations isa
        INNER JOIN game_schedules gs
          ON isa.game_schedule_id = gs.id
        WHERE isa.status IN ('active', 'completed')
        ORDER BY gs.scheduled_start
      `) as Array<{
        scheduled_start: number;
        allocation_id: string;
        input_source_id: string;
      }>;

      if (!rows || rows.length === 0) {
        logger.info('[PATTERN-ANALYZER] No time slot data found');
        return [];
      }

      // Group by hour of day (in venue local time)
      // hourBuckets maps hour -> array of { date, inputSourceId } so we can
      // count unique boxes per day per hour.
      const hourBuckets = new Map<number, Map<string, Set<string>>>();

      for (const row of rows) {
        // Convert Unix timestamp to local hour in venue timezone
        const date = new Date(row.scheduled_start * 1000);
        const localHour = parseInt(
          date.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: HARDWARE_CONFIG.venue.timezone }),
          10
        );
        const dateKey = date.toLocaleDateString('en-US', { timeZone: HARDWARE_CONFIG.venue.timezone });

        let dayMap = hourBuckets.get(localHour);
        if (!dayMap) {
          dayMap = new Map();
          hourBuckets.set(localHour, dayMap);
        }

        let inputSet = dayMap.get(dateKey);
        if (!inputSet) {
          inputSet = new Set();
          dayMap.set(dateKey, inputSet);
        }

        inputSet.add(row.input_source_id);
      }

      // Build time slot patterns in 3-hour ranges
      const slotRanges = [
        { start: 8, end: 11, label: '8-11' },
        { start: 11, end: 14, label: '11-14' },
        { start: 14, end: 17, label: '14-17' },
        { start: 17, end: 20, label: '17-20' },
        { start: 20, end: 23, label: '20-23' },
        { start: 23, end: 26, label: '23-2' }, // Late night wraps past midnight
      ];

      const patterns: TimeSlotPattern[] = [];

      for (const range of slotRanges) {
        // Collect all day-level box counts for hours in this range
        const dailyBoxCounts: number[] = [];
        const dayBoxSets = new Map<string, Set<string>>();

        for (let h = range.start; h < range.end; h++) {
          const hour = h % 24; // Handle wrap-around
          const dayMap = hourBuckets.get(hour);
          if (!dayMap) continue;

          for (const [dateKey, inputSet] of dayMap) {
            let existing = dayBoxSets.get(dateKey);
            if (!existing) {
              existing = new Set();
              dayBoxSets.set(dateKey, existing);
            }
            for (const inputId of inputSet) {
              existing.add(inputId);
            }
          }
        }

        // Calculate avg and peak from daily counts
        for (const [, inputSet] of dayBoxSets) {
          dailyBoxCounts.push(inputSet.size);
        }

        if (dailyBoxCounts.length === 0) {
          patterns.push({
            hourRange: range.label,
            avgBoxes: 0,
            peakBoxes: 0,
          });
          continue;
        }

        const totalBoxes = dailyBoxCounts.reduce((sum, c) => sum + c, 0);
        const avgBoxes = Math.round((totalBoxes / dailyBoxCounts.length) * 10) / 10;
        const peakBoxes = Math.max(...dailyBoxCounts);

        patterns.push({
          hourRange: range.label,
          avgBoxes,
          peakBoxes,
        });
      }

      logger.info(`[PATTERN-ANALYZER] Analyzed ${slotRanges.length} time slot ranges`);
      return patterns;
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Error analyzing time slot patterns:', { error });
      return [];
    }
  }

  // ==========================================================================
  // 4. Audio Volume Patterns
  // ==========================================================================

  /**
   * Analyze audio volume logs to extract patterns:
   * - Team + zone volume patterns (what volume per zone when a team is playing)
   * - Time slot volume patterns (what volume per zone per time slot)
   * - DJ mode volume patterns (typical volumes when DJ mode is active)
   *
   * Queries the audio_volume_logs table (most recent 1000 entries).
   */
  async analyzeAudioVolumePatterns(): Promise<AudioVolumePattern[]> {
    try {
      logger.info('[PATTERN-ANALYZER] Analyzing audio volume patterns...');

      const rows = await db.all(sql`
        SELECT zone_number, zone_name, new_volume, active_league, active_home_team, active_away_team,
               is_home_game, day_of_week, hour_of_day, time_slot, current_source, is_dj_mode
        FROM audio_volume_logs
        ORDER BY created_at DESC
        LIMIT 1000
      `) as Array<{
        zone_number: number;
        zone_name: string | null;
        new_volume: number;
        active_league: string | null;
        active_home_team: string | null;
        active_away_team: string | null;
        is_home_game: boolean | null;
        day_of_week: string | null;
        hour_of_day: number | null;
        time_slot: string | null;
        current_source: string | null;
        is_dj_mode: boolean | null;
      }>;

      if (!rows || rows.length === 0) {
        logger.info('[PATTERN-ANALYZER] No audio volume log data found');
        return [];
      }

      const patterns: AudioVolumePattern[] = [];

      // ---------------------------------------------------------------
      // 4a. Team + zone volume patterns
      // ---------------------------------------------------------------
      // Key: "{teamName}_{zoneNumber}" -> { totalVolume, count, zoneName, isHomeGame }
      const teamZoneMap = new Map<string, {
        teamName: string;
        zoneNumber: number;
        zoneName: string;
        totalVolume: number;
        count: number;
        isHomeGame: boolean | null;
      }>();

      for (const row of rows) {
        // Process home team
        if (row.active_home_team) {
          const key = `${row.active_home_team}_${row.zone_number}`;
          let entry = teamZoneMap.get(key);
          if (!entry) {
            entry = {
              teamName: row.active_home_team,
              zoneNumber: row.zone_number,
              zoneName: row.zone_name || `Zone ${row.zone_number}`,
              totalVolume: 0,
              count: 0,
              isHomeGame: row.is_home_game ?? null,
            };
            teamZoneMap.set(key, entry);
          }
          entry.totalVolume += row.new_volume;
          entry.count++;
        }

        // Process away team
        if (row.active_away_team) {
          const key = `${row.active_away_team}_${row.zone_number}`;
          let entry = teamZoneMap.get(key);
          if (!entry) {
            entry = {
              teamName: row.active_away_team,
              zoneNumber: row.zone_number,
              zoneName: row.zone_name || `Zone ${row.zone_number}`,
              totalVolume: 0,
              count: 0,
              isHomeGame: row.is_home_game != null ? !row.is_home_game : null,
            };
            teamZoneMap.set(key, entry);
          }
          entry.totalVolume += row.new_volume;
          entry.count++;
        }
      }

      for (const [, entry] of teamZoneMap) {
        const avgVolume = Math.round(entry.totalVolume / entry.count);
        patterns.push({
          patternKey: `team_volume_${entry.teamName}_${entry.zoneNumber}`,
          patternType: 'team_volume',
          data: {
            teamName: entry.teamName,
            zoneNumber: entry.zoneNumber,
            zoneName: entry.zoneName,
            avgVolume,
            isHomeGame: entry.isHomeGame ?? undefined,
            sampleCount: entry.count,
          },
        });
      }

      // ---------------------------------------------------------------
      // 4b. Time slot + zone volume patterns
      // ---------------------------------------------------------------
      const timeSlotZoneMap = new Map<string, {
        timeSlot: string;
        zoneNumber: number;
        zoneName: string;
        totalVolume: number;
        count: number;
      }>();

      for (const row of rows) {
        if (!row.time_slot) continue;

        const key = `${row.time_slot}_${row.zone_number}`;
        let entry = timeSlotZoneMap.get(key);
        if (!entry) {
          entry = {
            timeSlot: row.time_slot,
            zoneNumber: row.zone_number,
            zoneName: row.zone_name || `Zone ${row.zone_number}`,
            totalVolume: 0,
            count: 0,
          };
          timeSlotZoneMap.set(key, entry);
        }
        entry.totalVolume += row.new_volume;
        entry.count++;
      }

      for (const [, entry] of timeSlotZoneMap) {
        const avgVolume = Math.round(entry.totalVolume / entry.count);
        patterns.push({
          patternKey: `timeslot_volume_${entry.timeSlot}_${entry.zoneNumber}`,
          patternType: 'timeslot_volume',
          data: {
            timeSlot: entry.timeSlot,
            zoneNumber: entry.zoneNumber,
            zoneName: entry.zoneName,
            avgVolume,
            sampleCount: entry.count,
          },
        });
      }

      // ---------------------------------------------------------------
      // 4c. DJ mode volume patterns
      // ---------------------------------------------------------------
      const djZoneMap = new Map<number, {
        zoneNumber: number;
        zoneName: string;
        totalVolume: number;
        count: number;
      }>();

      for (const row of rows) {
        if (!row.is_dj_mode) continue;

        let entry = djZoneMap.get(row.zone_number);
        if (!entry) {
          entry = {
            zoneNumber: row.zone_number,
            zoneName: row.zone_name || `Zone ${row.zone_number}`,
            totalVolume: 0,
            count: 0,
          };
          djZoneMap.set(row.zone_number, entry);
        }
        entry.totalVolume += row.new_volume;
        entry.count++;
      }

      for (const [, entry] of djZoneMap) {
        const avgVolume = Math.round(entry.totalVolume / entry.count);
        patterns.push({
          patternKey: `dj_volume_${entry.zoneNumber}`,
          patternType: 'dj_volume',
          data: {
            zoneNumber: entry.zoneNumber,
            zoneName: entry.zoneName,
            avgVolume,
            sampleCount: entry.count,
          },
        });
      }

      logger.info(
        `[PATTERN-ANALYZER] Found ${patterns.length} audio volume patterns ` +
        `(${teamZoneMap.size} team, ${timeSlotZoneMap.size} timeslot, ${djZoneMap.size} dj)`
      );
      return patterns;
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Error analyzing audio volume patterns:', { error });
      return [];
    }
  }

  // ==========================================================================
  // 5. Analyze All & Persist
  // ==========================================================================

  /**
   * Run all analyzers and save results to the scheduling_patterns table.
   * Uses INSERT OR REPLACE to upsert rows keyed by (pattern_type, pattern_key).
   */
  async analyzeAll(): Promise<PatternAnalysisResult> {
    const startTime = Date.now();
    logger.info('[PATTERN-ANALYZER] Starting full pattern analysis...');

    await this.ensureTables();

    const [teamRouting, leaguePriority, timeSlots, audioVolume] = await Promise.all([
      this.analyzeTeamRoutingPatterns(),
      this.analyzeLeaguePriorityPatterns(),
      this.analyzeTimeSlotPatterns(),
      this.analyzeAudioVolumePatterns(),
    ]);

    const now = Math.floor(Date.now() / 1000);

    // Persist team routing patterns
    for (const pattern of teamRouting) {
      try {
        const id = this.generateId();
        const data = JSON.stringify(pattern);
        await db.run(sql`
          INSERT OR REPLACE INTO scheduling_patterns
            (id, pattern_type, pattern_key, pattern_data, sample_size, confidence, created_at, updated_at)
          VALUES (
            COALESCE(
              (SELECT id FROM scheduling_patterns WHERE pattern_type = 'team_routing' AND pattern_key = ${pattern.team}),
              ${id}
            ),
            'team_routing',
            ${pattern.team},
            ${data},
            ${pattern.frequency},
            ${Math.min(pattern.frequency / 10, 1.0)},
            COALESCE(
              (SELECT created_at FROM scheduling_patterns WHERE pattern_type = 'team_routing' AND pattern_key = ${pattern.team}),
              ${now}
            ),
            ${now}
          )
        `);
      } catch (error: any) {
        logger.error(`[PATTERN-ANALYZER] Error saving team routing pattern for ${pattern.team}:`, { error });
      }
    }

    // Persist league priority patterns
    for (const pattern of leaguePriority) {
      try {
        const id = this.generateId();
        const data = JSON.stringify(pattern);
        await db.run(sql`
          INSERT OR REPLACE INTO scheduling_patterns
            (id, pattern_type, pattern_key, pattern_data, sample_size, confidence, created_at, updated_at)
          VALUES (
            COALESCE(
              (SELECT id FROM scheduling_patterns WHERE pattern_type = 'league_priority' AND pattern_key = ${pattern.league}),
              ${id}
            ),
            'league_priority',
            ${pattern.league},
            ${data},
            ${pattern.scheduleCount},
            ${Math.min(pattern.scheduleCount / 20, 1.0)},
            COALESCE(
              (SELECT created_at FROM scheduling_patterns WHERE pattern_type = 'league_priority' AND pattern_key = ${pattern.league}),
              ${now}
            ),
            ${now}
          )
        `);
      } catch (error: any) {
        logger.error(`[PATTERN-ANALYZER] Error saving league priority pattern for ${pattern.league}:`, { error });
      }
    }

    // Persist time slot patterns
    for (const pattern of timeSlots) {
      try {
        const id = this.generateId();
        const data = JSON.stringify(pattern);
        await db.run(sql`
          INSERT OR REPLACE INTO scheduling_patterns
            (id, pattern_type, pattern_key, pattern_data, sample_size, confidence, created_at, updated_at)
          VALUES (
            COALESCE(
              (SELECT id FROM scheduling_patterns WHERE pattern_type = 'time_slot' AND pattern_key = ${pattern.hourRange}),
              ${id}
            ),
            'time_slot',
            ${pattern.hourRange},
            ${data},
            ${pattern.peakBoxes},
            ${pattern.avgBoxes > 0 ? 0.8 : 0},
            COALESCE(
              (SELECT created_at FROM scheduling_patterns WHERE pattern_type = 'time_slot' AND pattern_key = ${pattern.hourRange}),
              ${now}
            ),
            ${now}
          )
        `);
      } catch (error: any) {
        logger.error(`[PATTERN-ANALYZER] Error saving time slot pattern for ${pattern.hourRange}:`, { error });
      }
    }

    // Persist audio volume patterns
    for (const pattern of audioVolume) {
      try {
        const id = this.generateId();
        const data = JSON.stringify(pattern.data);
        const patternType = pattern.patternType;
        const patternKey = pattern.patternKey;
        const sampleCount = pattern.data.sampleCount;
        await db.run(sql`
          INSERT OR REPLACE INTO scheduling_patterns
            (id, pattern_type, pattern_key, pattern_data, sample_size, confidence, created_at, updated_at)
          VALUES (
            COALESCE(
              (SELECT id FROM scheduling_patterns WHERE pattern_type = ${patternType} AND pattern_key = ${patternKey}),
              ${id}
            ),
            ${patternType},
            ${patternKey},
            ${data},
            ${sampleCount},
            ${Math.min(sampleCount / 15, 1.0)},
            COALESCE(
              (SELECT created_at FROM scheduling_patterns WHERE pattern_type = ${patternType} AND pattern_key = ${patternKey}),
              ${now}
            ),
            ${now}
          )
        `);
      } catch (error: any) {
        logger.error(`[PATTERN-ANALYZER] Error saving audio volume pattern ${pattern.patternKey}:`, { error });
      }
    }

    // Save a summary preference for the last analysis run
    try {
      const summaryId = this.generateId();
      const summaryData = JSON.stringify({
        teamCount: teamRouting.length,
        leagueCount: leaguePriority.length,
        timeSlotCount: timeSlots.length,
        audioVolumeCount: audioVolume.length,
        analyzedAt: now,
        durationMs: Date.now() - startTime,
      });
      await db.run(sql`
        INSERT OR REPLACE INTO scheduling_preferences
          (id, preference_type, preference_data, source, is_active, created_at, updated_at)
        VALUES (
          COALESCE(
            (SELECT id FROM scheduling_preferences WHERE preference_type = 'analysis_run'),
            ${summaryId}
          ),
          'analysis_run',
          ${summaryData},
          'analyzed',
          1,
          COALESCE(
            (SELECT created_at FROM scheduling_preferences WHERE preference_type = 'analysis_run'),
            strftime('%s', 'now')
          ),
          strftime('%s', 'now')
        )
      `);
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Error saving analysis summary:', { error });
    }

    const result: PatternAnalysisResult = {
      teamRouting,
      leaguePriority,
      timeSlots,
      audioVolume,
      analyzedAt: now,
    };

    const durationMs = Date.now() - startTime;
    logger.info(
      `[PATTERN-ANALYZER] Full analysis complete in ${durationMs}ms: ` +
      `${teamRouting.length} teams, ${leaguePriority.length} leagues, ` +
      `${timeSlots.length} time slots, ${audioVolume.length} audio volume patterns`
    );

    return result;
  }

  // ==========================================================================
  // Utility: Read Saved Patterns
  // ==========================================================================

  /**
   * Retrieve previously saved patterns from the scheduling_patterns table.
   * Returns null if the tables don't exist or no data is found.
   */
  async getSavedPatterns(patternType?: string): Promise<Array<{
    patternType: string;
    patternKey: string;
    patternData: any;
    sampleSize: number;
    confidence: number;
    updatedAt: number;
  }>> {
    try {
      await this.ensureTables();

      let rows: any[];
      if (patternType) {
        rows = await db.all(sql`
          SELECT pattern_type, pattern_key, pattern_data, sample_size, confidence, updated_at
          FROM scheduling_patterns
          WHERE pattern_type = ${patternType}
          ORDER BY sample_size DESC
        `);
      } else {
        rows = await db.all(sql`
          SELECT pattern_type, pattern_key, pattern_data, sample_size, confidence, updated_at
          FROM scheduling_patterns
          ORDER BY pattern_type, sample_size DESC
        `);
      }

      return (rows || []).map((row: any) => ({
        patternType: row.pattern_type,
        patternKey: row.pattern_key,
        patternData: JSON.parse(row.pattern_data),
        sampleSize: row.sample_size,
        confidence: row.confidence,
        updatedAt: row.updated_at,
      }));
    } catch (error: any) {
      logger.error('[PATTERN-ANALYZER] Error reading saved patterns:', { error });
      return [];
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const patternAnalyzer = new PatternAnalyzer()
export { PatternAnalyzer }

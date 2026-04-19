/**
 * Apply ScheduledOverrideDefaults to an allocation's tvOutputIds.
 *
 * The override-learn digest's Apply button writes rows to
 * ScheduledOverrideDefaults that look like:
 *   (team='Miami Marlins', outputNum=13, action='exclude')
 *   (team='Milwaukee Brewers', outputNum=5, action='include')
 *
 * This helper is called right before a new allocation is inserted.
 * Given the game's home and away team names, it:
 *   - STRIPS outputs where an 'exclude' rule matches either team
 *   - ADDS outputs where an 'include' rule matches either team (if not
 *     already present)
 *   - Writes a SchedulerLog audit row summarizing any changes, so
 *     operators can see the override defaults actually firing.
 *
 * No change is made when no matching rules exist; the function returns
 * the input list unchanged. Errors are non-fatal — if the DB query
 * fails for any reason, we log and return the original list so
 * allocation still proceeds.
 */

import { eq, inArray, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { logger } from '@sports-bar/logger'

export interface ApplyDefaultsResult {
  finalOutputIds: number[]
  excludedOutputs: Array<{ team: string; outputNum: number }>
  includedOutputs: Array<{ team: string; outputNum: number }>
  rulesConsulted: number
}

export async function applyOverrideDefaults(
  tvOutputIds: number[],
  homeTeamName: string | null | undefined,
  awayTeamName: string | null | undefined,
  correlationId?: string,
): Promise<ApplyDefaultsResult> {
  const teams = [homeTeamName, awayTeamName].filter((t): t is string => !!t && t.length > 0)
  const baseResult: ApplyDefaultsResult = {
    finalOutputIds: [...tvOutputIds],
    excludedOutputs: [],
    includedOutputs: [],
    rulesConsulted: 0,
  }

  if (teams.length === 0) return baseResult

  try {
    const rules = await db
      .select()
      .from(schema.scheduledOverrideDefaults)
      .where(inArray(schema.scheduledOverrideDefaults.team, teams))
      .all()

    if (rules.length === 0) return baseResult

    baseResult.rulesConsulted = rules.length

    const current = new Set<number>(tvOutputIds)

    for (const rule of rules) {
      if (rule.action === 'exclude') {
        if (current.has(rule.outputNum)) {
          current.delete(rule.outputNum)
          baseResult.excludedOutputs.push({ team: rule.team, outputNum: rule.outputNum })
        }
      } else if (rule.action === 'include') {
        if (!current.has(rule.outputNum)) {
          current.add(rule.outputNum)
          baseResult.includedOutputs.push({ team: rule.team, outputNum: rule.outputNum })
        }
      }
    }

    baseResult.finalOutputIds = Array.from(current).sort((a, b) => a - b)

    // Audit: only log when something actually changed. Otherwise the
    // SchedulerLog gets noisy with no-op entries.
    if (baseResult.excludedOutputs.length > 0 || baseResult.includedOutputs.length > 0) {
      const gameLabel = [awayTeamName, homeTeamName].filter(Boolean).join(' @ ')
      const changes: string[] = []
      if (baseResult.excludedOutputs.length > 0) {
        changes.push(
          `excluded TV${baseResult.excludedOutputs.length === 1 ? '' : 's'} ${baseResult.excludedOutputs.map(e => e.outputNum).join(',')}`,
        )
      }
      if (baseResult.includedOutputs.length > 0) {
        changes.push(
          `included TV${baseResult.includedOutputs.length === 1 ? '' : 's'} ${baseResult.includedOutputs.map(e => e.outputNum).join(',')}`,
        )
      }

      try {
        await db.insert(schema.schedulerLogs).values({
          id: crypto.randomUUID(),
          correlationId: correlationId || crypto.randomUUID(),
          component: 'override-digest',
          operation: 'applied-to-allocation',
          level: 'info',
          message: `Applied override defaults to ${gameLabel}: ${changes.join('; ')}`,
          success: true,
          metadata: JSON.stringify({
            homeTeamName,
            awayTeamName,
            rulesConsulted: baseResult.rulesConsulted,
            excludedOutputs: baseResult.excludedOutputs,
            includedOutputs: baseResult.includedOutputs,
            originalOutputIds: tvOutputIds,
            finalOutputIds: baseResult.finalOutputIds,
          }),
        })
      } catch (auditErr) {
        // Audit-log failure is non-fatal
        logger.warn('[OVERRIDE-DEFAULTS] Audit log write failed:', auditErr)
      }

      logger.info(
        `[OVERRIDE-DEFAULTS] ${gameLabel}: ${changes.join('; ')} (from ${baseResult.rulesConsulted} rule${baseResult.rulesConsulted === 1 ? '' : 's'})`,
      )
    }

    return baseResult
  } catch (err: any) {
    logger.error('[OVERRIDE-DEFAULTS] Lookup failed — using original outputs unchanged:', err)
    return baseResult
  }
}

// Explicit `or` import so tree-shaking doesn't drop it; drizzle's dynamic
// query building can't signal the import usage to some bundlers.
void or

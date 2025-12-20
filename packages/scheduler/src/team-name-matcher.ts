/**
 * Team Name Matcher Service
 *
 * Intelligent fuzzy matching system for team names with 6-level matching strategy:
 * 1. EXACT MATCH - Direct string match (100% confidence)
 * 2. ALIAS MATCH - Matches against known aliases (95% confidence)
 * 3. LEARNED MATCH - Matches from previous validated matches (90-95% confidence)
 * 4. FUZZY TOKEN MATCH - Token-based similarity (70-90% confidence)
 * 5. PARTIAL MATCH - Substring matching (60-75% confidence)
 * 6. ABBREVIATION MATCH - City/team abbreviations (65-70% confidence)
 */

import { db, schema, eq, and, sql } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'

export interface TeamMatch {
  teamId: string
  teamName: string
  confidence: number // 0.0 - 1.0
  matchMethod: 'exact' | 'alias' | 'learned' | 'fuzzy' | 'partial' | 'abbreviation'
  sport?: string
  league?: string
  priority: number
  minTVsWhenActive: number
  rivalTeams: string[]
  preferredZones: string[]
}

export interface HomeTeamData {
  id: string
  teamName: string
  sport: string
  league: string
  priority: number
  isPrimary: boolean
  aliases: string[] | null
  cityAbbreviations: string[] | null
  teamAbbreviations: string[] | null
  commonVariations: string[] | null
  minMatchConfidence: number
  minTVsWhenActive: number
  rivalTeams: string[] | null
  preferredZones: string[] | null
}

export class TeamNameMatcher {
  private homeTeams: HomeTeamData[] = []
  private lastLoad: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    this.loadHomeTeams()
  }

  /**
   * Load home teams from database with caching
   */
  private async loadHomeTeams(): Promise<void> {
    const now = Date.now()
    if (this.homeTeams.length > 0 && now - this.lastLoad < this.CACHE_TTL) {
      return // Use cached data
    }

    try {
      const teams = await db
        .select()
        .from(schema.homeTeams)
        .where(eq(schema.homeTeams.isActive, 1))

      this.homeTeams = teams.map(team => ({
        id: team.id,
        teamName: team.teamName,
        sport: team.sport,
        league: team.league,
        priority: team.priority,
        isPrimary: team.isPrimary === 1,
        aliases: team.aliases ? JSON.parse(team.aliases) : null,
        cityAbbreviations: team.cityAbbreviations ? JSON.parse(team.cityAbbreviations) : null,
        teamAbbreviations: team.teamAbbreviations ? JSON.parse(team.teamAbbreviations) : null,
        commonVariations: team.commonVariations ? JSON.parse(team.commonVariations) : null,
        minMatchConfidence: team.minMatchConfidence || 0.7,
        minTVsWhenActive: team.minTVsWhenActive || 1,
        rivalTeams: team.rivalTeams ? JSON.parse(team.rivalTeams) : null,
        preferredZones: team.preferredZones ? JSON.parse(team.preferredZones) : null
      }))

      this.lastLoad = now
      logger.info(`[TEAM_MATCHER] Loaded ${this.homeTeams.length} home teams`)
    } catch (error) {
      logger.error('[TEAM_MATCHER] Error loading home teams:', error)
      throw error
    }
  }

  /**
   * Find best match for a team name from guide data
   */
  async findMatch(guideName: string, sport?: string, league?: string): Promise<TeamMatch | null> {
    await this.loadHomeTeams()

    const normalized = this.normalizeTeamName(guideName)
    logger.debug(`[TEAM_MATCHER] Finding match for: "${guideName}" (normalized: "${normalized}")`)

    // Level 1: Exact match
    let match = this.exactMatch(normalized, sport, league)
    if (match) {
      logger.info(`[TEAM_MATCHER] EXACT match: "${guideName}" → "${match.teamName}" (${match.confidence})`)
      await this.logMatch(guideName, match, 'exact')
      return match
    }

    // Level 2: Alias match
    match = this.aliasMatch(normalized, sport, league)
    if (match) {
      logger.info(`[TEAM_MATCHER] ALIAS match: "${guideName}" → "${match.teamName}" (${match.confidence})`)
      await this.logMatch(guideName, match, 'alias')
      return match
    }

    // Level 3: Learned match (from previous matches)
    match = await this.learnedMatch(guideName, sport, league)
    if (match) {
      logger.info(`[TEAM_MATCHER] LEARNED match: "${guideName}" → "${match.teamName}" (${match.confidence})`)
      await this.logMatch(guideName, match, 'learned')
      return match
    }

    // Level 4: Fuzzy token match
    match = this.fuzzyTokenMatch(normalized, sport, league)
    if (match && match.confidence >= 0.7) {
      logger.info(`[TEAM_MATCHER] FUZZY match: "${guideName}" → "${match.teamName}" (${match.confidence})`)
      await this.logMatch(guideName, match, 'fuzzy')
      return match
    }

    // Level 5: Partial match (substring)
    match = this.partialMatch(normalized, sport, league)
    if (match && match.confidence >= 0.6) {
      logger.info(`[TEAM_MATCHER] PARTIAL match: "${guideName}" → "${match.teamName}" (${match.confidence})`)
      await this.logMatch(guideName, match, 'partial')
      return match
    }

    // Level 6: Abbreviation match
    match = this.abbreviationMatch(normalized, sport, league)
    if (match && match.confidence >= 0.65) {
      logger.info(`[TEAM_MATCHER] ABBREV match: "${guideName}" → "${match.teamName}" (${match.confidence})`)
      await this.logMatch(guideName, match, 'abbreviation')
      return match
    }

    logger.warn(`[TEAM_MATCHER] No match found for: "${guideName}"`)
    return null
  }

  /**
   * Level 1: Exact match
   */
  private exactMatch(normalized: string, sport?: string, league?: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      const teamNormalized = this.normalizeTeamName(team.teamName)

      if (teamNormalized === normalized) {
        // Check sport/league if provided
        if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) continue
        if (league && team.league.toLowerCase() !== league.toLowerCase()) continue

        return this.createMatch(team, 1.0, 'exact')
      }
    }
    return null
  }

  /**
   * Level 2: Alias match
   */
  private aliasMatch(normalized: string, sport?: string, league?: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      if (!team.aliases) continue

      for (const alias of team.aliases) {
        const aliasNormalized = this.normalizeTeamName(alias)

        if (aliasNormalized === normalized) {
          // Check sport/league if provided
          if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) continue
          if (league && team.league.toLowerCase() !== league.toLowerCase()) continue

          return this.createMatch(team, 0.95, 'alias')
        }
      }
    }
    return null
  }

  /**
   * Level 3: Learned match (from database log)
   */
  private async learnedMatch(guideName: string, sport?: string, league?: string): Promise<TeamMatch | null> {
    try {
      const matches = await db
        .select()
        .from(schema.teamNameMatches)
        .where(
          and(
            eq(schema.teamNameMatches.guideTeamName, guideName),
            eq(schema.teamNameMatches.isValidated, 1),
            eq(schema.teamNameMatches.isCorrect, 1)
          )
        )
        .orderBy(sql`${schema.teamNameMatches.matchCount} DESC`)
        .limit(1)

      if (matches.length === 0) return null

      const match = matches[0]
      const team = this.homeTeams.find(t => t.id === match.matchedTeamId)
      if (!team) return null

      // Check sport/league if provided
      if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) return null
      if (league && team.league.toLowerCase() !== league.toLowerCase()) return null

      // Use stored confidence or default to 0.9
      const confidence = match.confidence || 0.9

      return this.createMatch(team, confidence, 'learned')
    } catch (error) {
      logger.error('[TEAM_MATCHER] Error in learned match:', error)
      return null
    }
  }

  /**
   * Level 4: Fuzzy token match (token-based similarity)
   */
  private fuzzyTokenMatch(normalized: string, sport?: string, league?: string): TeamMatch | null {
    const guideTokens = this.tokenize(normalized)
    let bestMatch: { team: HomeTeamData; score: number } | null = null

    for (const team of this.homeTeams) {
      // Check sport/league if provided
      if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) continue
      if (league && team.league.toLowerCase() !== league.toLowerCase()) continue

      const teamTokens = this.tokenize(this.normalizeTeamName(team.teamName))
      const score = this.calculateTokenSimilarity(guideTokens, teamTokens)

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { team, score }
      }

      // Also check common variations
      if (team.commonVariations) {
        for (const variation of team.commonVariations) {
          const varTokens = this.tokenize(this.normalizeTeamName(variation))
          const varScore = this.calculateTokenSimilarity(guideTokens, varTokens)

          if (varScore > 0 && (!bestMatch || varScore > bestMatch.score)) {
            bestMatch = { team, score: varScore }
          }
        }
      }
    }

    if (bestMatch && bestMatch.score >= 0.7) {
      return this.createMatch(bestMatch.team, bestMatch.score, 'fuzzy')
    }

    return null
  }

  /**
   * Level 5: Partial match (substring)
   */
  private partialMatch(normalized: string, sport?: string, league?: string): TeamMatch | null {
    let bestMatch: { team: HomeTeamData; confidence: number } | null = null

    for (const team of this.homeTeams) {
      // Check sport/league if provided
      if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) continue
      if (league && team.league.toLowerCase() !== league.toLowerCase()) continue

      const teamNormalized = this.normalizeTeamName(team.teamName)

      // Check if guide name contains team name or vice versa
      if (normalized.includes(teamNormalized) || teamNormalized.includes(normalized)) {
        const longerLength = Math.max(normalized.length, teamNormalized.length)
        const shorterLength = Math.min(normalized.length, teamNormalized.length)
        const confidence = shorterLength / longerLength * 0.75 // Max 75% for partial match

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { team, confidence }
        }
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.6) {
      return this.createMatch(bestMatch.team, bestMatch.confidence, 'partial')
    }

    return null
  }

  /**
   * Level 6: Abbreviation match
   */
  private abbreviationMatch(normalized: string, sport?: string, league?: string): TeamMatch | null {
    for (const team of this.homeTeams) {
      // Check sport/league if provided
      if (sport && team.sport.toLowerCase() !== sport.toLowerCase()) continue
      if (league && team.league.toLowerCase() !== league.toLowerCase()) continue

      // Check city abbreviations
      if (team.cityAbbreviations) {
        for (const abbrev of team.cityAbbreviations) {
          const abbrevNormalized = this.normalizeTeamName(abbrev)
          if (normalized.includes(abbrevNormalized) || abbrevNormalized === normalized) {
            return this.createMatch(team, 0.7, 'abbreviation')
          }
        }
      }

      // Check team abbreviations
      if (team.teamAbbreviations) {
        for (const abbrev of team.teamAbbreviations) {
          const abbrevNormalized = this.normalizeTeamName(abbrev)
          if (normalized.includes(abbrevNormalized) || abbrevNormalized === normalized) {
            return this.createMatch(team, 0.65, 'abbreviation')
          }
        }
      }
    }

    return null
  }

  /**
   * Normalize team name for matching
   */
  private normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
  }

  /**
   * Tokenize name into individual words
   */
  private tokenize(normalized: string): string[] {
    return normalized.split(' ').filter(token => token.length > 0)
  }

  /**
   * Calculate token-based similarity (Jaccard similarity)
   */
  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1)
    const set2 = new Set(tokens2)

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    if (union.size === 0) return 0

    return intersection.size / union.size
  }

  /**
   * Create TeamMatch object from HomeTeamData
   */
  private createMatch(
    team: HomeTeamData,
    confidence: number,
    method: TeamMatch['matchMethod']
  ): TeamMatch {
    return {
      teamId: team.id,
      teamName: team.teamName,
      confidence,
      matchMethod: method,
      sport: team.sport,
      league: team.league,
      priority: team.priority,
      minTVsWhenActive: team.minTVsWhenActive,
      rivalTeams: team.rivalTeams || [],
      preferredZones: team.preferredZones || []
    }
  }

  /**
   * Log match to database for learning
   */
  private async logMatch(
    guideName: string,
    match: TeamMatch,
    method: string
  ): Promise<void> {
    try {
      // Check if this exact match already exists
      const existing = await db
        .select()
        .from(schema.teamNameMatches)
        .where(
          and(
            eq(schema.teamNameMatches.guideTeamName, guideName),
            eq(schema.teamNameMatches.matchedTeamId, match.teamId)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        // Update existing match (increment count)
        await db
          .update(schema.teamNameMatches)
          .set({
            matchCount: existing[0].matchCount + 1,
            lastMatchedAt: new Date().toISOString(),
            confidence: match.confidence
          })
          .where(eq(schema.teamNameMatches.id, existing[0].id))
      } else {
        // Create new match log
        await db.insert(schema.teamNameMatches).values({
          guideTeamName: guideName,
          matchedTeamId: match.teamId,
          matchedTeamName: match.teamName,
          confidence: match.confidence,
          matchMethod: method,
          sport: match.sport,
          league: match.league,
          isValidated: 0,
          isCorrect: null,
          matchCount: 1,
          lastMatchedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        })
      }
    } catch (error) {
      logger.error('[TEAM_MATCHER] Error logging match:', error)
      // Don't throw - logging is not critical
    }
  }

  /**
   * Reload teams from database (force cache refresh)
   */
  async reload(): Promise<void> {
    this.lastLoad = 0
    await this.loadHomeTeams()
  }

  /**
   * Get all home teams (for admin UI)
   */
  async getAllTeams(): Promise<HomeTeamData[]> {
    await this.loadHomeTeams()
    return this.homeTeams
  }
}

// Singleton instance
let matcherInstance: TeamNameMatcher | null = null

export function getTeamMatcher(): TeamNameMatcher {
  if (!matcherInstance) {
    matcherInstance = new TeamNameMatcher()
  }
  return matcherInstance
}

export function resetTeamMatcher(): void {
  matcherInstance = null
}

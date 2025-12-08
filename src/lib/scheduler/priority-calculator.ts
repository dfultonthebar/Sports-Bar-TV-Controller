/**
 * Priority Calculator Service
 *
 * Calculates game priority scores based on:
 * - Base priority from homeTeams table (0-100)
 * - Team match confidence from fuzzy matcher
 * - Playoff/postseason bonus (+20)
 * - Rivalry bonus (+15)
 * - Prime time bonus (+10)
 * - Primary team bonus (+15)
 * - Day of week modifiers (Sunday NFL, March Madness)
 *
 * Final score range: 0-150+
 */

import { getTeamMatcher, TeamMatch } from './team-name-matcher'
import { logger } from '@/lib/logger'

export interface GameInfo {
  id?: string
  homeTeam: string
  awayTeam: string
  sport?: string
  league?: string
  startTime: string | Date
  description?: string
  channelNumber?: string  // Legacy field for backwards compatibility
  cableChannel?: string   // Channel number from cable presets
  directvChannel?: string // Channel number from DirecTV presets
  channelName?: string
}

export interface PriorityScore {
  gameId?: string
  baseScore: number
  matchConfidence: number
  bonuses: {
    playoff: number
    rivalry: number
    primeTime: number
    primaryTeam: number
    dayOfWeek: number
  }
  totalBonus: number
  finalScore: number
  matchedTeam: TeamMatch | null
  reasoning: string[]
  isHomeTeamGame: boolean  // True when the HOME team is in our homeTeams list
}

export class PriorityCalculator {
  private teamMatcher = getTeamMatcher()

  /**
   * Calculate priority score for a game
   */
  async calculateGamePriority(game: GameInfo): Promise<PriorityScore> {
    const reasoning: string[] = []
    const bonuses = {
      playoff: 0,
      rivalry: 0,
      primeTime: 0,
      primaryTeam: 0,
      dayOfWeek: 0
    }

    // Try to match home team or away team
    const homeMatch = await this.teamMatcher.findMatch(game.homeTeam, game.sport, game.league)
    const awayMatch = await this.teamMatcher.findMatch(game.awayTeam, game.sport, game.league)

    // Use the match with higher priority
    const matchedTeam = this.selectBestMatch(homeMatch, awayMatch)

    if (!matchedTeam) {
      // No home team match - assign base score by league importance
      // This allows non-home-team games to fill TVs instead of defaulting to ESPN
      const leagueBaseScores: Record<string, number> = {
        'nfl': 40,
        'nba': 35,
        'college-football': 35,
        'mlb': 30,
        'nhl': 25,
        'mens-college-basketball': 25,
        'womens-college-basketball': 20,
        'college-baseball': 20,
        'mens-college-soccer': 15,
        'womens-college-soccer': 15
      }

      const baseScore = leagueBaseScores[game.league?.toLowerCase()] || 20

      // Still apply bonuses for playoff/prime time
      if (this.isPlayoffGame(game.description, game.league)) {
        bonuses.playoff = 20
        reasoning.push('🏆 Playoff game: +20')
      }

      const gameTime = new Date(game.startTime)
      if (this.isPrimeTime(gameTime)) {
        bonuses.primeTime = 10
        reasoning.push(`🌙 Prime time (${gameTime.getHours()}:00): +10`)
      }

      const dayBonus = this.getDayOfWeekBonus(gameTime, game.sport, game.league)
      if (dayBonus > 0) {
        bonuses.dayOfWeek = dayBonus
        reasoning.push(`📅 Special day: +${dayBonus}`)
      }

      const totalBonus = Object.values(bonuses).reduce((sum, val) => sum + val, 0)
      const finalScore = Math.min(baseScore + totalBonus, 70) // Cap non-home-team games at 70

      logger.debug(`[PRIORITY_CALC] Non-home-team game: ${game.homeTeam} vs ${game.awayTeam} = ${finalScore} (league: ${game.league})`)

      return {
        gameId: game.id,
        baseScore,
        matchConfidence: 0,
        bonuses,
        totalBonus,
        finalScore,
        matchedTeam: null,
        reasoning: [
          `Non-home-team game (${game.league})`,
          `League base score: ${baseScore}`,
          ...reasoning,
          `Final score: ${baseScore} + ${totalBonus} = ${finalScore} (capped at 70)`
        ],
        isHomeTeamGame: false  // Not a home team game
      }
    }

    const baseScore = matchedTeam.priority
    const matchConfidence = matchedTeam.confidence
    const matchMethod = matchedTeam.matchMethod

    reasoning.push(
      `Matched "${matchedTeam.teamName}" via ${matchMethod} (confidence: ${(matchConfidence * 100).toFixed(0)}%)`,
      `Base priority: ${baseScore}`
    )

    // Bonus 1: Playoff/Postseason
    if (this.isPlayoffGame(game.description, game.league)) {
      bonuses.playoff = 20
      reasoning.push('🏆 Playoff game: +20')
    }

    // Bonus 2: Rivalry game
    const opponentName = homeMatch ? game.awayTeam : game.homeTeam
    if (this.isRivalryGame(matchedTeam, opponentName)) {
      bonuses.rivalry = 15
      reasoning.push(`⚔️ Rivalry game (${opponentName}): +15`)
    }

    // Bonus 3: Prime time
    const gameTime = new Date(game.startTime)
    if (this.isPrimeTime(gameTime)) {
      bonuses.primeTime = 10
      reasoning.push(`🌙 Prime time (${gameTime.getHours()}:00): +10`)
    }

    // Bonus 4: Primary team
    if (this.isPrimaryTeam(matchedTeam)) {
      bonuses.primaryTeam = 15
      reasoning.push('⭐ Primary team: +15')
    }

    // Bonus 5: Day of week (special cases)
    const dayBonus = this.getDayOfWeekBonus(gameTime, game.sport, game.league)
    if (dayBonus > 0) {
      bonuses.dayOfWeek = dayBonus
      reasoning.push(`📅 Special day: +${dayBonus}`)
    }

    const totalBonus = Object.values(bonuses).reduce((sum, val) => sum + val, 0)
    const finalScore = Math.min(baseScore + totalBonus, 150) // Cap at 150

    reasoning.push(`Final score: ${baseScore} + ${totalBonus} = ${finalScore}`)

    logger.info(
      `[PRIORITY_CALC] ${game.homeTeam} vs ${game.awayTeam} = ${finalScore} ` +
      `(base: ${baseScore}, bonuses: ${totalBonus})`
    )

    return {
      gameId: game.id,
      baseScore,
      matchConfidence,
      bonuses,
      totalBonus,
      finalScore,
      matchedTeam,
      reasoning,
      isHomeTeamGame: homeMatch !== null  // True when the HOME team is in our registered list
    }
  }

  /**
   * Calculate priorities for multiple games
   */
  async calculateMultipleGames(games: GameInfo[]): Promise<PriorityScore[]> {
    const scores = await Promise.all(
      games.map(game => this.calculateGamePriority(game))
    )

    // Sort by final score (highest first)
    return scores.sort((a, b) => b.finalScore - a.finalScore)
  }

  /**
   * Select best match from home/away team matches
   */
  private selectBestMatch(homeMatch: TeamMatch | null, awayMatch: TeamMatch | null): TeamMatch | null {
    if (!homeMatch && !awayMatch) return null
    if (!homeMatch) return awayMatch
    if (!awayMatch) return homeMatch

    // Prefer match with higher priority
    if (homeMatch.priority !== awayMatch.priority) {
      return homeMatch.priority > awayMatch.priority ? homeMatch : awayMatch
    }

    // If priority is equal, prefer higher confidence
    return homeMatch.confidence >= awayMatch.confidence ? homeMatch : awayMatch
  }

  /**
   * Check if game is playoff/postseason
   */
  private isPlayoffGame(description?: string, league?: string): boolean {
    if (!description) return false

    const desc = description.toLowerCase()

    // Playoff keywords
    const playoffKeywords = [
      'playoff',
      'postseason',
      'championship',
      'finals',
      'conference final',
      'division series',
      'wild card',
      'super bowl',
      'world series',
      'stanley cup',
      'nba finals',
      'march madness',
      'sweet sixteen',
      'elite eight',
      'final four',
      'college football playoff',
      'bowl game'
    ]

    return playoffKeywords.some(keyword => desc.includes(keyword))
  }

  /**
   * Check if game is against a rival team
   */
  private isRivalryGame(matchedTeam: TeamMatch, opponentName: string): boolean {
    if (!matchedTeam.rivalTeams || matchedTeam.rivalTeams.length === 0) {
      return false
    }

    const opponentLower = opponentName.toLowerCase()

    return matchedTeam.rivalTeams.some(rival => {
      const rivalLower = rival.toLowerCase()
      return opponentLower.includes(rivalLower) || rivalLower.includes(opponentLower)
    })
  }

  /**
   * Check if game is in prime time (6 PM - 11 PM local)
   */
  private isPrimeTime(gameTime: Date): boolean {
    const hour = gameTime.getHours()
    return hour >= 18 && hour <= 23
  }

  /**
   * Check if team is marked as primary
   */
  private isPrimaryTeam(matchedTeam: TeamMatch): boolean {
    // This info isn't in TeamMatch, would need to fetch from DB
    // For now, use priority as proxy (90+ = primary)
    return matchedTeam.priority >= 90
  }

  /**
   * Get day of week bonus for special cases
   */
  private getDayOfWeekBonus(gameTime: Date, sport?: string, league?: string): number {
    const dayOfWeek = gameTime.getDay() // 0 = Sunday, 6 = Saturday

    // Sunday NFL bonus
    if (dayOfWeek === 0 && league === 'NFL') {
      return 5
    }

    // Saturday college football bonus
    if (dayOfWeek === 6 && league === 'NCAA' && sport === 'Football') {
      return 5
    }

    // Thursday night NFL bonus
    if (dayOfWeek === 4 && league === 'NFL') {
      return 3
    }

    // Monday night football bonus
    if (dayOfWeek === 1 && league === 'NFL') {
      return 5
    }

    // March Madness (March-April, college basketball)
    if (league === 'NCAA' && sport === 'Basketball') {
      const month = gameTime.getMonth() // 0 = January
      if (month === 2 || month === 3) { // March or April
        return 10
      }
    }

    return 0
  }

  /**
   * Get recommended TV allocation for a game
   */
  getRecommendedTVCount(score: PriorityScore): number {
    if (!score.matchedTeam) return 1

    // Start with minimum from team config
    let tvCount = score.matchedTeam.minTVsWhenActive

    // Increase for high priority games
    if (score.finalScore >= 120) {
      tvCount = Math.max(tvCount, 8) // Max coverage
    } else if (score.finalScore >= 100) {
      tvCount = Math.max(tvCount, 6) // Heavy coverage
    } else if (score.finalScore >= 80) {
      tvCount = Math.max(tvCount, 4) // Good coverage
    } else if (score.finalScore >= 60) {
      tvCount = Math.max(tvCount, 2) // Moderate coverage
    }

    return tvCount
  }

  /**
   * Get preferred zones for a game
   */
  getPreferredZones(score: PriorityScore): string[] {
    if (!score.matchedTeam || !score.matchedTeam.preferredZones) {
      return ['main', 'bar'] // Default zones
    }

    return score.matchedTeam.preferredZones
  }

  /**
   * Compare two games and determine which should have priority
   */
  compareGames(score1: PriorityScore, score2: PriorityScore): number {
    // Higher final score wins
    if (score1.finalScore !== score2.finalScore) {
      return score2.finalScore - score1.finalScore
    }

    // If equal, prefer playoff games
    if (score1.bonuses.playoff !== score2.bonuses.playoff) {
      return score2.bonuses.playoff - score1.bonuses.playoff
    }

    // If still equal, prefer primary teams
    if (score1.bonuses.primaryTeam !== score2.bonuses.primaryTeam) {
      return score2.bonuses.primaryTeam - score1.bonuses.primaryTeam
    }

    // If still equal, prefer rivalry games
    if (score1.bonuses.rivalry !== score2.bonuses.rivalry) {
      return score2.bonuses.rivalry - score1.bonuses.rivalry
    }

    return 0
  }
}

// Singleton instance
let calculatorInstance: PriorityCalculator | null = null

export function getPriorityCalculator(): PriorityCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new PriorityCalculator()
  }
  return calculatorInstance
}

export function resetPriorityCalculator(): void {
  calculatorInstance = null
}

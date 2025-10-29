import { findMany, gte, lte, asc, and, eq, schema } from '@/lib/db-helpers'
import { logger } from '@/lib/logger'

/**
 * AI Sports Context Provider
 *
 * Provides upcoming game information to AI for contextual awareness
 */

export interface SportsContext {
  upcomingGames: Array<{
    eventName: string
    league: string
    homeTeam: string
    awayTeam: string
    eventDate: Date
    eventTime: string | null
    importance: string
    isFavorite: boolean
    hoursUntilGame: number
  }>
  todaysGames: number
  tomorrowsGames: number
  thisWeeksGames: number
  criticalGames: number
  nextBigGame: {
    eventName: string
    when: string
    hoursAway: number
  } | null
  recommendations: string[]
}

export class AISportsContextProvider {
  /**
   * Get comprehensive sports context for AI
   */
  async getSportsContext(): Promise<SportsContext> {
    try {
      const now = new Date()
      const todayEnd = new Date(now)
      todayEnd.setHours(23, 59, 59, 999)

      const tomorrowEnd = new Date(now)
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1)
      tomorrowEnd.setHours(23, 59, 59, 999)

      const weekEnd = new Date(now)
      weekEnd.setDate(weekEnd.getDate() + 7)

      // Fetch upcoming games
      const upcomingGames = await findMany('sportsEvents', {
        where: and(
          gte(schema.sportsEvents.eventDate, now.toISOString()),
          lte(schema.sportsEvents.eventDate, weekEnd.toISOString()),
          eq(schema.sportsEvents.status, 'scheduled')
        ) as any,
        orderBy: asc(schema.sportsEvents.eventDate),
        limit: 20
      })

      // Process games
      const games = upcomingGames.map((event: any) => {
        const eventDate = new Date(event.eventDate)
        const hoursUntilGame = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60)

        return {
          eventName: event.eventName,
          league: event.league,
          homeTeam: event.homeTeam,
          awayTeam: event.awayTeam,
          eventDate,
          eventTime: event.eventTime,
          importance: event.importance,
          isFavorite: event.isHomeTeamFavorite,
          hoursUntilGame
        }
      })

      // Count games by timeframe
      const todaysGames = games.filter(g => g.eventDate <= todayEnd).length
      const tomorrowsGames = games.filter(g =>
        g.eventDate > todayEnd && g.eventDate <= tomorrowEnd
      ).length
      const thisWeeksGames = games.length
      const criticalGames = games.filter(g => g.importance === 'critical' || g.importance === 'high').length

      // Find next big game
      const nextBigGame = games.find(g => g.importance === 'critical' || g.importance === 'high')

      // Generate recommendations
      const recommendations = this.generateRecommendations(games, now)

      return {
        upcomingGames: games,
        todaysGames,
        tomorrowsGames,
        thisWeeksGames,
        criticalGames,
        nextBigGame: nextBigGame ? {
          eventName: nextBigGame.eventName,
          when: this.formatTimeUntil(nextBigGame.hoursUntilGame),
          hoursAway: Math.round(nextBigGame.hoursUntilGame)
        } : null,
        recommendations
      }
    } catch (error) {
      logger.error('[AI Sports Context] Error getting context:', error)
      return {
        upcomingGames: [],
        todaysGames: 0,
        tomorrowsGames: 0,
        thisWeeksGames: 0,
        criticalGames: 0,
        nextBigGame: null,
        recommendations: []
      }
    }
  }

  /**
   * Generate contextual text for AI prompts
   */
  async getContextText(): Promise<string> {
    const context = await this.getSportsContext()

    if (context.upcomingGames.length === 0) {
      return "No upcoming games scheduled for favorite teams in the next 7 days."
    }

    let text = `UPCOMING SPORTS SCHEDULE:\n\n`

    if (context.todaysGames > 0) {
      text += `TODAY (${context.todaysGames} games):\n`
      const todayGames = context.upcomingGames.filter(g =>
        g.hoursUntilGame < 24 && g.hoursUntilGame >= 0
      )
      todayGames.forEach(game => {
        const time = game.eventTime || 'TBD'
        text += `  - ${game.league}: ${game.awayTeam} @ ${game.homeTeam} at ${time}`
        if (game.isFavorite) text += ` (HOME TEAM)`
        if (game.importance === 'critical' || game.importance === 'high') text += ` [IMPORTANT]`
        text += `\n`
      })
      text += `\n`
    }

    if (context.tomorrowsGames > 0) {
      text += `TOMORROW (${context.tomorrowsGames} games):\n`
      const tomorrowGames = context.upcomingGames.filter(g =>
        g.hoursUntilGame >= 24 && g.hoursUntilGame < 48
      )
      tomorrowGames.slice(0, 5).forEach(game => {
        const time = game.eventTime || 'TBD'
        text += `  - ${game.league}: ${game.awayTeam} @ ${game.homeTeam} at ${time}`
        if (game.isFavorite) text += ` (HOME TEAM)`
        text += `\n`
      })
      text += `\n`
    }

    if (context.nextBigGame) {
      text += `NEXT BIG GAME: ${context.nextBigGame.eventName} in ${context.nextBigGame.when}\n\n`
    }

    if (context.recommendations.length > 0) {
      text += `RECOMMENDATIONS:\n`
      context.recommendations.forEach(rec => {
        text += `  - ${rec}\n`
      })
    }

    return text
  }

  /**
   * Generate AI recommendations based on upcoming games
   */
  private generateRecommendations(games: any[], now: Date): string[] {
    const recommendations: string[] = []

    // Check for games in next 2 hours
    const soonGames = games.filter(g => g.hoursUntilGame > 0 && g.hoursUntilGame < 2)
    if (soonGames.length > 0) {
      recommendations.push(`${soonGames.length} game(s) starting within 2 hours - run system health check now!`)
      recommendations.push(`Verify all cable boxes are responding before game time`)
      recommendations.push(`Check audio zones are ready for crowd noise`)
    }

    // Check for important games tomorrow
    const tomorrowBigGames = games.filter(g =>
      g.hoursUntilGame > 12 && g.hoursUntilGame < 36 &&
      (g.importance === 'critical' || g.importance === 'high')
    )
    if (tomorrowBigGames.length > 0) {
      recommendations.push(`Important game(s) tomorrow - consider running pre-game system test`)
    }

    // Check for multiple simultaneous games
    const todayGames = games.filter(g => g.hoursUntilGame >= 0 && g.hoursUntilGame < 12)
    if (todayGames.length >= 3) {
      recommendations.push(`${todayGames.length} games today - ensure all TVs/audio zones are operational`)
      recommendations.push(`Consider pre-routing major games to avoid delays during rush`)
    }

    // Idle period recommendation
    if (games.length > 0 && games[0].hoursUntilGame > 48) {
      recommendations.push(`Quiet period before next game - good time for system maintenance`)
    }

    return recommendations
  }

  /**
   * Format hours until game as human-readable string
   */
  private formatTimeUntil(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)} minutes`
    if (hours < 24) return `${Math.round(hours)} hours`
    const days = Math.round(hours / 24)
    return `${days} day${days > 1 ? 's' : ''}`
  }
}

// Singleton instance
let contextProvider: AISportsContextProvider | null = null

export function getAISportsContextProvider(): AISportsContextProvider {
  if (!contextProvider) {
    contextProvider = new AISportsContextProvider()
  }
  return contextProvider
}


/**
 * NFHS Network API Integration Service - Puppeteer Version
 * Uses browser automation to bypass 403 errors
 */

import { getNFHSScraper } from './nfhs-puppeteer-scraper'
import { NFHSGame } from './nfhs-api'

class NFHSPuppeteerAPIService {
  private scraper = getNFHSScraper()
  private sessionExpiry: number = 0
  private readonly SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

  /**
   * Ensure we have a valid authenticated session
   */
  private async ensureAuthenticated(): Promise<void> {
    const now = Date.now()
    
    // Check if session is still valid
    if (now < this.sessionExpiry) {
      return // Session still valid
    }

    // Login and refresh session
    console.log('🔄 Refreshing NFHS authentication...')
    const success = await this.scraper.login()
    
    if (success) {
      this.sessionExpiry = now + this.SESSION_DURATION
      console.log('✅ NFHS session refreshed')
    } else {
      throw new Error('Failed to authenticate with NFHS Network')
    }
  }

  /**
   * Get high school games using Puppeteer scraping
   */
  async getHighSchoolGames(
    state?: string,
    sport?: string,
    startDate?: string,
    endDate?: string
  ): Promise<NFHSGame[]> {
    try {
      await this.ensureAuthenticated()
      
      console.log(`🏫 Fetching NFHS games via Puppeteer for ${state || 'all states'}`)
      
      const games = await this.scraper.scrapeGames(state, sport)
      
      // Filter by date range if specified
      let filteredGames = games
      if (startDate || endDate) {
        filteredGames = games.filter(game => {
          const gameDate = new Date(game.date)
          const start = startDate ? new Date(startDate) : new Date(0)
          const end = endDate ? new Date(endDate) : new Date('2099-12-31')
          return gameDate >= start && gameDate <= end
        })
      }

      console.log(`✅ Retrieved ${filteredGames.length} NFHS games via Puppeteer`)
      return filteredGames

    } catch (error) {
      console.error('❌ Error fetching NFHS games via Puppeteer:', error)
      return []
    }
  }

  /**
   * Get games by location
   */
  async getGamesByLocation(
    zipCode?: string,
    city?: string,
    state?: string,
    radiusMiles: number = 50
  ): Promise<NFHSGame[]> {
    try {
      await this.ensureAuthenticated()
      
      const games = await this.scraper.scrapeGames(state)
      
      // Filter by city if specified
      if (city) {
        return games.filter(game =>
          game.homeTeam.city.toLowerCase().includes(city.toLowerCase()) ||
          game.awayTeam.city.toLowerCase().includes(city.toLowerCase())
        )
      }
      
      return games

    } catch (error) {
      console.error('❌ Error fetching games by location:', error)
      return []
    }
  }

  /**
   * Get live streaming games
   */
  async getLiveStreams(): Promise<NFHSGame[]> {
    try {
      await this.ensureAuthenticated()
      
      console.log('📺 Fetching live NFHS streams via Puppeteer')
      const liveGames = await this.scraper.getLiveGames()
      
      console.log(`✅ Found ${liveGames.length} live streams`)
      return liveGames

    } catch (error) {
      console.error('❌ Error fetching live streams:', error)
      return []
    }
  }

  /**
   * Get upcoming streaming schedule
   */
  async getUpcomingStreams(days: number = 7): Promise<NFHSGame[]> {
    try {
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + days)
      
      const games = await this.getHighSchoolGames(
        undefined,
        undefined,
        new Date().toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      )
      
      return games
        .filter(game => game.isNFHSNetwork)
        .sort((a, b) => {
          const dateA = new Date(`${a.date} ${a.time}`)
          const dateB = new Date(`${b.date} ${b.time}`)
          return dateA.getTime() - dateB.getTime()
        })

    } catch (error) {
      console.error('❌ Error fetching upcoming streams:', error)
      return []
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    await this.scraper.close()
    this.sessionExpiry = 0
  }
}

// Export singleton instance
export const nfhsPuppeteerAPI = new NFHSPuppeteerAPIService()

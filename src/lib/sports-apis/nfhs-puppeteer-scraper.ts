
/**
 * NFHS Network Puppeteer-based Scraper
 * Uses real browser automation to bypass 403 errors and anti-bot detection
 */

import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { Browser, Page } from 'puppeteer'
import { NFHSGame } from './nfhs-api'

// Apply stealth plugin to avoid detection
puppeteer.use(StealthPlugin())

interface NFHSCredentials {
  email: string
  password: string
}

interface NFHSScraperOptions {
  headless?: boolean
  timeout?: number
  retries?: number
}

class NFHSPuppeteerScraper {
  private browser: Browser | null = null
  private page: Page | null = null
  private isAuthenticated: boolean = false
  private credentials: NFHSCredentials
  private options: NFHSScraperOptions

  constructor(credentials: NFHSCredentials, options: NFHSScraperOptions = {}) {
    this.credentials = credentials
    this.options = {
      headless: options.headless !== false, // Default to true
      timeout: options.timeout || 30000,
      retries: options.retries || 3
    }
  }

  /**
   * Initialize browser and page
   */
  private async initBrowser(): Promise<void> {
    if (this.browser) {
      return // Already initialized
    }

    console.log('🚀 Launching Puppeteer browser...')
    
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    })

    this.page = await this.browser.newPage()

    // Set realistic user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    // Set extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    })

    // Block unnecessary resources to speed up
    await this.page.setRequestInterception(true)
    this.page.on('request', (req) => {
      const resourceType = req.resourceType()
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    console.log('✅ Browser initialized')
  }

  /**
   * Login to NFHS Network
   */
  async login(): Promise<boolean> {
    try {
      await this.initBrowser()
      
      if (!this.page) {
        throw new Error('Page not initialized')
      }

      console.log('🔐 Logging into NFHS Network...')
      
      // Navigate to login page
      await this.page.goto('https://www.nfhsnetwork.com/login', {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      })

      // Wait for login form
      await this.page.waitForSelector('input[type="email"], input[name="email"], input#email', {
        timeout: this.options.timeout
      })

      // Fill in credentials
      const emailSelector = 'input[type="email"], input[name="email"], input#email'
      const passwordSelector = 'input[type="password"], input[name="password"], input#password'
      
      await this.page.type(emailSelector, this.credentials.email, { delay: 100 })
      await this.page.type(passwordSelector, this.credentials.password, { delay: 100 })

      // Find and click login button
      const loginButtonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Log In")',
        'button:contains("Sign In")',
        '.login-button',
        '#login-button'
      ]

      let loginClicked = false
      for (const selector of loginButtonSelectors) {
        try {
          await this.page.click(selector)
          loginClicked = true
          break
        } catch (e) {
          continue
        }
      }

      if (!loginClicked) {
        throw new Error('Could not find login button')
      }

      // Wait for navigation after login
      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      })

      // Check if login was successful
      const currentUrl = this.page.url()
      this.isAuthenticated = !currentUrl.includes('/login') && !currentUrl.includes('/signin')

      if (this.isAuthenticated) {
        console.log('✅ Successfully logged into NFHS Network')
      } else {
        console.log('❌ Login failed - still on login page')
      }

      return this.isAuthenticated

    } catch (error) {
      console.error('❌ Error during NFHS login:', error)
      this.isAuthenticated = false
      return false
    }
  }

  /**
   * Scrape games from NFHS Network
   */
  async scrapeGames(state?: string, sport?: string): Promise<NFHSGame[]> {
    try {
      if (!this.isAuthenticated) {
        const loginSuccess = await this.login()
        if (!loginSuccess) {
          throw new Error('Failed to authenticate with NFHS Network')
        }
      }

      if (!this.page) {
        throw new Error('Page not initialized')
      }

      console.log(`🏫 Scraping NFHS games for ${state || 'all states'}, sport: ${sport || 'all sports'}`)

      // Build schedule URL with filters
      let scheduleUrl = 'https://www.nfhsnetwork.com/schools'
      if (state) {
        scheduleUrl += `?state=${state}`
      }

      // Navigate to schedule page
      await this.page.goto(scheduleUrl, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      })

      // Wait for game listings to load
      await this.page.waitForSelector('.game-card, .event-card, .schedule-item, [data-game-id]', {
        timeout: this.options.timeout
      }).catch(() => {
        console.log('⚠️ No game cards found, trying alternative selectors...')
      })

      // Extract game data from the page
      const games = await this.page.evaluate(() => {
        const gameElements = document.querySelectorAll('.game-card, .event-card, .schedule-item, [data-game-id]')
        const extractedGames: any[] = []

        gameElements.forEach((element, index) => {
          try {
            // Extract game information from DOM
            const homeTeamEl = element.querySelector('.home-team, .team-home, [data-home-team]')
            const awayTeamEl = element.querySelector('.away-team, .team-away, [data-away-team]')
            const sportEl = element.querySelector('.sport, [data-sport]')
            const dateEl = element.querySelector('.date, .game-date, [data-date]')
            const timeEl = element.querySelector('.time, .game-time, [data-time]')
            const venueEl = element.querySelector('.venue, .location, [data-venue]')
            const streamEl = element.querySelector('.stream-link, [data-stream-url]')

            const game = {
              id: `nfhs-scraped-${Date.now()}-${index}`,
              homeTeam: {
                name: homeTeamEl?.textContent?.trim() || 'Home Team',
                school: homeTeamEl?.getAttribute('data-school') || 'Unknown School',
                city: homeTeamEl?.getAttribute('data-city') || 'Unknown City',
                state: homeTeamEl?.getAttribute('data-state') || 'Unknown State'
              },
              awayTeam: {
                name: awayTeamEl?.textContent?.trim() || 'Away Team',
                school: awayTeamEl?.getAttribute('data-school') || 'Unknown School',
                city: awayTeamEl?.getAttribute('data-city') || 'Unknown City',
                state: awayTeamEl?.getAttribute('data-state') || 'Unknown State'
              },
              sport: sportEl?.textContent?.trim() || 'Unknown Sport',
              league: 'High School',
              date: dateEl?.textContent?.trim() || new Date().toISOString().split('T')[0],
              time: timeEl?.textContent?.trim() || '7:00 PM',
              venue: venueEl?.textContent?.trim() || 'Unknown Venue',
              status: element.classList.contains('live') ? 'live' : 'scheduled',
              streamUrl: streamEl?.getAttribute('href') || streamEl?.getAttribute('data-stream-url'),
              isNFHSNetwork: !!streamEl
            }

            extractedGames.push(game)
          } catch (err) {
            console.error('Error extracting game data:', err)
          }
        })

        return extractedGames
      })

      console.log(`✅ Scraped ${games.length} games from NFHS Network`)
      return games as NFHSGame[]

    } catch (error) {
      console.error('❌ Error scraping NFHS games:', error)
      return []
    }
  }

  /**
   * Get live streaming games
   */
  async getLiveGames(): Promise<NFHSGame[]> {
    try {
      if (!this.isAuthenticated) {
        await this.login()
      }

      if (!this.page) {
        throw new Error('Page not initialized')
      }

      console.log('📺 Fetching live NFHS streams...')

      // Navigate to live streams page
      await this.page.goto('https://www.nfhsnetwork.com/live', {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      })

      // Extract live games
      const liveGames = await this.page.evaluate(() => {
        const liveElements = document.querySelectorAll('.live-game, .live-stream, [data-status="live"]')
        const games: any[] = []

        liveElements.forEach((element, index) => {
          const game = {
            id: `nfhs-live-${Date.now()}-${index}`,
            homeTeam: {
              name: element.querySelector('.home-team')?.textContent?.trim() || 'Home Team',
              school: 'Unknown School',
              city: 'Unknown City',
              state: 'Unknown State'
            },
            awayTeam: {
              name: element.querySelector('.away-team')?.textContent?.trim() || 'Away Team',
              school: 'Unknown School',
              city: 'Unknown City',
              state: 'Unknown State'
            },
            sport: element.querySelector('.sport')?.textContent?.trim() || 'Unknown Sport',
            league: 'High School',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString(),
            venue: 'Unknown Venue',
            status: 'live' as const,
            streamUrl: element.querySelector('a')?.getAttribute('href') || undefined,
            isNFHSNetwork: true
          }
          games.push(game)
        })

        return games
      })

      console.log(`✅ Found ${liveGames.length} live games`)
      return liveGames as NFHSGame[]

    } catch (error) {
      console.error('❌ Error fetching live games:', error)
      return []
    }
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close()
        this.page = null
      }
      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }
      this.isAuthenticated = false
      console.log('✅ Browser closed')
    } catch (error) {
      console.error('❌ Error closing browser:', error)
    }
  }

  /**
   * Get cookies for session persistence
   */
  async getCookies(): Promise<any[]> {
    if (!this.page) {
      return []
    }
    return await this.page.cookies()
  }

  /**
   * Set cookies for session restoration
   */
  async setCookies(cookies: any[]): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized')
    }
    await this.page.setCookie(...cookies)
  }
}

// Singleton instance with credentials from environment
let scraperInstance: NFHSPuppeteerScraper | null = null

export function getNFHSScraper(): NFHSPuppeteerScraper {
  if (!scraperInstance) {
    const credentials: NFHSCredentials = {
      email: process.env.NFHS_EMAIL || 'lhoople@graystonealehouse.com',
      password: process.env.NFHS_PASSWORD || 'Graystone#1'
    }
    
    scraperInstance = new NFHSPuppeteerScraper(credentials, {
      headless: true,
      timeout: 30000,
      retries: 3
    })
  }
  
  return scraperInstance
}

export { NFHSPuppeteerScraper }
export type { NFHSCredentials, NFHSScraperOptions }

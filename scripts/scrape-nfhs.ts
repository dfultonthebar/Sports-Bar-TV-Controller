#!/usr/bin/env npx ts-node
/**
 * NFHS Network Scraper using Playwright
 *
 * Scrapes game schedules from NFHS Network school pages
 * Run with: npx ts-node scripts/scrape-nfhs.ts [school-slug]
 */

import { chromium, Browser, Page } from 'playwright'

interface NFHSGame {
  id: string
  sport: string
  level: string
  homeTeam: string
  awayTeam: string
  date: string
  time: string
  dateTime: string
  location: string
  status: 'upcoming' | 'live' | 'on_demand'
  eventUrl: string
}

const DEFAULT_SCHOOL = 'de-pere-high-school-de-pere-wi'

async function scrapeNFHSSchool(schoolSlug: string): Promise<NFHSGame[]> {
  const games: NFHSGame[] = []
  let browser: Browser | null = null

  try {
    console.log(`Launching browser to scrape ${schoolSlug}...`)

    browser = await chromium.launch({
      headless: true
    })

    const page = await browser.newPage()

    // Navigate to school page
    const url = `https://www.nfhsnetwork.com/schools/${schoolSlug}`
    console.log(`Navigating to ${url}`)

    await page.goto(url, { waitUntil: 'networkidle' })

    // Wait for content to load
    await page.waitForTimeout(2000)

    // Accept cookies if dialog appears
    try {
      const acceptButton = page.locator('button:has-text("Accept")')
      if (await acceptButton.isVisible({ timeout: 1000 })) {
        await acceptButton.click()
        await page.waitForTimeout(500)
      }
    } catch (e) {
      // No cookie dialog
    }

    // Extract upcoming games
    const upcomingSection = page.locator('text=Upcoming').first()
    if (await upcomingSection.isVisible()) {
      console.log('Found Upcoming section')

      // Get all event links in the upcoming section
      const eventLinks = await page.locator('a[href*="/events/"][href*="/gam"]').all()
      console.log(`Found ${eventLinks.length} event links`)

      for (const link of eventLinks) {
        try {
          const href = await link.getAttribute('href')
          const text = await link.textContent()

          if (!href || !text) continue

          // Parse game info from the link text
          // Format: "Sport Level Team1 vs. Team2 Date | Time Location"
          const sportMatch = text.match(/((?:Junior Varsity|Varsity|JV|Freshman)\s+(?:Boys|Girls)?\s*(?:Basketball|Football|Soccer|Ice Hockey|Volleyball|Wrestling|Baseball|Softball|Lacrosse|Tennis|Track|Swimming|Cross Country))/i)
          const teamsMatch = text.match(/([A-Za-z\s.]+)\s+vs\.?\s+([A-Za-z\s.]+)/)
          const dateTimeMatch = text.match(/(\w{3}\s+\d{1,2},\s+\d{4})\s*\|\s*(\d{1,2}:\d{2}\s*(?:AM|PM)\s*\w+)/)
          const locationMatch = text.match(/(\w{3})\s+([\w\s,]+)$/i)

          const sport = sportMatch ? sportMatch[1].trim() : 'Unknown'
          const homeTeam = teamsMatch ? teamsMatch[1].trim() : ''
          const awayTeam = teamsMatch ? teamsMatch[2].trim() : ''
          const date = dateTimeMatch ? dateTimeMatch[1] : ''
          const time = dateTimeMatch ? dateTimeMatch[2] : ''
          const location = locationMatch ? locationMatch[2].trim() : ''

          // Determine status
          const isLive = text.toLowerCase().includes('live')
          const isOnDemand = text.toLowerCase().includes('on demand')
          const status: 'live' | 'on_demand' | 'upcoming' = isLive ? 'live' : isOnDemand ? 'on_demand' : 'upcoming'

          // Extract event ID
          const eventId = href.split('/').pop() || `nfhs-${Date.now()}-${games.length}`

          // Parse date
          let dateTime = ''
          if (date && time) {
            try {
              const timeClean = time.replace(/\s*[A-Z]{3}$/, '') // Remove timezone
              const parsed = new Date(`${date} ${timeClean}`)
              if (!isNaN(parsed.getTime())) {
                dateTime = parsed.toISOString()
              }
            } catch (e) {
              dateTime = date
            }
          }

          games.push({
            id: eventId,
            sport,
            level: sport.includes('Junior') || sport.includes('JV') ? 'JV' : 'Varsity',
            homeTeam,
            awayTeam,
            date,
            time,
            dateTime,
            location,
            status,
            eventUrl: `https://www.nfhsnetwork.com${href}`
          })

        } catch (e) {
          console.error('Error parsing event:', e)
        }
      }
    }

    // Check for live games specifically
    const liveIndicators = await page.locator('text=Live').all()
    for (const indicator of liveIndicators) {
      try {
        const parent = indicator.locator('..')
        const linkInParent = parent.locator('a[href*="/events/"]')
        if (await linkInParent.isVisible()) {
          const href = await linkInParent.getAttribute('href')
          const eventId = href?.split('/').pop()
          if (eventId) {
            // Mark this game as live
            const game = games.find(g => g.id === eventId)
            if (game) {
              game.status = 'live'
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    }

  } catch (error) {
    console.error('Scraping error:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }

  return games
}

async function main() {
  const schoolSlug = process.argv[2] || DEFAULT_SCHOOL
  console.log(`\n=== NFHS Network Scraper ===`)
  console.log(`School: ${schoolSlug}\n`)

  const games = await scrapeNFHSSchool(schoolSlug)

  console.log(`\n=== Results ===`)
  console.log(`Total games found: ${games.length}`)

  const liveGames = games.filter(g => g.status === 'live')
  const upcomingGames = games.filter(g => g.status === 'upcoming')
  const onDemandGames = games.filter(g => g.status === 'on_demand')

  if (liveGames.length > 0) {
    console.log(`\n🔴 LIVE GAMES (${liveGames.length}):`)
    for (const game of liveGames) {
      console.log(`  - ${game.sport}: ${game.homeTeam} vs ${game.awayTeam}`)
      console.log(`    ${game.eventUrl}`)
    }
  }

  if (upcomingGames.length > 0) {
    console.log(`\n📅 UPCOMING GAMES (${upcomingGames.length}):`)
    for (const game of upcomingGames.slice(0, 10)) {
      console.log(`  - ${game.date} ${game.time}`)
      console.log(`    ${game.sport}: ${game.homeTeam} vs ${game.awayTeam}`)
      console.log(`    ${game.location}`)
    }
    if (upcomingGames.length > 10) {
      console.log(`  ... and ${upcomingGames.length - 10} more`)
    }
  }

  // Output JSON for API consumption
  console.log(`\n=== JSON Output ===`)
  console.log(JSON.stringify({
    success: true,
    school: schoolSlug,
    summary: {
      total: games.length,
      live: liveGames.length,
      upcoming: upcomingGames.length,
      onDemand: onDemandGames.length
    },
    liveGames,
    upcomingGames: upcomingGames.slice(0, 20),
    timestamp: new Date().toISOString()
  }, null, 2))
}

main().catch(console.error)

/**
 * Test script for NFHS Puppeteer scraper
 * Run with: node scripts/test_nfhs_puppeteer.js
 */

const { getNFHSScraper } = require('../src/lib/sports-apis/nfhs-puppeteer-scraper')

async function testNFHSScraper() {
  console.log('🧪 Testing NFHS Puppeteer Scraper...\n')
  
  const scraper = getNFHSScraper()
  
  try {
    // Test 1: Login
    console.log('Test 1: Attempting login...')
    const loginSuccess = await scraper.login()
    
    if (loginSuccess) {
      console.log('✅ Login successful!\n')
    } else {
      console.log('❌ Login failed!\n')
      process.exit(1)
    }
    
    // Test 2: Scrape games
    console.log('Test 2: Scraping games...')
    const games = await scraper.scrapeGames('WI', 'Football')
    console.log(`✅ Scraped ${games.length} games\n`)
    
    if (games.length > 0) {
      console.log('Sample game:')
      console.log(JSON.stringify(games[0], null, 2))
    }
    
    // Test 3: Get live games
    console.log('\nTest 3: Fetching live games...')
    const liveGames = await scraper.getLiveGames()
    console.log(`✅ Found ${liveGames.length} live games\n`)
    
    // Test 4: Get cookies
    console.log('Test 4: Extracting cookies...')
    const cookies = await scraper.getCookies()
    console.log(`✅ Extracted ${cookies.length} cookies\n`)
    
    console.log('🎉 All tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await scraper.close()
  }
}

testNFHSScraper()

import { chromium } from 'playwright'

async function inspectRemote() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  const page = await context.newPage()

  try {
    console.log('Navigating to /remote...')
    await page.goto('http://localhost:3001/remote', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    console.log('Taking screenshot...')
    await page.screenshot({
      path: '/tmp/remote-interface.png',
      fullPage: true
    })

    console.log('Looking for buttons...')
    const buttons = await page.locator('button').all()
    console.log(`Found ${buttons.length} buttons:`)
    for (let i = 0; i < Math.min(buttons.length, 20); i++) {
      const text = await buttons[i].textContent()
      console.log(`  [${i}] ${text}`)
    }

    console.log('\nLooking for all text content with "Direct"...')
    const content = await page.content()
    const directTVMatches = content.match(/direct\s*tv/gi) || []
    console.log(`Found ${directTVMatches.length} mentions of "direct tv"`)

    const allText = await page.locator('body').textContent()
    if (allText.includes('Direct')) {
      console.log('Found "Direct" in page text')
    }

  } finally {
    await browser.close()
  }
}

inspectRemote().catch(console.error)

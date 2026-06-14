import { chromium } from 'playwright';

async function verifyShureRfDetails() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('=== DETAILED RF AI INSIGHTS VERIFICATION ===\n');

    // Navigate to device config
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Navigate to Wireless Mics
    const audioTab = page.locator('button:has-text("Audio")').first();
    await audioTab.click();
    await page.waitForTimeout(500);

    const wirelessTab = page.locator('button:has-text("Wireless Mics")').first();
    await wirelessTab.click();
    await page.waitForTimeout(1000);

    // Scroll to RF AI Insights
    await page.evaluate(() => {
      const elem = Array.from(document.querySelectorAll('*')).find(e => e.textContent?.includes('RF AI Insights'));
      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    await page.waitForTimeout(2000);

    // Extract RF Environment Summary content
    console.log('RF ENVIRONMENT SUMMARY:');
    const summaryText = await page.locator('text=RF Environment Summary').first().textContent().catch(() => 'N/A');
    console.log(`Summary card found: ${summaryText !== 'N/A'}`);

    // Check for counts grid (may not exist yet)
    const countsGridText = await page.locator('text=/Active|Cleared|Events/i').first().textContent().catch(() => 'N/A');
    console.log(`Counts grid text: ${countsGridText?.substring(0, 50) || 'N/A'}`);

    // Extract age badge
    const ageBadge = await page.locator('text=/ago/i').first().textContent().catch(() => 'N/A');
    console.log(`Age badge: "${ageBadge}"`);

    console.log('\nSUGGEST A CLEAN FREQUENCY:');
    // Get clean freq button and result
    const cleanFreqSection = page.locator('[class*="rounded"]').filter({ hasText: /clean.*freq|Find.*clean/ });
    if (await cleanFreqSection.count() > 0) {
      const cleanContent = await cleanFreqSection.first().textContent();
      console.log(`Content: ${cleanContent?.substring(0, 200) || 'N/A'}`);
    }

    console.log('\nADVANCED CHECKS:');

    // Test for width badges
    const redBadges = page.locator('[class*="bg-red"]');
    const amberBadges = page.locator('[class*="bg-amber"]');
    const slateBadges = page.locator('[class*="bg-slate"]');

    console.log(`Width badges found:`);
    console.log(`  - Red (TV-broadcast): ${await redBadges.count()} instances`);
    console.log(`  - Amber (Wireless): ${await amberBadges.count()} instances`);
    console.log(`  - Slate (Other): ${await slateBadges.count()} instances`);

    // Extract actual badge text
    if (await redBadges.count() > 0) {
      const firstRedText = await redBadges.first().textContent();
      console.log(`  - Red badge example: "${firstRedText}"`);
    }

    // Take detailed screenshot of AI panel
    await page.screenshot({
      path: '/tmp/ui-screenshots/14-shure-ai-detailed-view.png',
      fullPage: false
    });

    console.log('\nSHIFT BRIEF VERIFICATION:');
    await page.goto('http://localhost:3001/remote', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Find and verify Shift Brief card
    const shiftBrief = page.locator('text=Shift Brief').first();
    if (await shiftBrief.isVisible({ timeout: 3000 }).catch(() => false)) {
      const briefCard = page.locator('[class*="border"]').filter({ hasText: /Shift Brief/i }).first();
      const briefText = await briefCard.textContent();
      console.log(`Shift Brief visible: true`);
      console.log(`Content preview: ${briefText?.substring(0, 150) || 'N/A'}...`);

      // Check for specific issues
      const hasCavs = briefText?.includes('Cavaliers') || briefText?.includes('Knicks');
      const hasBrewers = briefText?.includes('Brewers') || briefText?.includes('Bucks') || briefText?.includes('Badgers') || briefText?.includes('Packers');
      const doublePrefix = briefText?.includes('Mic status: Mic status:');
      const hasMicStatus = briefText?.includes('Mic status');

      console.log(`\nBrief content checks:`);
      console.log(`  - Has Cavs/Knicks (should be false): ${hasCavs}`);
      console.log(`  - Has home teams: ${hasBrewers}`);
      console.log(`  - Has Mic status line: ${hasMicStatus}`);
      console.log(`  - Has double Mic status prefix (BUG): ${doublePrefix}`);

      // Take screenshot
      await page.screenshot({
        path: '/tmp/ui-screenshots/15-shift-brief-detailed.png',
        fullPage: true
      });
    } else {
      console.log('Shift Brief card NOT found!');
    }

    // Browser console check
    console.log('\nBrowser console messages (errors only):');
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`  [ERROR] ${msg.text()}`);
      }
    });

    page.on('pageerror', err => {
      console.log(`  [PAGE ERROR] ${err.message}`);
    });

  } catch (error) {
    console.error('Verification error:', error);
  } finally {
    await browser.close();
  }
}

verifyShureRfDetails().catch(console.error);

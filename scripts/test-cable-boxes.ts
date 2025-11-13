import { chromium } from 'playwright';

async function testCableBoxes() {
  console.log('Starting cable box test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Track console messages and errors
  const consoleMessages: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log('Step 1: Navigate to http://localhost:3001/remote');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    console.log('Step 2: Click on "Remote" tab');
    const remoteTab = page.locator('button').filter({ hasText: 'Remote' });
    await remoteTab.click();
    await page.waitForTimeout(1000); // Wait for tab transition

    console.log('Step 3: Take screenshot of input selector panel');
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-input-selector-panel.png',
      fullPage: true
    });
    console.log('✅ Screenshot saved: /tmp/ui-screenshots/01-input-selector-panel.png\n');

    console.log('Step 4: Count cable box inputs visible');

    // Find all input cards
    const inputCards = page.locator('[class*="rounded-lg"][class*="border"]').filter({
      has: page.locator('text=/Cable Box|Cable \\(IR\\)/i')
    });

    const cardCount = await inputCards.count();
    console.log(`📊 Total cable box inputs found: ${cardCount}\n`);

    // Get details of each cable box card
    console.log('Step 5 & 6: Checking cable box details...');

    const cableBoxDetails: any[] = [];

    for (let i = 0; i < cardCount; i++) {
      const card = inputCards.nth(i);

      // Get card text content
      const cardText = await card.innerText();

      // Extract channel number (e.g., "Ch 1")
      const channelMatch = cardText.match(/Ch\s+(\d+)/i);
      const channelNumber = channelMatch ? channelMatch[1] : 'unknown';

      // Extract name (e.g., "Cable Box 1")
      const nameMatch = cardText.match(/Cable Box \d+/i);
      const name = nameMatch ? nameMatch[0] : 'unknown';

      // Check for "Cable (IR)" text
      const hasCableIR = cardText.includes('Cable (IR)');

      // Check for online status (green checkmark or similar indicator)
      const hasOnlineIndicator = await card.locator('[class*="text-green"], [class*="bg-green"]').count() > 0;

      cableBoxDetails.push({
        channel: `Ch ${channelNumber}`,
        name,
        type: hasCableIR ? 'Cable (IR)' : 'unknown',
        online: hasOnlineIndicator,
        fullText: cardText
      });

      console.log(`  ✅ ${channelNumber === '1' ? 'Ch 1' : 'Ch 2'}: ${name} - ${hasCableIR ? 'Cable (IR)' : 'N/A'} - ${hasOnlineIndicator ? 'Online' : 'Status Unknown'}`);
    }

    console.log('');

    // Test clicking on Ch 1
    console.log('Step 7: Click on "Ch 1" and take screenshot');
    const ch1Card = inputCards.first();
    await ch1Card.click();
    await page.waitForTimeout(2000); // Wait for remote to load

    await page.screenshot({
      path: '/tmp/ui-screenshots/02-cable-box-1-selected.png',
      fullPage: true
    });
    console.log('✅ Screenshot saved: /tmp/ui-screenshots/02-cable-box-1-selected.png\n');

    // Check if CableBoxRemote rendered
    const hasCableRemote1 = await page.locator('text=/Channel Presets|Direct Entry|Cable Box Remote/i').count() > 0;
    console.log(`  ${hasCableRemote1 ? '✅' : '❌'} CableBoxRemote component rendered for Ch 1\n`);

    // Go back to selector
    console.log('Step 8: Go back and click on "Ch 2" and take screenshot');
    const backButton = page.locator('button').filter({ hasText: /back|return/i }).first();
    if (await backButton.count() > 0) {
      await backButton.click();
      await page.waitForTimeout(1000);
    } else {
      // Alternative: click Remote tab again
      await remoteTab.click();
      await page.waitForTimeout(1000);
    }

    // Click on Ch 2
    if (cardCount >= 2) {
      const ch2Card = inputCards.nth(1);
      await ch2Card.click();
      await page.waitForTimeout(2000);

      await page.screenshot({
        path: '/tmp/ui-screenshots/03-cable-box-2-selected.png',
        fullPage: true
      });
      console.log('✅ Screenshot saved: /tmp/ui-screenshots/03-cable-box-2-selected.png\n');

      // Check if CableBoxRemote rendered
      const hasCableRemote2 = await page.locator('text=/Channel Presets|Direct Entry|Cable Box Remote/i').count() > 0;
      console.log(`  ${hasCableRemote2 ? '✅' : '❌'} CableBoxRemote component rendered for Ch 2\n`);
    } else {
      console.log('⚠️  Ch 2 not found, skipping\n');
    }

    // Check for GlobalCache enrichment
    console.log('Step 10: Verify GlobalCache enrichment...');

    // Go back to selector to see device details
    if (await backButton.count() > 0) {
      await backButton.click();
      await page.waitForTimeout(1000);
    } else {
      await remoteTab.click();
      await page.waitForTimeout(1000);
    }

    // Check if iTach addresses are shown in the UI
    const hasITachAddress = await page.locator('text=/192\\.168\\.\\d+\\.\\d+/').count() > 0;
    console.log(`  ${hasITachAddress ? '✅' : '⚠️'} GlobalCache IP addresses ${hasITachAddress ? 'found in UI' : 'not visible in UI'}`);
    console.log(`  (Note: IP addresses may be in device data but not displayed in UI)\n`);

    // Report console errors
    console.log('Step 9: Check browser console for errors');
    if (consoleErrors.length > 0) {
      console.log(`❌ Console Errors Found (${consoleErrors.length}):`);
      consoleErrors.slice(0, 10).forEach(err => {
        console.log(`  - ${err}`);
      });
      if (consoleErrors.length > 10) {
        console.log(`  ... and ${consoleErrors.length - 10} more errors`);
      }
    } else {
      console.log('✅ No console errors detected');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`📊 Cable box inputs visible: ${cardCount}`);
    console.log(`✅ Ch 1 visible: ${cardCount >= 1 ? 'YES' : 'NO'}`);
    console.log(`✅ Ch 2 visible: ${cardCount >= 2 ? 'YES' : 'NO'}`);

    if (cableBoxDetails.length > 0) {
      console.log('\nCable Box Details:');
      cableBoxDetails.forEach((detail, idx) => {
        console.log(`  ${idx + 1}. ${detail.channel} - ${detail.name}`);
        console.log(`     Type: ${detail.type}`);
        console.log(`     Online: ${detail.online ? '✅ YES' : '❌ NO'}`);
      });
    }

    console.log(`\n✅ Console Errors: ${consoleErrors.length === 0 ? 'NONE' : consoleErrors.length}`);
    console.log(`📸 Screenshots captured: 3`);
    console.log(`📁 Screenshot location: /tmp/ui-screenshots/`);
    console.log('='.repeat(60));

    // Test result
    const allTestsPassed =
      cardCount === 2 &&
      cableBoxDetails.length === 2 &&
      cableBoxDetails.every(d => d.type === 'Cable (IR)') &&
      consoleErrors.length === 0;

    console.log(`\n${allTestsPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}\n`);

  } catch (error: any) {
    console.error('❌ Test failed with error:', error.message);

    // Capture error screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
    console.log('📸 Error screenshot saved: /tmp/ui-screenshots/error-state.png');

    throw error;
  } finally {
    await browser.close();
  }
}

testCableBoxes().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

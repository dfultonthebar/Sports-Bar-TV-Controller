import { chromium } from '@playwright/test';

async function verifyAudioMeters() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 }
  });

  const page = await context.newPage();
  let consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    console.log('[METER-VERIFY] Navigating to bartender remote (port 3002)...');
    await page.goto('http://localhost:3002/remote', { waitUntil: 'networkidle', timeout: 10000 });

    // Find and click Audio tab
    const audioTabBtn = page.locator('button, a, div[role="tab"]').filter({ hasText: /^Audio$/i }).first();
    const audioTabVisible = await audioTabBtn.isVisible().catch(() => false);
    
    if (!audioTabVisible) {
      console.log('[METER-VERIFY] ⚠ Audio tab button not found, trying generic selector...');
      await page.locator('button').filter({ hasText: 'Audio' }).first().click().catch(() => {});
    } else {
      await audioTabBtn.click();
    }

    await page.waitForTimeout(1500);

    // Frame 1: Initial state
    const shot1 = '/tmp/ui-screenshots/audio-meters-1-initial.png';
    await page.screenshot({ path: shot1, fullPage: false });
    console.log(`[METER-VERIFY] ✓ Screenshot 1 captured: ${shot1}`);

    // Try to find meter elements on the page
    const meterText = await page.locator('text=/Input|Level|dB|-\d+/', { timeout: 2000 }).count().catch(() => 0);
    console.log(`[METER-VERIFY] Found ~${meterText} text nodes with meter-like content`);

    // Wait 10 seconds for live update
    console.log('[METER-VERIFY] Waiting 10 seconds for meter updates...');
    await page.waitForTimeout(10000);

    // Frame 2: After 10 seconds
    const shot2 = '/tmp/ui-screenshots/audio-meters-2-after10s.png';
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`[METER-VERIFY] ✓ Screenshot 2 captured: ${shot2}`);

    // Check page title/content to confirm we're on the right page
    const title = await page.title();
    console.log(`[METER-VERIFY] Page title: ${title}`);

    // Print summary
    console.log('[METER-VERIFY] ✓ Bartender remote Audio tab verification complete');
    console.log(`[METER-VERIFY] Console errors detected: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      consoleErrors.slice(0, 3).forEach(e => console.log(`  - ${e}`));
    }

  } catch (error: any) {
    console.error('[METER-VERIFY] Error:', error.message);
    await page.screenshot({ path: '/tmp/ui-screenshots/audio-meters-error.png' });
  } finally {
    await browser.close();
  }
}

verifyAudioMeters();

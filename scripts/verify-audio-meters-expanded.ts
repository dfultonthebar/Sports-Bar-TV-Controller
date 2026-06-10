import { chromium } from '@playwright/test';

async function verifyAudioMeters() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 768, height: 1400 }  // taller viewport
  });

  const page = await context.newPage();

  try {
    console.log('[METER-VERIFY] Navigating to bartender remote...');
    await page.goto('http://localhost:3002/remote', { waitUntil: 'networkidle', timeout: 10000 });

    // Wait for Audio tab to be visible
    await page.waitForSelector('text=/Audio/', { timeout: 5000 });
    
    // Click Audio tab
    await page.locator('button').filter({ hasText: 'Audio' }).first().click();
    await page.waitForTimeout(1000);

    // Click to expand "Real-time Audio Meters" section
    console.log('[METER-VERIFY] Expanding Real-time Audio Meters section...');
    const expandBtn = page.locator('text=Real-time Audio Meters').first();
    await expandBtn.click().catch(() => console.log('[METER-VERIFY] Expand button not immediately clickable'));
    await page.waitForTimeout(1500);

    // Screenshot 1: meters expanded
    const shot1 = '/tmp/ui-screenshots/audio-meters-expanded-1.png';
    await page.screenshot({ path: shot1, fullPage: false });
    console.log(`[METER-VERIFY] ✓ Screenshot 1 (meters expanded): ${shot1}`);

    // Check for visible meter bars or values
    const pageText = await page.innerText('body').catch(() => '');
    const hasMeters = pageText.includes('dB') || pageText.includes('Input');
    console.log(`[METER-VERIFY] Page contains meter-like text: ${hasMeters}`);

    // Wait 10 seconds
    console.log('[METER-VERIFY] Waiting 10 seconds for updates...');
    await page.waitForTimeout(10000);

    // Screenshot 2: after 10 seconds
    const shot2 = '/tmp/ui-screenshots/audio-meters-expanded-2.png';
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`[METER-VERIFY] ✓ Screenshot 2 (after 10s): ${shot2}`);

    console.log('[METER-VERIFY] ✓ Verification complete');

  } catch (error: any) {
    console.error('[METER-VERIFY] Error:', error.message);
  } finally {
    await browser.close();
  }
}

verifyAudioMeters();

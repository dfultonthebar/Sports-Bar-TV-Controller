import { chromium } from 'playwright';

async function captureSelector() {
  console.log('🎨 Launching browser to capture selector screen...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Navigate to remote page
    console.log('📸 Navigating to Remote page...');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Click on the "Remote" tab (6th tab button with Gamepad2 icon)
    console.log('📸 Clicking Remote tab...');
    const remoteTabButton = page.locator('button').filter({ hasText: 'Remote' });
    await remoteTabButton.click();

    // Wait for the remote selector to load
    await page.waitForTimeout(1000);

    // Take screenshot of remote selector
    await page.screenshot({
      path: '/tmp/ui-screenshots/selector-enhanced.png',
      fullPage: true
    });

    console.log('   ✓ Saved: selector-enhanced.png\n');

    // Also capture with hover state on first input card
    console.log('📸 Capturing with hover state...');
    const inputCards = page.locator('button:has-text("Input"), button:has-text("Cable"), button:has-text("Satellite"), button:has-text("Streaming")');
    const firstCard = inputCards.first();
    if (await firstCard.isVisible()) {
      await firstCard.hover();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: '/tmp/ui-screenshots/selector-hover.png',
        fullPage: true
      });
      console.log('   ✓ Saved: selector-hover.png\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  await browser.close();
  console.log('✅ Selector screenshots captured!');
  console.log('📁 Screenshots saved to: /tmp/ui-screenshots\n');
}

captureSelector().catch(console.error);

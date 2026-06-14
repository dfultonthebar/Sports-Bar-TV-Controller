import { chromium } from 'playwright';

async function verifyBrief() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3001/remote', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // Scroll to top to find Shift Brief
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Get full brief text
    const briefCard = page.locator('[class*="border"], [class*="card"]').filter({ hasText: /Shift Brief/i }).first();
    if (await briefCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await briefCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      const fullText = await briefCard.textContent();
      console.log('=== FULL SHIFT BRIEF TEXT ===\n');
      console.log(fullText);
      console.log('\n=== END BRIEF ===\n');

      // Screenshot just the brief card
      const bbox = await briefCard.boundingBox();
      if (bbox) {
        await page.screenshot({
          path: '/tmp/ui-screenshots/16-shift-brief-only.png',
          clip: {
            x: Math.max(0, bbox.x - 10),
            y: Math.max(0, bbox.y - 10),
            width: bbox.width + 20,
            height: bbox.height + 20
          }
        });
        console.log('Screenshot saved: 16-shift-brief-only.png');
      }
    }
  } finally {
    await browser.close();
  }
}

verifyBrief().catch(console.error);

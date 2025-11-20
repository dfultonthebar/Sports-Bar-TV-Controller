import { chromium } from 'playwright';

const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function inspectDirectTVPage() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to device-config page...');
    await page.goto(DEVICE_CONFIG_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click DirecTV tab
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    if (await directvTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await directvTab.click();
      await page.waitForTimeout(1500);
    }

    // Get the HTML of device cards
    console.log('Examining device card structure...\n');

    // Find the first device card container
    const deviceCardHTML = await page.locator('[class*="card"], [class*="Card"]').first().innerHTML();
    console.log('First device card HTML:');
    console.log(deviceCardHTML);
    console.log('\n---\n');

    // Look for any elements with onclick or click handlers
    const clickableElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[onclick], button, [role="button"]');
      const results = [];
      for (let i = 0; i < Math.min(elements.length, 50); i++) {
        const el = elements[i];
        const tag = el.tagName;
        const text = (el as any).textContent?.substring(0, 50);
        const onclick = (el as any).onclick ? 'YES' : 'NO';
        const innerHTML = (el as any).innerHTML?.substring(0, 100);
        results.push({ tag, text, onclick, innerHTML: innerHTML?.replace(/\n/g, ' ') });
      }
      return results;
    });

    console.log('Clickable elements:');
    clickableElements.forEach((el, i) => {
      console.log(`${i}: ${el.tag} - text="${el.text}", onclick="${el.onclick}", html="${el.innerHTML}"`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

inspectDirectTVPage().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

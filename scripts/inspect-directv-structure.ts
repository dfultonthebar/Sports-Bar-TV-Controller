import { chromium } from 'playwright';

async function inspect() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click DirecTV tab
  const tab = page.locator('button[role="tab"]').filter({ hasText: 'DirecTV' });
  await tab.click();
  await page.waitForTimeout(2000);

  // Try to find cards using various selectors
  console.log('Looking for device cards...');

  const selectors = [
    'div[class*="card"]',
    'div[class*="Card"]',
    '[data-device-type]',
    'div[class*="grid"] > div',
    'article',
    'section'
  ];

  for (const selector of selectors) {
    const elements = await page.$$(selector);
    console.log(`Selector "${selector}": found ${elements.length} elements`);
  }

  // Look for headings
  const headings = await page.$$('h2, h3, h4');
  console.log(`\nFound ${headings.length} headings:`);

  for (let i = 0; i < Math.min(headings.length, 10); i++) {
    const text = await headings[i].textContent();
    console.log(`  ${i + 1}. ${text}`);
  }

  // Look for buttons
  const buttons = await page.$$('button');
  console.log(`\nFound ${buttons.length} buttons (showing first 20):`);

  for (let i = 0; i < Math.min(buttons.length, 20); i++) {
    const text = await buttons[i].textContent();
    const ariaLabel = await buttons[i].getAttribute('aria-label');
    console.log(`  ${i + 1}. Text: "${text?.trim()}" | Aria: "${ariaLabel}"`);
  }

  await browser.close();
}

inspect().catch(console.error);

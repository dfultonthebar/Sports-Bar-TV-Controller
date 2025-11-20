import { chromium } from 'playwright';

async function exploreDeviceConfig() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[INFO] Navigating to device config...');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Get full page HTML to understand structure
    const pageContent = await page.content();
    const pageText = await page.evaluate(() => document.body.innerText);

    console.log('[INFO] Page title:', await page.title());
    console.log('[INFO] Current URL:', page.url());
    console.log('[INFO] Page text preview (first 2000 chars):');
    console.log(pageText.substring(0, 2000));

    // Look for all text containing "Direct" or "TV" or "device"
    const allText = pageText;
    const directLines = allText.split('\n').filter(line =>
      line.toLowerCase().includes('direct') ||
      line.toLowerCase().includes('device') ||
      line.toLowerCase().includes('cable')
    );

    console.log('[INFO] Lines containing device-related keywords:');
    directLines.slice(0, 20).forEach(line => console.log('  ' + line.trim()));

    // Take screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/explore-device-config.png',
      fullPage: true
    });
    console.log('[SUCCESS] Screenshot saved to /tmp/ui-screenshots/explore-device-config.png');

    // Check for navigation tabs or sections
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`[INFO] Found ${buttonCount} buttons`);

    const tabs = page.locator('[role="tab"], [role="tablist"]');
    const tabCount = await tabs.count();
    console.log(`[INFO] Found ${tabCount} tab elements`);

    // List all visible text
    const allElements = page.locator('*');
    const elementCount = await allElements.count();
    console.log(`[INFO] Total elements on page: ${elementCount}`);

    // Check if there are navigation links
    const links = page.locator('a, button');
    const linkCount = await links.count();
    console.log(`[INFO] Found ${linkCount} clickable elements`);

    // Get the body content structure
    const bodyStructure = await page.evaluate(() => {
      return {
        bodyClasses: (document.body as any).className,
        bodyChildCount: document.body.children.length,
        mainElement: document.querySelector('main') ? true : false,
        nav: document.querySelector('nav') ? true : false,
        navText: document.querySelector('nav')?.textContent?.substring(0, 200)
      };
    });

    console.log('[INFO] Page structure:', JSON.stringify(bodyStructure, null, 2));

  } catch (error) {
    console.error('[ERROR]', error);
  } finally {
    await browser.close();
  }
}

exploreDeviceConfig().catch(console.error);

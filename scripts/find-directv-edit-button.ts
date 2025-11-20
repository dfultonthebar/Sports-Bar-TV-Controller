import { chromium } from 'playwright';

const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function findEditButton() {
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
    await directvTab.click();
    await page.waitForTimeout(1500);

    // Get details about the action buttons
    const allButtons = page.locator('button');

    // Buttons 13, 14, 15 are action buttons for first device
    // Let's inspect their SVG content to figure out what they do
    console.log('Inspecting action buttons for first DirecTV device:\n');

    for (let i = 13; i <= 15; i++) {
      const button = allButtons.nth(i);

      // Get the SVG or content
      const svgClass = await button.evaluate((el) => {
        const svg = (el as HTMLButtonElement).querySelector('svg');
        if (svg) {
          // Try to determine what icon this is
          const classList = Array.from(svg.classList).join(' ');
          // Check for common icon patterns
          const innerHTML = svg.innerHTML;
          return {
            classes: classList,
            hasPath: innerHTML.includes('<path'),
            iconName: classList
          };
        }
        return null;
      });

      // Try to get aria-label or title
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');

      // Check data attributes
      const dataAttributes = await button.evaluate((el) => {
        const attrs = {};
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-')) {
            (attrs as any)[attr.name] = attr.value;
          }
        }
        return attrs;
      });

      console.log(`Button ${i}:`);
      console.log(`  SVG info: ${JSON.stringify(svgClass)}`);
      console.log(`  aria-label: ${ariaLabel}`);
      console.log(`  title: ${title}`);
      console.log(`  data attrs: ${JSON.stringify(dataAttributes)}`);

      // Try to determine icon by checking if it has specific lucide icon classes
      const iconMatch = svgClass?.iconName?.match(/lucide-(\w+)/);
      if (iconMatch) {
        console.log(`  Icon type: ${iconMatch[1]}`);
      }
      console.log('');
    }

    // Now let's try clicking button 13 and see what happens
    console.log('\nTesting button 13 click...');
    await allButtons.nth(13).click();
    await page.waitForTimeout(1500);

    // Check for any modals or changes
    const dialog = page.locator('[role="dialog"]');
    const hasDialog = await dialog.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`Dialog appeared: ${hasDialog}`);

    // Check for any visible changes
    const newButtons = page.locator('button');
    const newButtonCount = await newButtons.count();
    console.log(`Button count after click: ${newButtonCount} (was 88)`);

    // Take a screenshot
    await page.screenshot({
      path: `/tmp/directv-after-btn13-click.png`,
      fullPage: false
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

findEditButton().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

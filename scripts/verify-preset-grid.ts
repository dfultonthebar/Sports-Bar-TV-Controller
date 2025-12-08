import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function verifyPresetGridLayout() {
  const screenshotDir = '/home/ubuntu/Sports-Bar-TV-Controller/playwright-screenshots';

  try {
    // Create screenshot directory
    await mkdir(screenshotDir, { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    console.log('Navigating to http://localhost:3001/remote...');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Page loaded, waiting for channel preset grid to appear...');

    // Wait for the preset grid to be visible
    await page.waitForSelector('[class*="preset"], [class*="channel"]', {
      timeout: 10000
    });

    // Wait a bit for animations to complete
    await page.waitForTimeout(1000);

    // Take full page screenshot first
    const fullPagePath = join(screenshotDir, '01-remote-page-full.png');
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });
    console.log(`Full page screenshot saved: ${fullPagePath}`);

    // Try to find and screenshot the preset grid section
    // Looking for common selectors that might contain the grid
    const gridSelectors = [
      '[class*="grid"]',
      '[class*="preset"]',
      'section',
      '[role="region"]'
    ];

    let foundGrid = false;
    for (const selector of gridSelectors) {
      const elements = await page.locator(selector).count();
      if (elements > 0) {
        const firstElement = page.locator(selector).first();
        const text = await firstElement.textContent();
        if (text && text.toLowerCase().includes('channel')) {
          console.log(`Found grid-like element with selector: ${selector}`);

          // Get the bounding box
          const box = await firstElement.boundingBox();
          if (box) {
            console.log(`Element bounding box:`, box);
          }

          // Try to screenshot this area
          try {
            const gridPath = join(screenshotDir, '02-preset-grid-section.png');
            await firstElement.screenshot({ path: gridPath });
            console.log(`Grid section screenshot saved: ${gridPath}`);
            foundGrid = true;
            break;
          } catch (e) {
            console.log(`Could not screenshot element with selector ${selector}`);
          }
        }
      }
    }

    if (!foundGrid) {
      console.log('Could not find grid section with preset selectors, taking full page screenshot instead');
    }

    // Look for individual preset buttons and analyze them
    console.log('\nAnalyzing preset button structure...');

    // Try various button selectors
    const buttonSelectors = [
      'button[class*="preset"]',
      'button[class*="channel"]',
      'div[class*="preset"] button',
      'div[role="button"]',
      'button'
    ];

    let presetButtons = [];
    for (const selector of buttonSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found ${count} elements with selector: ${selector}`);

        // Get first few buttons to analyze
        for (let i = 0; i < Math.min(3, count); i++) {
          const button = page.locator(selector).nth(i);
          const text = await button.textContent();
          const classes = await button.getAttribute('class');

          if (text && text.includes('Ch') || text.match(/\d+/)) {
            console.log(`Button ${i}:`);
            console.log(`  Text content: ${text}`);
            console.log(`  Classes: ${classes}`);
            presetButtons.push({ selector, index: i, text });
          }
        }

        if (presetButtons.length > 0) break;
      }
    }

    // If we found preset buttons, take a zoomed screenshot
    if (presetButtons.length > 0) {
      console.log(`\nFound preset buttons, taking zoomed screenshot...`);
      const firstButton = page.locator(presetButtons[0].selector).nth(presetButtons[0].index);

      try {
        const zoomedPath = join(screenshotDir, '03-preset-button-detail.png');
        await firstButton.screenshot({ path: zoomedPath });
        console.log(`Button detail screenshot saved: ${zoomedPath}`);
      } catch (e) {
        console.log(`Could not take zoomed screenshot`);
      }
    }

    // Take a screenshot of the entire viewport for verification
    const viewportPath = join(screenshotDir, '04-viewport-screenshot.png');
    await page.screenshot({ path: viewportPath });
    console.log(`Viewport screenshot saved: ${viewportPath}`);

    // Analyze the HTML structure
    console.log('\n\nAnalyzing HTML structure for preset grid...');
    const bodyHTML = await page.content();

    // Look for preset-related elements in the HTML
    if (bodyHTML.includes('Quick Channel') || bodyHTML.includes('Channel')) {
      console.log('Found channel/preset references in HTML');

      // Extract a sample of the HTML containing preset buttons
      const presetMatch = bodyHTML.match(/<button[^>]*class="[^"]*preset[^"]*"[^>]*>.*?<\/button>/i);
      if (presetMatch) {
        console.log('\nSample preset button HTML:');
        console.log(presetMatch[0].substring(0, 500));
      }
    }

    // Check for usage count badges
    console.log('\nLooking for usage count badges...');
    const badgeSelectors = [
      '[class*="badge"]',
      '[class*="count"]',
      '[class*="usage"]',
      'span[class*="text"]'
    ];

    for (const selector of badgeSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        const firstBadge = page.locator(selector).first();
        const text = await firstBadge.textContent();
        const classes = await firstBadge.getAttribute('class');

        // Check if it looks like a usage count (contains "x" or numbers)
        if (text && (text.match(/\d+x/) || text.match(/\d+/) && text.length < 10)) {
          console.log(`Found potential badge with selector: ${selector}`);
          console.log(`  Text: ${text}`);
          console.log(`  Classes: ${classes}`);
        }
      }
    }

    await browser.close();

    console.log('\n\nTest Summary:');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    console.log(`Files created:`);
    console.log(`  - 01-remote-page-full.png (full page screenshot)`);
    console.log(`  - 02-preset-grid-section.png (grid section, if found)`);
    console.log(`  - 03-preset-button-detail.png (button detail, if found)`);
    console.log(`  - 04-viewport-screenshot.png (viewport screenshot)`);

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

verifyPresetGridLayout();

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

    console.log('Page loaded');

    // Take initial screenshot to see the video tab state
    const initialPath = join(screenshotDir, '00-initial-video-tab.png');
    await page.screenshot({ path: initialPath, fullPage: false });
    console.log(`Initial screenshot saved: ${initialPath}`);

    // Wait for the bottom navigation to be visible
    console.log('Waiting for navigation buttons...');
    await page.waitForSelector('button', { timeout: 5000 });

    // Click on the Guide tab (4th button from left based on page structure)
    console.log('Looking for and clicking Guide tab...');
    const buttons = await page.locator('button').all();

    let guideButtonFound = false;
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent();
      console.log(`Button ${i}: "${text}"`);
      if (text && text.toLowerCase().includes('guide')) {
        console.log(`Found Guide button at index ${i}`);
        await buttons[i].click();
        guideButtonFound = true;
        break;
      }
    }

    if (!guideButtonFound) {
      console.log('Guide button not found, trying to click by role');
      // Try alternative approach - look for button containing "Guide" text
      const guideButton = page.locator('button:has-text("Guide")').first();
      if (await guideButton.isVisible()) {
        await guideButton.click();
        guideButtonFound = true;
      }
    }

    if (!guideButtonFound) {
      console.log('Warning: Could not find Guide button, page may show empty state');
    }

    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(2000);

    // Take screenshot of guide tab
    const guideTabPath = join(screenshotDir, '01-guide-tab-full.png');
    await page.screenshot({ path: guideTabPath, fullPage: true });
    console.log(`Guide tab screenshot saved: ${guideTabPath}`);

    // Look for the "Quick Channel Access" heading
    console.log('Looking for Quick Channel Access section...');
    const quickChannelElement = page.locator('h3:has-text("Quick Channel Access")').first();

    if (await quickChannelElement.isVisible()) {
      console.log('Found Quick Channel Access section');

      // Get the parent container of the heading (should contain the grid)
      const parent = quickChannelElement.locator('xpath=ancestor::div[contains(@class, "backdrop-blur")]').first();

      try {
        const parentBoxPath = join(screenshotDir, '02-preset-grid-section.png');
        await parent.screenshot({ path: parentBoxPath });
        console.log(`Preset grid section screenshot saved: ${parentBoxPath}`);
      } catch (e) {
        console.log('Could not screenshot parent element');
      }
    } else {
      console.log('Quick Channel Access section not visible');
    }

    // Look for preset buttons
    console.log('Analyzing preset buttons...');
    const presetButtons = page.locator('button[class*="relative"]').locator('xpath=ancestor::button[1]');
    const buttonCount = await presetButtons.count();
    console.log(`Found ${buttonCount} potential preset buttons`);

    if (buttonCount > 0) {
      // Get details of first few buttons
      for (let i = 0; i < Math.min(3, buttonCount); i++) {
        const button = presetButtons.nth(i);
        const text = await button.textContent();
        const hasUsageCount = await button.locator('[class*="bg-black"]').isVisible();

        console.log(`\nButton ${i}:`);
        console.log(`  Text content: ${text?.substring(0, 100)}`);
        console.log(`  Has usage count badge: ${hasUsageCount}`);

        // Try to screenshot individual button
        try {
          const buttonPath = join(screenshotDir, `03-preset-button-${i}.png`);
          await button.screenshot({ path: buttonPath });
          console.log(`  Button screenshot saved: ${buttonPath}`);
        } catch (e) {
          console.log(`  Could not screenshot button`);
        }
      }
    }

    // Look for usage count badges specifically
    console.log('\nSearching for usage count badges...');
    const badges = page.locator('[class*="bg-black"]');
    const badgeCount = await badges.count();
    console.log(`Found ${badgeCount} elements with black background`);

    if (badgeCount > 0) {
      for (let i = 0; i < Math.min(3, badgeCount); i++) {
        const badge = badges.nth(i);
        const text = await badge.textContent();
        const classes = await badge.getAttribute('class');

        if (text && text.match(/\d+x/)) {
          console.log(`\nUsage badge ${i}:`);
          console.log(`  Text: ${text}`);
          console.log(`  Classes: ${classes}`);
        }
      }
    }

    // Get the full HTML to analyze structure
    console.log('\nAnalyzing page structure...');
    const htmlContent = await page.content();

    // Look for preset-related elements
    if (htmlContent.includes('Ch ') || htmlContent.includes('Channel')) {
      console.log('Found channel references in HTML');
    }

    // Look for the usage count badge HTML pattern
    if (htmlContent.includes('bg-black') && htmlContent.includes('text-white')) {
      console.log('Found styling patterns for usage badges');
    }

    // Check for the specific implementation pattern
    if (htmlContent.includes('preset.usageCount') || htmlContent.includes('usageCount')) {
      console.log('Usage count data is present in the page');
    }

    // Navigate back to remote selector tab to see different implementation
    console.log('\nChecking Remote selector tab...');
    const remoteButton = page.locator('button:has-text("Remote")').first();
    if (await remoteButton.isVisible()) {
      await remoteButton.click();
      await page.waitForTimeout(1000);

      const remoteTabPath = join(screenshotDir, '04-remote-tab.png');
      await page.screenshot({ path: remoteTabPath, fullPage: true });
      console.log(`Remote tab screenshot saved: ${remoteTabPath}`);
    }

    await browser.close();

    console.log('\n\nTest Summary:');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    console.log(`\nFiles created:`);
    console.log(`  - 00-initial-video-tab.png`);
    console.log(`  - 01-guide-tab-full.png`);
    console.log(`  - 02-preset-grid-section.png (if grid found)`);
    console.log(`  - 03-preset-button-*.png (individual buttons)`);
    console.log(`  - 04-remote-tab.png`);

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

verifyPresetGridLayout();

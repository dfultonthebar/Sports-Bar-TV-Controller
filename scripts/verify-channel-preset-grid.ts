import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function verifyChannelPresetGrid() {
  const screenshotDir = '/home/ubuntu/Sports-Bar-TV-Controller/playwright-screenshots';

  try {
    await mkdir(screenshotDir, { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    console.log('Step 1: Navigating to http://localhost:3001/remote...');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Step 2: Waiting for page to stabilize...');
    await page.waitForTimeout(2000);

    // Click on the Remote tab
    console.log('Step 3: Clicking on Remote tab...');
    const remoteButton = page.locator('button:has-text("Remote")');
    if (await remoteButton.isVisible()) {
      await remoteButton.click();
      await page.waitForTimeout(1500);
    }

    // Take screenshot before device selection
    const beforeDevicePath = join(screenshotDir, '10-remote-before-selection.png');
    await page.screenshot({ path: beforeDevicePath, fullPage: true });
    console.log(`Screenshot before device selection: ${beforeDevicePath}`);

    // Select the first device (Cable Box 1)
    console.log('Step 4: Selecting first device...');
    const deviceButtons = page.locator('button').filter({
      has: page.locator('text=/Cable Box|Direct TV/')
    });

    const deviceCount = await deviceButtons.count();
    console.log(`Found ${deviceCount} device buttons`);

    if (deviceCount > 0) {
      // Click the first device button
      const firstDevice = deviceButtons.first();
      const deviceText = await firstDevice.textContent();
      console.log(`Selecting device: ${deviceText}`);
      await firstDevice.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No device buttons found, trying alternative approach...');
      // Try clicking on any button that contains "Cable Box"
      const cableBoxButton = page.locator('text=/Cable Box 1/').first();
      if (await cableBoxButton.isVisible()) {
        await cableBoxButton.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }

    // Take screenshot after device selection
    const afterDevicePath = join(screenshotDir, '11-remote-after-selection.png');
    await page.screenshot({ path: afterDevicePath, fullPage: true });
    console.log(`Screenshot after device selection: ${afterDevicePath}`);

    // Look for the "Quick Channel Access" section
    console.log('Step 5: Looking for Quick Channel Access section...');
    const quickChannelHeading = page.locator('h3:has-text("Quick Channel Access")');

    if (await quickChannelHeading.isVisible()) {
      console.log('Found "Quick Channel Access" section!');

      // Get the parent grid container
      const gridContainer = quickChannelHeading.locator('xpath=ancestor::div[contains(@class, "rounded-lg")]').first();

      try {
        const gridPath = join(screenshotDir, '12-channel-preset-grid.png');
        await gridContainer.screenshot({ path: gridPath });
        console.log(`Grid section screenshot: ${gridPath}`);
      } catch (e) {
        console.log('Could not screenshot grid container, taking full page screenshot');
      }

      // Look for individual preset buttons
      console.log('Step 6: Analyzing preset buttons...');

      // Get all buttons within the grid
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Found ${buttonCount} total buttons on page`);

      // Look for buttons that contain "Ch " which indicates channel presets
      const gridButtons = await page.locator('button:has-text("Ch")').all();
      console.log(`Found ${gridButtons.length} buttons with channel numbers`);

      if (gridButtons.length > 0) {
        // Analyze first preset button
        console.log('\nAnalyzing first preset button:');
        const firstPreset = gridButtons[0];
        const presetText = await firstPreset.textContent();
        console.log(`  Full text: ${presetText?.substring(0, 150)}`);

        // Check for usage count badge
        const badge = firstPreset.locator('[class*="bg-black"]');
        const badgeVisible = await badge.isVisible();

        if (badgeVisible) {
          const badgeText = await badge.textContent();
          const badgeClasses = await badge.getAttribute('class');
          console.log(`  Usage badge found: "${badgeText}"`);
          console.log(`  Badge classes: ${badgeClasses}`);
        } else {
          console.log(`  No usage badge found on first button`);
        }

        // Take a closeup screenshot of the first preset button
        try {
          const presetPath = join(screenshotDir, '13-first-preset-button.png');
          await firstPreset.screenshot({ path: presetPath });
          console.log(`  Preset button screenshot: ${presetPath}`);
        } catch (e) {
          console.log(`  Could not screenshot preset button`);
        }

        // Analyze a few more buttons
        console.log('\nAnalyzing preset grid structure:');
        for (let i = 0; i < Math.min(3, gridButtons.length); i++) {
          const btn = gridButtons[i];
          const text = await btn.textContent();
          const badge = btn.locator('[class*="bg-black"]');
          const hasBadge = await badge.isVisible();
          console.log(`  Button ${i}: Has usage badge = ${hasBadge}`);
        }
      }
    } else {
      console.log('Quick Channel Access section not found');

      // Check if there's any grid visible
      const gridContainers = page.locator('[class*="grid"]');
      const gridCount = await gridContainers.count();
      console.log(`Found ${gridCount} grid containers on page`);
    }

    // Get HTML content to analyze structure
    console.log('Step 7: Analyzing HTML structure...');
    const htmlContent = await page.content();

    // Check for key patterns
    const patterns = {
      'Usage count display (Nx format)': htmlContent.includes('usageCount') || htmlContent.includes('x'),
      'Badge styling (bg-black/40)': htmlContent.includes('bg-black') && htmlContent.includes('text-white'),
      'Bottom-right positioning': htmlContent.includes('bottom-') && htmlContent.includes('right-'),
      'Channel display (Ch)': htmlContent.includes('Ch '),
      'Quick Channel Access heading': htmlContent.includes('Quick Channel Access'),
    };

    console.log('\nHTML Pattern Analysis:');
    Object.entries(patterns).forEach(([pattern, found]) => {
      console.log(`  ${pattern}: ${found ? 'YES' : 'NO'}`);
    });

    // Scroll down to see if grid is below viewport
    console.log('Step 8: Scrolling to check for off-screen content...');
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(500);

    const afterScrollPath = join(screenshotDir, '14-after-scroll.png');
    await page.screenshot({ path: afterScrollPath, fullPage: true });
    console.log(`Screenshot after scroll: ${afterScrollPath}`);

    await browser.close();

    console.log('\n\nTest Summary:');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    console.log(`\nKey files:`);
    console.log(`  - 10-remote-before-selection.png (initial state)`);
    console.log(`  - 11-remote-after-selection.png (after selecting device)`);
    console.log(`  - 12-channel-preset-grid.png (grid section, if found)`);
    console.log(`  - 13-first-preset-button.png (individual preset button)`);
    console.log(`  - 14-after-scroll.png (after scrolling)`);

  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

verifyChannelPresetGrid();

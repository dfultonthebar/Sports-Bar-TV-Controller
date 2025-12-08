import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

async function capturePresetGridDetail() {
  const screenshotDir = '/home/ubuntu/Sports-Bar-TV-Controller/playwright-screenshots';

  try {
    await mkdir(screenshotDir, { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Use higher viewport for better detail
    const context = await browser.newContext({
      viewport: { width: 2560, height: 1440 }
    });

    const page = await context.newPage();

    console.log('Navigating to http://localhost:3001/remote...');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(1500);

    // Click Remote tab
    const remoteButton = page.locator('button:has-text("Remote")');
    if (await remoteButton.isVisible()) {
      await remoteButton.click();
      await page.waitForTimeout(1500);
    }

    // Select first device
    const deviceButtons = page.locator('button').filter({
      has: page.locator('text=/Cable Box/')
    });

    if (await deviceButtons.count() > 0) {
      await deviceButtons.first().click();
      await page.waitForTimeout(2000);
    }

    // Find and capture the grid
    const gridContainer = page.locator('h3:has-text("Quick Channel Access")').locator('xpath=ancestor::div[contains(@class, "backdrop-blur")]').first();

    if (await gridContainer.isVisible()) {
      console.log('Grid container found, capturing high-resolution detail...');

      // Get bounding box for precise capture
      const box = await gridContainer.boundingBox();
      if (box) {
        console.log(`Grid bounding box: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);

        // Capture with viewport adjustment if needed
        const detailedPath = join(screenshotDir, '20-grid-high-res.png');
        await gridContainer.screenshot({ path: detailedPath });
        console.log(`High-resolution grid screenshot: ${detailedPath}`);
      }

      // Now capture individual preset buttons with details
      const presetButtons = page.locator('button:has-text("Ch")');
      const buttonCount = await presetButtons.count();
      console.log(`Found ${buttonCount} preset buttons`);

      // Capture first 3 buttons with their badges
      for (let i = 0; i < Math.min(3, buttonCount); i++) {
        const button = presetButtons.nth(i);
        const buttonPath = join(screenshotDir, `21-preset-detail-${i}.png`);

        try {
          await button.screenshot({ path: buttonPath });

          // Get text content for analysis
          const buttonText = await button.textContent();
          const badge = button.locator('[class*="bg-black"]');
          const badgeVisible = await badge.isVisible();
          const badgeText = badgeVisible ? await badge.textContent() : 'none';

          console.log(`\nButton ${i}:`);
          console.log(`  Path: ${buttonPath}`);
          console.log(`  Content: ${buttonText?.substring(0, 100)}`);
          console.log(`  Usage badge: ${badgeText}`);
        } catch (e) {
          console.log(`Could not capture button ${i}`);
        }
      }

      // Analyze the complete grid structure
      console.log('\nAnalyzing grid structure...');
      const gridContent = await gridContainer.innerHTML();

      // Count grid items
      const gridItems = await gridContainer.locator('button[class*="group"]').count();
      console.log(`Grid contains ${gridItems} items`);

      // Check badge positions
      const badges = await gridContainer.locator('[class*="bottom"]').all();
      console.log(`Found ${badges.length} elements with bottom positioning`);

      for (let i = 0; i < Math.min(2, badges.length); i++) {
        const badge = badges[i];
        const classes = await badge.getAttribute('class');
        const text = await badge.textContent();

        if (text && text.match(/\d+x/)) {
          console.log(`\nBadge ${i}:`);
          console.log(`  Text: ${text}`);
          console.log(`  Classes: ${classes}`);

          // Extract key styling classes
          if (classes) {
            const hasBottomRight = classes.includes('bottom-') && classes.includes('right-');
            const hasBlackBg = classes.includes('bg-black');
            const hasWhiteText = classes.includes('text-white');
            const hasSmallText = classes.includes('text-[10px]');

            console.log(`  Position (bottom-right): ${hasBottomRight}`);
            console.log(`  Styling (bg-black/40): ${hasBlackBg}`);
            console.log(`  Text color (white/80): ${hasWhiteText}`);
            console.log(`  Size (text-[10px]): ${hasSmallText}`);
          }
        }
      }
    } else {
      console.log('Grid container not found');
    }

    // Take full page screenshot for context
    const fullPath = join(screenshotDir, '22-full-context.png');
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log(`\nFull page context: ${fullPath}`);

    await browser.close();

    console.log('\nCapture complete!');
    console.log(`All screenshots saved to: ${screenshotDir}`);

  } catch (error) {
    console.error('Error during capture:', error);
    process.exit(1);
  }
}

capturePresetGridDetail();

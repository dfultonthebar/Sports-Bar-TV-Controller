import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = '/tmp/ui-issues-analysis';
const BARTENDER_URL = 'http://localhost:3001/remote';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureUIIssues() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('========================================');
    console.log('UI ISSUES ANALYSIS - Bartender Remote');
    console.log('========================================\n');

    console.log('1. Navigating to bartender remote...');
    await page.goto(BARTENDER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // ===== ISSUE 1: SCREEN JUMP WHEN CHANGING INPUT =====
    console.log('\n--- ISSUE 1: Screen Jump When Changing Input ---\n');

    // Find and click the Routing button
    console.log('Looking for Routing button...');
    const routingButton = page.locator('button').filter({ hasText: /^Routing$|^Routing\s/ }).first();

    if (await routingButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✓ Found Routing button');

      // Capture BEFORE state
      console.log('Capturing BEFORE changing input...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/01-routing-before-input-change.png`,
        fullPage: true
      });
      console.log('✓ Screenshot saved: 01-routing-before-input-change.png');

      // Click routing button to open routing UI
      await routingButton.click();
      await page.waitForTimeout(1500);

      // Capture the routing UI
      console.log('Capturing routing UI...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/02-routing-ui-open.png`,
        fullPage: true
      });
      console.log('✓ Screenshot saved: 02-routing-ui-open.png');

      // Get initial scroll position
      const initialScrollY = await page.evaluate(() => window.scrollY);
      console.log(`Initial scroll position: ${initialScrollY}px`);

      // Find input selectors and click one
      const inputSelectors = await page.locator('button').filter({ hasText: /Cable Box|Fire TV|DirecTV/ }).all();
      console.log(`Found ${inputSelectors.length} input options`);

      if (inputSelectors.length > 0) {
        // Get current state of first selector
        const firstSelectorText = await inputSelectors[0].textContent();
        console.log(`First input option: ${firstSelectorText}`);

        // Click on a different input (if multiple available)
        let selectedIndex = 0;
        if (inputSelectors.length > 1) {
          selectedIndex = 1;
        }

        const selectedInput = inputSelectors[selectedIndex];
        const selectedText = await selectedInput.textContent();
        console.log(`Selecting input: ${selectedText}`);

        // Capture BEFORE the click
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/03-before-input-click.png`,
          fullPage: false
        });
        console.log('✓ Screenshot saved: 03-before-input-click.png');

        // Click the input
        await selectedInput.click();
        await page.waitForTimeout(1500);

        // Capture AFTER the click
        console.log('Capturing AFTER changing input...');
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/04-routing-after-input-change.png`,
          fullPage: true
        });
        console.log('✓ Screenshot saved: 04-routing-after-input-change.png');

        // Get new scroll position
        const newScrollY = await page.evaluate(() => window.scrollY);
        console.log(`New scroll position: ${newScrollY}px`);
        console.log(`Scroll difference: ${newScrollY - initialScrollY}px (${newScrollY !== initialScrollY ? 'JUMPED' : 'STABLE'})`);

        // Close routing and capture final state
        const closeButton = page.locator('button[aria-label*="close"], button[aria-label*="Close"], button:has-text("Close"), [aria-label="close"]').first();
        if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(500);
        } else {
          // Try pressing Escape
          try {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          } catch (e) {
            console.log('Could not close dialog with Escape');
          }
        }

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/05-routing-closed-after-change.png`,
          fullPage: true
        });
        console.log('✓ Screenshot saved: 05-routing-closed-after-change.png');
      }
    } else {
      console.log('✗ Routing button not found');
    }

    // ===== ISSUE 2: VIDEO BUTTON GREEN OVERLAY OVERLAP =====
    console.log('\n--- ISSUE 2: Video Button Green Overlay Overlap ---\n');

    // Navigate to a page where we can interact with video controls
    console.log('Looking for Video button...');

    // First, try to find it in the current page
    let videoButton = page.locator('button').filter({ hasText: /^Video$/ }).first();

    if (!await videoButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Video button not in current view, looking for tabs...');
      // Look for a "Video" tab in the tab bar
      videoButton = page.locator('[role="tab"]').filter({ hasText: 'Video' }).first();
    }

    if (await videoButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('✓ Found Video button');

      // Capture before clicking
      console.log('Capturing BEFORE clicking Video button...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/06-video-button-before.png`,
        fullPage: true
      });
      console.log('✓ Screenshot saved: 06-video-button-before.png');

      // Click video button
      await videoButton.click();
      await page.waitForTimeout(1500);

      // Capture after clicking (should show overlay issue)
      console.log('Capturing AFTER clicking Video button...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/07-video-button-after-click.png`,
        fullPage: true
      });
      console.log('✓ Screenshot saved: 07-video-button-after-click.png');

      // Try to zoom in on the overlay area - with better error handling
      try {
        const overlayElement = page.locator('.overlay, [class*="overlay"], [class*="green"], [data-testid*="overlay"]').first();
        const isVisible = await overlayElement.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          const box = await overlayElement.boundingBox().catch(() => null);
          if (box) {
            console.log(`Overlay element found at: ${JSON.stringify(box)}`);

            // Capture a zoomed/cropped view
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/08-video-overlay-closeup.png`,
              clip: {
                x: Math.max(0, box.x - 50),
                y: Math.max(0, box.y - 50),
                width: box.width + 100,
                height: box.height + 100
              }
            });
            console.log('✓ Screenshot saved: 08-video-overlay-closeup.png');
          }
        } else {
          console.log('No overlay element found');
        }
      } catch (e) {
        console.log('Could not capture overlay closeup:', (e as any).message);
      }

      // Get CSS styles of the overlay
      try {
        const overlayCSSInfo = await page.evaluate(() => {
          const overlays = document.querySelectorAll('[class*="overlay"], [style*="overlay"]');
          const info: any[] = [];
          overlays.forEach((el, idx) => {
            const computed = window.getComputedStyle(el);
            info.push({
              index: idx,
              class: el.className,
              zIndex: computed.zIndex,
              position: computed.position,
              top: computed.top,
              left: computed.left,
              width: computed.width,
              height: computed.height,
              display: computed.display,
              opacity: computed.opacity,
              pointerEvents: computed.pointerEvents
            });
          });
          return info;
        });

        console.log('Overlay CSS Information:');
        console.log(JSON.stringify(overlayCSSInfo, null, 2));
      } catch (e) {
        console.log('Could not extract overlay CSS info');
      }

    } else {
      console.log('✗ Video button not found');
    }

    // ===== GENERAL PAGE ANALYSIS =====
    console.log('\n--- General Page Analysis ---\n');

    // Get all buttons and interactive elements
    const allButtons = await page.locator('button').all();
    console.log(`Total buttons found: ${allButtons.length}`);

    const buttonLabels: string[] = [];
    for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
      const text = await allButtons[i].textContent();
      if (text && text.trim()) {
        buttonLabels.push(text.trim());
      }
    }
    console.log('Main buttons:', buttonLabels.join(', '));

    // Check for layout/style issues
    const layoutIssues = await page.evaluate(() => {
      const issues: string[] = [];

      // Check for position: fixed without proper z-index
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        const computed = window.getComputedStyle(el);
        if (computed.position === 'fixed' && computed.zIndex === 'auto') {
          issues.push(`Fixed element without z-index: ${el.className}`);
        }
      });

      // Check for overlapping absolute positioning
      const absoluteElements = document.querySelectorAll('[style*="position: absolute"], [style*="position:absolute"]');
      if (absoluteElements.length > 0) {
        issues.push(`Found ${absoluteElements.length} absolutely positioned elements`);
      }

      return issues;
    });

    console.log('Potential layout issues:');
    layoutIssues.forEach(issue => console.log(`  - ${issue}`));

    // Final full-page screenshot
    console.log('\nCapturing final full-page screenshot...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-final-full-page.png`,
      fullPage: true
    });
    console.log('✓ Screenshot saved: 09-final-full-page.png');

    console.log('\n========================================');
    console.log('Analysis Complete');
    console.log('========================================');
    console.log(`\nAll screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('\nFiles captured:');
    const files = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => console.log(`  - ${f}`));

  } catch (error) {
    console.error('\nError during capture:', error);

    // Capture error state
    try {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/error-state.png`,
        fullPage: true
      });
      console.log('Captured error state screenshot');
    } catch (screenshotError) {
      console.error('Could not capture error state:', screenshotError);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

captureUIIssues().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

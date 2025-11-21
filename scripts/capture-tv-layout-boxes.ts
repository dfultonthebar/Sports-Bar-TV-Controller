import { chromium } from 'playwright';
import path from 'path';

async function captureLayoutBoxes() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const screenshotDir = '/tmp/ui-screenshots';

  try {
    // Desktop viewport (1920x1080)
    console.log('\n=== DESKTOP VIEWPORT (1920x1080) ===');
    const desktopContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const desktopPage = await desktopContext.newPage();

    // Navigate to bartender remote
    await desktopPage.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle'
    });

    // Wait for the page to fully load
    await desktopPage.waitForTimeout(2000);

    // Capture full page
    const fullPagePath = path.join(screenshotDir, 'bartender-remote-full-desktop.png');
    await desktopPage.screenshot({
      path: fullPagePath,
      fullPage: true
    });
    console.log(`✓ Full page captured: ${fullPagePath}`);

    // Click on Video tab to ensure TV layout is visible
    const videoTab = desktopPage.locator('button').filter({ hasText: /^Video$/ });
    const isVisible = await videoTab.isVisible();

    if (isVisible) {
      console.log('✓ Video tab is visible, clicking...');
      await videoTab.click();
      await desktopPage.waitForTimeout(1000);
    } else {
      console.log('✓ Video tab may already be active');
    }

    // Capture full page with Video tab active
    const videoFullPath = path.join(screenshotDir, 'bartender-remote-video-tab-desktop.png');
    await desktopPage.screenshot({
      path: videoFullPath,
      fullPage: true
    });
    console.log(`✓ Video tab view captured: ${videoFullPath}`);

    // Try to locate the TV layout container
    const layoutContainer = desktopPage.locator('[data-testid="tv-layout"], .tv-layout, [class*="layout"]').first();
    const containerVisible = await layoutContainer.isVisible().catch(() => false);

    if (containerVisible) {
      console.log('✓ TV layout container found');

      // Get bounding box for zoomed screenshot
      const boundingBox = await layoutContainer.boundingBox();
      if (boundingBox) {
        console.log(`  Layout dimensions: ${boundingBox.width}x${boundingBox.height}`);
        console.log(`  Position: ${boundingBox.x}, ${boundingBox.y}`);

        // Scroll layout into view
        await layoutContainer.scrollIntoViewIfNeeded();
        await desktopPage.waitForTimeout(500);

        // Capture zoomed area with padding
        const padding = 50;
        const zoomPath = path.join(screenshotDir, 'bartender-remote-layout-closeup-desktop.png');
        await desktopPage.screenshot({
          path: zoomPath,
          clip: {
            x: Math.max(0, boundingBox.x - padding),
            y: Math.max(0, boundingBox.y - padding),
            width: boundingBox.width + (padding * 2),
            height: boundingBox.height + (padding * 2)
          }
        });
        console.log(`✓ Zoomed layout captured: ${zoomPath}`);
      }
    }

    await desktopContext.close();

    // Tablet viewport (768x1024)
    console.log('\n=== TABLET VIEWPORT (768x1024) ===');
    const tabletContext = await browser.newContext({
      viewport: { width: 768, height: 1024 }
    });
    const tabletPage = await tabletContext.newPage();

    await tabletPage.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle'
    });

    await tabletPage.waitForTimeout(2000);

    // Capture full page
    const tabletFullPath = path.join(screenshotDir, 'bartender-remote-full-tablet.png');
    await tabletPage.screenshot({
      path: tabletFullPath,
      fullPage: true
    });
    console.log(`✓ Full page captured: ${tabletFullPath}`);

    // Click Video tab on tablet
    const videoTabTablet = tabletPage.locator('button').filter({ hasText: /^Video$/ });
    const isVisibleTablet = await videoTabTablet.isVisible();

    if (isVisibleTablet) {
      console.log('✓ Video tab is visible, clicking...');
      await videoTabTablet.click();
      await tabletPage.waitForTimeout(1000);
    }

    // Capture tablet video view
    const tabletVideoPath = path.join(screenshotDir, 'bartender-remote-video-tab-tablet.png');
    await tabletPage.screenshot({
      path: tabletVideoPath,
      fullPage: true
    });
    console.log(`✓ Video tab view captured: ${tabletVideoPath}`);

    // Try to locate layout on tablet
    const layoutTablet = tabletPage.locator('[data-testid="tv-layout"], .tv-layout, [class*="layout"]').first();
    const containerVisibleTablet = await layoutTablet.isVisible().catch(() => false);

    if (containerVisibleTablet) {
      console.log('✓ TV layout container found on tablet');

      const boundingBox = await layoutTablet.boundingBox();
      if (boundingBox) {
        console.log(`  Layout dimensions: ${boundingBox.width}x${boundingBox.height}`);

        await layoutTablet.scrollIntoViewIfNeeded();
        await tabletPage.waitForTimeout(500);

        const padding = 40;
        const tabletZoomPath = path.join(screenshotDir, 'bartender-remote-layout-closeup-tablet.png');
        await tabletPage.screenshot({
          path: tabletZoomPath,
          clip: {
            x: Math.max(0, boundingBox.x - padding),
            y: Math.max(0, boundingBox.y - padding),
            width: boundingBox.width + (padding * 2),
            height: boundingBox.height + (padding * 2)
          }
        });
        console.log(`✓ Zoomed layout captured: ${tabletZoomPath}`);
      }
    }

    await tabletContext.close();

    // Mobile viewport (375x667)
    console.log('\n=== MOBILE VIEWPORT (375x667) ===');
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 667 }
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle'
    });

    await mobilePage.waitForTimeout(2000);

    // Capture full page
    const mobileFullPath = path.join(screenshotDir, 'bartender-remote-full-mobile.png');
    await mobilePage.screenshot({
      path: mobileFullPath,
      fullPage: true
    });
    console.log(`✓ Full page captured: ${mobileFullPath}`);

    // Click Video tab
    const videoTabMobile = mobilePage.locator('button').filter({ hasText: /^Video$/ });
    const isVisibleMobile = await videoTabMobile.isVisible();

    if (isVisibleMobile) {
      console.log('✓ Video tab is visible, clicking...');
      await videoTabMobile.click();
      await mobilePage.waitForTimeout(1000);
    }

    // Capture mobile video view
    const mobileVideoPath = path.join(screenshotDir, 'bartender-remote-video-tab-mobile.png');
    await mobilePage.screenshot({
      path: mobileVideoPath,
      fullPage: true
    });
    console.log(`✓ Video tab view captured: ${mobileVideoPath}`);

    await mobileContext.close();

    console.log('\n=== ANALYSIS ===');
    console.log('Screenshots saved to: /tmp/ui-screenshots/');
    console.log('\nKey files:');
    console.log('  - bartender-remote-full-desktop.png');
    console.log('  - bartender-remote-video-tab-desktop.png');
    console.log('  - bartender-remote-layout-closeup-desktop.png');
    console.log('  - bartender-remote-full-tablet.png');
    console.log('  - bartender-remote-video-tab-tablet.png');
    console.log('  - bartender-remote-layout-closeup-tablet.png');
    console.log('  - bartender-remote-full-mobile.png');
    console.log('  - bartender-remote-video-tab-mobile.png');

  } catch (error) {
    console.error('Error during capture:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureLayoutBoxes();

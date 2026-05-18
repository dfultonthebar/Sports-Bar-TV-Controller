import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function captureWirelessScreenshots() {
  const outputDir = '/tmp/ui-screenshots';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Desktop viewport for admin pages
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const desktopPage = await desktopContext.newPage();

    // Tablet viewport for bartender
    const tabletContext = await browser.newContext({
      viewport: { width: 1024, height: 768 }
    });
    const tabletPage = await tabletContext.newPage();

    // Log any console messages
    desktopPage.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[Desktop ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
    tabletPage.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[Tablet ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });

    // Log any page errors
    desktopPage.on('pageerror', err => console.error(`[Desktop Page Error] ${err.message}`));
    tabletPage.on('pageerror', err => console.error(`[Tablet Page Error] ${err.message}`));

    console.log('\n=== Screenshot 1: Device Config Overview Tab ===');
    await desktopPage.goto('http://localhost:3000/device-config', { waitUntil: 'networkidle' });

    // Wait for actual content to load - look for the category buttons
    await desktopPage.waitForSelector('button', { timeout: 10000 }).catch(() => {
      console.log('Note: Category buttons not found after 10s, continuing anyway');
    });

    await desktopPage.waitForTimeout(3000); // Extra wait for UI to settle
    await desktopPage.screenshot({
      path: `${outputDir}/01-device-config-overview.png`,
      fullPage: false
    });
    console.log('Captured: 01-device-config-overview.png');

    console.log('\n=== Screenshot 2: Device Config - Audio > Wireless Mics Tab ===');

    // Try to find and click the Audio category button
    const audioBtn = await desktopPage.locator('button').filter({ hasText: /Audio/ }).first();
    const isAudioVisible = await audioBtn.isVisible().catch(() => false);

    if (isAudioVisible) {
      console.log('Found Audio button, clicking...');
      await audioBtn.click();
      await desktopPage.waitForTimeout(1000);

      // Click Wireless Mics tab
      const wirelessBtn = await desktopPage.locator('button').filter({ hasText: /Wireless/ }).first();
      const isWirelessVisible = await wirelessBtn.isVisible().catch(() => false);

      if (isWirelessVisible) {
        console.log('Found Wireless Mics button, clicking...');
        await wirelessBtn.click();
        await desktopPage.waitForTimeout(1000);
      } else {
        console.log('Wireless Mics button not found');
      }
    } else {
      console.log('Audio button not found on page');
    }

    await desktopPage.screenshot({
      path: `${outputDir}/02-wireless-mics-admin-tab.png`,
      fullPage: false
    });
    console.log('Captured: 02-wireless-mics-admin-tab.png');

    console.log('\n=== Screenshot 3: Bartender Remote Landing ===');
    await tabletPage.goto('http://localhost:3002/remote', { waitUntil: 'networkidle' });
    await tabletPage.waitForTimeout(3000);

    // Check for errors
    const pageContent = await tabletPage.content();
    if (pageContent.includes('error') || pageContent.includes('Error')) {
      console.log('Warning: Page content contains "error" keyword');
    }

    await tabletPage.screenshot({
      path: `${outputDir}/03-bartender-remote-landing.png`,
      fullPage: false
    });
    console.log('Captured: 03-bartender-remote-landing.png');

    console.log('\n=== Screenshot 4: Bartender Remote - Audio Tab ===');

    // Check if login is required
    const loginInput = await tabletPage.locator('input[type="password"]').isVisible().catch(() => false);

    if (loginInput) {
      console.log('Auth prompt detected. Taking screenshot of login screen.');
      await tabletPage.screenshot({
        path: `${outputDir}/04-bartender-auth-prompt.png`,
        fullPage: false
      });
      console.log('Captured: 04-bartender-auth-prompt.png');
    } else {
      // Try to click Audio tab
      const tabAudio = await tabletPage.locator('button').filter({ hasText: /^Audio$/ }).first();
      const isTabAudioVisible = await tabAudio.isVisible().catch(() => false);

      if (isTabAudioVisible) {
        console.log('Found Audio tab, clicking...');
        await tabAudio.click();
        await tabletPage.waitForTimeout(1000);
        await tabletPage.screenshot({
          path: `${outputDir}/04-bartender-audio-tab.png`,
          fullPage: false
        });
        console.log('Captured: 04-bartender-audio-tab.png');
      } else {
        console.log('Audio tab not found, taking fallback screenshot');
        await tabletPage.screenshot({
          path: `${outputDir}/04-bartender-fallback.png`,
          fullPage: false
        });
      }
    }

    console.log('\n=== Capture Complete ===');
    console.log(`Screenshots saved to: ${outputDir}`);
    console.log('Files:');
    fs.readdirSync(outputDir).filter(f => f.endsWith('.png')).forEach(f => {
      const stats = fs.statSync(path.join(outputDir, f));
      console.log(`  - ${f} (${stats.size} bytes)`);
    });

    await desktopContext.close();
    await tabletContext.close();

  } catch (error) {
    console.error('Screenshot capture failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureWirelessScreenshots();

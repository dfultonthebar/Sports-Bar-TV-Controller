import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = '/tmp/ui-screenshots/after';
const BASE_URL = 'http://localhost:3001';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

interface PageCapture {
  name: string;
  url: string;
  waitFor?: string;
  click?: string;
  description: string;
}

const pagesToCapture: PageCapture[] = [
  // Main Dashboard
  {
    name: '01-main-dashboard',
    url: '/',
    description: 'Main Dashboard - Enhanced'
  },

  // Remote Control Page - All Tabs
  {
    name: '02-remote-video-tab',
    url: '/remote',
    description: 'Remote - Video Tab (TV Layout) - Enhanced'
  },
  {
    name: '03-remote-audio-tab',
    url: '/remote',
    click: 'button:has-text("Audio")',
    description: 'Remote - Audio Tab - Enhanced'
  },
  {
    name: '04-remote-music-tab',
    url: '/remote',
    click: 'button:has-text("Music")',
    description: 'Remote - Music Tab - Enhanced'
  },
  {
    name: '05-remote-guide-tab',
    url: '/remote',
    click: 'button:has-text("Guide")',
    description: 'Remote - Guide Tab - Enhanced'
  },
  {
    name: '06-remote-remote-tab',
    url: '/remote',
    click: 'button:has-text("Remote")',
    description: 'Remote - Remote Tab (Selector) - Enhanced'
  },
  {
    name: '07-remote-power-tab',
    url: '/remote',
    click: 'button:has-text("Power")',
    description: 'Remote - Power Tab (CEC) - Enhanced'
  },

  // Sports Guide
  {
    name: '08-sports-guide',
    url: '/sports-guide',
    description: 'Sports Guide Page - Enhanced'
  },

  // AI Hub
  {
    name: '09-ai-hub',
    url: '/ai-hub',
    description: 'AI Hub Dashboard'
  },

  // System Health
  {
    name: '10-system-health',
    url: '/system-health',
    description: 'System Health Monitor'
  },

  // Audio Control
  {
    name: '11-audio-control',
    url: '/audio-control',
    description: 'Audio Control Page'
  },

  // System Admin
  {
    name: '12-system-admin',
    url: '/system-admin',
    description: 'System Admin Page'
  }
];

async function captureAllPages() {
  console.log('🎨 Starting comprehensive AFTER UI capture...\n');
  console.log(`📁 Saving to: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  let successCount = 0;
  let failCount = 0;

  for (const pageConfig of pagesToCapture) {
    try {
      console.log(`📸 Capturing: ${pageConfig.description}`);

      // Navigate to page
      await page.goto(`${BASE_URL}${pageConfig.url}`, {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      // Click if needed (for tabs)
      if (pageConfig.click) {
        const element = page.locator(pageConfig.click);
        await element.click();
        await page.waitForTimeout(1000); // Wait for tab transition
      }

      // Wait for specific element if specified
      if (pageConfig.waitFor) {
        await page.waitForSelector(pageConfig.waitFor, { timeout: 5000 });
      }

      // Additional wait for any animations
      await page.waitForTimeout(500);

      // Capture screenshot
      const filename = `${pageConfig.name}.png`;
      const filepath = path.join(SCREENSHOTS_DIR, filename);

      await page.screenshot({
        path: filepath,
        fullPage: true
      });

      console.log(`   ✓ Saved: ${filename}\n`);
      successCount++;

    } catch (error) {
      console.error(`   ❌ Failed: ${pageConfig.description}`);
      console.error(`   Error: ${error}\n`);
      failCount++;
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log('📊 Capture Summary');
  console.log('='.repeat(50));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📁 Location: ${SCREENSHOTS_DIR}`);
  console.log('='.repeat(50) + '\n');
}

captureAllPages().catch(console.error);

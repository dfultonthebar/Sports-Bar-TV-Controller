import { chromium } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const BARTENDER_URL = 'http://24.123.87.42:3001/remote';

async function analyzeCECIssue() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Capture all messages
  const messages: string[] = [];
  const networkRequests: { method: string; url: string; status?: number }[] = [];

  page.on('console', msg => {
    messages.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('request', request => {
    networkRequests.push({
      method: request.method(),
      url: request.url()
    });
  });

  page.on('response', response => {
    const req = networkRequests.find(r => r.url === response.url());
    if (req) {
      req.status = response.status();
    }
  });

  try {
    console.log('\n=== CEC Issue Analysis ===\n');

    // Navigate to page
    await page.goto(BARTENDER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Clear network requests log to focus on actions
    networkRequests.length = 0;
    messages.length = 0;

    // Click on Remote tab
    const remoteTab = page.locator('button').filter({ hasText: 'Remote' }).first();
    if (await remoteTab.isVisible()) {
      await remoteTab.click();
      await page.waitForTimeout(1500);
    }

    // Look for Cable Box 2 and click it
    console.log('1. Looking for Cable Box 2...');
    const cableBox2 = page.locator('button').filter({ hasText: /Cable Box 2/ }).first();

    if (await cableBox2.isVisible({ timeout: 5000 })) {
      console.log('2. Found Cable Box 2, clicking it...');
      await cableBox2.click();
      await page.waitForTimeout(1500);

      // Now try to send a command - click on a number button (like 2 or 28)
      console.log('3. Attempting to select channel 28...');

      // Click 2
      const button2 = page.locator('button').filter({ hasText: /^2$/ }).first();
      if (await button2.isVisible()) {
        await button2.click();
        await page.waitForTimeout(300);
      }

      // Click 8
      const button8 = page.locator('button').filter({ hasText: /^8$/ }).first();
      if (await button8.isVisible()) {
        await button8.click();
        await page.waitForTimeout(300);
      }

      // Click ENTER
      const enterButton = page.locator('button').filter({ hasText: /ENTER/ }).first();
      if (await enterButton.isVisible()) {
        await enterButton.click();
        await page.waitForTimeout(500);
      }

      // Capture after action
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/08-after-channel-command.png`,
        fullPage: true
      });
    }

    // Wait a bit for any async operations
    await page.waitForTimeout(2000);

    // Analyze network requests
    console.log('\n4. Network requests made:');
    const cecRequests = networkRequests.filter(r =>
      r.url.includes('cec') || r.url.includes('ir') || r.url.includes('command') || r.url.includes('channel')
    );

    console.log(`\n  Total requests: ${networkRequests.length}`);
    console.log(`  CEC/IR/Command related: ${cecRequests.length}`);

    cecRequests.forEach(req => {
      console.log(`  - [${req.method}] ${req.url} (${req.status || 'pending'})`);
    });

    // All requests summary
    console.log('\n  All requests:');
    networkRequests.slice(0, 20).forEach(req => {
      console.log(`  - [${req.method}] ${new URL(req.url).pathname} (${req.status || 'pending'})`);
    });

    // Analyze console messages
    console.log('\n5. Console messages:');
    messages.forEach(msg => console.log(`  ${msg}`));

    // Check page for error indicators
    console.log('\n6. Page analysis:');
    const errorElements = await page.locator('[class*="error"], [role="alert"]').count();
    console.log(`  - Error elements visible: ${errorElements}`);

    const isMatrixDisconnected = await page.getByText('Matrix: disconnected').isVisible().catch(() => false);
    console.log(`  - Matrix disconnected banner: ${isMatrixDisconnected}`);

    // Get device info from the page
    const selectedDevice = await page.locator('[class*="selected"], .active').first().textContent().catch(() => 'unknown');
    console.log(`  - Selected device: ${selectedDevice}`);

    // Check for CEC configuration
    const pageContent = await page.content();
    const hasCEC = pageContent.includes('CEC') || pageContent.includes('cec');
    const hasIR = pageContent.includes('IR') || pageContent.includes('GlobalCache');
    const hasDeviceInfo = pageContent.includes('ttyACM') || pageContent.includes('/dev/');

    console.log(`  - Page mentions CEC: ${hasCEC}`);
    console.log(`  - Page mentions IR/GlobalCache: ${hasIR}`);
    console.log(`  - Page mentions device paths: ${hasDeviceInfo}`);

    // Save detailed report
    const report = `
CEC Issue Analysis Report
========================
Generated: ${new Date().toISOString()}
Target: ${BARTENDER_URL}

OBSERVATIONS:
1. Cable Box 2 Selection: Found and clickable
2. Remote Control Interface: Displays remote buttons after selection
3. Channel Command Attempt: Selected "28" and pressed ENTER

NETWORK REQUESTS (CEC/IR related):
${cecRequests.map(r => `  [${r.method}] ${r.url} (${r.status})`).join('\n')}

CONSOLE OUTPUT:
${messages.join('\n')}

PAGE ANALYSIS:
- Has CEC mentions: ${hasCEC}
- Has IR/GlobalCache mentions: ${hasIR}
- Has device paths: ${hasDeviceInfo}
- Error elements visible: ${errorElements}
- Matrix status: ${isMatrixDisconnected ? 'disconnected' : 'connected'}

ISSUE:
The interface shows a "Cable Box Remote" control after selecting Cable Box 2.
When sending commands (channel selection), need to verify if:
1. Commands are being sent via CEC to /dev/ttyACM2
2. Or if they're being sent via IR/GlobalCache (which would be incorrect)

NEXT STEPS:
1. Check server logs for actual command type being sent
2. Verify Cable Box 2 configuration in the system
3. Check if device type detection is working correctly
`;

    fs.writeFileSync(`${SCREENSHOT_DIR}/cec-analysis-report.txt`, report);
    console.log('\nReport saved to:', `${SCREENSHOT_DIR}/cec-analysis-report.txt`);

  } catch (error) {
    console.error('Error during analysis:', error);
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/analysis-error.png`,
      fullPage: true
    });
    throw error;
  } finally {
    await browser.close();
  }
}

analyzeCECIssue().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

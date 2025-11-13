import { chromium, Browser, Page, Request } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  payload: any;
  response?: {
    status: number;
    statusText: string;
    body: any;
  };
}

async function testCableBoxRemote() {
  const screenshotDir = '/tmp/ui-screenshots/cable-box-test';
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const capturedRequests: CapturedRequest[] = [];
  const consoleMessages: string[] = [];
  const consoleErrors: string[] = [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: '/tmp/ui-screenshots/cable-box-test/videos' }
  });

  const page = await context.newPage();

  // Listen to console messages
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    console.log('Browser console:', text);
  });

  // Listen to page errors
  page.on('pageerror', error => {
    const errorText = `PageError: ${error.message}`;
    consoleErrors.push(errorText);
    console.error('Browser error:', errorText);
  });

  // Capture network requests to /api/ir-devices/send-command
  page.on('request', (request: Request) => {
    const url = request.url();
    if (url.includes('/api/ir-devices/send-command')) {
      const capturedReq: CapturedRequest = {
        url,
        method: request.method(),
        headers: request.headers(),
        payload: null
      };

      // Try to get POST data
      if (request.method() === 'POST') {
        const postData = request.postData();
        if (postData) {
          try {
            capturedReq.payload = JSON.parse(postData);
          } catch (e) {
            capturedReq.payload = postData;
          }
        }
      }

      capturedRequests.push(capturedReq);
      console.log('\n=== CAPTURED REQUEST ===');
      console.log('URL:', url);
      console.log('Method:', request.method());
      console.log('Payload:', JSON.stringify(capturedReq.payload, null, 2));
    }
  });

  // Capture responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/ir-devices/send-command')) {
      const request = capturedRequests.find(r => r.url === url);
      if (request) {
        try {
          const body = await response.json();
          request.response = {
            status: response.status(),
            statusText: response.statusText(),
            body
          };
          console.log('Response status:', response.status());
          console.log('Response body:', JSON.stringify(body, null, 2));
          console.log('======================\n');
        } catch (e) {
          request.response = {
            status: response.status(),
            statusText: response.statusText(),
            body: await response.text()
          };
        }
      }
    }
  });

  try {
    console.log('Step 1: Navigate to http://localhost:3001/remote');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.screenshot({
      path: path.join(screenshotDir, '01-initial-load.png'),
      fullPage: true
    });
    console.log('✓ Navigated to /remote');

    // Wait a bit for any initial data loading
    await page.waitForTimeout(2000);

    console.log('\nStep 2: Click on "Remote" tab');
    // Look for the Remote tab button
    const remoteTabs = await page.locator('button').all();
    let remoteTabFound = false;

    for (const tab of remoteTabs) {
      const text = await tab.textContent();
      if (text && text.toLowerCase().includes('remote')) {
        await tab.click();
        remoteTabFound = true;
        console.log('✓ Clicked Remote tab');
        break;
      }
    }

    if (!remoteTabFound) {
      console.log('⚠ Remote tab not found, might already be active');
    }

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotDir, '02-remote-tab-active.png'),
      fullPage: true
    });

    console.log('\nStep 3: Select "Ch 1" (Cable Box 1)');
    // Look for the Ch 1 card or button
    const ch1Selectors = [
      'text="Ch 1"',
      'text="Cable Box 1"',
      '[data-device-id="cable-box-1"]',
      'button:has-text("Ch 1")',
      'div:has-text("Ch 1")'
    ];

    let deviceSelected = false;
    for (const selector of ch1Selectors) {
      try {
        const element = page.locator(selector).first();
        const count = await element.count();
        if (count > 0) {
          await element.click();
          deviceSelected = true;
          console.log(`✓ Selected Ch 1 using selector: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!deviceSelected) {
      console.log('⚠ Could not find Ch 1 device selector');
      console.log('Available text content:');
      const bodyText = await page.textContent('body');
      console.log(bodyText?.substring(0, 500));
    }

    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotDir, '03-ch1-selected.png'),
      fullPage: true
    });

    console.log('\nStep 4: DevTools Network tab is being monitored programmatically');

    console.log('\nStep 5: Click the "Power" button on the Cable Box remote');
    // Look for the red power button on the Cable Box Remote (top-left of remote)
    const powerSelectors = [
      '.cable-box-remote button[data-command="power"]',
      'button.bg-red-500',
      'button.bg-red-600',
      '.remote-control button:has-text("Power")'
    ];

    let powerClicked = false;
    for (const selector of powerSelectors) {
      try {
        const element = page.locator(selector).first();
        const count = await element.count();
        if (count > 0) {
          // Make sure we're clicking the button on the remote, not the bottom nav
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            powerClicked = true;
            console.log(`✓ Clicked Power button using selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!powerClicked) {
      console.log('⚠ Could not find Power button on remote');
      // Try to find any red button as fallback
      try {
        const redButtons = await page.locator('button').all();
        for (const btn of redButtons) {
          const classes = await btn.getAttribute('class');
          if (classes?.includes('red')) {
            const box = await btn.boundingBox();
            if (box && box.y < 400) { // Top half of screen
              await btn.click();
              powerClicked = true;
              console.log('✓ Clicked red power button (fallback)');
              break;
            }
          }
        }
      } catch (e) {
        console.log('Fallback power click failed:', e);
      }
    }

    // Wait for request to complete
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotDir, '04-after-power-click.png'),
      fullPage: true
    });

    console.log('\nStep 10: Try clicking digit "1" button');
    const digitSelectors = [
      'button:has-text("1")',
      'button[data-key="1"]',
      'button[data-command="1"]'
    ];

    let digitClicked = false;
    for (const selector of digitSelectors) {
      try {
        const elements = await page.locator(selector).all();
        // Find the one that's exactly "1" (not "10", "11", etc.)
        for (const element of elements) {
          const text = await element.textContent();
          if (text?.trim() === '1') {
            // Check if it's visible and in the remote area
            const isVisible = await element.isVisible();
            if (isVisible) {
              await element.click();
              digitClicked = true;
              console.log(`✓ Clicked digit "1" button`);
              break;
            }
          }
        }
        if (digitClicked) break;
      } catch (e) {
        continue;
      }
    }

    if (!digitClicked) {
      console.log('⚠ Could not find digit "1" button');
      // Try to find it by position (should be in number pad area)
      try {
        const allButtons = await page.locator('button').all();
        for (const btn of allButtons) {
          const text = await btn.textContent();
          if (text === '1') {
            const box = await btn.boundingBox();
            if (box && box.y > 200 && box.y < 600) { // Middle area
              await btn.click();
              digitClicked = true;
              console.log('✓ Clicked digit "1" button (fallback)');
              break;
            }
          }
        }
      } catch (e) {
        console.log('Fallback digit click failed:', e);
      }
    }

    // Wait for request to complete
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotDir, '05-after-digit1-click.png'),
      fullPage: true
    });

    console.log('\n');
    console.log('='.repeat(80));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log('\n--- CAPTURED API REQUESTS ---');

    if (capturedRequests.length === 0) {
      console.log('⚠ NO REQUESTS CAPTURED to /api/ir-devices/send-command');
    } else {
      capturedRequests.forEach((req, index) => {
        console.log(`\nRequest #${index + 1}:`);
        console.log('URL:', req.url);
        console.log('Method:', req.method);
        console.log('Payload:', JSON.stringify(req.payload, null, 2));

        if (req.response) {
          console.log('\nResponse:');
          console.log('Status:', req.response.status, req.response.statusText);
          console.log('Body:', JSON.stringify(req.response.body, null, 2));
        } else {
          console.log('⚠ No response captured');
        }

        console.log('\nPayload Analysis:');
        if (req.payload) {
          console.log('- deviceId:', req.payload.deviceId);
          console.log('- command:', req.payload.command);
          console.log('- iTachAddress:', req.payload.iTachAddress);
          console.log('- isRawCode:', req.payload.isRawCode);

          if (req.payload.isRawCode) {
            console.log('- Command type: RAW IR CODE');
            if (req.payload.command?.startsWith('sendir')) {
              console.log('- Format: Valid sendir format');
              console.log('- Code length:', req.payload.command.length, 'characters');
            }
          } else {
            console.log('- Command type: COMMAND NAME');
          }
        }
      });
    }

    console.log('\n--- CONSOLE MESSAGES ---');
    if (consoleMessages.length === 0) {
      console.log('(No console messages)');
    } else {
      consoleMessages.forEach(msg => console.log(msg));
    }

    console.log('\n--- CONSOLE ERRORS ---');
    if (consoleErrors.length === 0) {
      console.log('✓ No console errors');
    } else {
      consoleErrors.forEach(err => console.log(err));
    }

    console.log('\n--- SCREENSHOTS ---');
    console.log('Screenshots saved to:', screenshotDir);
    const screenshots = fs.readdirSync(screenshotDir).filter(f => f.endsWith('.png'));
    screenshots.forEach(file => {
      console.log('-', path.join(screenshotDir, file));
    });

    console.log('\n' + '='.repeat(80));

    // Save results to JSON file
    const results = {
      timestamp: new Date().toISOString(),
      capturedRequests,
      consoleMessages,
      consoleErrors,
      screenshots: screenshots.map(f => path.join(screenshotDir, f))
    };

    fs.writeFileSync(
      path.join(screenshotDir, 'test-results.json'),
      JSON.stringify(results, null, 2)
    );
    console.log('\nTest results saved to:', path.join(screenshotDir, 'test-results.json'));

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({
      path: path.join(screenshotDir, 'error-state.png'),
      fullPage: true
    });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Run the test
testCableBoxRemote()
  .then(() => {
    console.log('\n✓ Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

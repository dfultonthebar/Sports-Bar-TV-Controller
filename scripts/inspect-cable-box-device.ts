import { chromium } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const BARTENDER_URL = 'http://24.123.87.42:3001/remote';

async function inspectCableBoxDevice() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to remote page...');
    await page.goto(BARTENDER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Remote tab
    const remoteTab = page.locator('button').filter({ hasText: 'Remote' }).first();
    if (await remoteTab.isVisible()) {
      await remoteTab.click();
      await page.waitForTimeout(1500);
    }

    // Inspect the device selector buttons
    console.log('\n=== Cable Box Device Information ===\n');

    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();

    const cableBoxDevices: any[] = [];

    for (let i = 0; i < buttonCount; i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();

      if (text && text.includes('Cable Box')) {
        const deviceName = text.trim();
        const ariaLabel = await button.getAttribute('aria-label');
        const dataId = await button.getAttribute('data-device-id');
        const dataType = await button.getAttribute('data-device-type');
        const onClick = await button.getAttribute('onclick');

        const deviceInfo = {
          displayText: deviceName,
          ariaLabel,
          dataDeviceId: dataId,
          dataDeviceType: dataType,
          hasClickHandler: !!onClick,
          index: i
        };

        cableBoxDevices.push(deviceInfo);

        console.log(`Found: ${deviceName}`);
        console.log(`  aria-label: ${ariaLabel}`);
        console.log(`  data-device-id: ${dataId}`);
        console.log(`  data-device-type: ${dataType}`);
        console.log(`  onClick handler: ${!!onClick}\n`);

        // Try clicking Cable Box 2 specifically
        if (deviceName.includes('Cable Box 2')) {
          console.log('Clicking Cable Box 2...');
          await button.click();
          await page.waitForTimeout(1500);

          // Check what data is available after selection
          const selectedDevice = await page.evaluate(() => {
            // Try to find selected state
            const active = document.querySelector('[data-device-type="cable"], .active, [aria-selected="true"]');
            if (active) {
              return {
                text: active.textContent,
                attributes: Array.from(active.attributes).map(a => `${a.name}=${a.value}`)
              };
            }
            return null;
          });

          console.log('\nSelected device state:', selectedDevice);

          // Capture the component tree
          const componentTree = await page.evaluate(() => {
            const remoteCenter = document.querySelector('[class*="Remote"], [class*="remote"]');
            if (remoteCenter) {
              return {
                className: remoteCenter.className,
                innerHTML: remoteCenter.innerHTML.substring(0, 500) + '...'
              };
            }
            return null;
          });

          console.log('\nComponent tree:', componentTree);
        }
      }
    }

    // Try to get the device ID that's being used
    console.log('\n=== API Request Analysis ===\n');

    // Intercept the fetch call to see what parameters are sent
    const requests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('ir-devices') || request.url().includes('cec')) {
        try {
          const body = request.postData();
          requests.push({
            method: request.method(),
            url: request.url(),
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          requests.push({
            method: request.method(),
            url: request.url(),
            body: 'unable to parse'
          });
        }
      }
    });

    // Try to click a number button (this will trigger the API call)
    console.log('Clicking number buttons to capture API payload...');
    const button2 = page.locator('button').filter({ hasText: /^2$/ }).first();
    if (await button2.isVisible()) {
      await button2.click();
      await page.waitForTimeout(500);
    }

    // Log captured requests
    console.log('\nCaptured API requests:');
    requests.forEach((req, idx) => {
      console.log(`\nRequest ${idx + 1}:`);
      console.log(`  Method: ${req.method}`);
      console.log(`  URL: ${req.url}`);
      console.log(`  Body:`, JSON.stringify(req.body, null, 2));
    });

    // Capture detailed HTML structure
    const htmlStructure = await page.evaluate(() => {
      const remoteSection = document.querySelector('[role="main"], main, .remote-control, [class*="Remote"]');
      if (remoteSection) {
        // Get the parent button structure
        const buttons = remoteSection.querySelectorAll('button');
        return {
          totalButtons: buttons.length,
          buttonStructure: Array.from(buttons).slice(0, 5).map(btn => ({
            text: btn.textContent?.trim(),
            className: btn.className,
            dataAttributes: Object.fromEntries(
              Array.from(btn.attributes)
                .filter(a => a.name.startsWith('data-'))
                .map(a => [a.name, a.value])
            )
          }))
        };
      }
      return null;
    });

    console.log('\n=== HTML Structure ===\n');
    console.log(JSON.stringify(htmlStructure, null, 2));

    // Save comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      url: BARTENDER_URL,
      cableBoxDevices,
      requestsIntercepted: requests,
      htmlStructure
    };

    fs.writeFileSync(
      `${SCREENSHOT_DIR}/device-inspection-report.json`,
      JSON.stringify(report, null, 2)
    );

    console.log('\nReport saved to:', `${SCREENSHOT_DIR}/device-inspection-report.json`);

    // Take final screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-device-inspection.png`,
      fullPage: true
    });

    console.log('Screenshot saved to:', `${SCREENSHOT_DIR}/09-device-inspection.png`);

  } catch (error) {
    console.error('Error during inspection:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

inspectCableBoxDevice().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface AccessibilityIssue {
  element: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
}

interface CSSError {
  element: string;
  issue: string;
  line: string;
}

interface TestReport {
  screenshots: string[];
  accessibility_issues: AccessibilityIssue[];
  connection_status: Record<string, string>;
  css_errors: CSSError[];
  test_timestamp: string;
  test_duration_ms: number;
}

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/ubuntu/Sports-Bar-TV-Controller/docs/screenshots/directv-edit-modal';

async function captureDeviceConnectionStatus(page: Page): Promise<Record<string, string>> {
  const status: Record<string, string> = {};

  // Wait for device cards to load
  await page.waitForSelector('div[class*="card"]', { timeout: 10000 });

  // Find all device cards (they have class containing "card")
  const deviceCards = await page.$$('div[class*="card"]');

  console.log(`Found ${deviceCards.length} device cards`);

  for (const card of deviceCards) {
    try {
      // Get device name from the card (h3 or h4 heading)
      const nameElement = await card.$('h3, h4');
      const deviceName = nameElement ? await nameElement.textContent() : 'Unknown';

      // Check for status indicators (SVG icons with color classes)
      const hasGreenCheck = await card.$('svg[class*="text-green"], [class*="text-green"] svg');
      const hasRedAlert = await card.$('svg[class*="text-red"], [class*="text-red"] svg');
      const hasYellowWarning = await card.$('svg[class*="text-yellow"], [class*="text-yellow"] svg');

      let connectionStatus = 'unknown';
      if (hasGreenCheck) {
        connectionStatus = 'online';
      } else if (hasRedAlert) {
        connectionStatus = 'offline';
      } else if (hasYellowWarning) {
        connectionStatus = 'warning';
      }

      status[deviceName?.trim() || 'Unknown'] = connectionStatus;
      console.log(`Device: ${deviceName?.trim()} - Status: ${connectionStatus}`);
    } catch (error) {
      console.error('Error reading device card:', error);
    }
  }

  return status;
}

async function findEditButton(page: Page, deviceName: string): Promise<void> {
  console.log(`Looking for edit button for device: ${deviceName}`);

  // Find device card by heading text
  const deviceCards = await page.$$('div[class*="card"]');

  for (const card of deviceCards) {
    const nameElement = await card.$('h3, h4');
    const name = nameElement ? await nameElement.textContent() : '';

    if (name?.trim() === deviceName) {
      console.log(`Found device card for ${deviceName}`);

      // Hover over the card to reveal action buttons
      await card.hover();
      await page.waitForTimeout(800);

      // Look for edit button within this card
      // The inspection showed empty text buttons (likely icon buttons)
      const buttons = await card.$$('button');
      console.log(`Found ${buttons.length} buttons in card`);

      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const html = await btn.innerHTML();
        const ariaLabel = await btn.getAttribute('aria-label');

        console.log(`Button ${i}: aria="${ariaLabel}", html length=${html.length}`);

        // Look for edit button by aria-label or icon content
        if (
          ariaLabel?.toLowerCase().includes('edit') ||
          html.includes('pencil') ||
          html.includes('edit') ||
          html.includes('M16.862 4.487')  // Lucide edit icon path
        ) {
          console.log('Found edit button, clicking...');
          await btn.click();
          return;
        }
      }

      // If we didn't find by icon, try clicking the second visible button (often edit)
      if (buttons.length >= 2) {
        console.log('Trying second button (likely edit)...');
        await buttons[1].click();
        return;
      }
    }
  }

  throw new Error(`Could not find edit button for device: ${deviceName}`);
}

async function analyzeAccessibilityIssues(page: Page): Promise<AccessibilityIssue[]> {
  const issues: AccessibilityIssue[] = [];

  // Check for low contrast text in modal
  const helperTexts = await page.$$('.text-slate-400, .text-gray-400, .text-slate-500');

  for (const element of helperTexts) {
    const text = await element.textContent();
    const computedStyle = await element.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor,
        parentBg: window.getComputedStyle(el.parentElement!).backgroundColor
      };
    });

    // Helper text with low contrast
    if (text && text.trim()) {
      issues.push({
        element: `Helper text: "${text.trim().substring(0, 50)}..."`,
        issue: `Low contrast text (${computedStyle.color}) on light background`,
        severity: 'high'
      });
    }
  }

  // Check for form labels
  const labels = await page.$$('label');
  for (const label of labels) {
    const htmlFor = await label.getAttribute('for');
    if (htmlFor) {
      const input = await page.$(`#${htmlFor}`);
      if (!input) {
        const labelText = await label.textContent();
        issues.push({
          element: `Label: "${labelText?.trim()}"`,
          issue: 'Label references non-existent input (broken for attribute)',
          severity: 'medium'
        });
      }
    }
  }

  return issues;
}

async function analyzeCSSErrors(page: Page): Promise<CSSError[]> {
  const errors: CSSError[] = [];

  // Find Cancel button and check for invalid className
  const cancelButton = await page.$('button:has-text("Cancel")');

  if (cancelButton) {
    const className = await cancelButton.getAttribute('class');

    if (className?.includes('or')) {
      errors.push({
        element: 'Cancel button',
        issue: "Invalid 'or' keyword in className (invalid Tailwind CSS syntax)",
        line: `className="${className}"`
      });
    }

    // Check if multiple conflicting background classes exist
    if (className?.includes('bg-slate-800') && className?.includes('bg-slate-900')) {
      errors.push({
        element: 'Cancel button',
        issue: 'Multiple conflicting background color classes',
        line: `className="${className}"`
      });
    }
  }

  return errors;
}

async function runTest(): Promise<TestReport> {
  const startTime = Date.now();
  const report: TestReport = {
    screenshots: [],
    accessibility_issues: [],
    connection_status: {},
    css_errors: [],
    test_timestamp: new Date().toISOString(),
    test_duration_ms: 0
  };

  let browser: Browser | null = null;

  try {
    console.log('Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Enable console logging from browser
    page.on('console', msg => console.log(`Browser console: ${msg.text()}`));

    // Step 1: Navigate to Device Config page
    console.log('Navigating to Device Config page...');
    await page.goto(`${BASE_URL}/device-config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for any animations

    // Step 2: Click DirecTV tab
    console.log('Clicking DirecTV tab...');
    const direcTvTab = page.locator('button[role="tab"]').filter({ hasText: 'DirecTV' });
    await direcTvTab.click();
    await page.waitForTimeout(1000); // Wait for tab transition

    // Step 3: Capture device list
    console.log('Capturing device list...');
    const deviceListPath = path.join(SCREENSHOT_DIR, 'directv-device-list.png');
    await page.screenshot({
      path: deviceListPath,
      fullPage: true
    });
    report.screenshots.push(deviceListPath);
    console.log(`✓ Saved: ${deviceListPath}`);

    // Step 4: Capture connection status
    console.log('Analyzing device connection status...');
    report.connection_status = await captureDeviceConnectionStatus(page);

    // Step 5: Open edit modal for first device (Direct TV 1)
    console.log('Opening edit modal for Direct TV 1...');
    try {
      await findEditButton(page, 'Direct TV 1');
      await page.waitForTimeout(1000); // Wait for modal animation

      // Verify modal is open
      const modal = await page.$('[role="dialog"], .modal, [class*="Modal"]');
      if (!modal) {
        throw new Error('Modal did not appear after clicking edit button');
      }

      console.log('Modal opened successfully');

      // Step 6: Capture full edit modal
      console.log('Capturing full edit modal...');
      const modalFullPath = path.join(SCREENSHOT_DIR, 'directv-edit-modal-full.png');
      await page.screenshot({
        path: modalFullPath,
        fullPage: false // Just viewport to focus on modal
      });
      report.screenshots.push(modalFullPath);
      console.log(`✓ Saved: ${modalFullPath}`);

      // Step 7: Capture form fields detail
      console.log('Capturing form fields detail...');
      const formFieldsPath = path.join(SCREENSHOT_DIR, 'directv-edit-form-fields-detail.png');

      // Find the form container
      const formContainer = await page.$('form, [class*="form"], .space-y-4');
      if (formContainer) {
        await formContainer.screenshot({
          path: formFieldsPath
        });
        report.screenshots.push(formFieldsPath);
        console.log(`✓ Saved: ${formFieldsPath}`);
      }

      // Step 8: Capture cancel button
      console.log('Capturing cancel button...');
      const cancelButtonPath = path.join(SCREENSHOT_DIR, 'directv-cancel-button.png');
      const cancelButton = await page.$('button:has-text("Cancel")');
      if (cancelButton) {
        await cancelButton.screenshot({
          path: cancelButtonPath
        });
        report.screenshots.push(cancelButtonPath);
        console.log(`✓ Saved: ${cancelButtonPath}`);
      }

      // Step 9: Analyze accessibility issues
      console.log('Analyzing accessibility issues...');
      report.accessibility_issues = await analyzeAccessibilityIssues(page);

      // Step 10: Analyze CSS errors
      console.log('Analyzing CSS errors...');
      report.css_errors = await analyzeCSSErrors(page);

      // Close modal
      console.log('Closing modal...');
      const closeButton = await page.$('button[aria-label*="Close"], button:has-text("Cancel")');
      if (closeButton) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }

    } catch (error) {
      console.error('Error during Direct TV 1 modal test:', error);

      // Capture error state
      const errorPath = path.join(SCREENSHOT_DIR, 'error-direct-tv-1.png');
      await page.screenshot({
        path: errorPath,
        fullPage: true
      });
      report.screenshots.push(errorPath);
    }

    // Step 11: Test with offline device (Direct TV 2)
    console.log('Opening edit modal for Direct TV 2 (offline device)...');
    try {
      await page.waitForTimeout(1000); // Ensure previous modal is closed

      await findEditButton(page, 'Direct TV 2');
      await page.waitForTimeout(1000);

      // Capture offline device modal
      const offlineModalPath = path.join(SCREENSHOT_DIR, 'directv-edit-offline-device.png');
      await page.screenshot({
        path: offlineModalPath,
        fullPage: false
      });
      report.screenshots.push(offlineModalPath);
      console.log(`✓ Saved: ${offlineModalPath}`);

    } catch (error) {
      console.error('Error during Direct TV 2 modal test:', error);

      // Capture error state
      const errorPath = path.join(SCREENSHOT_DIR, 'error-direct-tv-2.png');
      await page.screenshot({
        path: errorPath,
        fullPage: true
      });
      report.screenshots.push(errorPath);
    }

    console.log('Test completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  report.test_duration_ms = Date.now() - startTime;
  return report;
}

// Execute test
runTest()
  .then((report) => {
    console.log('\n' + '='.repeat(80));
    console.log('TEST REPORT');
    console.log('='.repeat(80));
    console.log(JSON.stringify(report, null, 2));
    console.log('='.repeat(80));

    // Save report to file
    const reportPath = path.join(SCREENSHOT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Report saved to: ${reportPath}`);

    // Summary
    console.log('\nSUMMARY:');
    console.log(`- Screenshots captured: ${report.screenshots.length}`);
    console.log(`- Accessibility issues: ${report.accessibility_issues.length}`);
    console.log(`- CSS errors: ${report.css_errors.length}`);
    console.log(`- Test duration: ${report.test_duration_ms}ms`);
    console.log(`\nAll screenshots saved to: ${SCREENSHOT_DIR}/`);

    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed with error:', error);
    process.exit(1);
  });

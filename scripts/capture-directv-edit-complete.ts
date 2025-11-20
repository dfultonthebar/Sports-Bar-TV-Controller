import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/home/ubuntu/Sports-Bar-TV-Controller/docs/screenshots/directv-edit-modal';

interface TestReport {
  screenshots: string[];
  accessibility_issues: Array<{
    element: string;
    issue: string;
    severity: string;
    line?: string;
  }>;
  connection_status: Record<string, string>;
  css_errors: Array<{
    element: string;
    issue: string;
    line: string;
  }>;
  test_timestamp: string;
  test_duration_ms: number;
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

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    page.on('console', msg => console.log(`Browser: ${msg.text()}`));

    // Navigate to device config
    console.log('Navigating to Device Config page...');
    await page.goto(`${BASE_URL}/device-config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click DirecTV tab
    console.log('Clicking DirecTV tab...');
    const direcTvTab = page.locator('button[role="tab"]').filter({ hasText: 'DirecTV' });
    await direcTvTab.click();
    await page.waitForTimeout(1500);

    // Capture device list
    console.log('Capturing device list...');
    const deviceListPath = path.join(SCREENSHOT_DIR, 'directv-device-list.png');
    await page.screenshot({ path: deviceListPath, fullPage: true });
    report.screenshots.push(deviceListPath);
    console.log(`✓ Saved: ${deviceListPath}`);

    // Find and analyze device cards
    console.log('\nAnalyzing device cards...');
    const deviceCards = await page.$$('div[class*="card"]');

    for (let i = 0; i < deviceCards.length; i++) {
      const card = deviceCards[i];
      const nameElement = await card.$('h3, h4');
      const nameText = nameElement ? await nameElement.textContent() : null;

      if (nameText && nameText.trim().startsWith('Direct TV ')) {
        const deviceName = nameText.trim();

        // Check connection status
        const hasGreenCheck = await card.$('svg[class*="text-green"]');
        const hasRedAlert = await card.$('svg[class*="text-red"]');
        const status = hasGreenCheck ? 'online' : (hasRedAlert ? 'offline' : 'unknown');

        report.connection_status[deviceName] = status;
        console.log(`  ${deviceName}: ${status}`);
      }
    }

    // Test 1: Open edit modal for Direct TV 1
    console.log('\n=== Testing Direct TV 1 Edit Modal ===');

    // Find Direct TV 1 card
    const directTv1Card = await page.locator('h3, h4').filter({ hasText: 'Direct TV 1' }).locator('..').locator('..').locator('..');

    // Hover to reveal buttons
    console.log('Hovering over Direct TV 1 card...');
    await directTv1Card.hover();
    await page.waitForTimeout(1000);

    // Take screenshot of hover state
    const hoverPath = path.join(SCREENSHOT_DIR, 'directv-card-hover-state.png');
    await directTv1Card.screenshot({ path: hoverPath });
    report.screenshots.push(hoverPath);
    console.log(`✓ Saved: ${hoverPath}`);

    // Click the edit button (second button in the action buttons group)
    console.log('Clicking edit button...');
    const editButton = await page.$('button[title="Edit device"]');

    if (editButton) {
      await editButton.click();
      await page.waitForTimeout(1500); // Wait for modal animation

      // Verify modal is open
      const modal = await page.$('div.fixed.inset-0.bg-black');
      if (modal) {
        console.log('✓ Edit modal opened successfully');

        // Capture full modal
        const modalFullPath = path.join(SCREENSHOT_DIR, 'directv-edit-modal-full.png');
        await page.screenshot({ path: modalFullPath });
        report.screenshots.push(modalFullPath);
        console.log(`✓ Saved: ${modalFullPath}`);

        // Capture modal dialog specifically
        const modalDialog = await page.$('div.card.rounded-lg.max-w-md');
        if (modalDialog) {
          const modalDialogPath = path.join(SCREENSHOT_DIR, 'directv-edit-modal-dialog.png');
          await modalDialog.screenshot({ path: modalDialogPath });
          report.screenshots.push(modalDialogPath);
          console.log(`✓ Saved: ${modalDialogPath}`);
        }

        // Analyze form fields for accessibility issues
        console.log('\nAnalyzing accessibility issues...');

        const helperTexts = await page.$$('.text-slate-400, .text-gray-400');
        for (const helperText of helperTexts) {
          const text = await helperText.textContent();
          if (text && text.trim()) {
            report.accessibility_issues.push({
              element: `Helper text: "${text.trim().substring(0, 50)}..."`,
              issue: 'Low contrast text (text-slate-400) on light background',
              severity: 'high'
            });
            console.log(`  ⚠ Low contrast: "${text.trim().substring(0, 40)}..."`);
          }
        }

        // Form fields are already captured in the modal dialog screenshot above
        console.log('Form fields captured in modal dialog screenshot');

        // Find and analyze Cancel button
        console.log('\nAnalyzing Cancel button...');
        const cancelButton = await page.$('button:has-text("Cancel")').catch(() => null);

        if (cancelButton) {
          const className = await cancelButton.getAttribute('class');
          console.log(`Cancel button class: ${className}`);

          if (className && className.includes('or')) {
            report.css_errors.push({
              element: 'Cancel button',
              issue: "Invalid 'or' keyword in className (invalid Tailwind CSS syntax)",
              line: `className="${className}"`
            });
            console.log('  ✗ CSS ERROR: Invalid "or" in className');
          }

          if (className && className.includes('bg-slate-800') && className.includes('bg-slate-900')) {
            report.css_errors.push({
              element: 'Cancel button',
              issue: 'Multiple conflicting background color classes',
              line: `className="${className}"`
            });
            console.log('  ✗ CSS ERROR: Conflicting bg classes');
          }

          // Capture cancel button
          const cancelButtonPath = path.join(SCREENSHOT_DIR, 'directv-cancel-button.png');
          await cancelButton.screenshot({ path: cancelButtonPath });
          report.screenshots.push(cancelButtonPath);
          console.log(`✓ Saved: ${cancelButtonPath}`);
        }

        // Close modal
        console.log('\nClosing modal...');
        if (cancelButton) {
          await cancelButton.click();
          await page.waitForTimeout(500);
        }
      } else {
        console.log('✗ Modal did not appear');
      }
    } else {
      console.log('✗ Could not find edit button');
    }

    // Test 2: Try Direct TV 2 (offline device)
    console.log('\n=== Testing Direct TV 2 Edit Modal (Offline) ===');

    const directTv2Card = await page.locator('h3, h4').filter({ hasText: 'Direct TV 2' }).locator('..').locator('..').locator('..');
    await directTv2Card.hover();
    await page.waitForTimeout(1000);

    const editButton2 = await page.$('button[title="Edit device"]');

    if (editButton2) {
      await editButton2.click();
      await page.waitForTimeout(1500);

      const offlineModalPath = path.join(SCREENSHOT_DIR, 'directv-edit-offline-device.png');
      await page.screenshot({ path: offlineModalPath });
      report.screenshots.push(offlineModalPath);
      console.log(`✓ Saved: ${offlineModalPath}`);

      // Close modal
      const cancelBtn = await page.$('button:has-text("Cancel")');
      if (cancelBtn) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await browser.close();
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

    // Save report
    const reportPath = path.join(SCREENSHOT_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Report saved to: ${reportPath}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`✓ Screenshots captured: ${report.screenshots.length}`);
    console.log(`⚠ Accessibility issues: ${report.accessibility_issues.length}`);
    console.log(`✗ CSS errors: ${report.css_errors.length}`);
    console.log(`⏱ Test duration: ${report.test_duration_ms}ms`);
    console.log(`📁 Screenshots: ${SCREENSHOT_DIR}/`);

    if (report.accessibility_issues.length > 0) {
      console.log('\nAccessibility Issues:');
      report.accessibility_issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.element}`);
        console.log(`     ${issue.issue}`);
      });
    }

    if (report.css_errors.length > 0) {
      console.log('\nCSS Errors:');
      report.css_errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error.element}: ${error.issue}`);
        console.log(`     ${error.line}`);
      });
    }

    process.exit(0);
  })
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });

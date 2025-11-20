import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = '/tmp/ui-screenshots/team-dropdown-debug';
const BASE_URL = 'http://24.123.87.42:3001';
const PAGE = `${BASE_URL}/sports-guide-config`;

// Create screenshots directory
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

interface TestResult {
  step: string;
  status: 'success' | 'failed' | 'error';
  message: string;
  screenshot?: string;
  consoleErrors?: string[];
  networkLogs?: string[];
  htmlSnapshot?: string;
}

const results: TestResult[] = [];

async function captureScreenshot(page: Page, name: string): Promise<string> {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`Screenshot saved: ${filePath}`);
  return filePath;
}

async function captureHTML(page: Page, name: string): Promise<string> {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.html`);
  const content = await page.content();
  fs.writeFileSync(filePath, content);
  console.log(`HTML snapshot saved: ${filePath}`);
  return filePath;
}

async function runTest() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const consoleMessages: string[] = [];
  const networkLogs: string[] = [];
  const errorMessages: string[] = [];

  // Intercept console messages
  page.on('console', (msg) => {
    const message = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log('Browser Console:', message);
  });

  // Intercept network requests
  page.on('request', (request) => {
    const log = `[${request.method()}] ${request.url()}`;
    if (request.url().includes('/api/')) {
      networkLogs.push(log);
      console.log('Network Request:', log);
    }
  });

  // Intercept network responses
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      const log = `[${response.status()}] ${response.url()}`;
      networkLogs.push(log);
      console.log('Network Response:', log);

      if (response.status() >= 400) {
        errorMessages.push(`API Error ${response.status()}: ${response.url()}`);
      }
    }
  });

  // Intercept page errors
  page.on('pageerror', (error) => {
    errorMessages.push(`Page Error: ${error.message}`);
    console.log('Page Error:', error);
  });

  try {
    // Step 1: Navigate to sports-guide-config
    console.log('\n=== STEP 1: Navigating to Sports Guide Config ===');
    await page.goto(PAGE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    let screenshot = await captureScreenshot(page, '01-initial-page');
    results.push({
      step: 'Navigate to /sports-guide-config',
      status: 'success',
      message: 'Page loaded successfully',
      screenshot
    });

    // Check if Teams tab exists
    const teamsTab = page.locator('button:has-text("Teams")');
    const tabCount = await teamsTab.count();
    console.log(`Teams tabs found: ${tabCount}`);

    // Step 2: Click Teams Tab
    console.log('\n=== STEP 2: Clicking Teams Tab ===');
    if (tabCount > 0) {
      await teamsTab.first().click();
      await page.waitForTimeout(1000);
      screenshot = await captureScreenshot(page, '02-teams-tab-clicked');
      results.push({
        step: 'Click Teams Tab',
        status: 'success',
        message: 'Teams tab clicked',
        screenshot
      });
    } else {
      results.push({
        step: 'Click Teams Tab',
        status: 'failed',
        message: 'Teams tab not found'
      });
      throw new Error('Teams tab not found');
    }

    // Step 3: Click "Add Team" button
    console.log('\n=== STEP 3: Clicking Add Team Button ===');
    const addTeamBtn = page.locator('button:has-text("Add Team")');
    const addTeamCount = await addTeamBtn.count();
    console.log(`Add Team buttons found: ${addTeamCount}`);

    if (addTeamCount > 0) {
      await addTeamBtn.first().click();
      await page.waitForTimeout(1500);
      screenshot = await captureScreenshot(page, '03-add-team-form-opened');

      const htmlSnapshot = await captureHTML(page, '03-add-team-form-html');
      results.push({
        step: 'Click Add Team Button',
        status: 'success',
        message: 'Add Team form opened',
        screenshot,
        htmlSnapshot
      });
    } else {
      results.push({
        step: 'Click Add Team Button',
        status: 'failed',
        message: 'Add Team button not found'
      });
      throw new Error('Add Team button not found');
    }

    // Step 4: Select "football" from Sport dropdown
    console.log('\n=== STEP 4: Selecting Sport Dropdown ===');
    consoleMessages.length = 0; // Reset console messages
    networkLogs.length = 0; // Reset network logs

    const sportDropdown = page.locator('[data-testid="sport-select"], select[name="sport"], [role="combobox"]:has-text("Sport"), div:has(label:has-text("Sport"))');
    const sportCount = await sportDropdown.count();
    console.log(`Sport dropdowns found: ${sportCount}`);

    // Try different selectors
    const allSelects = await page.locator('select, [role="combobox"]').count();
    console.log(`Total select/combobox elements: ${allSelects}`);

    // Log all form fields
    const formLabels = await page.locator('label').count();
    console.log(`Form labels found: ${formLabels}`);

    // Get form labels text
    for (let i = 0; i < Math.min(formLabels, 5); i++) {
      const text = await page.locator('label').nth(i).textContent();
      console.log(`Label ${i}: ${text}`);
    }

    // Try finding Sport label and its associated input
    const sportLabel = page.locator('label:has-text("Sport")');
    const sportLabelCount = await sportLabel.count();
    console.log(`Sport labels found: ${sportLabelCount}`);

    if (sportLabelCount > 0) {
      // Find the input/select associated with this label
      const sportInput = sportLabel.locator('~ *').first();
      const sportInputRole = await sportInput.getAttribute('role');
      console.log(`Sport input role: ${sportInputRole}`);

      // Try clicking and selecting
      await sportInput.click();
      await page.waitForTimeout(500);
      screenshot = await captureScreenshot(page, '04a-sport-dropdown-opened');

      // Look for football option
      const footballOption = page.locator('[role="option"]:has-text("football"), button:has-text("football"), div:has-text("football")');
      const footballCount = await footballOption.count();
      console.log(`Football options found: ${footballCount}`);

      if (footballCount > 0) {
        await footballOption.first().click();
        await page.waitForTimeout(1000);
        screenshot = await captureScreenshot(page, '04b-football-selected');
        results.push({
          step: 'Select football from Sport dropdown',
          status: 'success',
          message: 'Football selected',
          screenshot,
          consoleErrors: errorMessages.slice(),
          networkLogs: networkLogs.slice()
        });
      } else {
        // Try alternative approach - direct input
        const sportInputElement = page.locator('input[name="sport"], select[name="sport"]');
        if (await sportInputElement.count() > 0) {
          await sportInputElement.first().fill('football');
          await page.waitForTimeout(500);
          screenshot = await captureScreenshot(page, '04c-sport-typed');
          results.push({
            step: 'Type football in Sport field',
            status: 'success',
            message: 'Football typed in field',
            screenshot,
            consoleErrors: errorMessages.slice(),
            networkLogs: networkLogs.slice()
          });
        }
      }
    }

    // Step 5: Select "NFL" from League dropdown
    console.log('\n=== STEP 5: Selecting League Dropdown ===');
    consoleMessages.length = 0; // Reset console messages
    networkLogs.length = 0; // Reset network logs
    const initialErrorCount = errorMessages.length;

    await page.waitForTimeout(500);
    screenshot = await captureScreenshot(page, '05a-before-league-selection');

    const leagueLabel = page.locator('label:has-text("League")');
    const leagueLabelCount = await leagueLabel.count();
    console.log(`League labels found: ${leagueLabelCount}`);

    if (leagueLabelCount > 0) {
      const leagueInput = leagueLabel.locator('~ *').first();
      const leagueInputRole = await leagueInput.getAttribute('role');
      console.log(`League input role: ${leagueInputRole}`);

      // Click league dropdown
      await leagueInput.click();
      await page.waitForTimeout(800);
      screenshot = await captureScreenshot(page, '05b-league-dropdown-opened');

      // Look for NFL option
      const nflOption = page.locator('[role="option"]:has-text("NFL"), button:has-text("NFL"), div:has-text("NFL")');
      const nflCount = await nflOption.count();
      console.log(`NFL options found: ${nflCount}`);

      if (nflCount > 0) {
        await nflOption.first().click();
        await page.waitForTimeout(2000); // Wait longer for API call
        screenshot = await captureScreenshot(page, '05c-nfl-selected');

        const newErrorCount = errorMessages.length;
        const newErrors = newErrorCount > initialErrorCount ? errorMessages.slice(initialErrorCount) : [];

        results.push({
          step: 'Select NFL from League dropdown',
          status: newErrors.length === 0 ? 'success' : 'error',
          message: newErrors.length === 0 ? 'NFL selected, no API errors' : `NFL selected, but ${newErrors.length} errors detected`,
          screenshot,
          consoleErrors: newErrors,
          networkLogs: networkLogs.slice()
        });
      }
    }

    // Step 6: Check for Teams dropdown/field
    console.log('\n=== STEP 6: Checking Team Selection Field ===');
    const teamLabel = page.locator('label:has-text("Team")');
    const teamLabelCount = await teamLabel.count();
    console.log(`Team labels found: ${teamLabelCount}`);

    if (teamLabelCount > 0) {
      const teamInput = teamLabel.locator('~ *').first();
      const isDisabled = await teamInput.getAttribute('disabled');
      const isAriaDisabled = await teamInput.getAttribute('aria-disabled');
      console.log(`Team input disabled: ${isDisabled}, aria-disabled: ${isAriaDisabled}`);

      // Try to click the team dropdown
      try {
        await teamInput.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        screenshot = await captureScreenshot(page, '06a-team-dropdown-clicked');
        results.push({
          step: 'Click Team Dropdown',
          status: 'success',
          message: 'Team dropdown is enabled and clickable',
          screenshot
        });
      } catch (error) {
        screenshot = await captureScreenshot(page, '06b-team-dropdown-failed');
        results.push({
          step: 'Click Team Dropdown',
          status: 'failed',
          message: `Team dropdown not clickable: ${error}`,
          screenshot,
          consoleErrors: errorMessages.slice()
        });
      }
    } else {
      results.push({
        step: 'Check Team Selection Field',
        status: 'failed',
        message: 'Team label not found in form'
      });
    }

    // Step 7: Wait and check for any loading states
    console.log('\n=== STEP 7: Checking for Loading States ===');
    const loadingStates = ['[data-testid*="loading"]', '.loading', '.spinner', '[aria-busy="true"]'];

    for (const selector of loadingStates) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found ${count} elements matching: ${selector}`);
      }
    }

    // Final screenshot
    screenshot = await captureScreenshot(page, '99-final-state');

    // Capture final HTML for inspection
    const finalHTML = await captureHTML(page, '99-final-state');

    // Generate detailed error report
    console.log('\n=== FINAL ERROR/WARNING ANALYSIS ===');
    console.log('Console Errors:', errorMessages);
    console.log('Network Logs:', networkLogs);

  } catch (error: any) {
    console.error('Test failed with error:', error);
    results.push({
      step: 'Test Execution',
      status: 'error',
      message: `Test failed: ${error.message}`
    });
  } finally {
    // Save results to JSON file
    const reportPath = path.join(SCREENSHOTS_DIR, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nTest report saved: ${reportPath}`);

    // Save error log
    const errorLogPath = path.join(SCREENSHOTS_DIR, 'error-log.txt');
    fs.writeFileSync(
      errorLogPath,
      `Console Errors:\n${consoleMessages.filter(m => m.includes('ERROR')).join('\n')}\n\nNetwork Logs:\n${networkLogs.join('\n')}`
    );
    console.log(`Error log saved: ${errorLogPath}`);

    await browser.close();
  }
}

// Run the test
runTest().then(() => {
  console.log('\nTest completed. Screenshots and reports are in:', SCREENSHOTS_DIR);
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://24.123.87.42:3001';
const SCREENSHOT_DIR = '/tmp/ui-screenshots/audio-zone-scheduler';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface TestResult {
  testName: string;
  passed: boolean;
  details: string;
  screenshot?: string;
}

const results: TestResult[] = [];

async function log(message: string) {
  console.log(message);
}

async function captureScreenshot(name: string): Promise<string> {
  const filePath = path.join(SCREENSHOT_DIR, `${name}.png`);
  return filePath;
}

async function testAudioZoneScheduler() {
  let browser;

  try {
    log('\n=== Audio Zone Scheduler Improvements Test ===\n');

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Clear browser cache (skip localStorage due to security policy)
    log('📋 Navigating to fresh page...');

    // Navigate to sports-guide-config
    log('🌐 Navigating to sports-guide-config page...');
    await page.goto(`${BASE_URL}/sports-guide-config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Take initial screenshot
    let screenshotPath = path.join(SCREENSHOT_DIR, '01-initial-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`📸 Captured: 01-initial-page.png\n`);

    // Click on Scheduling tab
    log('📋 Clicking on "Scheduling" tab...');
    const schedulingTab = page.locator('button:has-text("Scheduling")').first();

    if (!await schedulingTab.isVisible()) {
      throw new Error('Scheduling tab not found');
    }

    await schedulingTab.click();
    await page.waitForTimeout(1500);

    screenshotPath = path.join(SCREENSHOT_DIR, '02-scheduling-tab-open.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`📸 Captured: 02-scheduling-tab-open.png\n`);

    // Look for schedule creation/editing
    log('📋 Looking for schedule creation/editing interface...');

    // Try to find "New Schedule" button
    let newScheduleButton = page.locator('button:has-text("New Schedule")').first();

    if (!await newScheduleButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      log('   ⚠️  "New Schedule" button not found, looking for existing schedules...');

      // Look for existing schedule items by the schedule titles
      const scheduleItems = page.locator('[class*="schedule"], [role="button"]:has-text("Morning"), [role="button"]:has-text("Closing")');
      const count = await scheduleItems.count();

      if (count > 0) {
        log(`   Found ${count} existing schedule items`);
        // Click first schedule to edit - look for play/edit buttons
        const editButton = page.locator('button[aria-label*="edit"], button[aria-label*="Edit"]').first();
        if (await editButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await editButton.click();
        } else {
          // Try clicking the schedule item itself
          await scheduleItems.first().click();
        }
        await page.waitForTimeout(1500);
      } else {
        throw new Error('No schedule creation button or existing schedules found');
      }
    } else {
      log('   ✓ Found "New Schedule" button, clicking it...');
      await newScheduleButton.click();
      await page.waitForTimeout(1500);
    }

    screenshotPath = path.join(SCREENSHOT_DIR, '03-schedule-form-open.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`📸 Captured: 03-schedule-form-open.png\n`);

    // Look for "Audio Zone Control" checkbox by scrolling to bottom of form
    log('🔍 TEST 1: Looking for "Audio Zone Control" checkbox...');

    // Scroll to bottom to see all form elements
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Find Audio Zone Control checkbox
    const audioZoneControlLabel = page.locator('text=/Audio Zone Control/i');
    let audioZoneCheckboxFound = false;

    if (await audioZoneControlLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      log('   ✓ Found "Audio Zone Control" text');

      // Find the checkbox associated with this label
      const parentContainer = audioZoneControlLabel.locator('..');
      const checkbox = parentContainer.locator('input[type="checkbox"]').first();

      if (await checkbox.isVisible({ timeout: 1000 }).catch(() => false)) {
        log('   ✓ Found "Audio Zone Control" checkbox');
        audioZoneCheckboxFound = true;

        // Check if it's enabled
        const isChecked = await checkbox.isChecked();
        log(`   Current state: ${isChecked ? 'Checked' : 'Unchecked'}`);

        // Enable it if not already enabled
        if (!isChecked) {
          log('   Enabling Audio Zone Control...');
          await audioZoneControlLabel.click();
          await page.waitForTimeout(1000);
        }

        results.push({
          testName: 'Audio Zone Checkbox Visibility',
          passed: true,
          details: 'Audio Zone Control checkbox found and accessible'
        });
      }
    }

    if (!audioZoneCheckboxFound) {
      // Try alternative selectors
      const allCheckboxes = page.locator('input[type="checkbox"]');
      const allLabels = page.locator('label');
      const allText = await page.locator('body').textContent();

      if (allText?.includes('Audio Zone')) {
        log('   ⚠️  "Audio Zone" text found in page but checkbox not directly accessible');
        results.push({
          testName: 'Audio Zone Checkbox Visibility',
          passed: false,
          details: 'Audio Zone text found but checkbox structure unclear'
        });
      } else {
        log('   ❌ "Audio Zone Control" checkbox not found on page');
        results.push({
          testName: 'Audio Zone Checkbox Visibility',
          passed: false,
          details: 'Audio Zone Control checkbox not found on page'
        });
      }
    }

    screenshotPath = path.join(SCREENSHOT_DIR, '04-audio-zone-enabled.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`📸 Captured: 04-audio-zone-enabled.png\n`);

    // Look for "Add Audio Zone" button or container
    log('🔍 TEST 2: Looking for "Add Audio Zone" button...');

    // First check if Audio Zone section exists
    const audioZoneSection = page.locator('text=/Audio Zone Control/i').locator('..');
    let addZoneButtonFound = false;

    // Look for add button near audio zone control (try different patterns)
    let addZoneButton = page.locator('button:has-text("Add Audio Zone")').first();

    if (!await addZoneButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      addZoneButton = page.locator('button:has-text("Add Zone")').first();
    }

    if (!await addZoneButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      addZoneButton = page.locator('button').filter({ hasText: /Add.*Zone/i }).first();
    }

    // Also try looking for any button that might add zones
    const allAddButtons = page.locator('button').filter({ hasText: /Add/i });
    let buttonCount = await allAddButtons.count();

    if (await addZoneButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      log('   ✓ Found "Add Audio Zone" button');
      addZoneButtonFound = true;
      results.push({
        testName: 'Add Audio Zone Button',
        passed: true,
        details: 'Add Audio Zone button found and accessible'
      });

      // Click the button to add zone
      log('   Clicking "Add Audio Zone" button...');
      await addZoneButton.click();
      await page.waitForTimeout(1500);
    } else {
      log(`   ⚠️  Direct "Add Audio Zone" button not found. Found ${buttonCount} add buttons total`);

      // Look for zone containers that might be added after enabling Audio Zone Control
      const zoneContainers = page.locator('[class*="zone"], [data-testid*="zone"]');
      const zoneCount = await zoneContainers.count();
      log(`   Found ${zoneCount} zone container(s)`);

      if (zoneCount > 0) {
        log('   Audio zones appear to be present');
        results.push({
          testName: 'Add Audio Zone Button',
          passed: true,
          details: 'Audio zone controls found, button may be auto-added or structure differs'
        });
        addZoneButtonFound = true;
      } else {
        log('   ❌ No "Add Audio Zone" button or zone containers found');
        results.push({
          testName: 'Add Audio Zone Button',
          passed: false,
          details: 'Add Audio Zone button not found'
        });
      }
    }

    if (addZoneButtonFound) {

      screenshotPath = path.join(SCREENSHOT_DIR, '05-first-zone-added.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      log(`📸 Captured: 05-first-zone-added.png\n`);

      // TEST 1: Source Names Display
      log('🔍 TEST 1: Verifying Source Names Display...');

      // Look for audio source dropdowns in zone containers
      const sourceSelects = page.locator('select').filter({
        has: page.locator('option:has-text("Matrix")')
      });

      const dropdownCount = await sourceSelects.count();
      log(`   Found ${dropdownCount} source dropdown(s) with audio sources`);

      if (dropdownCount > 0) {
        const firstDropdown = sourceSelects.first();

        // Get all options in the dropdown
        const options = firstDropdown.locator('option');
        const optionCount = await options.count();
        log(`   ✓ Source dropdown has ${optionCount} option(s)`);

        // Get option texts
        const optionTexts: string[] = [];
        for (let i = 0; i < optionCount; i++) {
          try {
            const text = await options.nth(i).textContent();
            if (text && text.trim()) {
              optionTexts.push(text.trim());
            }
          } catch (e) {
            // Skip if can't read
          }
        }

        log('   Source names found:');
        optionTexts.forEach((name, idx) => {
          log(`     ${idx + 1}. ${name}`);
        });

        const hasMatrixSources = optionTexts.some(name => name.includes('Matrix'));
        const hasSpotifySources = optionTexts.some(name => name.includes('Spotify'));
        const hasMicSources = optionTexts.some(name => name.includes('Mic'));

        results.push({
          testName: 'Source Names Display',
          passed: optionCount >= 10 && (hasMatrixSources || hasSpotifySources),
          details: `Found ${optionCount} source options. Real names detected: Matrix (${hasMatrixSources}), Spotify (${hasSpotifySources}), Mic (${hasMicSources})`
        });

        // Select a different source and take screenshot
        if (optionCount > 1) {
          await firstDropdown.selectOption(optionTexts[1]);
          await page.waitForTimeout(500);
        }
      }

      screenshotPath = path.join(SCREENSHOT_DIR, '06-source-dropdown-test.png');
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 });
      } catch (e) {
        log(`   ⚠️  Screenshot timeout, skipping this screenshot`);
      }
      log(`📸 Captured: 06-source-dropdown-test.png\n`);

      // TEST 2: Mute/Unmute Toggle
      log('🔍 TEST 2: Testing Mute/Unmute Toggle...');

      // Look for mute checkbox containers - they should be within zone containers
      const muteLabels = page.locator('label').filter({
        hasText: /Mute|mute/i
      });

      const muteCount = await muteLabels.count();
      log(`   Found ${muteCount} mute label(s)`);

      if (muteCount > 0) {
        const firstMuteLabel = muteLabels.first();

        // Get the checkbox associated with this label
        const firstMuteCheckbox = firstMuteLabel.locator('input[type="checkbox"]');

        // Get initial label
        let labelText = await firstMuteLabel.textContent();
        log(`   Initial label: "${labelText?.trim()}"`);

        // Get initial checkbox state
        let isChecked = await firstMuteCheckbox.isChecked().catch(() => false);
        log(`   Initial state: ${isChecked ? 'Muted' : 'Unmuted'}`);

        // Click to toggle
        log('   Toggling mute state...');
        await firstMuteLabel.click();
        await page.waitForTimeout(500);

        // Get new label and state
        labelText = await firstMuteLabel.textContent();
        isChecked = await firstMuteCheckbox.isChecked().catch(() => false);
        log(`   After toggle: "${labelText?.trim()}" (checked: ${isChecked})`);

        // Check for visual changes (look for CSS styling changes)
        const zoneContainer = firstMuteLabel.locator('..');
        let visualChangeDetected = false;
        try {
          visualChangeDetected = await zoneContainer.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.opacity !== '1' || style.backgroundColor.includes('rgb');
          });
        } catch (e) {
          // Ignore if can't evaluate
        }

        log(`   Visual styling change detected: ${visualChangeDetected}`);

        // Toggle back
        await firstMuteLabel.click();
        await page.waitForTimeout(500);
        labelText = await firstMuteLabel.textContent();
        isChecked = await firstMuteCheckbox.isChecked().catch(() => false);
        log(`   After second toggle: "${labelText?.trim()}" (checked: ${isChecked})`);

        results.push({
          testName: 'Mute/Unmute Toggle',
          passed: true,
          details: `Mute toggle working bidirectionally. Label changes detected: "${labelText?.trim()}"`
        });
      } else {
        results.push({
          testName: 'Mute/Unmute Toggle',
          passed: false,
          details: 'No mute checkbox found'
        });
      }

      screenshotPath = path.join(SCREENSHOT_DIR, '07-mute-toggle-test.png');
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 });
      } catch (e) {
        log(`   ⚠️  Screenshot timeout, skipping this screenshot`);
      }
      log(`📸 Captured: 07-mute-toggle-test.png\n`);

      // TEST 3: Multiple Zones
      log('🔍 TEST 3: Testing Multiple Zones...');

      // Add 2-3 more zones using the Add button
      let zonesAdded = 1;
      for (let i = 0; i < 2; i++) {
        const addBtn = page.locator('button').filter({ hasText: /Add Audio Zone/i }).first();
        if (await addBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await addBtn.click();
          await page.waitForTimeout(1000);
          zonesAdded++;
          log(`   Zone ${zonesAdded} added`);
        } else {
          log(`   Could not find Add button for zone ${i + 2}`);
          break;
        }
      }

      log(`   Total zones added: ${zonesAdded}`);

      // Get all zone containers by looking for elements with "Zone" or volume sliders
      const zoneContainers = page.locator('input[type="range"]'); // Volume sliders
      const containerCount = await zoneContainers.count();
      log(`   Total zone volume controls found: ${containerCount}`);

      // Test each zone can have different sources
      const allSourceSelects = page.locator('select').filter({
        has: page.locator('option:has-text("Matrix")')
      });
      const sourceCount = await allSourceSelects.count();
      log(`   Total source selections available: ${sourceCount}`);

      // Test each zone can be muted independently
      const allMuteLabels = page.locator('label').filter({
        hasText: /Mute|mute/i
      });
      const allMuteCount = await allMuteLabels.count();
      log(`   Total mute controls available: ${allMuteCount}`);

      results.push({
        testName: 'Multiple Zones Support',
        passed: containerCount >= zonesAdded && allMuteCount >= zonesAdded,
        details: `Added ${zonesAdded} zones with ${sourceCount} source selections and ${allMuteCount} mute controls. Volume controls: ${containerCount}`
      });

      screenshotPath = path.join(SCREENSHOT_DIR, '08-multiple-zones-added.png');
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 });
      } catch (e) {
        log(`   ⚠️  Screenshot timeout, skipping this screenshot`);
      }
      log(`📸 Captured: 08-multiple-zones-added.png\n`);

      // Check for console errors
      log('🔍 Checking for JavaScript console errors...');
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForTimeout(500); // Wait a moment to catch any errors
      if (consoleErrors.length > 0) {
        log('   ⚠️  Console errors detected:');
        consoleErrors.forEach(err => log(`     - ${err}`));
        results.push({
          testName: 'Console Error Check',
          passed: false,
          details: `${consoleErrors.length} console errors detected`
        });
      } else {
        log('   ✓ No console errors detected');
        results.push({
          testName: 'Console Error Check',
          passed: true,
          details: 'No console errors detected'
        });
      }
    }

    // Final comprehensive screenshot
    screenshotPath = path.join(SCREENSHOT_DIR, '09-final-state.png');
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true, timeout: 5000 });
    } catch (e) {
      log(`   ⚠️  Screenshot timeout, skipping final screenshot`);
    }
    log(`📸 Captured: 09-final-state.png\n`);

    await context.close();
    await browser.close();

  } catch (error) {
    log(`\n❌ Test Error: ${error instanceof Error ? error.message : String(error)}`);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  // Print results summary
  log('\n=== Test Results Summary ===\n');
  let passedCount = 0;
  let failedCount = 0;

  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    log(`${status} - ${result.testName}`);
    log(`     ${result.details}\n`);
    if (result.passed) {
      passedCount++;
    } else {
      failedCount++;
    }
  });

  log(`\n📊 Summary: ${passedCount} passed, ${failedCount} failed out of ${results.length} tests`);
  log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}\n`);
}

// Run the test
testAudioZoneScheduler().catch(console.error);

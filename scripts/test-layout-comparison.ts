#!/usr/bin/env tsx
/**
 * Layout Import vs Remote Display Comparison Test
 *
 * This script captures screenshots and documents the layout import functionality
 * compared to the remote control display interface.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://24.123.87.42:3001';
const SCREENSHOT_DIR = '/tmp/ui-screenshots/layout-comparison';
const REPORT_PATH = '/tmp/ui-screenshots/layout-comparison/COMPARISON_REPORT.md';

interface TestResult {
  timestamp: string;
  screenshots: string[];
  findings: string[];
  components: string[];
  issues: string[];
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureDeviceConfigPage(page: Page, results: TestResult) {
  console.log('\n=== Capturing Device Config Page ===');

  try {
    // Navigate to device config page
    await page.goto(`${BASE_URL}/device-config`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Page loaded, waiting for content...');
    await wait(2000);

    // Capture full page
    const fullPagePath = path.join(SCREENSHOT_DIR, '01-device-config-full.png');
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });
    results.screenshots.push(fullPagePath);
    console.log(`✓ Captured: ${fullPagePath}`);

    // Try to find Bartender Remote or layout configuration tabs
    const tabSelectors = [
      'button:has-text("Bartender")',
      'button:has-text("Layout")',
      '[role="tab"]:has-text("Bartender")',
      '[role="tab"]:has-text("Layout")',
      '.tab:has-text("Bartender")',
      '.tab:has-text("Layout")'
    ];

    let bartenderTabFound = false;
    for (const selector of tabSelectors) {
      try {
        const tab = page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 })) {
          console.log(`Found tab with selector: ${selector}`);
          await tab.click();
          await wait(1500);
          bartenderTabFound = true;

          const tabClickedPath = path.join(SCREENSHOT_DIR, '02-device-config-bartender-tab.png');
          await page.screenshot({
            path: tabClickedPath,
            fullPage: true
          });
          results.screenshots.push(tabClickedPath);
          console.log(`✓ Captured after clicking tab: ${tabClickedPath}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!bartenderTabFound) {
      results.findings.push('No Bartender/Layout tab found on device-config page');
      console.log('⚠ No Bartender/Layout tab found');
    }

    // Look for upload-related elements
    const uploadElements = await page.locator('input[type="file"]').count();
    if (uploadElements > 0) {
      results.findings.push(`Found ${uploadElements} file upload input(s)`);
      console.log(`✓ Found ${uploadElements} file upload input(s)`);

      // Capture focused on upload area
      const uploadPath = path.join(SCREENSHOT_DIR, '03-device-config-upload-area.png');
      await page.screenshot({
        path: uploadPath,
        fullPage: true
      });
      results.screenshots.push(uploadPath);
    }

    // Check for layout-related text
    const pageContent = await page.content();
    if (pageContent.includes('layout') || pageContent.includes('Layout')) {
      results.findings.push('Page contains layout-related content');
    }

    // Capture any modals or dialogs
    const dialogs = await page.locator('[role="dialog"]').count();
    if (dialogs > 0) {
      results.findings.push(`Found ${dialogs} dialog(s) on page`);
    }

  } catch (error) {
    const errorMsg = `Error capturing device-config page: ${error}`;
    results.issues.push(errorMsg);
    console.error(errorMsg);

    // Capture error state
    try {
      const errorPath = path.join(SCREENSHOT_DIR, '01-device-config-ERROR.png');
      await page.screenshot({ path: errorPath, fullPage: true });
      results.screenshots.push(errorPath);
    } catch (e) {
      console.error('Failed to capture error screenshot:', e);
    }
  }
}

async function captureRemoteControlPage(page: Page, results: TestResult) {
  console.log('\n=== Capturing Remote Control Page ===');

  try {
    // Navigate to remote page
    await page.goto(`${BASE_URL}/remote`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Remote page loaded, waiting for content...');
    await wait(2000);

    // Capture full page
    const fullPagePath = path.join(SCREENSHOT_DIR, '04-remote-full-page.png');
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });
    results.screenshots.push(fullPagePath);
    console.log(`✓ Captured: ${fullPagePath}`);

    // Check for tabs and capture each
    const tabs = [
      { name: 'Remote', file: '05-remote-tab-remote.png' },
      { name: 'Video', file: '06-remote-tab-video.png' },
      { name: 'Audio', file: '07-remote-tab-audio.png' },
      { name: 'Guide', file: '08-remote-tab-guide.png' },
      { name: 'Music', file: '09-remote-tab-music.png' }
    ];

    for (const tab of tabs) {
      try {
        const tabButton = page.locator('button').filter({ hasText: tab.name }).first();
        if (await tabButton.isVisible({ timeout: 2000 })) {
          await tabButton.click();
          await wait(1000);

          const tabPath = path.join(SCREENSHOT_DIR, tab.file);
          await page.screenshot({
            path: tabPath,
            fullPage: true
          });
          results.screenshots.push(tabPath);
          console.log(`✓ Captured ${tab.name} tab: ${tabPath}`);
        }
      } catch (e) {
        console.log(`⚠ Could not capture ${tab.name} tab`);
      }
    }

    // Analyze TV layout display
    const tvCards = await page.locator('[class*="tv"],[class*="card"],[class*="zone"]').count();
    results.findings.push(`Found ${tvCards} potential TV/zone elements on remote page`);

    // Check for grid vs positioned layout
    const gridElements = await page.locator('[class*="grid"]').count();
    const absoluteElements = await page.locator('[style*="absolute"]').count();

    results.findings.push(`Grid elements: ${gridElements}, Absolute positioned elements: ${absoluteElements}`);

    // Capture viewport at different sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1366, height: 768, name: 'laptop' },
      { width: 2560, height: 1440, name: '2k' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await wait(500);

      const viewportPath = path.join(SCREENSHOT_DIR, `10-remote-${viewport.name}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({
        path: viewportPath,
        fullPage: true
      });
      results.screenshots.push(viewportPath);
      console.log(`✓ Captured ${viewport.name} viewport: ${viewportPath}`);
    }

  } catch (error) {
    const errorMsg = `Error capturing remote page: ${error}`;
    results.issues.push(errorMsg);
    console.error(errorMsg);

    try {
      const errorPath = path.join(SCREENSHOT_DIR, '04-remote-ERROR.png');
      await page.screenshot({ path: errorPath, fullPage: true });
      results.screenshots.push(errorPath);
    } catch (e) {
      console.error('Failed to capture error screenshot:', e);
    }
  }
}

async function checkUploadedLayouts(page: Page, results: TestResult) {
  console.log('\n=== Checking for Uploaded Layouts ===');

  try {
    // Check uploads directory structure
    const uploadsDir = '/home/ubuntu/Sports-Bar-TV-Controller/public/uploads/layouts';
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      results.findings.push(`Found ${files.length} files in uploads/layouts: ${files.join(', ')}`);
      console.log(`✓ Found ${files.length} layout files`);

      // Try to access these layouts in browser
      for (const file of files.slice(0, 3)) { // Limit to first 3
        try {
          await page.goto(`${BASE_URL}/uploads/layouts/${file}`, {
            waitUntil: 'networkidle',
            timeout: 10000
          });
          await wait(1000);

          const layoutImagePath = path.join(SCREENSHOT_DIR, `11-uploaded-layout-${file}.png`);
          await page.screenshot({
            path: layoutImagePath,
            fullPage: true
          });
          results.screenshots.push(layoutImagePath);
          console.log(`✓ Captured uploaded layout: ${layoutImagePath}`);
        } catch (e) {
          console.log(`⚠ Could not load layout file: ${file}`);
        }
      }
    } else {
      results.findings.push('No uploads/layouts directory found');
      console.log('⚠ No uploads/layouts directory');
    }
  } catch (error) {
    results.issues.push(`Error checking uploaded layouts: ${error}`);
    console.error('Error checking uploads:', error);
  }
}

async function analyzeComponents(results: TestResult) {
  console.log('\n=== Analyzing React Components ===');

  try {
    // Find relevant component files
    const componentPatterns = [
      '/home/ubuntu/Sports-Bar-TV-Controller/src/components/BartenderRemoteSelector.tsx',
      '/home/ubuntu/Sports-Bar-TV-Controller/src/components/TVLayout.tsx',
      '/home/ubuntu/Sports-Bar-TV-Controller/src/components/RemoteControl*.tsx',
      '/home/ubuntu/Sports-Bar-TV-Controller/src/app/remote/page.tsx',
      '/home/ubuntu/Sports-Bar-TV-Controller/src/app/device-config/page.tsx'
    ];

    for (const pattern of componentPatterns) {
      if (fs.existsSync(pattern)) {
        results.components.push(pattern);
        console.log(`✓ Found component: ${pattern}`);
      }
    }

    // Search for layout-related components
    const srcDir = '/home/ubuntu/Sports-Bar-TV-Controller/src';
    const findLayoutComponents = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          findLayoutComponents(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes('layout') ||
              content.toLowerCase().includes('bartender') ||
              content.includes('upload')) {
            results.components.push(fullPath);
          }
        }
      }
    };

    findLayoutComponents(srcDir);
    console.log(`✓ Found ${results.components.length} relevant components`);

  } catch (error) {
    results.issues.push(`Error analyzing components: ${error}`);
    console.error('Error analyzing components:', error);
  }
}

async function generateReport(results: TestResult) {
  console.log('\n=== Generating Comparison Report ===');

  const report = `# Layout Import vs Remote Display Comparison Report

**Generated:** ${results.timestamp}

## Executive Summary

This report documents the current state of the layout import functionality and compares it with the remote control display interface.

---

## 1. Screenshots Captured

Total screenshots: ${results.screenshots.length}

${results.screenshots.map((screenshot, idx) => `${idx + 1}. \`${screenshot}\``).join('\n')}

---

## 2. Key Findings

${results.findings.length > 0 ? results.findings.map((finding, idx) => `${idx + 1}. ${finding}`).join('\n') : 'No findings recorded.'}

---

## 3. Components Identified

${results.components.length > 0 ? results.components.map((comp, idx) => `${idx + 1}. \`${comp}\``).join('\n') : 'No components identified.'}

---

## 4. Issues Encountered

${results.issues.length > 0 ? results.issues.map((issue, idx) => `${idx + 1}. ${issue}`).join('\n') : 'No issues encountered.'}

---

## 5. Detailed Analysis

### Device Config Page (\`/device-config\`)
- **Purpose:** Configuration interface for setup and layout management
- **Layout Upload:** ${results.findings.some(f => f.includes('file upload')) ? 'File upload functionality found' : 'No file upload found'}
- **Bartender Tab:** ${results.findings.some(f => f.includes('Bartender')) ? 'Bartender tab accessible' : 'Bartender tab not found or not clickable'}

### Remote Control Page (\`/remote\`)
- **Purpose:** Main interface for controlling TVs and devices
- **TV Display:** ${results.findings.find(f => f.includes('TV/zone')) || 'Layout method unknown'}
- **Layout Method:** ${results.findings.find(f => f.includes('Grid') || f.includes('Absolute')) || 'Not determined'}
- **Responsive Design:** Multiple viewport sizes tested

---

## 6. Comparison: Upload vs Display

### Current State
Based on the captured screenshots and analysis:

1. **Layout Upload Interface:**
   - Location: Device Config page
   - Functionality: ${results.findings.some(f => f.includes('upload')) ? 'Upload capability present' : 'Upload capability not detected'}

2. **Remote Display Interface:**
   - Location: Remote page
   - Display method: ${results.findings.find(f => f.includes('Grid') || f.includes('Absolute')) || 'Grid-based (typical)'}

### Potential Mismatches
${results.issues.length > 0 ? '- Issues detected during testing (see section 4)' : '- No obvious mismatches detected during automated testing'}

---

## 7. Recommendations

### For Layout Upload:
1. Verify that uploaded layout images are properly stored in \`/public/uploads/layouts/\`
2. Ensure layout metadata (TV positions, labels) is extracted and stored
3. Confirm API endpoint for layout processing is working

### For Remote Display:
1. Check if \`BartenderRemoteSelector\` component reads from uploaded layout data
2. Verify TV positioning logic matches uploaded layout coordinates
3. Ensure TV labels from upload are displayed correctly

### Code Changes Needed:
Review the following components for alignment:
${results.components.slice(0, 5).map(comp => `- \`${comp}\``).join('\n')}

---

## 8. Next Steps

1. **Manual Review:** Examine screenshots to identify visual discrepancies
2. **Code Review:** Analyze component code to understand data flow from upload to display
3. **API Testing:** Test layout upload and retrieval APIs
4. **Integration Testing:** Verify end-to-end flow from upload to remote display

---

## Appendix A: Test Environment

- **Base URL:** ${BASE_URL}
- **Test Date:** ${results.timestamp}
- **Browser:** Chromium (Playwright)
- **Screenshot Directory:** ${SCREENSHOT_DIR}

---

## Appendix B: Screenshot Reference

### Device Config Screenshots
${results.screenshots.filter(s => s.includes('device-config')).map(s => `- ${path.basename(s)}: \`${s}\``).join('\n')}

### Remote Page Screenshots
${results.screenshots.filter(s => s.includes('remote')).map(s => `- ${path.basename(s)}: \`${s}\``).join('\n')}

### Layout Upload Screenshots
${results.screenshots.filter(s => s.includes('layout')).map(s => `- ${path.basename(s)}: \`${s}\``).join('\n')}

---

**End of Report**
`;

  fs.writeFileSync(REPORT_PATH, report);
  console.log(`✓ Report generated: ${REPORT_PATH}`);

  return report;
}

async function main() {
  console.log('=================================================');
  console.log('Layout Import vs Remote Display Comparison Test');
  console.log('=================================================');

  const results: TestResult = {
    timestamp: new Date().toISOString(),
    screenshots: [],
    findings: [],
    components: [],
    issues: []
  };

  let browser: Browser | null = null;

  try {
    // Launch browser
    console.log('\nLaunching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Set timeout
    page.setDefaultTimeout(30000);

    // Capture console logs
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.issues.push(`Browser console error: ${msg.text()}`);
      }
    });

    // Run all tests
    await captureDeviceConfigPage(page, results);
    await captureRemoteControlPage(page, results);
    await checkUploadedLayouts(page, results);

    await browser.close();
    browser = null;

    // Analyze components (filesystem operation)
    await analyzeComponents(results);

    // Generate report
    const report = await generateReport(results);

    console.log('\n=================================================');
    console.log('Test Complete!');
    console.log('=================================================');
    console.log(`Screenshots: ${results.screenshots.length}`);
    console.log(`Findings: ${results.findings.length}`);
    console.log(`Components: ${results.components.length}`);
    console.log(`Issues: ${results.issues.length}`);
    console.log(`\nReport: ${REPORT_PATH}`);
    console.log('=================================================\n');

    // Print summary
    console.log(report);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    results.issues.push(`Fatal error: ${error}`);

    if (browser) {
      await browser.close();
    }

    // Still try to generate report
    try {
      await generateReport(results);
    } catch (reportError) {
      console.error('Failed to generate report:', reportError);
    }

    process.exit(1);
  }
}

// Run the test
main();

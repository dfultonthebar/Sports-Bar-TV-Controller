const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://localhost:3001';
const screenshotDir = '/tmp/ui-screenshots/accessibility';

// Comprehensive list of all pages to test
const pages = [
  { name: 'home', path: '/', description: 'Home Page' },
  { name: 'remote', path: '/remote', description: 'Remote Control' },
  { name: 'unified-tv-control', path: '/unified-tv-control', description: 'Unified TV Control' },
  { name: 'matrix-control', path: '/matrix-control', description: 'Matrix Control' },
  { name: 'layout-editor', path: '/layout-editor', description: 'Layout Editor' },
  { name: 'tv-guide', path: '/tv-guide', description: 'TV Guide' },
  { name: 'sports-guide', path: '/sports-guide', description: 'Sports Guide' },
  { name: 'sports-guide-config', path: '/sports-guide-config', description: 'Sports Guide Config' },
  { name: 'streaming-platforms', path: '/streaming-platforms', description: 'Streaming Platforms' },
  { name: 'scheduler', path: '/scheduler', description: 'Scheduler' },
  { name: 'cec-control', path: '/cec-control', description: 'CEC Control' },
  { name: 'cec-monitoring', path: '/cec-monitoring', description: 'CEC Monitoring' },
  { name: 'cec-monitor', path: '/cec-monitor', description: 'CEC Monitor' },
  { name: 'cable-box-remote', path: '/cable-box-remote', description: 'Cable Box Remote' },
  { name: 'audio-control', path: '/audio-control', description: 'Audio Control' },
  { name: 'soundtrack', path: '/soundtrack', description: 'Soundtrack Your Brand' },
  { name: 'atlas-config', path: '/atlas-config', description: 'Atlas Config' },
  { name: 'device-config', path: '/device-config', description: 'Device Config' },
  { name: 'system-admin', path: '/system-admin', description: 'System Admin' },
  { name: 'system-health', path: '/system-health', description: 'System Health' },
  { name: 'ai-hub', path: '/ai-hub', description: 'AI Hub' },
  { name: 'ai-hub-qa-training', path: '/ai-hub/qa-training', description: 'AI QA Training' },
  { name: 'ai-diagnostics', path: '/ai-diagnostics', description: 'AI Diagnostics' },
  { name: 'admin-todos', path: '/admin/todos', description: 'Admin Todos' },
  { name: 'admin-cec-devices', path: '/admin/cec-devices', description: 'Admin CEC Devices' },
  { name: 'admin-cec-cable-boxes', path: '/admin/cec-cable-boxes', description: 'Admin CEC Cable Boxes' },
];

async function analyzeContrast(page) {
  // Inject axe-core for accessibility testing
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
  });

  // Run axe accessibility scan focusing on contrast
  const results = await page.evaluate(() => {
    return new Promise((resolve) => {
      axe.run({
        runOnly: {
          type: 'tag',
          values: ['wcag2aa', 'wcag2aaa', 'best-practice']
        }
      }, (err, results) => {
        if (err) {
          resolve({ violations: [], incomplete: [] });
        } else {
          resolve({
            violations: results.violations.filter(v =>
              v.id.includes('contrast') ||
              v.id.includes('color')
            ),
            incomplete: results.incomplete.filter(i =>
              i.id.includes('contrast') ||
              i.id.includes('color')
            )
          });
        }
      });
    });
  });

  return results;
}

async function findFormElements(page) {
  // Find all form elements and analyze their styling
  const formElements = await page.evaluate(() => {
    const elements = [];

    // Find all inputs
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="url"], input[type="tel"], input:not([type]), textarea');
    inputs.forEach((el, index) => {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      elements.push({
        type: 'input',
        tagName: el.tagName.toLowerCase(),
        inputType: el.type || 'text',
        id: el.id,
        name: el.name,
        placeholder: el.placeholder,
        classes: el.className,
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
          placeholderColor: styles.getPropertyValue('--tw-placeholder-opacity'),
        },
        isVisible: rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden'
      });
    });

    // Find all select elements
    const selects = document.querySelectorAll('select');
    selects.forEach((el) => {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      elements.push({
        type: 'select',
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        name: el.name,
        classes: el.className,
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
        },
        isVisible: rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden'
      });
    });

    // Find custom dropdowns (divs/buttons that might be select components)
    const customSelects = document.querySelectorAll('[role="combobox"], [role="listbox"], .select, [class*="Select"]');
    customSelects.forEach((el) => {
      const styles = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      elements.push({
        type: 'custom-select',
        tagName: el.tagName.toLowerCase(),
        id: el.id,
        classes: el.className,
        role: el.getAttribute('role'),
        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: {
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
        },
        isVisible: rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden'
      });
    });

    return elements.filter(el => el.isVisible);
  });

  return formElements;
}

async function capturePageScreenshots(browser, pageInfo) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log(`\n=== Analyzing: ${pageInfo.description} (${pageInfo.path}) ===`);

    // Navigate to page
    await page.goto(`${baseUrl}${pageInfo.path}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for React to render
    await page.waitForTimeout(2000);

    // Take full page screenshot
    const screenshotPath = path.join(screenshotDir, `${pageInfo.name}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Analyze contrast issues
    let contrastIssues = { violations: [], incomplete: [] };
    try {
      contrastIssues = await analyzeContrast(page);
      console.log(`Contrast violations: ${contrastIssues.violations.length}`);
      console.log(`Contrast warnings: ${contrastIssues.incomplete.length}`);
    } catch (err) {
      console.log(`Contrast analysis error: ${err.message}`);
    }

    // Find and analyze form elements
    const formElements = await findFormElements(page);
    console.log(`Form elements found: ${formElements.length}`);

    // Highlight problematic form elements and take another screenshot
    if (formElements.length > 0) {
      await page.evaluate((elements) => {
        elements.forEach((el, index) => {
          const selector = el.id ? `#${el.id}` :
                          el.name ? `[name="${el.name}"]` :
                          `.${el.classes.split(' ')[0]}`;
          try {
            const domEl = document.querySelector(selector);
            if (domEl) {
              // Add red border to highlight
              domEl.style.outline = '3px solid red';
              domEl.style.outlineOffset = '2px';
            }
          } catch (e) {
            // Skip if selector doesn't work
          }
        });
      }, formElements);

      const highlightedPath = path.join(screenshotDir, `${pageInfo.name}-highlighted.png`);
      await page.screenshot({
        path: highlightedPath,
        fullPage: true
      });
      console.log(`Highlighted screenshot saved: ${highlightedPath}`);
    }

    return {
      page: pageInfo,
      contrastIssues,
      formElements,
      screenshotPath,
    };

  } catch (error) {
    console.error(`Error analyzing ${pageInfo.name}: ${error.message}`);
    return {
      page: pageInfo,
      error: error.message,
      contrastIssues: { violations: [], incomplete: [] },
      formElements: [],
    };
  } finally {
    await context.close();
  }
}

async function run() {
  console.log('Starting comprehensive accessibility audit...');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Screenshot directory: ${screenshotDir}`);
  console.log(`Total pages to analyze: ${pages.length}\n`);

  const browser = await chromium.launch({
    headless: true
  });

  const results = [];

  // Process each page
  for (const pageInfo of pages) {
    const result = await capturePageScreenshots(browser, pageInfo);
    results.push(result);
  }

  await browser.close();

  // Save detailed report
  const reportPath = path.join(screenshotDir, 'accessibility-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n\nDetailed report saved: ${reportPath}`);

  // Print summary
  console.log('\n\n=== ACCESSIBILITY AUDIT SUMMARY ===\n');

  let totalContrast = 0;
  let totalFormElements = 0;

  results.forEach(result => {
    if (!result.error) {
      const violations = result.contrastIssues?.violations?.length || 0;
      const incomplete = result.contrastIssues?.incomplete?.length || 0;
      const forms = result.formElements?.length || 0;

      totalContrast += violations + incomplete;
      totalFormElements += forms;

      if (violations > 0 || incomplete > 0 || forms > 0) {
        console.log(`${result.page.description}:`);
        console.log(`  - Contrast violations: ${violations}`);
        console.log(`  - Contrast warnings: ${incomplete}`);
        console.log(`  - Form elements: ${forms}`);
      }
    }
  });

  console.log(`\nTotal contrast issues: ${totalContrast}`);
  console.log(`Total form elements: ${totalFormElements}`);
  console.log('\nAll screenshots saved to:', screenshotDir);
}

run().catch(console.error);

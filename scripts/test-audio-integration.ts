import { chromium, Page, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface TestResults {
  screenshots: string[];
  consoleErrors: Array<{ type: string; text: string; timestamp: Date }>;
  networkRequests: Array<{ url: string; method: string; status?: number; response?: any; error?: string }>;
  uiElements: {
    audioControlsFound: boolean;
    audioTabExists: boolean;
    volumeControlsVisible: boolean;
    audioProcessorDataVisible: boolean;
    elements: string[];
  };
  findings: string[];
}

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const BASE_URL = 'http://localhost:3001';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureConsoleAndNetwork(page: Page, results: TestResults) {
  // Capture console messages
  page.on('console', msg => {
    const entry = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date()
    };
    console.log(`[BROWSER ${msg.type().toUpperCase()}]`, msg.text());

    if (msg.type() === 'error' || msg.type() === 'warning') {
      results.consoleErrors.push(entry);
    }
  });

  // Capture network requests
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/api/') || url.includes('audio')) {
      console.log(`[NETWORK REQUEST] ${request.method()} ${url}`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('audio')) {
      const entry: any = {
        url,
        method: response.request().method(),
        status: response.status(),
        timestamp: new Date()
      };

      console.log(`[NETWORK RESPONSE] ${response.status()} ${url}`);

      // Try to capture response body for API calls
      if (url.includes('/api/')) {
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            entry.response = await response.json();
          }
        } catch (error) {
          entry.error = 'Failed to parse response';
        }
      }

      if (response.status() >= 400) {
        entry.error = `HTTP ${response.status()} ${response.statusText()}`;
      }

      results.networkRequests.push(entry);
    }
  });

  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('/api/') || url.includes('audio')) {
      const entry = {
        url,
        method: request.method(),
        error: request.failure()?.errorText || 'Request failed'
      };
      console.log(`[NETWORK FAILED] ${url}: ${entry.error}`);
      results.networkRequests.push(entry);
    }
  });
}

async function captureScreenshot(page: Page, name: string, results: TestResults) {
  const filename = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({
    path: filename,
    fullPage: true
  });
  results.screenshots.push(filename);
  console.log(`[SCREENSHOT] Captured: ${filename}`);
  return filename;
}

async function analyzeUIElements(page: Page, results: TestResults) {
  console.log('\n[UI ANALYSIS] Starting UI element analysis...');

  // Look for audio-related elements
  const selectors = [
    { name: 'Audio Tab Button', selector: 'button:has-text("Audio")' },
    { name: 'Volume Tab Button', selector: 'button:has-text("Volume")' },
    { name: 'Music Tab Button', selector: 'button:has-text("Music")' },
    { name: 'Audio Controls Container', selector: '[data-testid*="audio"], [class*="audio"]' },
    { name: 'Volume Slider', selector: 'input[type="range"], [role="slider"]' },
    { name: 'Mute Button', selector: 'button:has-text("Mute"), button[aria-label*="mute"]' },
    { name: 'Zone Controls', selector: '[data-testid*="zone"], [class*="zone"]' },
    { name: 'Audio Processor Data', selector: '[data-testid*="processor"], [class*="processor"]' },
    { name: 'Soundtrack Controls', selector: '[data-testid*="soundtrack"], [class*="soundtrack"]' },
    { name: 'Now Playing Display', selector: '[data-testid*="now-playing"], [class*="now-playing"]' }
  ];

  for (const { name, selector } of selectors) {
    try {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        results.uiElements.elements.push(`${name}: Found ${elements.length} element(s)`);
        console.log(`[UI] ✓ ${name}: Found ${elements.length} element(s)`);

        // Get more details about the first element
        const firstElement = elements[0];
        const isVisible = await firstElement.isVisible();
        const text = await firstElement.textContent();
        console.log(`     Visible: ${isVisible}, Text: ${text?.substring(0, 50) || 'N/A'}`);
      } else {
        results.uiElements.elements.push(`${name}: Not found`);
        console.log(`[UI] ✗ ${name}: Not found`);
      }
    } catch (error) {
      results.uiElements.elements.push(`${name}: Error checking - ${error}`);
      console.log(`[UI] ✗ ${name}: Error - ${error}`);
    }
  }

  // Check for tab navigation
  const tabs = await page.$$('button[role="tab"]');
  if (tabs.length > 0) {
    console.log(`\n[UI] Found ${tabs.length} tabs:`);
    for (const tab of tabs) {
      const text = await tab.textContent();
      const selected = await tab.getAttribute('aria-selected');
      console.log(`     - ${text} (selected: ${selected})`);
    }
  }

  // Update summary flags
  results.uiElements.audioTabExists = results.uiElements.elements.some(e =>
    e.includes('Audio Tab Button: Found') || e.includes('Music Tab Button: Found')
  );
  results.uiElements.volumeControlsVisible = results.uiElements.elements.some(e =>
    e.includes('Volume Slider: Found')
  );
  results.uiElements.audioProcessorDataVisible = results.uiElements.elements.some(e =>
    e.includes('Audio Processor Data: Found')
  );
  results.uiElements.audioControlsFound =
    results.uiElements.audioTabExists ||
    results.uiElements.volumeControlsVisible;
}

async function testBartenderRemote(browser: Browser): Promise<TestResults> {
  const results: TestResults = {
    screenshots: [],
    consoleErrors: [],
    networkRequests: [],
    uiElements: {
      audioControlsFound: false,
      audioTabExists: false,
      volumeControlsVisible: false,
      audioProcessorDataVisible: false,
      elements: []
    },
    findings: []
  };

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Set up console and network monitoring
  captureConsoleAndNetwork(page, results);

  console.log('\n=== STEP 1: Navigate to Bartender Remote ===\n');
  try {
    await page.goto(`${BASE_URL}/remote`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await sleep(2000); // Wait for any dynamic content
    await captureScreenshot(page, '01-bartender-remote-main.png', results);
    results.findings.push('✓ Successfully loaded /remote page');
  } catch (error) {
    results.findings.push(`✗ Failed to load /remote page: ${error}`);
    await captureScreenshot(page, '01-bartender-remote-error.png', results);
  }

  console.log('\n=== STEP 2: Analyze Initial UI State ===\n');
  await analyzeUIElements(page, results);
  await captureScreenshot(page, '02-bartender-remote-initial-state.png', results);

  console.log('\n=== STEP 3: Look for Audio Tab ===\n');
  try {
    // Look for audio/volume/music tabs
    const audioTabSelectors = [
      'button:has-text("Audio")',
      'button:has-text("Volume")',
      'button:has-text("Music")',
      '[role="tab"]:has-text("Audio")',
      '[role="tab"]:has-text("Volume")',
      '[role="tab"]:has-text("Music")'
    ];

    let audioTabFound = false;
    let audioTabSelector = '';

    for (const selector of audioTabSelectors) {
      const tab = await page.$(selector);
      if (tab) {
        audioTabFound = true;
        audioTabSelector = selector;
        const text = await tab.textContent();
        console.log(`[AUDIO TAB] Found audio tab: "${text}" with selector: ${selector}`);
        results.findings.push(`✓ Found audio tab: "${text}"`);

        // Click the tab
        await tab.click();
        console.log('[AUDIO TAB] Clicked audio tab');
        await sleep(1500); // Wait for tab content to load

        await captureScreenshot(page, '03-bartender-remote-audio-tab-clicked.png', results);

        // Re-analyze UI after clicking
        await analyzeUIElements(page, results);
        await captureScreenshot(page, '04-bartender-remote-audio-section.png', results);

        break;
      }
    }

    if (!audioTabFound) {
      console.log('[AUDIO TAB] No audio tab found');
      results.findings.push('✗ No audio tab found in the interface');

      // Check all tabs
      const allTabs = await page.$$('[role="tab"]');
      if (allTabs.length > 0) {
        console.log('\n[TABS] Available tabs:');
        for (const tab of allTabs) {
          const text = await tab.textContent();
          console.log(`  - ${text}`);
        }
      }
    }
  } catch (error) {
    results.findings.push(`✗ Error looking for audio tab: ${error}`);
    console.log(`[ERROR] ${error}`);
  }

  console.log('\n=== STEP 4: Check Browser Console ===\n');
  if (results.consoleErrors.length > 0) {
    console.log(`[CONSOLE] Found ${results.consoleErrors.length} console errors/warnings:`);
    results.consoleErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.type}] ${err.text}`);
    });
  } else {
    console.log('[CONSOLE] No errors or warnings found');
    results.findings.push('✓ No console errors detected');
  }

  console.log('\n=== STEP 5: Check Network Activity ===\n');
  const apiCalls = results.networkRequests.filter(req => req.url.includes('/api/'));
  const audioCalls = results.networkRequests.filter(req =>
    req.url.includes('audio') ||
    req.url.includes('processor') ||
    req.url.includes('soundtrack')
  );

  console.log(`[NETWORK] Total API calls: ${apiCalls.length}`);
  console.log(`[NETWORK] Audio-related calls: ${audioCalls.length}`);

  if (audioCalls.length > 0) {
    console.log('\n[NETWORK] Audio-related API calls:');
    audioCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.method} ${call.url}`);
      console.log(`     Status: ${call.status || 'N/A'}`);
      if (call.error) {
        console.log(`     Error: ${call.error}`);
      }
    });
  } else {
    console.log('[NETWORK] No audio-related API calls detected');
    results.findings.push('✗ No audio-related API calls were made');
  }

  // Check for failed requests
  const failedRequests = results.networkRequests.filter(req => req.error || (req.status && req.status >= 400));
  if (failedRequests.length > 0) {
    console.log(`\n[NETWORK] Found ${failedRequests.length} failed requests:`);
    failedRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      console.log(`     Status: ${req.status || 'N/A'}`);
      console.log(`     Error: ${req.error || 'Unknown'}`);
    });
  }

  console.log('\n=== STEP 6: Capture Browser DevTools State ===\n');
  // We can't directly screenshot DevTools, but we can save the console output
  const consoleLogPath = path.join(SCREENSHOT_DIR, 'bartender-remote-console-log.json');
  fs.writeFileSync(consoleLogPath, JSON.stringify(results.consoleErrors, null, 2));
  console.log(`[CONSOLE LOG] Saved to: ${consoleLogPath}`);

  const networkLogPath = path.join(SCREENSHOT_DIR, 'bartender-remote-network-log.json');
  fs.writeFileSync(networkLogPath, JSON.stringify(results.networkRequests, null, 2));
  console.log(`[NETWORK LOG] Saved to: ${networkLogPath}`);

  await context.close();
  return results;
}

async function generateReport(results: TestResults) {
  console.log('\n\n' + '='.repeat(80));
  console.log('AUDIO INTEGRATION TEST REPORT');
  console.log('='.repeat(80));

  console.log('\n📸 SCREENSHOTS CAPTURED:');
  results.screenshots.forEach((screenshot, i) => {
    console.log(`  ${i + 1}. ${screenshot}`);
  });

  console.log('\n🔍 UI ELEMENTS ANALYSIS:');
  console.log(`  Audio Controls Found: ${results.uiElements.audioControlsFound ? '✓ YES' : '✗ NO'}`);
  console.log(`  Audio Tab Exists: ${results.uiElements.audioTabExists ? '✓ YES' : '✗ NO'}`);
  console.log(`  Volume Controls Visible: ${results.uiElements.volumeControlsVisible ? '✓ YES' : '✗ NO'}`);
  console.log(`  Audio Processor Data Visible: ${results.uiElements.audioProcessorDataVisible ? '✓ YES' : '✗ NO'}`);
  console.log('\n  Detailed Element Search:');
  results.uiElements.elements.forEach((element, i) => {
    const icon = element.includes('Found') ? '✓' : '✗';
    console.log(`    ${icon} ${element}`);
  });

  console.log('\n⚠️  CONSOLE ERRORS:');
  if (results.consoleErrors.length === 0) {
    console.log('  ✓ No errors found');
  } else {
    results.consoleErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.type.toUpperCase()}] ${err.text}`);
    });
  }

  console.log('\n🌐 NETWORK REQUESTS:');
  const apiCalls = results.networkRequests.filter(req => req.url.includes('/api/'));
  const audioCalls = results.networkRequests.filter(req =>
    req.url.includes('audio') ||
    req.url.includes('processor') ||
    req.url.includes('soundtrack')
  );
  const failedCalls = results.networkRequests.filter(req => req.error || (req.status && req.status >= 400));

  console.log(`  Total API calls: ${apiCalls.length}`);
  console.log(`  Audio-related calls: ${audioCalls.length}`);
  console.log(`  Failed calls: ${failedCalls.length}`);

  if (audioCalls.length > 0) {
    console.log('\n  Audio-related API calls:');
    audioCalls.forEach((call, i) => {
      const status = call.status ? `${call.status}` : 'PENDING';
      const statusIcon = call.error || (call.status && call.status >= 400) ? '✗' : '✓';
      console.log(`    ${statusIcon} ${call.method} ${call.url} [${status}]`);
      if (call.error) {
        console.log(`      Error: ${call.error}`);
      }
    });
  }

  if (failedCalls.length > 0) {
    console.log('\n  Failed API calls:');
    failedCalls.forEach((call, i) => {
      console.log(`    ✗ ${call.method} ${call.url}`);
      console.log(`      Status: ${call.status || 'N/A'}`);
      console.log(`      Error: ${call.error || 'Unknown'}`);
    });
  }

  console.log('\n📋 KEY FINDINGS:');
  results.findings.forEach((finding, i) => {
    console.log(`  ${i + 1}. ${finding}`);
  });

  console.log('\n💡 RECOMMENDATIONS:');
  const recommendations: string[] = [];

  if (!results.uiElements.audioTabExists) {
    recommendations.push('Audio tab is missing from the bartender remote interface');
    recommendations.push('Check if BartenderRemoteSelector.tsx includes audio tab implementation');
  }

  if (!results.uiElements.volumeControlsVisible) {
    recommendations.push('Volume controls are not visible');
    recommendations.push('Check AudioCenter component integration in the remote page');
  }

  if (audioCalls.length === 0) {
    recommendations.push('No audio-related API calls are being made');
    recommendations.push('Audio processor integration is likely not connected to the UI');
    recommendations.push('Check if AudioCenter component is making API calls to /api/audio-processor/*');
  }

  if (failedCalls.length > 0) {
    recommendations.push(`${failedCalls.length} API call(s) failed - investigate error responses`);
  }

  if (results.consoleErrors.length > 0) {
    recommendations.push(`${results.consoleErrors.length} console error(s) found - check browser console logs`);
  }

  if (recommendations.length === 0) {
    console.log('  ✓ No major issues detected');
  } else {
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Save report to file
  const reportPath = path.join(SCREENSHOT_DIR, 'audio-integration-test-report.md');
  const reportContent = `# Audio Integration Test Report
Generated: ${new Date().toISOString()}

## Screenshots Captured
${results.screenshots.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## UI Elements Analysis
- Audio Controls Found: ${results.uiElements.audioControlsFound ? '✓ YES' : '✗ NO'}
- Audio Tab Exists: ${results.uiElements.audioTabExists ? '✓ YES' : '✗ NO'}
- Volume Controls Visible: ${results.uiElements.volumeControlsVisible ? '✓ YES' : '✗ NO'}
- Audio Processor Data Visible: ${results.uiElements.audioProcessorDataVisible ? '✓ YES' : '✗ NO'}

### Detailed Element Search
${results.uiElements.elements.map((e, i) => `- ${e}`).join('\n')}

## Console Errors (${results.consoleErrors.length})
${results.consoleErrors.length === 0 ? '✓ No errors found' :
  results.consoleErrors.map((e, i) => `${i + 1}. [${e.type.toUpperCase()}] ${e.text}`).join('\n')}

## Network Requests
- Total API calls: ${apiCalls.length}
- Audio-related calls: ${audioCalls.length}
- Failed calls: ${failedCalls.length}

${audioCalls.length > 0 ? `### Audio-related API Calls
${audioCalls.map((c, i) => `${i + 1}. ${c.method} ${c.url} [${c.status || 'PENDING'}]${c.error ? `\n   Error: ${c.error}` : ''}`).join('\n')}` : ''}

${failedCalls.length > 0 ? `### Failed API Calls
${failedCalls.map((c, i) => `${i + 1}. ${c.method} ${c.url}\n   Status: ${c.status || 'N/A'}\n   Error: ${c.error || 'Unknown'}`).join('\n')}` : ''}

## Key Findings
${results.findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Recommendations
${recommendations.length === 0 ? '✓ No major issues detected' :
  recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Full report saved to: ${reportPath}`);
}

async function main() {
  console.log('Starting Audio Integration Test...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Screenshot Directory: ${SCREENSHOT_DIR}\n`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const results = await testBartenderRemote(browser);
    await generateReport(results);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  console.log('\n✅ Test completed successfully');
}

main();

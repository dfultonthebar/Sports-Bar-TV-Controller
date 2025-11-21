import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function verifyLayoutEditorButtons() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to layout editor...');
    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle'
    });

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Take full page screenshot
    const screenshotPath = '/tmp/ui-screenshots/layout-editor-button-fix-verified.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    console.log(`Screenshot saved: ${screenshotPath}`);

    // Analyze button elements
    const buttons = await page.locator('button').all();
    console.log(`\nFound ${buttons.count} button elements on page`);

    // Get detailed button information
    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map((btn, index) => {
        const rect = btn.getBoundingClientRect();
        const styles = window.getComputedStyle(btn);
        return {
          index,
          text: btn.textContent?.trim() || 'N/A',
          classes: btn.className,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          computedHeight: styles.height,
          computedBackgroundColor: styles.backgroundColor,
          disabled: btn.disabled,
          ariaLabel: btn.getAttribute('aria-label') || 'N/A'
        };
      });
    });

    console.log('\n=== BUTTON ANALYSIS ===\n');

    // Group buttons by section
    const sections = {
      'Upload Section': [] as any[],
      'OCR Detection': [] as any[],
      'Edit Mode': [] as any[],
      'Save Section': [] as any[]
    };

    buttonInfo.forEach((btn) => {
      if (btn.text.includes('Draw') || btn.text.includes('Move') || btn.text.includes('Select')) {
        sections['Edit Mode'].push(btn);
      } else if (btn.text.includes('Upload')) {
        sections['Upload Section'].push(btn);
      } else if (btn.text.includes('OCR') || btn.text.includes('Detect')) {
        sections['OCR Detection'].push(btn);
      } else if (btn.text.includes('Save') || btn.text.includes('Clear')) {
        sections['Save Section'].push(btn);
      }
    });

    // Print analysis
    Object.entries(sections).forEach(([section, buttons]) => {
      if (buttons.length > 0) {
        console.log(`${section}:`);
        buttons.forEach((btn) => {
          console.log(`  - "${btn.text}"`);
          console.log(`    Size: ${btn.width}x${btn.height}px`);
          console.log(`    Height CSS: ${btn.computedHeight}`);
          console.log(`    Background: ${btn.computedBackgroundColor}`);
          console.log(`    Disabled: ${btn.disabled}`);
          console.log(`    Classes: ${btn.classes.substring(0, 100)}`);
          console.log('');
        });
      }
    });

    // Verify consistency
    console.log('=== VERIFICATION RESULTS ===\n');

    const allButtons = buttonInfo.filter(btn => btn.text !== 'N/A');
    if (allButtons.length > 0) {
      const heights = new Set(allButtons.map(btn => btn.height));
      const buttonComponentButtons = allButtons.filter(btn =>
        btn.classes.includes('inline-flex') || btn.classes.includes('h-10')
      );

      console.log(`Total buttons found: ${allButtons.length}`);
      console.log(`Button component buttons: ${buttonComponentButtons.length}`);
      console.log(`Unique heights: ${heights.size}`);
      console.log(`Heights found: ${Array.from(heights).sort().join(', ')}px`);

      if (heights.size === 1) {
        console.log('✓ All buttons have consistent height');
      } else {
        console.log('✗ Buttons have inconsistent heights');
        heights.forEach(h => {
          const count = allButtons.filter(btn => btn.height === h).length;
          console.log(`  ${h}px: ${count} button(s)`);
        });
      }

      // Check for rectangular buttons (very wide buttons)
      const rectangularButtons = allButtons.filter(btn => btn.width / btn.height > 3);
      if (rectangularButtons.length === 0) {
        console.log('✓ No rectangular (very wide) buttons found');
      } else {
        console.log(`✗ Found ${rectangularButtons.length} rectangular buttons:`);
        rectangularButtons.forEach(btn => {
          console.log(`  "${btn.text}" (${btn.width}x${btn.height}px)`);
        });
      }
    }

    console.log('\n=== SCREENSHOT DETAILS ===');
    console.log(`Screenshot saved to: /tmp/ui-screenshots/layout-editor-button-fix-verified.png`);
    console.log('File exists:', fs.existsSync(screenshotPath));
    console.log('File size:', fs.statSync(screenshotPath).size, 'bytes');

  } catch (error) {
    console.error('Error during verification:', error);

    // Capture error state
    await page.screenshot({
      path: '/tmp/ui-screenshots/layout-editor-error.png',
      fullPage: true
    });
    console.log('Error screenshot saved');
  } finally {
    await browser.close();
  }
}

verifyLayoutEditorButtons().catch(console.error);

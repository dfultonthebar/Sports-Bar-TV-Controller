import { chromium } from 'playwright';
import fs from 'fs';

async function captureEditModal() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[INFO] Capturing DirecTV edit modal...');

    // Navigate
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click DirecTV tab
    await page.locator('button:has-text("DirecTV")').first().click();
    await page.waitForTimeout(1000);

    // Hover over first device card to reveal edit button
    const firstCard = page.locator('.relative.group').first();
    await firstCard.hover();
    await page.waitForTimeout(500);

    // Click edit button with title="Edit device"
    const editButton = page.locator('button[title="Edit device"]').first();
    console.log('[INFO] Clicking edit button...');
    await editButton.click();
    await page.waitForTimeout(1500);

    // Take full screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/directv-edit-modal-full.png',
      fullPage: false
    });
    console.log('[SUCCESS] Captured full modal at /tmp/ui-screenshots/directv-edit-modal-full.png');

    // Check if modal is visible
    const modal = page.locator('[role="dialog"]').first();
    const isVisible = await modal.isVisible().catch(() => false);

    if (!isVisible) {
      console.log('[WARNING] Dialog not found, checking for other modal containers...');
      const containers = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('div')).map(el => ({
          classes: (el as any).className,
          text: el.textContent?.substring(0, 50),
          style: (el as any).getAttribute('style')
        })).filter(el => el.text?.includes('Address') || el.text?.includes('Port'));
      });
      console.log('[INFO] Potential modal containers:', containers);
    }

    // Extract comprehensive color information
    const colorAnalysis = await page.evaluate(() => {
      const report: any = {
        timestamp: new Date().toISOString(),
        modal: {},
        fields: [],
        textElements: []
      };

      // Find modal or dialog
      const modal = document.querySelector('[role="dialog"]') ||
                    document.querySelector('[class*="modal"]') ||
                    document.querySelector('[class*="Modal"]') ||
                    document.querySelector('[class*="dialog"]');

      if (modal) {
        const cs = window.getComputedStyle(modal);
        report.modal = {
          found: true,
          backgroundColor: cs.backgroundColor,
          color: cs.color,
          className: (modal as any).className,
          padding: cs.padding,
          borderRadius: cs.borderRadius
        };

        // Get all text nodes and their colors
        const walker = document.createTreeWalker(
          modal,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        const textNodes: any[] = [];
        while (node = walker.nextNode()) {
          const text = node.textContent?.trim();
          if (text && text.length > 0 && text.length < 200) {
            const parent = node.parentElement;
            if (parent && parent.offsetHeight > 0) {
              const cs = window.getComputedStyle(parent);
              textNodes.push({
                text: text.substring(0, 100),
                color: cs.color,
                backgroundColor: cs.backgroundColor,
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                parentTag: parent.tagName,
                parentClasses: (parent as any).className
              });
            }
          }
        }

        report.textElements = textNodes;
      } else {
        // Try to find input fields anywhere
        console.log('No modal found, looking for input fields...');
      }

      // Get all input fields
      const inputs = document.querySelectorAll('input, textarea');
      inputs.forEach((input: any, idx: number) => {
        const cs = window.getComputedStyle(input);
        const fieldData: any = {
          index: idx,
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          inputColor: cs.color,
          inputBackground: cs.backgroundColor,
          inputBorder: cs.borderColor,
          fontSize: cs.fontSize
        };

        // Find associated label
        let label = document.querySelector(`label[for="${input.id}"]`);
        if (!label && input.id) {
          label = document.querySelector(`label:has(> #${input.id})`);
        }
        if (label) {
          const labelCs = window.getComputedStyle(label);
          fieldData.label = {
            text: label.textContent?.trim(),
            color: labelCs.color,
            backgroundColor: labelCs.backgroundColor
          };
        }

        // Find helper text (following elements)
        let current = input.parentElement;
        let depth = 0;
        const helpers: any[] = [];

        while (current && depth < 3) {
          const textElements = current.querySelectorAll('p, small, span, div');
          textElements.forEach((el) => {
            const text = el.textContent?.trim();
            // Skip input value
            if (text && text !== fieldData.inputColor && text.length > 3 && text.length < 200) {
              const elCs = window.getComputedStyle(el);
              helpers.push({
                text: text.substring(0, 80),
                color: elCs.color,
                backgroundColor: elCs.backgroundColor,
                fontSize: elCs.fontSize,
                tag: el.tagName,
                classes: (el as any).className
              });
            }
          });
          current = current.parentElement;
          depth++;
        }

        if (helpers.length > 0) {
          fieldData.helpers = helpers;
        }

        report.fields.push(fieldData);
      });

      return report;
    });

    console.log('[INFO] Color Analysis Results:');
    console.log(JSON.stringify(colorAnalysis, null, 2));

    // Save detailed JSON report
    fs.writeFileSync(
      '/tmp/ui-screenshots/directv-color-analysis.json',
      JSON.stringify(colorAnalysis, null, 2)
    );
    console.log('[SUCCESS] Saved analysis to /tmp/ui-screenshots/directv-color-analysis.json');

    // Create readable text report
    const report: string[] = [];
    report.push('=====================================');
    report.push('  DirecTV Edit Modal Color Analysis');
    report.push('=====================================\n');

    if (colorAnalysis.modal.found) {
      report.push('MODAL BACKGROUND:');
      report.push(`  Background Color: ${colorAnalysis.modal.backgroundColor}`);
      report.push(`  Text Color: ${colorAnalysis.modal.color}`);
      report.push(`  Classes: ${colorAnalysis.modal.className}\n`);
    }

    if (colorAnalysis.fields.length > 0) {
      report.push('INPUT FIELDS AND HELPER TEXT:\n');
      colorAnalysis.fields.forEach((field: any, idx: number) => {
        report.push(`Field ${idx + 1}: ${field.name || field.type}`);
        if (field.label) {
          report.push(`  Label: "${field.label.text}"`);
          report.push(`    Color: ${field.label.color}`);
        }
        report.push(`  Input Color: ${field.inputColor}`);
        report.push(`  Input Background: ${field.inputBackground}`);

        if (field.helpers && field.helpers.length > 0) {
          report.push(`  Helper Text (${field.helpers.length} found):`);
          field.helpers.forEach((helper: any, hidx: number) => {
            report.push(`    ${hidx + 1}. "${helper.text}"`);
            report.push(`       Color: ${helper.color}`);
            report.push(`       Background: ${helper.backgroundColor}`);
            report.push(`       Classes: ${helper.classes}`);
          });
        }
        report.push('');
      });
    }

    if (colorAnalysis.textElements.length > 0) {
      report.push('\nALL TEXT ELEMENTS IN MODAL (first 30):\n');
      colorAnalysis.textElements.slice(0, 30).forEach((el: any, idx: number) => {
        report.push(`${idx + 1}. "${el.text}"`);
        report.push(`   Color: ${el.color}`);
        report.push(`   Background: ${el.backgroundColor}`);
        report.push(`   Parent: ${el.parentTag} (${el.parentClasses})`);
      });
    }

    const reportText = report.join('\n');
    fs.writeFileSync(
      '/tmp/ui-screenshots/directv-color-report.txt',
      reportText
    );
    console.log('[SUCCESS] Saved text report to /tmp/ui-screenshots/directv-color-report.txt');
    console.log('\n' + reportText);

    // Capture input field area closeup
    const inputFields = page.locator('input');
    const inputCount = await inputFields.count();

    if (inputCount > 0) {
      console.log(`[INFO] Found ${inputCount} input fields, capturing closeup...`);

      // Get bounding box of first input
      const firstInput = inputFields.first();
      const inputBox = await firstInput.boundingBox();

      if (inputBox) {
        // Expand box to capture label and helper text
        const expandedBox = {
          x: Math.max(0, inputBox.x - 100),
          y: Math.max(0, inputBox.y - 80),
          width: Math.min(inputBox.width + 200, 1200),
          height: Math.min(inputBox.height + 120, 400)
        };

        await page.screenshot({
          path: '/tmp/ui-screenshots/directv-edit-modal-helper-text-closeup.png',
          clip: expandedBox
        });
        console.log('[SUCCESS] Captured helper text closeup at /tmp/ui-screenshots/directv-edit-modal-helper-text-closeup.png');
      }
    }

    // Get CSS from stylesheet
    const cssInfo = await page.evaluate(() => {
      const info: any = {
        stylesheets: [],
        computedStyles: {}
      };

      // Check stylesheets
      const sheets = document.styleSheets;
      for (let i = 0; i < sheets.length; i++) {
        try {
          const rules = sheets[i].cssRules;
          for (let j = 0; j < rules.length; j++) {
            const rule = rules[j];
            if ((rule as any).selectorText?.includes('text-gray') ||
                (rule as any).selectorText?.includes('helper') ||
                (rule as any).selectorText?.includes('description')) {
              info.stylesheets.push({
                selector: (rule as any).selectorText,
                style: (rule as any).style.cssText
              });
            }
          }
        } catch (e) {
          // Cross-origin stylesheets can't be accessed
        }
      }

      return info;
    });

    console.log('[INFO] CSS Info:', JSON.stringify(cssInfo, null, 2));

  } catch (error) {
    console.error('[ERROR] Script failed:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-screenshot.png',
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('[INFO] Capture complete');
  }
}

captureEditModal().catch(console.error);

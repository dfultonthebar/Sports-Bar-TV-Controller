import { chromium } from 'playwright';
import fs from 'fs';

async function captureDirectVEditModal() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[INFO] Starting DirecTV edit modal capture...');

    // Navigate to device config
    console.log('[INFO] Navigating to device config page');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click on DirecTV tab
    console.log('[INFO] Clicking DirecTV tab...');
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    await directvTab.click();
    await page.waitForTimeout(1000);

    // Now look for the device card container (the one with the blue border in the screenshot)
    console.log('[INFO] Looking for DirecTV device card...');
    const deviceCards = page.locator('div[class*="border"], [class*="card"]');
    const cardCount = await deviceCards.count();
    console.log(`[INFO] Found ${cardCount} potential card elements`);

    // Click on Direct TV 1 card specifically
    console.log('[INFO] Clicking on Direct TV 1 card...');
    const directTV1 = page.locator('text=Direct TV 1').first();
    await directTV1.click();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-after-card-click.png',
      fullPage: false
    });
    console.log('[SUCCESS] Captured after card click');

    // Look for edit button or modal - try clicking on the card area itself
    console.log('[INFO] Looking for edit controls...');

    // Try to find and click an edit icon on the card
    const cardContainer = page.locator('div:has-text("Direct TV 1")').first();
    const parentBox = await cardContainer.boundingBox();

    if (parentBox) {
      console.log(`[INFO] Card found at position: x=${parentBox.x}, y=${parentBox.y}, w=${parentBox.width}, h=${parentBox.height}`);

      // Look for buttons within or near the card
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      console.log(`[INFO] Scanning ${buttonCount} buttons for edit functionality...`);

      for (let i = 0; i < buttonCount; i++) {
        const btn = buttons.nth(i);
        const box = await btn.boundingBox();

        if (box && Math.abs(box.x - parentBox.x) < 500 && Math.abs(box.y - parentBox.y) < 500) {
          const ariaLabel = await btn.getAttribute('aria-label');
          const text = await btn.textContent();

          if (text?.includes('edit') || text?.includes('Edit') || ariaLabel?.includes('edit')) {
            console.log(`[INFO] Found edit button: "${text}" (aria-label="${ariaLabel}")`);
            console.log(`[INFO] Clicking button at index ${i}`);
            await btn.click();
            await page.waitForTimeout(1500);

            await page.screenshot({
              path: '/tmp/ui-screenshots/02-after-edit-click.png',
              fullPage: false
            });
            console.log('[SUCCESS] Captured after edit click');
            break;
          }
        }
      }
    }

    // Check for modal
    const modal = page.locator('[role="dialog"], .modal').first();
    const modalVisible = await modal.isVisible().catch(() => false);

    if (modalVisible) {
      console.log('[INFO] Modal found!');

      // Full screenshot
      await page.screenshot({
        path: '/tmp/ui-screenshots/03-directv-edit-modal-full.png',
        fullPage: false
      });
      console.log('[SUCCESS] Captured full modal');

      // Get detailed color analysis
      const colors = await page.evaluate(() => {
        const analysis: any = {
          modal: {},
          inputs: [],
          helpers: [],
          allTextElements: []
        };

        // Modal background
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const cs = window.getComputedStyle(modal);
          analysis.modal = {
            backgroundColor: cs.backgroundColor,
            color: cs.color,
            className: (modal as any).className,
            style: (modal as any).getAttribute('style'),
            padding: cs.padding,
            margin: cs.margin
          };

          // Get all visible text
          const walker = document.createTreeWalker(
            modal,
            NodeFilter.SHOW_TEXT,
            null
          );

          let node;
          const textNodes: any[] = [];
          while (node = walker.nextNode()) {
            const text = node.textContent?.trim();
            if (text && text.length > 0 && text.length < 150) {
              const parent = node.parentElement;
              if (parent) {
                const cs = window.getComputedStyle(parent);
                textNodes.push({
                  text: text.substring(0, 100),
                  color: cs.color,
                  backgroundColor: cs.backgroundColor,
                  fontSize: cs.fontSize,
                  fontWeight: cs.fontWeight,
                  tag: parent.tagName,
                  classes: (parent as any).className,
                  computed: {
                    rgb: cs.color,
                    bg_rgb: cs.backgroundColor
                  }
                });
              }
            }
          }

          analysis.allTextElements = textNodes.slice(0, 50);
        }

        // Input fields and their labels/helpers
        const inputs = document.querySelectorAll('input, textarea');
        inputs.forEach((input: any) => {
          const cs = window.getComputedStyle(input);
          const fieldInfo: any = {
            type: input.type,
            name: input.name,
            placeholder: input.placeholder,
            value: input.value?.substring(0, 50),
            inputColor: cs.color,
            inputBackground: cs.backgroundColor,
            fontSize: cs.fontSize,
            helpers: []
          };

          // Find label
          let label = document.querySelector(`label[for="${input.id}"]`);
          if (label) {
            const labelCs = window.getComputedStyle(label);
            fieldInfo.label = {
              text: label.textContent?.trim(),
              color: labelCs.color,
              backgroundColor: labelCs.backgroundColor
            };
          }

          // Find next elements (helper text)
          let next = input.nextElementSibling;
          let helperCount = 0;
          while (next && helperCount < 3) {
            const nextText = next.textContent?.trim();
            if (nextText && nextText.length > 0 && nextText.length < 200) {
              const nextCs = window.getComputedStyle(next);
              fieldInfo.helpers.push({
                text: nextText.substring(0, 100),
                color: nextCs.color,
                backgroundColor: nextCs.backgroundColor,
                fontSize: nextCs.fontSize,
                tag: next.tagName,
                classes: (next as any).className
              });
            }
            next = next.nextElementSibling;
            helperCount++;
          }

          analysis.inputs.push(fieldInfo);
        });

        // Find helper text elements specifically
        const helpers = document.querySelectorAll('[class*="helper"], [class*="description"], .text-sm, [class*="text-gray"]');
        helpers.forEach((helper: any) => {
          const text = helper.textContent?.trim();
          if (text && text.length > 5 && text.length < 150) {
            const cs = window.getComputedStyle(helper);
            analysis.helpers.push({
              text: text.substring(0, 100),
              color: cs.color,
              backgroundColor: cs.backgroundColor,
              fontSize: cs.fontSize,
              classes: helper.className,
              tag: helper.tagName
            });
          }
        });

        return analysis;
      });

      console.log('[INFO] Color Analysis Results:');
      console.log(JSON.stringify(colors, null, 2));

      // Save analysis
      fs.writeFileSync(
        '/tmp/ui-screenshots/directv-modal-color-analysis.json',
        JSON.stringify(colors, null, 2)
      );
      console.log('[SUCCESS] Saved analysis');

      // Generate readable color report
      const report: string[] = [];
      report.push('=== DirecTV Edit Modal Color Analysis ===\n');

      report.push('MODAL BACKGROUND:');
      report.push(`  backgroundColor: ${colors.modal.backgroundColor}`);
      report.push(`  color: ${colors.modal.color}`);
      report.push(`  className: ${colors.modal.className}`);
      report.push('');

      if (colors.inputs.length > 0) {
        report.push('INPUT FIELDS:');
        colors.inputs.forEach((input: any, idx: number) => {
          report.push(`  Input ${idx}: ${input.name || input.type}`);
          report.push(`    Color: ${input.inputColor}`);
          report.push(`    Background: ${input.inputBackground}`);
          if (input.label) {
            report.push(`    Label Color: ${input.label.color}`);
          }
          if (input.helpers.length > 0) {
            input.helpers.forEach((h: any, hidx: number) => {
              report.push(`    Helper ${hidx}: "${h.text.substring(0, 40)}..."`);
              report.push(`      Color: ${h.color}`);
              report.push(`      Background: ${h.backgroundColor}`);
            });
          }
        });
        report.push('');
      }

      if (colors.helpers.length > 0) {
        report.push('HELPER TEXT ELEMENTS:');
        colors.helpers.forEach((h: any, idx: number) => {
          report.push(`  Helper ${idx}: "${h.text.substring(0, 50)}..."`);
          report.push(`    Color: ${h.color}`);
          report.push(`    Background: ${h.backgroundColor}`);
          report.push(`    Classes: ${h.classes}`);
        });
        report.push('');
      }

      report.push('ALL TEXT ELEMENTS (first 20):');
      colors.allTextElements.slice(0, 20).forEach((el: any, idx: number) => {
        report.push(`  ${idx}: "${el.text}"`);
        report.push(`     Color: ${el.color}`);
        report.push(`     Background: ${el.backgroundColor}`);
      });

      const reportText = report.join('\n');
      fs.writeFileSync(
        '/tmp/ui-screenshots/directv-modal-color-report.txt',
        reportText
      );
      console.log('[SUCCESS] Saved text report');
      console.log(reportText);

      // Capture closeup of input areas
      const inputElements = page.locator('input');
      const inputCount = await inputElements.count();

      if (inputCount > 0) {
        // Capture area around first input
        const firstInput = inputElements.first();
        const box = await firstInput.boundingBox();

        if (box) {
          // Get parent container to capture the whole field
          const container = await firstInput.evaluate((el) => {
            let parent = el.parentElement;
            while (parent && !parent.classList.toString().includes('field')) {
              parent = parent.parentElement;
            }
            return parent || el.parentElement;
          });

          const containerBox = await container?.boundingBox();

          const captureBox = containerBox || box;

          await page.screenshot({
            path: '/tmp/ui-screenshots/04-input-field-closeup.png',
            clip: {
              x: Math.max(0, captureBox.x - 30),
              y: Math.max(0, captureBox.y - 20),
              width: Math.min(captureBox.width + 60, 1000),
              height: Math.min(captureBox.height + 40, 500)
            }
          });
          console.log('[SUCCESS] Captured input field closeup');
        }
      }

      // Capture modal with padding
      const modalBox = await modal.boundingBox();
      if (modalBox) {
        await page.screenshot({
          path: '/tmp/ui-screenshots/05-modal-only.png',
          clip: {
            x: Math.max(0, modalBox.x - 15),
            y: Math.max(0, modalBox.y - 15),
            width: Math.min(modalBox.width + 30, 1900),
            height: Math.min(modalBox.height + 30, 1070)
          }
        });
        console.log('[SUCCESS] Captured modal only view');
      }

    } else {
      console.log('[WARNING] Modal not found. Current page content:');
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log(pageText.substring(0, 1000));

      await page.screenshot({
        path: '/tmp/ui-screenshots/02-no-modal-found.png',
        fullPage: true
      });
    }

  } catch (error) {
    console.error('[ERROR] Script failed:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('[INFO] Complete');
  }
}

captureDirectVEditModal().catch(console.error);

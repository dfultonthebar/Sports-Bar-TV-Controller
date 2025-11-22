import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const BASE_URL = 'http://localhost:3001';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureSystemAdminHub() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[SYSTEM-ADMIN] Navigating to System Admin Hub...');
    await page.goto(`${BASE_URL}/system-admin`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('[SYSTEM-ADMIN] Page loaded, waiting for dynamic content...');
    // Wait for the real-time monitoring section to render
    await page.waitForSelector('[data-testid="system-resources"], .system-resources, [class*="resource"]', {
      timeout: 10000
    }).catch(() => {
      console.log('[SYSTEM-ADMIN] Specific selectors not found, waiting for general load...');
    });

    // Additional wait for any animations or dynamic content
    await page.waitForTimeout(2000);

    // Take full page screenshot
    const fullPagePath = path.join(SCREENSHOT_DIR, '01-system-admin-full-page.png');
    console.log(`[SYSTEM-ADMIN] Capturing full page screenshot to ${fullPagePath}`);
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });

    // Get page dimensions for focused capture
    const bodyHandle = await page.$('body');
    const boundingBox = await bodyHandle?.boundingBox();

    console.log(`[SYSTEM-ADMIN] Page dimensions: ${boundingBox?.width || 'unknown'} x ${boundingBox?.height || 'unknown'}`);

    // Try to locate and capture the monitoring section
    console.log('[SYSTEM-ADMIN] Looking for Real-time System Resource Monitoring section...');

    // Try different selectors for the monitoring section
    const monitoringSectionSelectors = [
      'text=Real-time System Resource Monitoring',
      'text=System Resource Monitoring',
      'text=System Resources',
      '[data-testid="system-resources"]',
      '[class*="monitoring"]',
      '[class*="resources"]',
      'h2:has-text("Real-time")',
      'section:has-text("Monitoring")'
    ];

    let monitoringSection = null;
    for (const selector of monitoringSectionSelectors) {
      try {
        monitoringSection = await page.locator(selector).first();
        const isVisible = await monitoringSection.isVisible().catch(() => false);
        if (isVisible) {
          console.log(`[SYSTEM-ADMIN] Found monitoring section with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    // If we found the section, capture a focused screenshot
    if (monitoringSection) {
      try {
        const sectionBox = await monitoringSection.boundingBox();
        if (sectionBox) {
          console.log(`[SYSTEM-ADMIN] Section bounding box: ${JSON.stringify(sectionBox)}`);

          // Expand the crop area to get surrounding context
          const crop = {
            x: Math.max(0, sectionBox.x - 20),
            y: Math.max(0, sectionBox.y - 20),
            width: sectionBox.width + 40,
            height: Math.min(sectionBox.height + 40, 1080 - (sectionBox.y - 20))
          };

          const focusedPath = path.join(SCREENSHOT_DIR, '02-system-admin-monitoring-section.png');
          console.log(`[SYSTEM-ADMIN] Capturing focused monitoring section to ${focusedPath}`);
          await page.screenshot({
            path: focusedPath,
            clip: crop
          });
        }
      } catch (error) {
        console.warn('[SYSTEM-ADMIN] Could not capture focused section:', error);
      }
    }

    // Get the HTML content to analyze text colors
    console.log('[SYSTEM-ADMIN] Analyzing page content...');
    const pageContent = await page.content();

    // Look for gray text and contrast issues
    console.log('[SYSTEM-ADMIN] Examining page for contrast issues...');

    // Extract text content with styling information
    const contrastAnalysis = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const contrastIssues: any[] = [];

      elements.forEach((el) => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const backgroundColor = style.backgroundColor;
        const text = el.textContent?.trim();

        // Check for light gray text (rgb(128, 128, 128) and similar)
        // Gray is when R, G, B values are similar and relatively dark but light
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch && text && text.length > 3) {
          const [, r, g, b] = rgbMatch.map(Number);

          // Check for grayscale colors in the 100-150 range (medium-light gray)
          const isGray = Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
          const isLightGray = r > 100 && r < 180;

          // Check for white or light backgrounds
          const bgRgbMatch = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (bgRgbMatch && isGray && isLightGray) {
            const [, bgr, bgg, bgb] = bgRgbMatch.map(Number);
            const isLightBg = bgr > 240 && bgg > 240 && bgb > 240;

            if (isLightBg) {
              contrastIssues.push({
                text: text.substring(0, 50),
                color: color,
                backgroundColor: backgroundColor,
                tagName: el.tagName,
                className: el.className,
                element: el.id || `${el.tagName}.${el.className}`.substring(0, 50)
              });
            }
          }
        }
      });

      return contrastIssues;
    });

    console.log('[SYSTEM-ADMIN] Contrast analysis results:');
    console.log(JSON.stringify(contrastAnalysis, null, 2));

    console.log('[SYSTEM-ADMIN] Capture complete!');
    console.log(`[SYSTEM-ADMIN] Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error: any) {
    console.error('[SYSTEM-ADMIN] Error during capture:', error.message);

    // Capture error state screenshot
    const errorPath = path.join(SCREENSHOT_DIR, 'error-system-admin.png');
    try {
      await page.screenshot({
        path: errorPath,
        fullPage: true
      });
      console.log(`[SYSTEM-ADMIN] Error screenshot saved to: ${errorPath}`);
    } catch (screenshotError) {
      console.error('[SYSTEM-ADMIN] Could not capture error screenshot:', screenshotError);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

captureSystemAdminHub().catch(console.error);

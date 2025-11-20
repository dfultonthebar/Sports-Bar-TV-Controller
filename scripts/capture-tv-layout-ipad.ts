import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots/tv-layout-ipad';

interface ViewportConfig {
  width: number;
  height: number;
  name: string;
  description: string;
}

const viewports: ViewportConfig[] = [
  { width: 2360, height: 1640, name: 'ipad-landscape', description: 'iPad Landscape (2360x1640)' },
  { width: 1640, height: 2360, name: 'ipad-portrait', description: 'iPad Portrait (1640x2360)' }
];

async function captureLayoutAndMeasure() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Create screenshot directory
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    for (const viewport of viewports) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Capturing TV Layout - ${viewport.description}`);
      console.log(`${'='.repeat(80)}\n`);

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height }
      });

      const page = await context.newPage();

      // Navigate to remote page
      console.log(`Navigating to http://localhost:3001/remote...`);
      await page.goto('http://localhost:3001/remote', { waitUntil: 'networkidle' });

      // Wait for page to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for animations

      // Click on Video tab
      console.log(`Clicking on Video tab...`);
      const videoTab = page.locator('button').filter({ hasText: /^Video$/i });

      if (await videoTab.count() > 0) {
        await videoTab.click();
        await page.waitForTimeout(500); // Wait for tab transition
      } else {
        console.log('Warning: Video tab not found, may already be selected');
      }

      // Wait for layout to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);

      // Take full page screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, `01-${viewport.name}-full-layout.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      console.log(`✓ Full page screenshot: ${screenshotPath}`);

      // Measure layout container
      console.log(`\nMeasuring layout container dimensions...`);
      const layoutMeasurements = await page.evaluate(() => {
        // Try multiple selectors for the layout container
        const selectors = [
          '[class*="layout"]',
          '[class*="video"]',
          '[class*="grid"]',
          '.tvLayout',
          '.video-layout',
          '.grid-layout',
          '[data-testid*="layout"]'
        ];

        let layoutContainer = null;
        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element) {
            layoutContainer = element;
            break;
          }
        }

        if (!layoutContainer) {
          // Fallback: find the main content area
          layoutContainer = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        }

        const rect = layoutContainer.getBoundingClientRect();

        // Get computed styles
        const styles = window.getComputedStyle(layoutContainer);

        return {
          element: {
            tagName: layoutContainer.tagName,
            className: layoutContainer.className,
            id: layoutContainer.id
          },
          dimensions: {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right
          },
          styles: {
            display: styles.display,
            position: styles.position,
            gridTemplateColumns: styles.gridTemplateColumns,
            gridTemplateRows: styles.gridTemplateRows,
            gap: styles.gap,
            padding: styles.padding,
            margin: styles.margin,
            overflow: styles.overflow
          }
        };
      });

      console.log(`\nLayout Container Measurements:`);
      console.log(`  Dimensions: ${layoutMeasurements.dimensions.width.toFixed(1)}px x ${layoutMeasurements.dimensions.height.toFixed(1)}px`);
      console.log(`  Position: top=${layoutMeasurements.dimensions.top.toFixed(1)}px, left=${layoutMeasurements.dimensions.left.toFixed(1)}px`);
      console.log(`  Element: <${layoutMeasurements.element.tagName}> class="${layoutMeasurements.element.className}"`);
      console.log(`  CSS Display: ${layoutMeasurements.styles.display}`);
      console.log(`  CSS Position: ${layoutMeasurements.styles.position}`);
      if (layoutMeasurements.styles.gridTemplateColumns) {
        console.log(`  Grid Columns: ${layoutMeasurements.styles.gridTemplateColumns}`);
      }
      if (layoutMeasurements.styles.gridTemplateRows) {
        console.log(`  Grid Rows: ${layoutMeasurements.styles.gridTemplateRows}`);
      }
      if (layoutMeasurements.styles.gap) {
        console.log(`  Gap: ${layoutMeasurements.styles.gap}`);
      }

      // Find and measure all TV zones
      console.log(`\nScanning for TV zones...`);
      const tvZones = await page.evaluate(() => {
        // Try multiple selectors
        const selectors = [
          '[class*="zone"]',
          '[class*="tv"]',
          '[data-testid*="zone"]',
          '[data-testid*="tv"]',
          '.zone',
          '.tv-zone'
        ];

        let zones = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            zones = Array.from(elements);
            break;
          }
        }

        // If still no zones found, try finding divs with specific content patterns
        if (zones.length === 0) {
          zones = Array.from(document.querySelectorAll('div[class*="grid"], div[class*="flex"]')).filter(el => {
            const text = el.textContent || '';
            return text.includes('Zone') || text.includes('TV') || text.includes('Screen');
          });
        }

        return zones.map((zone, index) => {
          const rect = zone.getBoundingClientRect();
          const styles = window.getComputedStyle(zone);

          // Check for overlaps with other zones
          const overlappingZones = zones.filter((otherZone, otherIndex) => {
            if (index === otherIndex) return false;
            const otherRect = otherZone.getBoundingClientRect();

            return !(rect.right < otherRect.left ||
                     rect.left > otherRect.right ||
                     rect.bottom < otherRect.top ||
                     rect.top > otherRect.bottom);
          });

          return {
            index,
            element: {
              tagName: zone.tagName,
              className: zone.className,
              id: zone.id,
              textContent: (zone.textContent || '').substring(0, 50)
            },
            dimensions: {
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left,
              bottom: rect.bottom,
              right: rect.right
            },
            styles: {
              display: styles.display,
              position: styles.position,
              gridColumn: styles.gridColumn,
              gridRow: styles.gridRow,
              width: styles.width,
              height: styles.height
            },
            overlappingZonesCount: overlappingZones.length,
            overlappingWithIndexes: overlappingZones.map((_, idx) => zones.indexOf(_))
          };
        });
      });

      console.log(`Found ${tvZones.length} zones\n`);

      if (tvZones.length > 0) {
        tvZones.forEach((zone, index) => {
          console.log(`Zone ${zone.index}:`);
          console.log(`  Element: <${zone.element.tagName}> class="${zone.element.className}"`);
          console.log(`  Content: "${zone.element.textContent}"`);
          console.log(`  Dimensions: ${zone.dimensions.width.toFixed(1)}px x ${zone.dimensions.height.toFixed(1)}px`);
          console.log(`  Position: top=${zone.dimensions.top.toFixed(1)}px, left=${zone.dimensions.left.toFixed(1)}px`);
          console.log(`  CSS Grid Position: col=${zone.styles.gridColumn}, row=${zone.styles.gridRow}`);
          console.log(`  CSS Display: ${zone.styles.display}`);

          if (zone.overlappingZonesCount > 0) {
            console.log(`  WARNING: Overlaps with ${zone.overlappingZonesCount} other zone(s): indexes ${zone.overlappingWithIndexes.join(', ')}`);
          }
          console.log();
        });

        // Check for any overlaps
        const overlappingZones = tvZones.filter(z => z.overlappingZonesCount > 0);
        if (overlappingZones.length > 0) {
          console.log(`ALERT: ${overlappingZones.length} zone(s) are overlapping!\n`);
        }

        // Capture zoomed screenshots of overlapping areas if any
        if (overlappingZones.length > 0) {
          for (const zone of overlappingZones) {
            const screenshotPath = path.join(
              SCREENSHOT_DIR,
              `02-${viewport.name}-overlap-zone-${zone.index}.png`
            );

            // Scroll to zone and take screenshot
            await page.evaluate((index) => {
              const zones = document.querySelectorAll('[class*="zone"], [class*="tv"], .zone, .tv-zone');
              if (zones[index]) {
                zones[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, zone.index);

            await page.waitForTimeout(300);
            await page.screenshot({
              path: screenshotPath,
              fullPage: false
            });
            console.log(`✓ Overlap screenshot: ${screenshotPath}`);
          }
        }
      } else {
        console.log('No TV zones found with current selectors');
      }

      // Try to find layout configuration page
      console.log(`\nSearching for layout configuration options...`);
      const configLink = page.locator('a, button').filter({ hasText: /config|layout|setup|settings/i }).first();

      if (await configLink.count() > 0) {
        const href = await configLink.getAttribute('href');
        const ariaLabel = await configLink.getAttribute('aria-label');
        console.log(`Found config link: ${href || ariaLabel}`);
      } else {
        console.log('No direct config link found');
      }

      // Check if there's a layout editor modal or similar
      const editButtons = page.locator('button').filter({ hasText: /edit|configure|layout/i });
      const editCount = await editButtons.count();
      if (editCount > 0) {
        console.log(`Found ${editCount} edit/configure button(s)`);
      }

      // Save measurements to file
      const measurementsFile = path.join(SCREENSHOT_DIR, `measurements-${viewport.name}.json`);
      fs.writeFileSync(measurementsFile, JSON.stringify({
        viewport,
        capturedAt: new Date().toISOString(),
        layoutContainer: layoutMeasurements,
        tvZones,
        summary: {
          totalZones: tvZones.length,
          overlappingZones: tvZones.filter(z => z.overlappingZonesCount > 0).length,
          layoutDimensions: `${layoutMeasurements.dimensions.width.toFixed(0)}x${layoutMeasurements.dimensions.height.toFixed(0)}`
        }
      }, null, 2));
      console.log(`\n✓ Measurements saved: ${measurementsFile}`);

      await context.close();
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`All screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`${'='.repeat(80)}\n`);

  } finally {
    await browser.close();
  }
}

// Run the capture
captureLayoutAndMeasure().catch(console.error);

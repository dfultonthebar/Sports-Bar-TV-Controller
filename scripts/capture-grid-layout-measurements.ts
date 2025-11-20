import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots/tv-layout-ipad';

async function captureGridLayoutMeasurements() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // Test both iPad orientations
    const viewports = [
      { width: 2360, height: 1640, name: 'landscape', label: 'iPad Landscape (2360x1640)' },
      { width: 1640, height: 2360, name: 'portrait', label: 'iPad Portrait (1640x2360)' }
    ];

    for (const viewport of viewports) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Capturing Grid Layout - ${viewport.label}`);
      console.log(`${'='.repeat(80)}\n`);

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height }
      });

      const page = await context.newPage();

      // Navigate to remote page
      await page.goto('http://localhost:3001/remote', { waitUntil: 'networkidle' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Click on Video tab
      const videoTab = page.locator('button').filter({ hasText: /^Video$/i });
      if (await videoTab.count() > 0) {
        await videoTab.click();
        await page.waitForTimeout(500);
      }

      // Make sure we're on grid view (not image view)
      const gridViewButton = page.locator('button').filter({ hasText: /Grid View/i });
      if (await gridViewButton.count() > 0) {
        await gridViewButton.click();
        await page.waitForTimeout(500);
      }

      // Take full screenshot
      const fullScreenPath = path.join(SCREENSHOT_DIR, `grid-layout-${viewport.name}-full.png`);
      await page.screenshot({
        path: fullScreenPath,
        fullPage: true
      });
      console.log(`✓ Full grid screenshot: ${fullScreenPath}`);

      // Get detailed measurements of grid container and TV buttons
      const gridMeasurements = await page.evaluate(() => {
        const gridContainer = document.querySelector('[style*="grid-cols"]') || document.querySelector('.grid');

        if (!gridContainer) {
          return {
            error: 'Grid container not found',
            attempted_selectors: ['[style*="grid-cols"]', '.grid']
          };
        }

        const gridRect = gridContainer.getBoundingClientRect();
        const gridStyles = window.getComputedStyle(gridContainer);

        // Get all TV button divs (they have gridColumn and gridRow styles)
        const tvButtons = Array.from(gridContainer.querySelectorAll('[style*="gridColumn"]')).map((el, index) => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);
          const child = el.querySelector('button, [role="button"]') || el.querySelector('div');

          return {
            index,
            gridColumn: el.getAttribute('style').match(/gridColumn:\s*([^;]+)/)?.[1] || 'unknown',
            gridRow: el.getAttribute('style').match(/gridRow:\s*([^;]+)/)?.[1] || 'unknown',
            dimensions: {
              width: rect.width,
              height: rect.height,
              top: rect.top,
              left: rect.left,
              bottom: rect.bottom,
              right: rect.right
            },
            childCount: el.children.length,
            childTag: child?.tagName
          };
        });

        // Check for overlaps
        const overlaps = [];
        for (let i = 0; i < tvButtons.length; i++) {
          for (let j = i + 1; j < tvButtons.length; j++) {
            const a = tvButtons[i];
            const b = tvButtons[j];

            // Check if rectangles overlap
            if (!(a.dimensions.right < b.dimensions.left ||
                  a.dimensions.left > b.dimensions.right ||
                  a.dimensions.bottom < b.dimensions.top ||
                  a.dimensions.top > b.dimensions.bottom)) {
              overlaps.push({
                tv1: i,
                tv2: j,
                overlapWidth: Math.min(a.dimensions.right, b.dimensions.right) - Math.max(a.dimensions.left, b.dimensions.left),
                overlapHeight: Math.min(a.dimensions.bottom, b.dimensions.bottom) - Math.max(a.dimensions.top, b.dimensions.top)
              });
            }
          }
        }

        return {
          gridContainer: {
            dimensions: {
              width: gridRect.width,
              height: gridRect.height,
              top: gridRect.top,
              left: gridRect.left
            },
            styles: {
              display: gridStyles.display,
              gridTemplateColumns: gridStyles.gridTemplateColumns,
              gridTemplateRows: gridStyles.gridTemplateRows,
              gap: gridStyles.gap,
              padding: gridStyles.padding,
              minHeight: gridStyles.minHeight
            }
          },
          tvButtons: tvButtons,
          totalTVs: tvButtons.length,
          overlaps: overlaps,
          overlapCount: overlaps.length,
          stats: {
            avgTVWidth: tvButtons.reduce((sum, tv) => sum + tv.dimensions.width, 0) / tvButtons.length,
            avgTVHeight: tvButtons.reduce((sum, tv) => sum + tv.dimensions.height, 0) / tvButtons.length,
            minTVWidth: Math.min(...tvButtons.map(tv => tv.dimensions.width)),
            maxTVWidth: Math.max(...tvButtons.map(tv => tv.dimensions.width)),
            minTVHeight: Math.min(...tvButtons.map(tv => tv.dimensions.height)),
            maxTVHeight: Math.max(...tvButtons.map(tv => tv.dimensions.height))
          }
        };
      });

      console.log(`\nGrid Container Measurements:`);
      if (gridMeasurements.error) {
        console.log(`ERROR: ${gridMeasurements.error}`);
        console.log(`Attempted selectors: ${JSON.stringify(gridMeasurements.attempted_selectors)}`);
      } else {
        const container = gridMeasurements.gridContainer;
        console.log(`  Dimensions: ${container.dimensions.width.toFixed(1)}px × ${container.dimensions.height.toFixed(1)}px`);
        console.log(`  Position: top=${container.dimensions.top.toFixed(1)}px, left=${container.dimensions.left.toFixed(1)}px`);
        console.log(`  Display: ${container.styles.display}`);
        console.log(`  Grid Template: ${container.styles.gridTemplateColumns}`);
        console.log(`  Minimum Height: ${container.styles.minHeight}`);
        console.log(`  Gap: ${container.styles.gap}`);
        console.log(`  Padding: ${container.styles.padding}`);

        console.log(`\nTV Button Statistics:`);
        console.log(`  Total TVs: ${gridMeasurements.totalTVs}`);
        console.log(`  Average Size: ${gridMeasurements.stats.avgTVWidth.toFixed(0)}px × ${gridMeasurements.stats.avgTVHeight.toFixed(0)}px`);
        console.log(`  Width Range: ${gridMeasurements.stats.minTVWidth.toFixed(0)}px - ${gridMeasurements.stats.maxTVWidth.toFixed(0)}px`);
        console.log(`  Height Range: ${gridMeasurements.stats.minTVHeight.toFixed(0)}px - ${gridMeasurements.stats.maxTVHeight.toFixed(0)}px`);

        if (gridMeasurements.overlapCount > 0) {
          console.log(`\nWARNING: ${gridMeasurements.overlapCount} OVERLAPPING TV ZONES DETECTED!`);
          gridMeasurements.overlaps.forEach(overlap => {
            const tv1 = gridMeasurements.tvButtons[overlap.tv1];
            const tv2 = gridMeasurements.tvButtons[overlap.tv2];
            console.log(`  - TV${overlap.tv1} (${tv1.gridColumn}, ${tv1.gridRow}) overlaps with TV${overlap.tv2} (${tv2.gridColumn}, ${tv2.gridRow})`);
            console.log(`    Overlap area: ${overlap.overlapWidth.toFixed(0)}px × ${overlap.overlapHeight.toFixed(0)}px`);
          });
        } else {
          console.log(`\n✓ No overlapping zones detected`);
        }

        // Show sample TV measurements
        console.log(`\nSample TV Button Dimensions:`);
        const samples = [0, Math.floor(gridMeasurements.tvButtons.length / 2), gridMeasurements.tvButtons.length - 1];
        samples.forEach(idx => {
          const tv = gridMeasurements.tvButtons[idx];
          console.log(`  TV ${idx}: ${tv.dimensions.width.toFixed(0)}px × ${tv.dimensions.height.toFixed(0)}px (grid: ${tv.gridColumn}, ${tv.gridRow})`);
        });
      }

      // Save detailed measurements
      const measurementsFile = path.join(SCREENSHOT_DIR, `grid-measurements-${viewport.name}.json`);
      fs.writeFileSync(measurementsFile, JSON.stringify({
        viewport: { width: viewport.width, height: viewport.height, name: viewport.name },
        timestamp: new Date().toISOString(),
        measurements: gridMeasurements
      }, null, 2));
      console.log(`\n✓ Measurements saved: ${measurementsFile}`);

      // Capture a zoomed region of the grid if overlaps exist
      if (gridMeasurements.overlapCount > 0 && gridMeasurements.tvButtons.length > 0) {
        console.log(`\nCapturing detail of overlapping region...`);
        const firstOverlap = gridMeasurements.overlaps[0];
        const tv1 = gridMeasurements.tvButtons[firstOverlap.tv1];
        const tv2 = gridMeasurements.tvButtons[firstOverlap.tv2];

        // Calculate bounding box of overlap
        const boundingBox = {
          x: Math.max(tv1.dimensions.left, tv2.dimensions.left),
          y: Math.max(tv1.dimensions.top, tv2.dimensions.top),
          width: Math.min(tv1.dimensions.right, tv2.dimensions.right) - Math.max(tv1.dimensions.left, tv2.dimensions.left),
          height: Math.min(tv1.dimensions.bottom, tv2.dimensions.bottom) - Math.max(tv1.dimensions.top, tv2.dimensions.top)
        };

        try {
          const overlapScreenPath = path.join(SCREENSHOT_DIR, `grid-overlap-detail-${viewport.name}.png`);
          await page.screenshot({
            path: overlapScreenPath,
            clip: {
              x: Math.max(0, boundingBox.x - 50),
              y: Math.max(0, boundingBox.y - 50),
              width: boundingBox.width + 100,
              height: boundingBox.height + 100
            }
          });
          console.log(`✓ Overlap detail screenshot: ${overlapScreenPath}`);
        } catch (error) {
          console.log(`Note: Could not capture overlap detail (${error})`);
        }
      }

      await context.close();
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`All grid layout screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log(`${'='.repeat(80)}\n`);

    // Generate summary report
    const summaryFile = path.join(SCREENSHOT_DIR, 'GRID_LAYOUT_ANALYSIS.md');
    const summary = `
# TV Layout Grid Analysis Report

## iPad Resolution Testing

### Viewport Sizes Tested
- **Landscape**: 2360x1640px (iPad Pro 12.9" landscape)
- **Portrait**: 1640x2360px (iPad Pro 12.9" portrait)

### Grid Container Specifications

The TV layout uses a CSS Grid with 15 columns and 12 rows:
\`\`\`css
grid-template-columns: repeat(15, minmax(0, 1fr));
gap: 2px (0.5rem);
\`\`\`

### Key Measurements

**Grid Container (Landscape)**
- Width: 2360px (full viewport)
- Height: ~750px minimum (can grow based on content)

**Grid Container (Portrait)**
- Width: 1640px (full viewport)
- Height: ~750px minimum

### TV Button Sizing

Each TV button spans 1 grid column and 1 grid row by default:
- Column width (landscape): ~155px (2360px ÷ 15 - gap)
- Column width (portrait): ~107px (1640px ÷ 15 - gap)

### Layout Configuration

**Grid Positioning Rules**
- TVs positioned using explicit grid-column and grid-row styles
- Example: \`gridColumn: "13 / 14", gridRow: "1 / 2"\`
- This represents absolute grid placement (column 13, row 1)

**Color Coding by Area**
- EAST: Blue (top right)
- PARTY EAST: Red (left side)
- BAR: Green (central area with legend)
- DINING: Purple (right side)
- PARTY WEST: Yellow (bottom)
- PATIO: Orange (bottom left)
- WEST: Pink (bottom right)

### Responsive Behavior

**Issue Identified**
- Grid columns are fixed at 15 columns regardless of viewport width
- On iPad portrait (1640px), columns become very narrow
- This can cause TV zone overlapping or cramped layout

**Recommendation**
- Implement responsive grid: Use fewer columns on narrower viewports
- Example: 15 columns on desktop, 10 columns on tablet, 5 columns on mobile

### CSS Changes Needed

Current CSS (problematic on narrow screens):
\`\`\`css
grid-template-columns: repeat(15, minmax(0, 1fr));
\`\`\`

Recommended responsive CSS:
\`\`\`css
/* Desktop: 15 columns */
@media (min-width: 1920px) {
  grid-template-columns: repeat(15, minmax(0, 1fr));
}

/* Tablet: 10 columns */
@media (max-width: 1920px) and (min-width: 1024px) {
  grid-template-columns: repeat(10, minmax(0, 1fr));
}

/* Mobile: 5 columns */
@media (max-width: 1024px) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
\`\`\`

### Files to Modify

- **Component**: \`/src/components/TVLayoutView.tsx\`
  - Line 486: Grid template definition
  - Lines 50-96: TV_LAYOUT array with grid positions

- **Styling**: Update CSS media queries for responsive grid

### Testing Results

See associated screenshot files:
- \`grid-layout-landscape-full.png\` - Full layout at 2360x1640
- \`grid-layout-portrait-full.png\` - Full layout at 1640x2360
- \`grid-measurements-landscape.json\` - Detailed measurements
- \`grid-measurements-portrait.json\` - Portrait measurements

`;

    fs.writeFileSync(summaryFile, summary);
    console.log(`Generated summary report: ${summaryFile}`);

  } finally {
    await browser.close();
  }
}

captureGridLayoutMeasurements().catch(console.error);

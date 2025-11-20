import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function inspectDetailedGrid() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 2360, height: 1640 }
    });

    const page = await context.newPage();
    await page.goto('http://localhost:3001/remote', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const videoTab = page.locator('button').filter({ hasText: /^Video$/i });
    if (await videoTab.count() > 0) {
      await videoTab.click();
      await page.waitForTimeout(500);
    }

    // Get detailed grid structure
    const gridInfo = await page.evaluate(() => {
      // Look for the large container with many children
      const allDivs = Array.from(document.querySelectorAll('div'));

      // Find the container that's about 1200px wide and contains TV buttons
      const containerDiv = allDivs.find((div: any) => {
        const rect = div.getBoundingClientRect();
        const hasGridChild = Array.from(div.children).some((child: any) => {
          const childStyle = window.getComputedStyle(child);
          const className = typeof child.className === 'string' ? child.className : '';
          return childStyle.display === 'grid' ||
                 child.style.gridColumn ||
                 child.style.gridRow ||
                 className.includes('grid');
        });
        return rect.width > 800 && rect.height > 700 && hasGridChild;
      });

      if (!containerDiv) {
        return { error: 'Could not find container' };
      }

      const containerRect = containerDiv.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(containerDiv);

      // Find the actual grid div within
      const gridDiv = Array.from(containerDiv.children).find((child: any) => {
        const childStyle = window.getComputedStyle(child);
        const className = typeof child.className === 'string' ? child.className : '';
        return childStyle.display === 'grid' ||
               child.style.gridTemplateColumns ||
               className.includes('grid') ||
               Array.from(child.children).some((gc: any) => gc.style.gridColumn);
      });

      if (!gridDiv) {
        return { error: 'Could not find grid div within container' };
      }

      const gridRect = gridDiv.getBoundingClientRect();
      const gridStyle = window.getComputedStyle(gridDiv);

      // Get all TV button divs (they have grid positioning)
      const tvDivs = Array.from(gridDiv.children)
        .filter((child: any) => child.style.gridColumn || child.style.gridRow)
        .map((child: any, idx) => {
          const rect = child.getBoundingClientRect();
          const gridCol = child.style.gridColumn;
          const gridRow = child.style.gridRow;

          // Check if it has actual content
          const button = child.querySelector('button');
          const text = child.textContent?.substring(0, 20) || '';

          return {
            index: idx,
            gridColumn: gridCol,
            gridRow: gridRow,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            bottom: rect.bottom,
            right: rect.right,
            hasButton: !!button,
            text: text
          };
        });

      return {
        container: {
          width: containerRect.width,
          height: containerRect.height,
          className: containerDiv.className
        },
        grid: {
          width: gridRect.width,
          height: gridRect.height,
          display: gridStyle.display,
          gridTemplateColumns: gridStyle.gridTemplateColumns,
          gridTemplateRows: gridStyle.gridTemplateRows,
          gap: gridStyle.gap,
          padding: gridStyle.padding,
          minHeight: gridStyle.minHeight,
          className: gridDiv.className
        },
        tvDivs: tvDivs,
        summary: {
          totalTVs: tvDivs.length,
          avgWidth: tvDivs.reduce((sum, tv) => sum + tv.width, 0) / tvDivs.length,
          avgHeight: tvDivs.reduce((sum, tv) => sum + tv.height, 0) / tvDivs.length
        }
      };
    });

    if (gridInfo.error) {
      console.log('ERROR:', gridInfo.error);
      return;
    }

    console.log('\n=== GRID STRUCTURE ANALYSIS ===\n');
    console.log('Container:');
    console.log(`  Dimensions: ${gridInfo.container.width.toFixed(0)}px x ${gridInfo.container.height.toFixed(0)}px`);
    console.log(`  Class: ${gridInfo.container.className}`);

    console.log('\nGrid Div:');
    console.log(`  Dimensions: ${gridInfo.grid.width.toFixed(0)}px x ${gridInfo.grid.height.toFixed(0)}px`);
    console.log(`  Display: ${gridInfo.grid.display}`);
    console.log(`  Columns: ${gridInfo.grid.gridTemplateColumns}`);
    console.log(`  Rows: ${gridInfo.grid.gridTemplateRows}`);
    console.log(`  Gap: ${gridInfo.grid.gap}`);
    console.log(`  Padding: ${gridInfo.grid.padding}`);
    console.log(`  Min Height: ${gridInfo.grid.minHeight}`);
    console.log(`  Class: ${gridInfo.grid.className}`);

    console.log('\nTV Buttons:');
    console.log(`  Total: ${gridInfo.summary.totalTVs}`);
    console.log(`  Average Size: ${gridInfo.summary.avgWidth.toFixed(0)}px x ${gridInfo.summary.avgHeight.toFixed(0)}px`);

    console.log('\nFirst 10 TV Buttons:');
    gridInfo.tvDivs.slice(0, 10).forEach((tv: any) => {
      console.log(`  ${tv.index}: col=${tv.gridColumn}, row=${tv.gridRow}, size=${tv.width.toFixed(0)}x${tv.height.toFixed(0)}px, text="${tv.text}"`);
    });

    // Check for overlaps
    console.log('\nChecking for overlaps...');
    const overlaps: any[] = [];
    for (let i = 0; i < gridInfo.tvDivs.length; i++) {
      for (let j = i + 1; j < gridInfo.tvDivs.length; j++) {
        const a = gridInfo.tvDivs[i];
        const b = gridInfo.tvDivs[j];

        // Check if rectangles overlap
        if (!(a.right < b.left ||
              a.left > b.right ||
              a.bottom < b.top ||
              a.top > b.bottom)) {
          overlaps.push({
            tv1: i,
            tv2: j,
            tv1Col: a.gridColumn,
            tv2Col: b.gridColumn,
            overlap: {
              width: Math.min(a.right, b.right) - Math.max(a.left, b.left),
              height: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            }
          });
        }
      }
    }

    if (overlaps.length > 0) {
      console.log(`ALERT: ${overlaps.length} overlapping zones found!`);
      overlaps.slice(0, 5).forEach(overlap => {
        console.log(`  TV${overlap.tv1} (${overlap.tv1Col}) overlaps TV${overlap.tv2} (${overlap.tv2Col})`);
        console.log(`    by ${overlap.overlap.width.toFixed(0)}px x ${overlap.overlap.height.toFixed(0)}px`);
      });
    } else {
      console.log('No overlaps detected');
    }

    // Save detailed report
    const reportFile = '/tmp/ui-screenshots/tv-layout-ipad/detailed-grid-analysis.json';
    fs.mkdirSync('/tmp/ui-screenshots/tv-layout-ipad', { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      viewport: '2360x1640',
      gridInfo,
      overlaps
    }, null, 2));

    console.log(`\nDetailed report saved to: ${reportFile}`);

    await context.close();
  } finally {
    await browser.close();
  }
}

inspectDetailedGrid().catch(console.error);

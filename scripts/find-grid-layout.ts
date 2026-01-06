import { chromium } from 'playwright';
import fs from 'fs';

async function findGridLayout() {
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

    // Get the grid layout info
    const gridInfo = await page.evaluate(() => {
      // Find all divs with gridColumn style
      const gridCellDivs = Array.from(document.querySelectorAll('div[style*="gridColumn"]'));

      if (gridCellDivs.length === 0) {
        return { error: 'No grid cells found', gridCount: 0 };
      }

      // Get parent of first grid cell
      const firstCell = gridCellDivs[0] as HTMLElement;
      const gridParent = firstCell.parentElement as HTMLElement;

      if (!gridParent) {
        return { error: 'Grid parent not found' };
      }

      const gridRect = gridParent.getBoundingClientRect();
      const gridStyle = window.getComputedStyle(gridParent);

      // Get all TV cells with measurements
      const cells = gridCellDivs.map((div: any, idx) => {
        const rect = div.getBoundingClientRect();
        const gridCol = div.style.gridColumn || 'unknown';
        const gridRow = div.style.gridRow || 'unknown';
        const button = div.querySelector('button');
        const label = button?.textContent?.substring(0, 20) || '';

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
          label: label
        };
      });

      return {
        gridParent: {
          tag: gridParent.tagName,
          className: gridParent.className,
          width: gridRect.width,
          height: gridRect.height,
          top: gridRect.top,
          left: gridRect.left
        },
        gridStyle: {
          display: gridStyle.display,
          gridTemplateColumns: gridStyle.gridTemplateColumns,
          gridTemplateRows: gridStyle.gridTemplateRows,
          gap: gridStyle.gap,
          padding: gridStyle.padding,
          minHeight: gridStyle.minHeight
        },
        cells: cells,
        summary: {
          totalCells: cells.length,
          avgWidth: cells.reduce((sum, c) => sum + c.width, 0) / cells.length,
          avgHeight: cells.reduce((sum, c) => sum + c.height, 0) / cells.length,
          minWidth: Math.min(...cells.map(c => c.width)),
          maxWidth: Math.max(...cells.map(c => c.width)),
          minHeight: Math.min(...cells.map(c => c.height)),
          maxHeight: Math.max(...cells.map(c => c.height))
        }
      };
    });

    if (gridInfo.error) {
      console.log('ERROR:', gridInfo.error);
      return;
    }

    console.log('\n========== TV LAYOUT GRID ANALYSIS ==========\n');

    console.log('Grid Parent Element:');
    console.log(`  Tag: <${gridInfo.gridParent.tag}>`);
    console.log(`  Class: ${gridInfo.gridParent.className}`);
    console.log(`  Dimensions: ${gridInfo.gridParent.width.toFixed(0)}px x ${gridInfo.gridParent.height.toFixed(0)}px`);
    console.log(`  Position: top=${gridInfo.gridParent.top.toFixed(0)}px, left=${gridInfo.gridParent.left.toFixed(0)}px`);

    console.log('\nGrid CSS Properties:');
    console.log(`  Display: ${gridInfo.gridStyle.display}`);
    console.log(`  Columns: ${gridInfo.gridStyle.gridTemplateColumns}`);
    console.log(`  Rows: ${gridInfo.gridStyle.gridTemplateRows}`);
    console.log(`  Gap: ${gridInfo.gridStyle.gap}`);
    console.log(`  Padding: ${gridInfo.gridStyle.padding}`);
    console.log(`  Min Height: ${gridInfo.gridStyle.minHeight}`);

    console.log('\nGrid Cell Summary:');
    console.log(`  Total Cells: ${gridInfo.summary.totalCells}`);
    console.log(`  Avg Size: ${gridInfo.summary.avgWidth.toFixed(0)}px x ${gridInfo.summary.avgHeight.toFixed(0)}px`);
    console.log(`  Width Range: ${gridInfo.summary.minWidth.toFixed(0)}px - ${gridInfo.summary.maxWidth.toFixed(0)}px`);
    console.log(`  Height Range: ${gridInfo.summary.minHeight.toFixed(0)}px - ${gridInfo.summary.maxHeight.toFixed(0)}px`);

    console.log('\nSample Grid Cells (first 15):');
    gridInfo.cells.slice(0, 15).forEach((cell: any) => {
      const size = cell.width.toFixed(0);
      console.log(`  Cell ${cell.index}: grid(${cell.gridColumn}, ${cell.gridRow}) = ${size}x${cell.height.toFixed(0)}px "${cell.label}"`);
    });

    // Check for overlaps
    console.log('\nChecking for overlaps...');
    const overlaps: any[] = [];
    for (let i = 0; i < gridInfo.cells.length; i++) {
      for (let j = i + 1; j < gridInfo.cells.length; j++) {
        const a = gridInfo.cells[i];
        const b = gridInfo.cells[j];

        // Check if rectangles overlap
        if (!(a.right < b.left ||
              a.left > b.right ||
              a.bottom < b.top ||
              a.top > b.bottom)) {
          overlaps.push({
            cell1: i,
            cell2: j,
            cell1Grid: `${a.gridColumn}, ${a.gridRow}`,
            cell2Grid: `${b.gridColumn}, ${b.gridRow}`,
            overlapWidth: Math.min(a.right, b.right) - Math.max(a.left, b.left),
            overlapHeight: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          });
        }
      }
    }

    if (overlaps.length > 0) {
      console.log(`\nALERT: ${overlaps.length} OVERLAPPING CELLS DETECTED!\n`);
      overlaps.forEach(overlap => {
        console.log(`  Cell ${overlap.cell1} [${overlap.cell1Grid}] overlaps Cell ${overlap.cell2} [${overlap.cell2Grid}]`);
        console.log(`    Overlap: ${overlap.overlapWidth.toFixed(0)}px x ${overlap.overlapHeight.toFixed(0)}px\n`);
      });
    } else {
      console.log('\nNo overlaps detected - layout appears clean\n');
    }

    // Calculate column widths
    console.log('Grid Column Width Calculation:');
    const colWidth = gridInfo.gridParent.width / 15;
    console.log(`  Grid width: ${gridInfo.gridParent.width.toFixed(0)}px`);
    console.log(`  Columns: 15`);
    console.log(`  Theoretical column width: ${colWidth.toFixed(0)}px`);
    console.log(`  Gap: ${gridInfo.gridStyle.gap || '0'}`);
    console.log(`  Actual cell width: ${gridInfo.summary.avgWidth.toFixed(0)}px (${((gridInfo.summary.avgWidth / gridInfo.gridParent.width) * 100).toFixed(1)}% of grid)`);

    // Save report
    const reportFile = '/tmp/ui-screenshots/tv-layout-ipad/grid-layout-report.json';
    fs.mkdirSync('/tmp/ui-screenshots/tv-layout-ipad', { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      viewport: '2360x1640',
      gridInfo,
      overlaps
    }, null, 2));

    console.log(`\nDetailed report saved: ${reportFile}\n`);

    await context.close();
  } finally {
    await browser.close();
  }
}

findGridLayout().catch(console.error);

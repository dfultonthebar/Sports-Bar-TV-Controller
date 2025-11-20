import { chromium } from 'playwright';

async function inspectGrid() {
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
      // Find all potential grid containers
      const divs = document.querySelectorAll('div');
      const gridLikeElements: any[] = [];

      divs.forEach((div, idx) => {
        const style = window.getComputedStyle(div);
        const hasGridAttrs = div.style.gridTemplateColumns ||
                           div.style.gridColumn ||
                           style.display === 'grid' ||
                           div.className.includes('grid');

        if (hasGridAttrs || div.children.length > 10) {
          const rect = div.getBoundingClientRect();
          gridLikeElements.push({
            index: idx,
            tag: div.tagName,
            className: div.className.substring(0, 100),
            display: style.display,
            gridTemplateColumns: style.gridTemplateColumns,
            childCount: div.children.length,
            width: rect.width,
            height: rect.height,
            hasGridAttrs: hasGridAttrs
          });
        }
      });

      return {
        potentialGrids: gridLikeElements.slice(0, 20),
        totalDivs: divs.length
      };
    });

    console.log('Potential Grid Containers:');
    gridInfo.potentialGrids.forEach((el: any, i: number) => {
      console.log(`\n${i}. <${el.tag}> - ${el.className}`);
      console.log(`   Display: ${el.display}, Children: ${el.childCount}`);
      console.log(`   Size: ${el.width.toFixed(0)}px x ${el.height.toFixed(0)}px`);
      console.log(`   GridTemplateColumns: ${el.gridTemplateColumns || 'none'}`);
    });

    await context.close();
  } finally {
    await browser.close();
  }
}

inspectGrid().catch(console.error);

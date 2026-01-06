import { chromium } from 'playwright';
import fs from 'fs';

async function dumpHTML() {
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

    // Get the HTML content
    const html = await page.content();

    // Save to file
    fs.writeFileSync('/tmp/page-dump.html', html);

    // Also get some selector info
    const info = await page.evaluate(() => {
      const results: any = {};

      // Check what's in the page
      const gridLike = document.querySelectorAll('[class*="grid"]');
      results.gridClassElements = gridLike.length;

      const tvButtonsGeneric = document.querySelectorAll('div[style*="grid"]');
      results.divWithGridStyle = tvButtonsGeneric.length;

      // Look for specific text we expect
      const tvText = Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent?.includes('TV '));
      results.elementsWithTVText = tvText.length;

      // Look for specific video tab content areas
      const videoContent = document.querySelector('[data-tab="video"], [role="tabpanel"][aria-label*="Video"]');
      results.videoTabContent = videoContent ? videoContent.outerHTML.substring(0, 200) : 'not found';

      return results;
    });

    console.log('Page Info:');
    console.log(JSON.stringify(info, null, 2));
    console.log(`\nFull HTML dumped to: /tmp/page-dump.html`);

    // Get first few divs that contain "TV "
    const tvElements = await page.locator('text=TV').all();
    console.log(`\nFound ${tvElements.length} elements containing "TV "`);

    if (tvElements.length > 0) {
      const firstElem = tvElements[0];
      const parent = await firstElem.evaluate((el) => {
        let current = el.parentElement;
        const parents = [];
        for (let i = 0; i < 5 && current; i++) {
          parents.push({
            tag: current.tagName,
            class: current.className.substring(0, 50),
            style: current.getAttribute('style')?.substring(0, 100),
            childCount: current.children.length
          });
          current = current.parentElement;
        }
        return parents;
      });

      console.log('\nParent chain of first "TV " element:');
      parent.forEach((p: any, i: number) => {
        console.log(`  ${i}: <${p.tag}> class="${p.class}" style="${p.style}" children=${p.childCount}`);
      });
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

dumpHTML().catch(console.error);

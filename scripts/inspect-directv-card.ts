import { chromium } from 'playwright';

async function inspectDirectVCard() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Navigate
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click DirecTV tab
    await page.locator('button:has-text("DirecTV")').first().click();
    await page.waitForTimeout(1000);

    // Inspect the Direct TV 1 card element
    const cardInfo = await page.evaluate(() => {
      // Find the element containing "Direct TV 1"
      const elements = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent?.includes('Direct TV 1') &&
        el.textContent?.includes('192.168')
      );

      console.log('Found elements containing Direct TV 1:', elements.length);

      const results: any[] = [];

      elements.forEach((el: any, idx: number) => {
        const isClickable = el.onclick !== null ||
                           el.style.cursor === 'pointer' ||
                           el.tagName === 'BUTTON' ||
                           el.getAttribute('role') === 'button';

        const children = Array.from(el.children).map((child: any) => ({
          tag: child.tagName,
          classes: child.className,
          text: (child as any).textContent?.substring(0, 50),
          onclick: (child as any).onclick !== null
        }));

        results.push({
          index: idx,
          tag: el.tagName,
          classes: el.className,
          id: el.id,
          role: el.getAttribute('role'),
          onclick: el.onclick !== null,
          cursor: el.style.cursor,
          clickable: isClickable,
          childCount: el.children.length,
          children: children,
          parent: {
            tag: el.parentElement?.tagName,
            classes: el.parentElement?.className
          }
        });
      });

      return results;
    });

    console.log('[INFO] Card Structure Analysis:');
    console.log(JSON.stringify(cardInfo, null, 2));

    // Look for elements with icon buttons (pencil/edit)
    const iconButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const results: any[] = [];

      buttons.forEach((btn: any) => {
        const svgs = btn.querySelectorAll('svg');
        if (svgs.length > 0) {
          results.push({
            text: btn.textContent?.trim(),
            ariaLabel: btn.getAttribute('aria-label'),
            title: btn.title,
            svgCount: svgs.length,
            classes: btn.className,
            parent: btn.parentElement?.className
          });
        }
      });

      return results;
    });

    console.log('[INFO] Icon Buttons Found:');
    console.log(JSON.stringify(iconButtons, null, 2));

    // Try to find clickable areas within device cards
    const clickableAreas = await page.evaluate(() => {
      const divs = document.querySelectorAll('div');
      const clickables: any[] = [];

      divs.forEach((div: any) => {
        if (div.textContent?.includes('Direct TV') && div.textContent?.includes('192.168')) {
          // Check all descendants for clickable elements
          const buttons = div.querySelectorAll('button');
          const links = div.querySelectorAll('a');
          const editables = div.querySelectorAll('[role="button"]');

          if (buttons.length > 0 || links.length > 0 || editables.length > 0) {
            clickables.push({
              divClasses: div.className,
              divText: div.textContent?.substring(0, 50),
              buttons: buttons.length,
              links: links.length,
              editables: editables.length,
              buttonDetails: Array.from(buttons).map((b: any) => ({
                text: b.textContent?.trim(),
                ariaLabel: b.getAttribute('aria-label'),
                classes: b.className
              }))
            });
          }
        }
      });

      return clickables;
    });

    console.log('[INFO] Clickable Areas in Device Cards:');
    console.log(JSON.stringify(clickableAreas, null, 2));

    // Get all buttons and their properties
    const allButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      const results: any[] = [];

      buttons.forEach((btn: any, idx: number) => {
        const text = btn.textContent?.trim();
        if (text && text.length > 0 && text.length < 100) {
          results.push({
            index: idx,
            text: text.substring(0, 50),
            ariaLabel: btn.getAttribute('aria-label'),
            dataTestId: btn.getAttribute('data-testid'),
            classes: btn.className,
            type: btn.type,
            disabled: btn.disabled
          });
        }
      });

      return results;
    });

    console.log('[INFO] All Buttons (first 30):');
    allButtons.slice(0, 30).forEach((btn: any) => {
      console.log(`  ${btn.index}: "${btn.text}" (aria-label="${btn.ariaLabel}")`);
    });

    // Take screenshot of current state
    await page.screenshot({
      path: '/tmp/ui-screenshots/inspect-directv-card.png',
      fullPage: false
    });
    console.log('[SUCCESS] Screenshot saved');

  } catch (error) {
    console.error('[ERROR]', error);
  } finally {
    await browser.close();
  }
}

inspectDirectVCard().catch(console.error);

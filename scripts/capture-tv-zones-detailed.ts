import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots/tv-layout-ipad';

async function captureDetailedZones() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 2360, height: 1640 }
    });

    const page = await context.newPage();

    console.log(`Navigating to http://localhost:3001/remote...`);
    await page.goto('http://localhost:3001/remote', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log(`Clicking on Video tab...`);
    const videoTab = page.locator('button').filter({ hasText: /^Video$/i });
    if (await videoTab.count() > 0) {
      await videoTab.click();
      await page.waitForTimeout(500);
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Get detailed DOM structure and dimensions
    console.log(`\nAnalyzing TV Zone Structure...`);
    const domAnalysis = await page.evaluate(() => {
      // Get all elements with specific attributes or classes that might indicate TV zones
      const potentialZoneSelectors = [
        '[data-zone-id]',
        '[class*="tvzone"]',
        '[class*="tv-zone"]',
        '[class*="screen"]',
        '[class*="display"]',
        '[class*="region"]'
      ];

      let zoneContainers = [];
      for (const selector of potentialZoneSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          zoneContainers = Array.from(elements);
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          break;
        }
      }

      // Also look for canvas or video elements (actual display areas)
      const canvases = document.querySelectorAll('canvas');
      const videos = document.querySelectorAll('video');
      const iframes = document.querySelectorAll('iframe');

      // Look for divs that have onClick handlers or cursor pointers
      const interactiveElements = Array.from(document.querySelectorAll('div[role="button"], div[onclick]'));

      // Examine the main content area
      const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
      const allDivs = mainContent ? mainContent.querySelectorAll('div') : document.querySelectorAll('body > div');

      return {
        zoneContainersFound: zoneContainers.length,
        canvases: canvases.length,
        videos: videos.length,
        iframes: iframes.length,
        interactiveElements: interactiveElements.length,
        mainContentDivCount: allDivs.length,
        pageHTML: {
          head: document.head.children.length,
          body: document.body.children.length
        }
      };
    });

    console.log(`\nDOM Analysis:`, domAnalysis);

    // Try inspecting the SVG canvas area which seems to be the layout display
    console.log(`\nAnalyzing SVG Canvas and Clickable Areas...`);
    const svgAnalysis = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      const clickableElements = document.querySelectorAll('[role="button"], [onclick], [data-clickable], button, a');

      const svgInfo = Array.from(svgs).map((svg, index) => {
        const rect = svg.getBoundingClientRect();
        const viewBox = svg.getAttribute('viewBox');
        const parent = svg.parentElement;

        return {
          index,
          tag: 'svg',
          dimensions: {
            width: rect.width.toFixed(1),
            height: rect.height.toFixed(1),
            x: rect.x.toFixed(1),
            y: rect.y.toFixed(1)
          },
          viewBox,
          childCount: svg.children.length,
          parentTag: parent?.tagName,
          parentClass: parent?.className.substring(0, 50)
        };
      });

      // Look for g elements (groups) which might represent zones
      const groups = document.querySelectorAll('svg g');
      const groupsWithText = Array.from(groups).filter(g => {
        const text = g.textContent || '';
        return text.length > 0 && text.length < 100;
      });

      return {
        svgCount: svgs.length,
        svgDetails: svgInfo,
        groupsFound: groups.length,
        groupsWithText: groupsWithText.length,
        clickableElements: clickableElements.length
      };
    });

    console.log(`\nSVG Analysis:`, JSON.stringify(svgAnalysis, null, 2));

    // Get the SVG canvas viewport and try to understand zone positions
    console.log(`\nAnalyzing Zone Rendering in SVG...`);
    const svgZoneData = await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      if (svgs.length === 0) return { error: 'No SVG found' };

      const svg = svgs[svgs.length - 1]; // Likely the main layout canvas
      const rect = svg.getBoundingClientRect();
      const viewBox = svg.getAttribute('viewBox');

      // Get all rect elements (often used to represent zones)
      const rects = svg.querySelectorAll('rect');
      const circles = svg.querySelectorAll('circle');
      const texts = svg.querySelectorAll('text');
      const paths = svg.querySelectorAll('path');

      const rectData = Array.from(rects).map((rect) => ({
        x: rect.getAttribute('x'),
        y: rect.getAttribute('y'),
        width: rect.getAttribute('width'),
        height: rect.getAttribute('height'),
        fill: rect.getAttribute('fill'),
        stroke: rect.getAttribute('stroke'),
        class: rect.getAttribute('class'),
        id: rect.getAttribute('id'),
        onClick: rect.hasAttribute('onclick') || rect.hasAttribute('data-clickable')
      }));

      const circleData = Array.from(circles).slice(0, 10).map((circle) => ({
        cx: circle.getAttribute('cx'),
        cy: circle.getAttribute('cy'),
        r: circle.getAttribute('r'),
        fill: circle.getAttribute('fill'),
        class: circle.getAttribute('class')
      }));

      const textData = Array.from(texts).slice(0, 10).map((text) => ({
        x: text.getAttribute('x'),
        y: text.getAttribute('y'),
        content: text.textContent?.substring(0, 30),
        class: text.getAttribute('class')
      }));

      return {
        svgViewBox: viewBox,
        svgRect: {
          width: rect.width.toFixed(1),
          height: rect.height.toFixed(1),
          x: rect.x.toFixed(1),
          y: rect.y.toFixed(1)
        },
        elements: {
          rectCount: rects.length,
          circleCount: circles.length,
          textCount: texts.length,
          pathCount: paths.length
        },
        sampleRects: rectData.slice(0, 5),
        sampleCircles: circleData,
        sampleTexts: textData
      };
    });

    console.log(`\nSVG Zone Data:`, JSON.stringify(svgZoneData, null, 2));

    // Highlight zones by finding their borders and click areas
    console.log(`\nScanning for clickable zone areas...`);
    const clickableZones = await page.evaluate(() => {
      // Find elements that respond to clicks (might be zone representations)
      const svg = document.querySelector('svg');
      if (!svg) return { error: 'No SVG found' };

      const clickableGroups = Array.from(svg.querySelectorAll('g[onclick], g[data-zone], rect[onclick]'));

      return {
        clickableGroups: clickableGroups.length,
        details: clickableGroups.slice(0, 5).map((el, i) => ({
          index: i,
          tag: el.tagName,
          id: el.getAttribute('id'),
          class: el.getAttribute('class'),
          dataAttrs: Array.from(el.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => `${attr.name}=${attr.value}`)
            .join('; ')
        }))
      };
    });

    console.log(`\nClickable Zones:`, JSON.stringify(clickableZones, null, 2));

    // Save all findings to file
    const analysisFile = path.join(SCREENSHOT_DIR, 'detailed-zone-analysis.json');
    fs.writeFileSync(analysisFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      viewport: '2360x1640',
      domAnalysis,
      svgAnalysis,
      svgZoneData,
      clickableZones
    }, null, 2));

    console.log(`\n✓ Detailed analysis saved: ${analysisFile}`);

    // Take annotated screenshots showing zone boundaries
    console.log(`\nTaking annotated screenshots...`);

    // Highlight SVG elements
    await page.evaluate(() => {
      const svgs = document.querySelectorAll('svg');
      const svg = svgs[svgs.length - 1];

      if (svg) {
        // Add border to rects for visibility
        const rects = svg.querySelectorAll('rect');
        rects.forEach((rect, i) => {
          const width = rect.getAttribute('width');
          const height = rect.getAttribute('height');
          if (width && height && parseInt(width) > 50 && parseInt(height) > 50) {
            rect.setAttribute('stroke', '#FF0000');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('fill-opacity', '0.1');
          }
        });
      }
    });

    const annotatedPath = path.join(SCREENSHOT_DIR, '03-zones-annotated.png');
    await page.screenshot({
      path: annotatedPath,
      fullPage: true
    });
    console.log(`✓ Annotated screenshot: ${annotatedPath}`);

    // Test clicking on different areas to understand zone sensitivity
    console.log(`\nTesting zone click sensitivity...`);
    const clickTestResults = [];

    // Try clicking on the SVG area at different positions
    const testPoints = [
      { x: 500, y: 400, description: 'Top-left area' },
      { x: 1180, y: 500, description: 'Center area' },
      { x: 1700, y: 600, description: 'Right area' },
      { x: 1200, y: 900, description: 'Bottom area' }
    ];

    for (const point of testPoints) {
      try {
        const svgElement = await page.locator('svg').first();
        if (await svgElement.count() > 0) {
          const boundingBox = await svgElement.boundingBox();
          if (boundingBox) {
            // Move mouse to test point
            await page.mouse.move(point.x, point.y);
            await page.waitForTimeout(100);

            // Check if hover changed anything
            const hoverElement = await page.evaluate(() => {
              return document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.tagName;
            });

            clickTestResults.push({
              point,
              success: true,
              hoveredElement: hoverElement
            });
          }
        }
      } catch (error: any) {
        clickTestResults.push({
          point,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Click test results:`, clickTestResults);

    await context.close();

  } finally {
    await browser.close();
  }
}

captureDetailedZones().catch(console.error);

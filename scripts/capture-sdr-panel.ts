import { chromium } from 'playwright';

async function captureSDRPanel() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Navigate to device config
    console.log('Navigating to device-config...');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    
    await page.waitForTimeout(2000);

    // Try to click Audio tab if visible
    const audioTab = page.locator('button:has-text("Audio"), [role="tab"]:has-text("Audio")');
    if (await audioTab.count() > 0) {
      console.log('Clicking Audio tab...');
      await audioTab.first().click();
      await page.waitForTimeout(1500);
    }

    // Scroll to find RF Spectrum Monitor
    console.log('Scrolling to locate RF Spectrum Monitor...');
    for (let i = 0; i < 8; i++) {
      const hasSpectrum = page.locator('text=/RF Spectrum Monitor|Wireless Mics/i');
      if (await hasSpectrum.count() > 0) {
        console.log('Found RF Spectrum Monitor section');
        await hasSpectrum.first().scrollIntoViewIfNeeded();
        break;
      }
      await page.scroll('body', 0, 400);
      await page.waitForTimeout(500);
    }

    // Wait for SSE events (30 seconds)
    console.log('Waiting 30 seconds for SSE bucket events and FFT population...');
    await page.waitForTimeout(30000);

    // Full page screenshot
    console.log('Capturing full page screenshot...');
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-sdr-full-page.png',
      fullPage: false
    });

    // Locate and focus on SDR card panel
    const sdrCard = page.locator('[class*="card"], [class*="panel"], [class*="spectrum"]').first();
    if (await sdrCard.count() > 0) {
      await sdrCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
    }

    // Panel detail screenshot
    console.log('Capturing SDR panel detail...');
    await page.screenshot({
      path: '/tmp/ui-screenshots/02-sdr-panel-detail.png',
      fullPage: false
    });

    // Capture FFT canvas closeup
    const canvases = page.locator('canvas');
    if (await canvases.count() > 0) {
      console.log(`Found ${await canvases.count()} canvas element(s)`);
      const bbox = await canvases.first().boundingBox();
      
      if (bbox) {
        console.log(`Canvas bbox: x=${bbox.x}, y=${bbox.y}, w=${bbox.width}, h=${bbox.height}`);
        
        // Scroll canvas into view
        await canvases.first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        
        // Capture with padding
        const padding = 40;
        const clip = {
          x: Math.max(0, bbox.x - padding),
          y: Math.max(0, bbox.y - padding),
          width: bbox.width + (padding * 2),
          height: bbox.height + (padding * 2)
        };
        
        console.log('Capturing FFT canvas closeup...');
        await page.screenshot({
          path: '/tmp/ui-screenshots/03-sdr-fft-closeup.png',
          fullPage: false,
          clip
        });
      }
    }

    console.log('✅ All screenshots captured successfully');

  } catch (error) {
    console.error('Error:', error);
    console.log('Capturing error state...');
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

captureSDRPanel().catch(console.error);

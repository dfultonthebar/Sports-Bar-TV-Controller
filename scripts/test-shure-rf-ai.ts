import { chromium } from 'playwright';

async function runShureRfAiTests() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const screenshots: string[] = [];

  // Capture console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`Page error: ${error.message}`);
  });

  try {
    console.log('\n=== TEST 1: ShureRfAiPanel mount and initial state ===');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Click Audio tab
    const audioTab = page.locator('button:has-text("Audio")').first();
    const audioVisible = await audioTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (audioVisible) {
      await audioTab.click();
      await page.waitForTimeout(800);
      console.log('✓ Audio tab clicked');
    }

    // Click Wireless Mics tab
    const wirelessTab = page.locator('button:has-text("Wireless Mics")').first();
    const wirelessVisible = await wirelessTab.isVisible({ timeout: 5000 }).catch(() => false);
    if (wirelessVisible) {
      await wirelessTab.click();
      await page.waitForTimeout(1000);
      console.log('✓ Wireless Mics tab clicked');
    }

    // Scroll down to find RF AI Insights
    for (let i = 0; i < 10; i++) {
      const aiPanel = page.locator('text=RF AI Insights').first();
      if (await aiPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await aiPanel.scrollIntoViewIfNeeded();
        console.log('✓ RF AI Insights panel found and scrolled into view');
        break;
      }
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(300);
    }

    // Verify components
    const summaryCard = page.locator('text=RF Environment Summary').isVisible({ timeout: 3000 }).catch(() => false);
    const suggestCard = page.locator('text=Suggest a Clean Frequency').isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Test 1 results:`);
    console.log(`  - Summary card visible: ${await summaryCard}`);
    console.log(`  - Suggest card visible: ${await suggestCard}`);

    await page.screenshot({
      path: '/tmp/ui-screenshots/08-shure-ai-initial-state.png',
      fullPage: false
    });
    screenshots.push('08-shure-ai-initial-state.png');
    console.log('Screenshot: 08-shure-ai-initial-state.png\n');

    console.log('=== TEST 2: Digest refresh ===');
    // Find and click refresh button
    const refreshButtons = page.locator('button:has-text("Refresh")');
    const refreshCount = await refreshButtons.count();
    console.log(`Found ${refreshCount} Refresh button(s)`);

    if (refreshCount > 0) {
      // Get the first refresh button (in the summary card)
      const summaryRefresh = refreshButtons.first();
      await summaryRefresh.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      console.log('Clicking Refresh button...');
      await summaryRefresh.click();
      await page.waitForTimeout(800);

      // Check for loading state
      const loadingText = page.locator('text=/Generating|Loading/i');
      const isLoading = await loadingText.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Loading state visible: ${isLoading}`);

      // Wait for generation (up to 45 seconds for Ollama)
      console.log('Waiting for digest generation (up to 45s)...');
      let generationComplete = false;
      for (let i = 0; i < 45; i++) {
        const stillLoading = await loadingText.isVisible({ timeout: 1000 }).catch(() => false);
        if (!stillLoading) {
          generationComplete = true;
          console.log(`✓ Generation complete after ${i}s`);
          break;
        }
        process.stdout.write('.');
        await page.waitForTimeout(1000);
      }

      if (!generationComplete) {
        console.log('\n⚠ Generation timed out (but may still be processing)');
      }

      await page.waitForTimeout(500);
      await page.screenshot({
        path: '/tmp/ui-screenshots/09-shure-ai-after-refresh.png',
        fullPage: false
      });
      screenshots.push('09-shure-ai-after-refresh.png');
      console.log('\nScreenshot: 09-shure-ai-after-refresh.png\n');
    }

    console.log('=== TEST 3: Find Clean Freq button ===');
    const findCleanBtn = page.locator('button:has-text("Find clean freq")').first();
    const findCleanVisible = await findCleanBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Find clean freq button visible: ${findCleanVisible}`);

    if (findCleanVisible) {
      await findCleanBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      console.log('Clicking Find clean freq button...');
      await findCleanBtn.click();
      await page.waitForTimeout(2000);

      // Check for suggestions
      const suggestions = page.locator('text=/MHz|GHz|clean|frequency/i');
      const suggestionsVisible = await suggestions.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`Frequency suggestions visible: ${suggestionsVisible}`);

      // Look for #1 badge
      const badgeOne = page.locator('text=#1');
      const badgeVisible = await badgeOne.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`#1 badge visible: ${badgeVisible}`);

      await page.screenshot({
        path: '/tmp/ui-screenshots/10-shure-ai-clean-freq.png',
        fullPage: false
      });
      screenshots.push('10-shure-ai-clean-freq.png');
      console.log('Screenshot: 10-shure-ai-clean-freq.png\n');
    }

    console.log('=== TEST 4: Active carriers width badges (SDR panel) ===');
    // Scroll up to find SDR panel
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    for (let i = 0; i < 10; i++) {
      const sdrPanel = page.locator('text=RF Spectrum Monitor').first();
      if (await sdrPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sdrPanel.scrollIntoViewIfNeeded();
        console.log('✓ RF Spectrum Monitor found');
        break;
      }
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(300);
    }

    // Check for active carriers section
    const carriersSection = page.locator('text=Active carriers');
    const carriersSectionVisible = await carriersSection.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Active carriers section visible: ${carriersSectionVisible}`);

    // Check for width badges
    const redBadge = page.locator('[class*="bg-red"]').first();
    const amberBadge = page.locator('[class*="bg-amber"]').first();
    const slateBadge = page.locator('[class*="bg-slate"]').first();

    const redVisible = await redBadge.isVisible({ timeout: 1000 }).catch(() => false);
    const amberVisible = await amberBadge.isVisible({ timeout: 1000 }).catch(() => false);

    console.log(`Width badges found:`);
    console.log(`  - Red (TV-broadcast): ${redVisible}`);
    console.log(`  - Amber (Wireless): ${amberVisible}`);

    await page.screenshot({
      path: '/tmp/ui-screenshots/11-sdr-width-badges.png',
      fullPage: false
    });
    screenshots.push('11-sdr-width-badges.png');
    console.log('Screenshot: 11-sdr-width-badges.png\n');

    console.log('=== TEST 5: Shift brief at /remote ===');
    await page.goto('http://localhost:3001/remote', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const shiftBriefCard = page.locator('text=Shift Brief').first();
    const briefVisible = await shiftBriefCard.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Shift Brief card visible: ${briefVisible}`);

    if (briefVisible) {
      await shiftBriefCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Check brief content
      const briefContent = await shiftBriefCard.textContent().catch(() => '');
      console.log(`Brief content preview: "${briefContent?.substring(0, 100) || 'N/A'}..."`);

      // Check for NO Cavs/Knicks
      const cavaliers = page.locator('text=/Cavaliers|Knicks/i');
      const cavaliersVisible = await cavaliers.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Cavs/Knicks visible (should be false): ${cavaliersVisible}`);

      // Check for home teams
      const homeTeams = page.locator('text=/Brewers|Bucks|Badgers|Packers/i');
      const homeTeamsVisible = await homeTeams.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`Home teams visible: ${homeTeamsVisible}`);

      // Check for double-prefix bug
      const briefFullText = await shiftBriefCard.textContent().catch(() => '');
      const doublePrefix = briefFullText?.includes('Mic status: Mic status:') || false;
      console.log(`Double Mic status prefix (should be false): ${doublePrefix}`);

      await page.screenshot({
        path: '/tmp/ui-screenshots/12-shift-brief-remote.png',
        fullPage: true
      });
      screenshots.push('12-shift-brief-remote.png');
      console.log('Screenshot: 12-shift-brief-remote.png\n');

      // Try to refresh brief
      const briefRefreshBtn = page.locator('button:has-text("Refresh")').first();
      const briefRefreshVisible = await briefRefreshBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (briefRefreshVisible) {
        console.log('Found brief refresh button, clicking...');
        const initialText = await shiftBriefCard.textContent();
        await briefRefreshBtn.click();
        await page.waitForTimeout(800);

        // Wait for regeneration (up to 40 seconds)
        let refreshComplete = false;
        for (let i = 0; i < 40; i++) {
          const currentText = await shiftBriefCard.textContent();
          if (currentText !== initialText && !currentText?.includes('Generating')) {
            refreshComplete = true;
            console.log(`✓ Brief regenerated after ${i}s`);
            break;
          }
          process.stdout.write('.');
          await page.waitForTimeout(1000);
        }

        if (!refreshComplete) {
          console.log('\n⚠ Brief refresh timed out');
        }

        await page.waitForTimeout(500);
        await page.screenshot({
          path: '/tmp/ui-screenshots/13-shift-brief-after-refresh.png',
          fullPage: true
        });
        screenshots.push('13-shift-brief-after-refresh.png');
        console.log('\nScreenshot: 13-shift-brief-after-refresh.png');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Screenshots captured: ${screenshots.length}`);
    screenshots.forEach(s => console.log(`  - ${s}`));

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors Detected:');
      consoleErrors.forEach(e => console.log(`  - ${e}`));
    } else {
      console.log('\n✓ No console errors detected');
    }

  } catch (error) {
    console.error('Test execution error:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/99-test-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

runShureRfAiTests().catch(console.error);

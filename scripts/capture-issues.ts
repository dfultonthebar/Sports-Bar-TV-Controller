import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const screenshotDir = '/tmp/ui-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function captureIssueScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('Starting screenshot capture...');

    // 1. Navigate to Bartender Remote
    console.log('Navigating to /remote...');
    await page.goto('http://localhost:3001/remote', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for initial render

    // 2. Find and click the Cable Guide/Sports Guide tab
    console.log('Looking for Guide/Cable Guide tab...');

    // Wait for tabs to be visible
    await page.waitForSelector('button', { timeout: 5000 }).catch(() => {
      console.log('Could not find button selector, continuing anyway');
    });

    // Try to find the Guide tab - look for text containing "Guide" or "Cable"
    const guideTab = page.locator('button:has-text("Guide")').first();
    const tabVisible = await guideTab.isVisible().catch(() => false);

    if (tabVisible) {
      console.log('Found Guide tab, clicking...');
      await guideTab.click();
      await page.waitForTimeout(1500); // Wait for tab transition
    } else {
      console.log('Guide tab not immediately visible, waiting for content...');
    }

    // 3. Capture full page of cable guide
    console.log('Capturing full cable guide page...');
    await page.screenshot({
      path: path.join(screenshotDir, 'cable-guide-full.png'),
      fullPage: true
    });
    console.log('Saved: cable-guide-full.png');

    // 4. Wait a moment and scroll to see game cards clearly
    await page.waitForTimeout(500);

    // Scroll to main content area
    await page.evaluate(() => {
      const gameContainer = document.querySelector('[class*="game"], [class*="card"], main');
      if (gameContainer) {
        gameContainer.scrollIntoView({ behavior: 'smooth' });
      }
    });
    await page.waitForTimeout(1000);

    // 5. Capture focused screenshot of game cards
    console.log('Capturing game cards section...');
    const gameCardsLocator = page.locator('[class*="game"], [class*="card"], [class*="event"]').first();
    const gameCardsVisible = await gameCardsLocator.isVisible().catch(() => false);

    if (gameCardsVisible) {
      await gameCardsLocator.screenshot({
        path: path.join(screenshotDir, 'cable-guide-games.png')
      }).catch(async () => {
        // Fallback to viewport screenshot
        await page.screenshot({
          path: path.join(screenshotDir, 'cable-guide-games.png')
        });
      });
      console.log('Saved: cable-guide-games.png');
    } else {
      // Capture viewport of games section
      await page.screenshot({
        path: path.join(screenshotDir, 'cable-guide-games.png')
      });
      console.log('Saved: cable-guide-games.png (viewport)');
    }

    // 6. Look for AI Game Plan section or navigation
    console.log('Looking for AI Game Plan section...');

    // Try to find a link/button for AI Game Plan
    const aiGamePlanLink = page.locator('a:has-text("AI Game Plan"), button:has-text("AI Game Plan"), [class*="ai"], [class*="game-plan"]').first();
    const aiLinkVisible = await aiGamePlanLink.isVisible().catch(() => false);

    if (aiLinkVisible) {
      console.log('Found AI Game Plan link, clicking...');
      await aiGamePlanLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    } else {
      console.log('AI Game Plan link not found, checking if already on page...');

      // Check if there's an AI Game Plan section visible on current page
      const aiSection = page.locator('[class*="ai"], [class*="game-plan"], h2:has-text("AI"), h3:has-text("AI")').first();
      const aiSectionVisible = await aiSection.isVisible().catch(() => false);

      if (aiSectionVisible) {
        console.log('AI Game Plan section found on current page');
        // Scroll to it
        await aiSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      } else {
        // Try to navigate via URL if it's a different route
        console.log('Trying to navigate to potential AI Game Plan routes...');
        try {
          await page.goto('http://localhost:3001/ai-game-plan', { waitUntil: 'networkidle', timeout: 5000 }).catch(() => {
            console.log('Could not navigate to /ai-game-plan');
          });
        } catch (e) {
          console.log('Navigation attempt failed, continuing with current page');
        }
      }
    }

    // 7. Capture full AI Game Plan page
    console.log('Capturing full AI Game Plan page...');
    await page.screenshot({
      path: path.join(screenshotDir, 'ai-game-plan-full.png'),
      fullPage: true
    });
    console.log('Saved: ai-game-plan-full.png');

    // 8. Look for upcoming games section in AI Game Plan
    console.log('Looking for upcoming games section...');
    const upcomingGamesSection = page.locator('[class*="upcoming"], h2:has-text("upcoming"), h3:has-text("upcoming"), [class*="games"], main').first();
    const upcomingVisible = await upcomingGamesSection.isVisible().catch(() => false);

    if (upcomingVisible) {
      await upcomingGamesSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }

    // 9. Capture focused screenshot of upcoming games
    console.log('Capturing upcoming games section...');
    await page.screenshot({
      path: path.join(screenshotDir, 'ai-game-plan-upcoming.png')
    });
    console.log('Saved: ai-game-plan-upcoming.png');

    // 10. Scroll through and capture game assignments area
    console.log('Scrolling to see all content...');
    await page.evaluate(() => {
      window.scrollBy(0, 1000);
    });
    await page.waitForTimeout(500);

    console.log('Capturing scrolled view...');
    await page.screenshot({
      path: path.join(screenshotDir, 'ai-game-plan-assignments.png')
    });
    console.log('Saved: ai-game-plan-assignments.png');

    // 11. Check page source for data issues
    console.log('Analyzing page content...');
    const pageContent = await page.content();

    // Look for score data
    const hasScores = pageContent.includes('score') || pageContent.includes('Score') || pageContent.includes('-');
    const hasTimeLeft = pageContent.includes('time') || pageContent.includes('Time') || pageContent.includes(':');
    const hasVsText = pageContent.includes(' vs ') || pageContent.includes('VS');

    console.log('\nData Analysis:');
    console.log(`- Contains score data: ${hasScores}`);
    console.log(`- Contains time information: ${hasTimeLeft}`);
    console.log(`- Contains "vs" text: ${hasVsText}`);

    // Extract any error messages
    const errorElements = await page.locator('[class*="error"], [role="alert"]').count();
    console.log(`- Error elements visible: ${errorElements}`);

    console.log('\nAll screenshots captured successfully!');
    console.log(`Screenshot directory: ${screenshotDir}`);
    console.log('\nFiles created:');
    console.log('  - cable-guide-full.png');
    console.log('  - cable-guide-games.png');
    console.log('  - ai-game-plan-full.png');
    console.log('  - ai-game-plan-upcoming.png');
    console.log('  - ai-game-plan-assignments.png');

  } catch (error) {
    console.error('Error during screenshot capture:', error);
    // Capture error state
    await page.screenshot({
      path: path.join(screenshotDir, 'error-state.png'),
      fullPage: true
    }).catch(() => {
      console.log('Could not capture error state screenshot');
    });
  } finally {
    await browser.close();
  }
}

// Run the script
captureIssueScreenshots().catch(console.error);

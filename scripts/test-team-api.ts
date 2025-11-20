import { chromium } from 'playwright';

const BASE_URL = 'http://24.123.87.42:3001';

async function testTeamAPI() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const networkRequests: any[] = [];
  const networkResponses: any[] = [];

  // Intercept all network activity
  page.on('request', (request) => {
    if (request.url().includes('/api/espn/teams')) {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()
      });
      console.log(`REQUEST: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', async (response) => {
    if (response.url().includes('/api/espn/teams')) {
      try {
        const body = await response.json();
        networkResponses.push({
          url: response.url(),
          status: response.status(),
          data: body
        });
        console.log(`RESPONSE: ${response.status()} ${response.url()}`);
        console.log('Response body:', JSON.stringify(body, null, 2));
      } catch (e) {
        console.log(`Could not parse response JSON from ${response.url()}`);
      }
    }
  });

  try {
    console.log('Navigating to sports-guide-config...');
    await page.goto(`${BASE_URL}/sports-guide-config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Teams tab
    await page.locator('button:has-text("Teams")').click();
    await page.waitForTimeout(1000);

    // Click Add Team button
    await page.locator('button:has-text("Add Team")').click();
    await page.waitForTimeout(1500);

    // Select Football
    console.log('\n=== Selecting Football ===');
    const sportSelect = await page.locator('select').first();
    await sportSelect.selectOption('football');
    await page.waitForTimeout(1000);

    // Select NFL - this should trigger the API call
    console.log('\n=== Selecting NFL ===');
    const leagueSelect = (await page.locator('select').all())[1];

    console.log('Intercepting API calls for NFL selection...');

    // Monitor for changes
    await leagueSelect.selectOption('NFL');

    // Wait for potential API calls
    console.log('Waiting for API responses...');
    await page.waitForTimeout(3000);

    // Check what leagues are available in the dropdown
    console.log('\n=== Available Leagues in Dropdown ===');
    const leagueOptions = await page.locator('select').nth(1).locator('option').all();
    for (let i = 0; i < Math.min(10, leagueOptions.length); i++) {
      const value = await leagueOptions[i].getAttribute('value');
      const text = await leagueOptions[i].textContent();
      console.log(`  ${i}: value="${value}" text="${text}"`);
    }

    console.log('\n=== Network Summary ===');
    console.log(`Requests made: ${networkRequests.length}`);
    networkRequests.forEach(req => {
      console.log(`  - ${req.method} ${req.url}`);
    });
    console.log(`Responses received: ${networkResponses.length}`);
    networkResponses.forEach(res => {
      console.log(`  - ${res.status} ${res.url}`);
      if (res.data.success === false) {
        console.log(`    ERROR: ${res.data.error}`);
      }
      if (res.data.teams) {
        console.log(`    Teams returned: ${res.data.teams.length}`);
      }
    });

  } catch (error: any) {
    console.error('Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

testTeamAPI().then(() => {
  console.log('\nAPI test completed.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

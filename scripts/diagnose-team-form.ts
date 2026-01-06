import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOTS_DIR = '/tmp/ui-screenshots/team-form-diagnostic';
const BASE_URL = 'http://24.123.87.42:3001';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function diagnoseTeamForm() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to sports-guide-config...');
    await page.goto(`${BASE_URL}/sports-guide-config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Teams tab
    console.log('Clicking Teams tab...');
    await page.locator('button:has-text("Teams")').click();
    await page.waitForTimeout(1000);

    // Click Add Team button
    console.log('Clicking Add Team button...');
    await page.locator('button:has-text("Add Team")').click();
    await page.waitForTimeout(1500);

    // Get initial form state
    console.log('\n=== INITIAL FORM STATE ===');
    const initialState = await page.evaluate(() => {
      const sportSelect = document.querySelector('select[class*="px-4"][class*="py-2"]') as HTMLSelectElement;
      const leagueSelect = Array.from(document.querySelectorAll('select')).find(s =>
        s.parentElement?.textContent?.includes('League')
      ) as HTMLSelectElement;

      return {
        sportValue: sportSelect?.value,
        leagueValue: leagueSelect?.value,
        leagueDisabled: leagueSelect?.disabled,
        allSelects: Array.from(document.querySelectorAll('select')).length,
        selectValues: Array.from(document.querySelectorAll('select')).map((s: any) => ({
          label: s.previousElementSibling?.textContent || 'unknown',
          value: s.value,
          disabled: s.disabled
        }))
      };
    });
    console.log('Initial state:', JSON.stringify(initialState, null, 2));

    // Click Sport dropdown and select football
    console.log('\n=== SELECTING FOOTBALL ===');
    const sportSelects = await page.locator('select').all();
    console.log(`Found ${sportSelects.length} select elements`);

    // Find Sport select (first one with Sport label)
    const sportLabel = await page.locator('label:has-text("Sport")').first();
    const sportInput = sportLabel.locator('~ select').first();

    const sportValue = await sportInput.inputValue();
    console.log(`Sport input current value: "${sportValue}"`);

    // Click to focus and select
    await sportInput.click();
    await page.waitForTimeout(300);
    await sportInput.selectOption('football');
    await page.waitForTimeout(1500);

    // Get state after Sport selection
    console.log('\n=== STATE AFTER SELECTING FOOTBALL ===');
    const afterSportSelect = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll('input, select, [role="combobox"]'));
      const selectElements = Array.from(document.querySelectorAll('select'));

      return {
        sportValue: (selectElements[0] as HTMLSelectElement)?.value,
        leagueDisabled: (selectElements[1] as HTMLSelectElement)?.disabled,
        leagueValue: (selectElements[1] as HTMLSelectElement)?.value,
        leagueHTML: (selectElements[1] as HTMLSelectElement)?.outerHTML?.substring(0, 200),
        selectValues: selectElements.map((s: any) => ({
          value: s.value,
          disabled: s.disabled,
          name: s.name,
          class: s.className.substring(0, 50)
        }))
      };
    });
    console.log('After sport selection:', JSON.stringify(afterSportSelect, null, 2));

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-after-sport-select.png') });

    // Now try to interact with League dropdown
    console.log('\n=== CHECKING LEAGUE DROPDOWN STATE ===');
    const leagueLabel = await page.locator('label:has-text("League")').first();
    const leagueSelect = leagueLabel.locator('~ select').first();

    const leagueEnabled = await leagueSelect.evaluate((el: HTMLSelectElement) => !el.disabled);
    console.log(`League dropdown enabled: ${leagueEnabled}`);

    if (leagueEnabled) {
      console.log('Clicking League dropdown...');
      await leagueSelect.click();
      await page.waitForTimeout(800);

      // Select NFL
      console.log('Selecting NFL...');
      await leagueSelect.selectOption({ value: 'NFL' });
      await page.waitForTimeout(2000);

      // Check state after league selection
      const afterLeagueState = await page.evaluate(() => {
        const selectElements = Array.from(document.querySelectorAll('select'));
        return {
          sportValue: (selectElements[0] as HTMLSelectElement)?.value,
          leagueValue: (selectElements[1] as HTMLSelectElement)?.value,
          teamSelectDisabled: (selectElements[2] as HTMLSelectElement)?.disabled,
          teamSelectValue: (selectElements[2] as HTMLSelectElement)?.value,
        };
      });
      console.log('After league selection:', JSON.stringify(afterLeagueState, null, 2));

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-after-league-select.png') });

    } else {
      console.log('ERROR: League dropdown is disabled! Cannot proceed.');

      // Dump the entire form HTML for inspection
      const formHTML = await page.locator('div:has-text("Sport")').first().locator('..').evaluate(el => el.outerHTML);
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'form-html-dump.html'), formHTML);

      // Get React component state if possible
      const reactState = await page.evaluate(() => {
        const form = document.querySelector('form') || document.querySelector('[role="dialog"]');
        return {
          formHTML: form?.innerHTML?.substring(0, 500),
          inputStates: Array.from(document.querySelectorAll('input, select')).map((el: any) => ({
            type: el.type || el.tagName,
            value: el.value,
            disabled: el.disabled,
            name: el.name,
            ariaDisabled: el.getAttribute('aria-disabled')
          })).slice(0, 10)
        };
      });
      console.log('React state:', JSON.stringify(reactState, null, 2));
    }

    // Save comprehensive report
    const report = {
      initialState,
      afterSportSelect,
      leagueDropdownEnabled: leagueEnabled,
      timestamp: new Date().toISOString(),
      note: 'If League dropdown is disabled after Sport selection, check if teamFormData.sport state is updating correctly'
    };

    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'diagnostic-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n=== DIAGNOSTIC COMPLETE ===');
    console.log(`Report saved to: ${path.join(SCREENSHOTS_DIR, 'diagnostic-report.json')}`);

  } catch (error: any) {
    console.error('Diagnostic failed:', error);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

diagnoseTeamForm().then(() => {
  console.log('\nDiagnostic completed.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

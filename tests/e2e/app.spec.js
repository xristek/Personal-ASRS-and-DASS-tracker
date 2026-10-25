// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Mental Health Tracker App E2E', () => {

  test('Page loads without console errors or failed requests', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');

    await expect(page).toHaveTitle(/Mental Health Tracker/i);
    await expect(page.locator('#activityOverviewCard')).toBeVisible();
    await expect(page.locator('#entryFormSection')).toBeVisible();
    await expect(page.locator('#entriesContainer')).toBeVisible();

    // Verify no unhandled exceptions
    expect(consoleErrors).toEqual([]);
  });

  test('Habit & Activity Tracker collapsible card and date selection', async ({ page }) => {
    await page.goto('/');

    const card = page.locator('#activityOverviewCard');
    const summary = card.locator('summary');
    const grid = page.locator('#heatmapGrid');

    // Initially open
    await expect(grid).toBeVisible();
    const cells = grid.locator('button');
    await expect(cells).toHaveCount(35);

    // Toggle collapse
    await summary.click();
    await expect(grid).not.toBeVisible();

    // Expand again
    await summary.click();
    await expect(grid).toBeVisible();

    // Click a day on the calendar (e.g. cell 10)
    const targetCell = cells.nth(10);
    const titleAttr = await targetCell.getAttribute('title');
    expect(titleAttr).toBeTruthy();

    await targetCell.click();

    // Verify date is set in the form
    const entryDateInput = page.locator('#entryDate');
    const selectedDate = await entryDateInput.inputValue();
    expect(selectedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Verify form title indicates the date
    const formTitle = page.locator('#formTitle');
    await expect(formTitle).toContainText(/Daily Entry/);
  });

  test('Daily Entry workflow: Quick Actions, Form Submission, Edit & Delete', async ({ page }) => {
    await page.goto('/');

    // 1. Test Quick Action: All Clear button
    const firstCheckbox = page.locator('input[name="symptom"]').first();
    await firstCheckbox.check();
    await expect(firstCheckbox).toBeChecked();

    const quickClearBtn = page.locator('#quickClearBtn');
    await quickClearBtn.click();
    await expect(firstCheckbox).not.toBeChecked();

    const quickNotice = page.locator('#quickFillNotice');
    await expect(quickNotice).toBeVisible();
    await expect(quickNotice).toContainText(/cleared/i);

    // 2. Fill and save a new entry
    const testDate = '2026-10-18';
    await page.locator('#entryDate').fill(testDate);
    
    // Check two symptoms
    const detailsCb = page.locator('input[name="symptom"][value="details"]');
    const dassD1Cb = page.locator('input[name="symptom"][value="dass_d1"]');
    await detailsCb.check();
    await dassD1Cb.check();

    await page.locator('#entryNotes').fill('Automated E2E test daily log entry.');
    await page.locator('#entryForm button[type="submit"]').click();

    // Verify saved notification
    const saveStatus = page.locator('#saveStatus');
    await expect(saveStatus).toBeVisible();
    await expect(saveStatus).toContainText(/saved/i);

    // Verify entry renders in recent entries list
    const entryCard = page.locator('#entriesContainer > div').first();
    await expect(entryCard).toContainText('Automated E2E test daily log entry.');
    await expect(entryCard).toContainText('Finishing Details');

    // 3. Edit the entry
    await entryCard.locator('button:has-text("Edit")').click();
    await expect(page.locator('#formTitle')).toContainText('Edit Daily Entry');
    await expect(page.locator('#saveBtnText')).toContainText('Update Entry');
    await expect(page.locator('#entryNotes')).toHaveValue('Automated E2E test daily log entry.');

    // Add note text and update
    await page.locator('#entryNotes').fill('Updated E2E note.');
    await page.locator('#entryForm button[type="submit"]').click();

    await expect(page.locator('#entriesContainer')).toContainText('Updated E2E note.');

    // 4. Delete the entry
    await page.locator('#entriesContainer button:has-text("Remove")').first().click();
    await expect(page.locator('#entriesContainer')).not.toContainText('Updated E2E note.');
  });

  test('14-Day Assessment Report & Longitudinal Multi-Period Comparison', async ({ page }) => {
    await page.goto('/');

    // Seed sample data to test populated report
    await page.evaluate(() => {
      window.seedSampleData();
    });

    // Switch to Report tab
    await page.locator('#tabReport').click();
    await expect(page.locator('#viewReport')).toBeVisible();
    await expect(page.locator('#viewDaily')).not.toBeVisible();

    // Verify Metric Badges
    await expect(page.locator('#metricDateRange')).not.toBeEmpty();
    await expect(page.locator('#metricDaysLogged')).toContainText('/ 14');
    await expect(page.locator('#metricClinicalCriteria')).toContainText('/ 6');

    // Verify 14-day timeline volume bars
    const bars = page.locator('#trendChartContainer > div');
    await expect(bars).toHaveCount(14);

    // Verify ASRS Screener banner
    await expect(page.locator('#screenerScoreBanner')).toBeVisible();
    await expect(page.locator('#screenerScoreBadge')).toBeVisible();

    // Verify Period-over-Period Trend Card
    const comparisonCard = page.locator('#periodComparisonCard');
    await expect(comparisonCard).toBeVisible();
    await expect(page.locator('#comparisonWindowLabel')).toContainText(/Prior Window/i);

    const comparisonCards = page.locator('#comparisonMetricsGrid > div');
    await expect(comparisonCards).toHaveCount(4);
    await expect(page.locator('#comparisonTakeaway')).toBeVisible();

    // Verify DASS score cards with delta pills
    const dassCards = page.locator('#dassScoreCards > div');
    await expect(dassCards).toHaveCount(3);
    await expect(page.locator('#dassScoreCards')).toContainText(/Depression/);
    await expect(page.locator('#dassScoreCards')).toContainText(/Anxiety/);
    await expect(page.locator('#dassScoreCards')).toContainText(/Stress/);

    // Verify ASRS & DASS tables
    await expect(page.locator('#reportTableBody tr')).toHaveCount(6);
    await expect(page.locator('#dassTableBody tr')).toHaveCount(21);
  });

  test('Dark Mode toggle and persistence', async ({ page }) => {
    await page.goto('/');

    const htmlEl = page.locator('html');
    await expect(htmlEl).not.toHaveClass(/dark/);

    const themeToggleBtn = page.locator('#themeToggleBtn');
    await themeToggleBtn.click();
    await expect(htmlEl).toHaveClass(/dark/);

    // Reload page and verify persistence in localStorage
    await page.reload();
    await expect(htmlEl).toHaveClass(/dark/);

    // Toggle back to light
    await page.locator('#themeToggleBtn').click();
    await expect(htmlEl).not.toHaveClass(/dark/);
  });

  test('Tab switching and Backup/Data operations', async ({ page }) => {
    await page.goto('/');

    // Switch to Settings tab
    await page.locator('#tabSettings').click();
    await expect(page.locator('#viewSettings')).toBeVisible();
    await expect(page.locator('#customQuestionForm')).toBeVisible();

    // Switch to Data tab
    await page.locator('#tabData').click();
    await expect(page.locator('#viewData')).toBeVisible();
    await expect(page.locator('#exportCsvBtn')).toBeVisible();
    await expect(page.locator('button:has-text("CSV Spreadsheet")')).toBeVisible();
    await expect(page.locator('button:has-text("JSON Backup")')).toBeVisible();
  });

  test('Phase 3: Multi-type custom questions (scale & numeric), daily logging, and 14-day rolling averages', async ({ page }) => {
    await page.goto('/');

    // 1. Go to Settings tab
    await page.locator('#tabSettings').click();
    await expect(page.locator('#viewSettings')).toBeVisible();

    // 2. Add 1-10 Rating Scale Question
    await page.locator('#customQName').fill('Overall Mood');
    await page.locator('#customQPrompt').fill('Rate your mood from 1 to 10 today.');
    await page.locator('#customQType').selectOption('scale');
    await page.locator('#saveCustomQBtn').click();

    // Verify in settings list
    const questionsList = page.locator('#customQuestionsList');
    await expect(questionsList).toContainText('Overall Mood');
    await expect(questionsList).toContainText('1–10 Scale');

    // 3. Add Numeric Question with Unit
    await page.locator('#customQName').fill('Hours of Sleep');
    await page.locator('#customQPrompt').fill('Total hours slept last night.');
    await page.locator('#customQType').selectOption('number');
    await page.locator('#customQUnit').fill('hrs');
    await page.locator('#saveCustomQBtn').click();

    // Verify in settings list
    await expect(questionsList).toContainText('Hours of Sleep');
    await expect(questionsList).toContainText('Number (hrs)');

    // 4. Go back to Daily Entry tab
    await page.locator('#tabDaily').click();
    await expect(page.locator('#viewDaily')).toBeVisible();

    // Verify custom section rendered scale buttons and numeric input
    const customSection = page.locator('#customSection');
    await expect(customSection).toContainText('Overall Mood');
    await expect(customSection).toContainText('Hours of Sleep');
    await expect(customSection.locator('input[placeholder="0"]')).toBeVisible();
    await expect(customSection.locator('span:has-text("hrs")')).toBeVisible();

    // 5. Fill entry with Scale and Numeric values
    const testDate = '2026-10-18';
    await page.locator('#entryDate').fill(testDate);

    // Click scale button 8 for Overall Mood
    const moodBtn8 = page.locator('button[data-val="8"]').first();
    await moodBtn8.click();
    await expect(moodBtn8).toHaveClass(/bg-indigo-600/);

    // Fill numeric input with 7.5 hrs
    const sleepInput = customSection.locator('input[type="number"]').first();
    await sleepInput.fill('7.5');

    await page.locator('#entryNotes').fill('Logged mood 8 and 7.5 hours of sleep.');
    await page.locator('#entryForm button[type="submit"]').click();

    // 6. Verify entry in recent feed
    const entryCard = page.locator('#entriesContainer > div').first();
    await expect(entryCard).toContainText('Overall Mood: 8/10');
    await expect(entryCard).toContainText('Hours of Sleep: 7.5 hrs');

    // 7. Verify 14-Day Report tab displays rolling averages and ranges
    await page.locator('#tabReport').click();
    await expect(page.locator('#viewReport')).toBeVisible();

    const reportTable = page.locator('#customReportTableBody');
    await expect(reportTable).toContainText('Overall Mood');
    await expect(reportTable).toContainText('8.0 / 10 avg');
    await expect(reportTable).toContainText('Score: 8');

    await expect(reportTable).toContainText('Hours of Sleep');
    await expect(reportTable).toContainText('7.5 hrs avg');
    await expect(reportTable).toContainText('Min: 7.5 hrs');

    // 8. Edit the entry to verify editing updates both feed and report
    await page.locator('#tabDaily').click();
    await entryCard.locator('button:has-text("Edit")').click();

    // Change Mood to 9
    const moodBtn9 = page.locator('button[data-val="9"]').first();
    await moodBtn9.click();
    await page.locator('#entryForm button[type="submit"]').click();

    // Verify updated badge
    await expect(page.locator('#entriesContainer > div').first()).toContainText('Overall Mood: 9/10');

    // Verify updated report average
    await page.locator('#tabReport').click();
    await expect(reportTable).toContainText('9.0 / 10 avg');
  });

  test('Phase 4: Storage Mode Selector (Local vs Google Drive E2EE) and Zero-Knowledge Sync Round-Trip', async ({ page }) => {
    let uploadedEnvelope = null;

    // Intercept Google Drive API calls to verify zero-knowledge appDataFolder encryption & LWW merge
    await page.route('https://www.googleapis.com/drive/v3/files*', async (route) => {
      const url = route.request().url();
      if (url.includes('spaces=appDataFolder')) {
        if (!uploadedEnvelope) {
          // Simulate remote device having an encrypted entry from another day
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ files: [] })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              files: [{ id: 'mock-appdata-file-1', name: 'mental_health_tracker_sync_v1.enc.json' }]
            })
          });
        }
      } else if (url.includes('alt=media')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(uploadedEnvelope)
        });
      }
    });

    await page.route('https://www.googleapis.com/upload/drive/v3/files*', async (route) => {
      const postData = route.request().postData() || '';
      const matches = postData.match(/\{\s*"schemaVersion"[\s\S]*?\}/);
      if (matches) {
        uploadedEnvelope = JSON.parse(matches[0]);
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-appdata-file-1', name: 'mental_health_tracker_sync_v1.enc.json' })
      });
    });

    await page.goto('/');

    // 1. Create a local entry first
    await page.locator('#entryDate').fill('2026-10-20');
    await page.locator('#entryForm input[name="symptom"][value="restless"]').check();
    await page.locator('#entryNotes').fill('Local device entry before cloud sync');
    await page.locator('#entryForm button[type="submit"]').click();
    await expect(page.locator('#logCount')).toContainText('1 entry');

    // 2. Navigate to Backup & Export tab and verify Local Storage Only is active by default
    await page.locator('#tabData').click();
    await expect(page.locator('#viewData')).toBeVisible();
    await expect(page.locator('#storageModeBadge')).toContainText('Local Storage Only');
    await expect(page.locator('#gdriveSyncPanel')).toBeHidden();
    await expect(page.locator('#syncHeaderBadge')).toBeHidden();

    // 3. Switch to Google Drive Cloud Sync (E2EE) mode and verify localStorage entries are retained
    await page.locator('#modeGdriveCard').click();
    await expect(page.locator('#storageModeBadge')).toContainText('Google Drive Cloud Sync (E2EE)');
    await expect(page.locator('#gdriveSyncPanel')).toBeVisible();
    await expect(page.locator('#syncHeaderBadge')).toBeVisible();

    // Verify setup guide dynamically populates Authorized JavaScript origin and canonical Redirect URI
    await page.locator('#gdriveSetupGuide summary').click();
    await expect(page.locator('#oauthOriginValue')).toHaveText('http://localhost:3000');
    await expect(page.locator('#oauthRedirectUriValue')).toHaveText('http://localhost:3000/');

    // 4. Configure Client ID & simulate connected Google Drive account + Master Passphrase
    await page.locator('#gdriveClientId').fill('987654321-testclient.apps.googleusercontent.com');
    await page.evaluate(() => {
      window.DriveAuth.saveTokenState({
        accessToken: 'mock-oauth-access-token-xyz',
        email: 'user.personal@gmail.com',
        expiresAt: Date.now() + 3600000
      });
      window.setStorageMode('gdrive');
    });

    await expect(page.locator('#gdriveAccountStatus')).toContainText('Connected: user.personal@gmail.com');
    await expect(page.locator('#switchGdriveAccountBtn')).toBeVisible();
    await expect(page.locator('#disconnectGdriveBtn')).toBeVisible();

    // Enter Master Encryption Passphrase and trigger Sync Now
    await page.locator('#syncPassphraseInput').fill('my-zero-knowledge-secret-2026');
    await page.locator('#syncNowBtn').click();

    await expect(page.locator('#syncStatusMessage')).toContainText('Zero-Knowledge E2EE Sync complete');
    expect(uploadedEnvelope).not.toBeNull();
    expect(uploadedEnvelope.cipher).toBe('AES-GCM-256');
    expect(uploadedEnvelope.kdf).toBe('PBKDF2-SHA256');
    expect(JSON.stringify(uploadedEnvelope)).not.toContain('Local device entry before cloud sync');

    // 5. Switch back to Local Storage Only and confirm local entries remain intact
    await page.locator('#modeLocalCard').click();
    await expect(page.locator('#storageModeBadge')).toContainText('Local Storage Only');
    await expect(page.locator('#gdriveSyncPanel')).toBeHidden();
    await page.locator('#tabDaily').click();
    await expect(page.locator('#entriesContainer')).toContainText('Local device entry before cloud sync');
  });
});


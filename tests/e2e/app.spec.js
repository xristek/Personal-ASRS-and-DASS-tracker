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
});

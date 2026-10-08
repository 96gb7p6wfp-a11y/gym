import { expect, test, type Page } from '@playwright/test';

async function openPlan(page: Page) {
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
}

async function openTargets(page: Page) {
  await page.getByRole('button', { name: /^Targets/ }).click();
  await expect(page.getByRole('dialog', { name: 'Daily targets', exact: true })).toBeVisible();
}

test('volleyball times validate, persist and update workout and meal guidance', async ({ page }) => {
  await page.goto('/');
  await openPlan(page);
  await page.locator('.plan-schedule > summary').click();
  const schedule = page.getByRole('region', { name: 'Volleyball schedule', exact: true });
  await expect(schedule).toContainText('Tuesday and Friday');
  await expect(schedule).toContainText('20:00–22:00');
  await schedule.getByText('Edit training times', { exact: true }).click();
  await schedule.getByLabel('Volleyball end time', { exact: true }).fill('19:00');
  await schedule.getByRole('button', { name: 'Save volleyball times', exact: true }).click();
  await expect(schedule.getByRole('status')).toContainText('end time after');
  await expect(schedule.locator('strong')).toHaveText('20:00–22:00');
  await schedule.getByLabel('Volleyball start time', { exact: true }).fill('21:00');
  await schedule.getByLabel('Volleyball end time', { exact: true }).fill('23:00');
  await schedule.getByRole('button', { name: 'Save volleyball times', exact: true }).click();
  await expect(schedule.getByRole('status')).toHaveText('Training times saved.');
  await page.reload();
  await openPlan(page);
  await page.locator('.plan-schedule > summary').click();
  await expect(schedule).toContainText('21:00–23:00');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-10-06');
  await page.locator('.nutrition-simple-fuel > summary').click();
  await expect(page.locator('.nutrition-simple-fuel')).toContainText('19:00–20:00');
  await expect(page.locator('.nutrition-simple-fuel')).toContainText('After 23:00');
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Tue / }).click();
  await expect(page.getByRole('button', { name: 'Volleyball · 21:00', exact: true })).toBeVisible();
});

test('movement loading advice preserves distinct strength and power targets', async ({ page }) => {
  await page.goto('/');
  await openPlan(page);
  await page.locator('.plan-day-details > summary').filter({ hasText: 'Lower Body' }).click();
  await page.locator('.plan-day-details > summary').filter({ hasText: 'Upper Body' }).first().click();
  const squat = page.locator('details.exercise-guide').filter({ has: page.locator('summary[aria-label="Exercise details for Hack Squat"]') }).first();
  await squat.locator('summary').click();
  await expect(squat.locator('.exercise-guide__loading')).toContainText('Your target: 4–6 reps');
  await expect(squat.locator('.exercise-guide__loading')).toContainText('2 good reps');
  const slam = page.locator('details.exercise-guide').filter({ has: page.locator('summary[aria-label="Exercise details for Medicine Ball Spike Slam"]') }).first();
  await slam.locator('summary').click();
  await expect(slam.locator('.exercise-guide__loading')).toContainText('Your target: 4 reps');
  await expect(slam.locator('.exercise-guide__loading')).toContainText(/speed|fast/i);
  await expect(slam.locator('.exercise-guide__loading')).not.toContainText('top of the rep');
});

test('daily targets and explicit supplement tracking save and reload offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15_000 }).toBe('activated');
  await context.setOffline(true);
  await openTargets(page);
  await page.locator('.nutrition-calculator').getByRole('button', { name: 'Use these daily targets', exact: true }).click();
  await expect(page.locator('.nutrition-totals')).toContainText('of 3000 kcal');
  await page.getByRole('dialog', { name: 'Daily targets', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  const reminders = page.getByRole('region', { name: 'Supplement and medication reminders', exact: true });
  await reminders.getByRole('button', { name: 'Mark Mivolis zinc taken', exact: true }).click();
  await expect(reminders.getByRole('button', { name: 'Undo Mivolis zinc taken', exact: true })).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await expect(page.locator('.nutrition-totals')).toContainText('of 3000 kcal');
  await openTargets(page);
  await expect(page.locator('.nutrition-calculator')).toContainText('128 g');
  await page.getByRole('dialog', { name: 'Daily targets', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(reminders.getByRole('button', { name: 'Undo Mivolis zinc taken', exact: true })).toBeVisible();
});

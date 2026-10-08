import { expect, test, type Page } from '@playwright/test';

const KEY = 'setline.gym.v1';
const panel = (page: Page) => page.getByRole('region', { name: 'Supplement and medication reminders', exact: true });
async function openNutrition(page: Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-10-08');
}

async function openRoutine(page: Page) {
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await page.getByLabel('Routine date', { exact: true }).fill('2026-10-08');
}

test('a saved meal suggests zinc without logging a dose; Later, Taken, Undo and history survive reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openNutrition(page);
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await meal.getByLabel('Meal name', { exact: true }).fill('Lunch');
  await meal.getByLabel('Food 1', { exact: true }).fill('Rice and tofu');
  await meal.getByLabel('Calories · kcal', { exact: true }).fill('600');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(meal).not.toBeVisible();
  await expect(page.getByRole('status')).toContainText('Meal saved');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).reminders.entries.length, KEY)).toBe(0);
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await page.getByLabel('Routine date', { exact: true }).fill('2026-10-08');
  for (const name of ['Doppelherz D3 + K2', 'Doppelherz omega-3', 'Mivolis Magnesium 500']) {
    await expect(panel(page).getByRole('button', { name: `Mark ${name} taken`, exact: true })).toHaveCount(0);
  }
  await panel(page).locator('li').filter({ has: page.getByRole('button', { name: 'Edit Mivolis zinc reminder', exact: true }) }).locator('summary').click();
  await panel(page).getByRole('button', { name: 'Remind later for Mivolis zinc', exact: true }).click();
  await expect(panel(page)).toContainText('Later');
  await expect(panel(page).locator('.reminder-panel__meal')).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Undo later for Mivolis zinc', exact: true }).click();
  await panel(page).getByRole('button', { name: 'Mark Mivolis zinc taken', exact: true }).click();
  await expect(panel(page)).toContainText('Taken');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).reminders.entries.length, KEY)).toBe(1);
  await page.reload();
  await openRoutine(page);
  await expect(panel(page).getByRole('button', { name: 'Undo Mivolis zinc taken', exact: true })).toBeVisible();
  await page.getByLabel('Routine date', { exact: true }).fill('2026-10-07');
  await expect(panel(page).getByRole('button', { name: 'Mark Mivolis zinc taken', exact: true })).toBeVisible();
  await page.getByLabel('Routine date', { exact: true }).fill('2026-10-08');
  await panel(page).getByRole('button', { name: 'Undo Mivolis zinc taken', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Mark Mivolis zinc taken', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).reminders.entries[0].entry.takenAt, KEY)).toBeNull();
  expect(errors).toEqual([]);
});

test('custom medicines keep prescribed instructions without assumed frequency and remain usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await openNutrition(page);
  await openRoutine(page);
  await panel(page).getByRole('button', { name: 'Add reminder', exact: true }).click();
  const form = page.getByRole('form', { name: 'Reminder form', exact: true });
  await form.getByLabel('Name', { exact: true }).fill('My prescribed medicine');
  await form.getByLabel('Label or prescribed instructions', { exact: true }).fill('Follow the instructions on my prescription.');
  await expect(form.getByLabel('Reminder timing', { exact: true })).toHaveValue('instructions');
  await expect(form.getByLabel('Frequency', { exact: true })).toHaveValue('instructions-only');
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Mark My prescribed medicine taken', exact: true })).toHaveCount(0);
  await expect(form).not.toBeVisible();
  const manage = panel(page).locator('.reminder-panel__manage');
  await manage.locator(':scope > summary').click();
  await expect(manage).toHaveAttribute('open', '');
  await panel(page).getByRole('button', { name: 'Edit My prescribed medicine reminder', exact: true }).click();
  await form.getByLabel('Frequency', { exact: true }).selectOption('once-daily');
  await form.getByLabel('Reminder timing', { exact: true }).selectOption('time');
  await form.getByLabel('Reminder time · Berlin', { exact: true }).fill('22:30');
  await form.getByRole('checkbox', { name: 'I verified these instructions and once-daily frequency from my label or prescription.', exact: true }).check();
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Mark My prescribed medicine taken', exact: true })).toBeVisible();
  await expect(panel(page)).toContainText('22:30');
  const medicine = panel(page).locator('li').filter({ has: page.getByRole('button', { name: 'Edit My prescribed medicine reminder', exact: true }) });
  await medicine.locator('summary').click();
  await expect(medicine).toContainText('Once daily');
  await panel(page).getByRole('button', { name: 'Edit My prescribed medicine reminder', exact: true }).click();
  await form.getByLabel('Label or prescribed instructions', { exact: true }).fill('Changed prescription: needs a new confirmation.');
  await expect(form.getByRole('checkbox', { name: 'I verified these instructions and once-daily frequency from my label or prescription.', exact: true })).not.toBeChecked();
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: 'Mark My prescribed medicine taken', exact: true })).toHaveCount(0);
  await page.reload();
  await openRoutine(page);
  await expect(panel(page)).toContainText('My prescribed medicine');
  const bounds = await panel(page).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

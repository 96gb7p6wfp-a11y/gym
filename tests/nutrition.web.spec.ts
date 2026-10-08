import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';

async function openTargets(page: Page) {
  await page.getByRole('button', { name: /^Targets/, exact: false }).click();
  await expect(page.getByRole('dialog', { name: 'Daily targets', exact: true })).toBeVisible();
}

async function closeTargets(page: Page) {
  await page.getByRole('dialog', { name: 'Daily targets', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  await openTargets(page);
});

test('calculated targets require an explicit action and preserve existing meals and goal weight', async ({ page }) => {
  const calculator = page.locator('.nutrition-calculator');
  await expect(calculator).toContainText('3,000 kcal/day');
  await expect(calculator).toContainText('128 g');
  await expect(calculator).toContainText('442 g');
  await page.getByRole('button', { name: 'Edit targets', exact: true }).click();
  const targetDialog = page.getByRole('dialog', { name: 'Your nutrition targets', exact: true });
  for (const [label, value] of [['Calories · kcal', '2800'], ['Protein · g', '120'], ['Carbs · g', '350'], ['Fat · g', '80'], ['Goal weight · kg', '68']]) {
    await targetDialog.getByLabel(label, { exact: true }).fill(value);
  }
  await targetDialog.getByRole('button', { name: 'Save targets', exact: true }).click();
  await expect(page.locator('.nutrition-totals')).toContainText('of 2800 kcal');
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await meal.getByLabel('Meal name', { exact: true }).fill('Yogurt and oats');
  await meal.getByLabel('Food 1', { exact: true }).fill('Yogurt');
  await meal.getByLabel('Serving / portion', { exact: true }).fill('200 g');
  await meal.getByLabel('Calories · kcal', { exact: true }).fill('200');
  await meal.getByLabel('Protein · g', { exact: true }).fill('20');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.locator('.nutrition-meals')).toContainText('Yogurt and oats');
  await expect(page.locator('.nutrition-totals')).toContainText('of 2800 kcal');
  await openTargets(page);
  await calculator.getByRole('button', { name: 'Use these daily targets', exact: true }).click();
  await expect(calculator.getByRole('status')).toContainText('Daily targets saved');
  await expect(page.locator('.nutrition-totals')).toContainText('of 3000 kcal');
  await page.reload();
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await expect(page.locator('.nutrition-totals')).toContainText('of 3000 kcal');
  await expect(page.locator('.nutrition-meals')).toContainText('Yogurt and oats');
  await openTargets(page);
  await expect(page.getByText('Goal weight: 68 kg', { exact: true })).toBeVisible();
});

test('calculation details support decimal-comma body weight and reject invalid ages without replacing targets', async ({ page }) => {
  const calculator = page.locator('.nutrition-calculator');
  await calculator.getByText('Edit calculation details', { exact: true }).click();
  const weight = calculator.getByLabel('Weight for calculation · kg', { exact: true });
  await weight.fill('');
  await weight.pressSequentially('64,5');
  await calculator.getByLabel('Age', { exact: true }).fill('17');
  await expect(calculator.getByRole('button', { name: 'Use these daily targets', exact: true })).toBeDisabled();
  await calculator.getByRole('button', { name: 'Save calculation details', exact: true }).click();
  await expect(calculator.getByRole('alert')).toContainText('Check your age');
  await calculator.getByLabel('Age', { exact: true }).fill('19');
  await calculator.getByRole('button', { name: 'Save calculation details', exact: true }).click();
  await expect(calculator.getByRole('status')).toContainText('Calculation details saved');
  await expect(page.locator('.nutrition-totals')).toContainText('No target set');
  await page.reload();
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await openTargets(page);
  await calculator.getByText('Edit calculation details', { exact: true }).click();
  await expect(calculator.getByLabel('Weight for calculation · kg', { exact: true })).toHaveValue('64.5');
  await expect(calculator.getByLabel('Age', { exact: true })).toHaveValue('19');
  await expect(page.locator('.nutrition-totals')).toContainText('No target set');
});

test('food guidance follows the selected volleyball date and stays compact on small iPhones', async ({ page }) => {
  await closeTargets(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-10-06');
  const fuel = page.locator('.nutrition-simple-fuel');
  await fuel.locator(':scope > summary').click();
  await expect(fuel).toContainText('20:00–22:00');
  await expect(fuel).toContainText('18:00–19:00');
  await expect(fuel).toContainText('After 22:00');
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-10-08');
  await expect(fuel).not.toContainText('Volleyball 20:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('choosing an unspecified equation preserves privacy and allows manual targets', async ({ page }) => {
  const calculator = page.locator('.nutrition-calculator');
  await calculator.getByText('Edit calculation details', { exact: true }).click();
  await calculator.getByLabel('Energy equation', { exact: true }).selectOption('unspecified');
  await expect(calculator.getByRole('button', { name: 'Use these daily targets', exact: true })).toBeDisabled();
  await calculator.getByRole('button', { name: 'Save calculation details', exact: true }).click();
  await expect(calculator.getByRole('status')).toContainText('Calculation details saved');
  await page.reload();
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await openTargets(page);
  await expect(calculator).toContainText('edit your targets manually');
  await calculator.getByText('Edit calculation details', { exact: true }).click();
  await expect(calculator.getByLabel('Energy equation', { exact: true })).toHaveValue('unspecified');
  await expect(page.locator('.nutrition-totals')).toContainText('No target set');
});

test('older profiles explicitly load the shared details while historical workout weight stays unchanged', async ({ page }) => {
  const { nutrition: _nutrition, volleyballSchedule: _schedule, ...olderFields } = DEFAULT_PROFILE;
  const legacyProfile = { ...olderFields, bodyWeight: 61 };
  const historical = stopSessionTimers(createSession(legacyProfile.plan[0], 0, '2026-10-05', legacyProfile, []), 'completed');
  await page.evaluate(({ profile, historical }) => {
    localStorage.setItem('setline.gym.v1', JSON.stringify({
      schemaVersion: 1, profile, profileVersion: 1,
      sessions: [{ session: historical, version: 1 }], nutrition: [], activities: [],
    }));
  }, { profile: legacyProfile, historical });
  await page.reload();
  await page.getByRole('tab', { name: 'Nutrition', exact: true }).click();
  await openTargets(page);
  const calculator = page.locator('.nutrition-calculator');
  await expect(calculator).toContainText('2,900 kcal/day');
  await calculator.getByRole('button', { name: 'Use my shared details (18 years, 180 cm, 64 kg)', exact: true }).click();
  await expect(calculator).toContainText('3,000 kcal/day');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('setline.gym.v1')!).profile.bodyWeight)).toBe(61);
  await calculator.getByRole('button', { name: 'Use these daily targets', exact: true }).click();
  await expect(calculator.getByRole('status')).toContainText('Daily targets saved');
  expect(await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('setline.gym.v1')!);
    return { current: data.profile.bodyWeight, historical: data.sessions[0].session.bodyWeight };
  })).toEqual({ current: 64, historical: 61 });
  await expect(calculator.getByRole('button', { name: 'Use my shared details (18 years, 180 cm, 64 kg)', exact: true })).toHaveCount(0);
});

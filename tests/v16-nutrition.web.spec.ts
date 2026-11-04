import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders.ts';
import { openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T10:00:00Z') });
  await page.addInitScript(({ key, profile, reminders }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [], reminders }));
  }, { key: STORE, profile: DEFAULT_PROFILE, reminders: defaultReminderState() });
  await page.goto('/');
  await openSection(page, 'Nutrition');
});

test('quick calories and protein store partial macros without inventing zeros or duplicate entries', async ({ page }) => {
  await page.getByRole('button', { name: 'Quick entry', exact: true }).click();
  const quick = page.getByRole('dialog', { name: 'Quick nutrition entry', exact: true });
  await quick.getByLabel('Calories · kcal', { exact: true }).fill('250,5');
  await quick.getByLabel('Protein · g', { exact: true }).fill('20');
  await quick.getByLabel('Save as a favorite meal', { exact: true }).check();
  await quick.getByRole('button', { name: 'Save quick entry', exact: true }).evaluate(element => {
    for (let index = 0; index < 10; index++) (element as HTMLButtonElement).click();
  });
  await expect(quick).not.toBeVisible();
  const store = await read(page);
  expect(store.nutrition).toHaveLength(1);
  expect(store.nutrition[0].payload.foods[0]).toMatchObject({ calories: 250.5, protein: 20, carbs: null, fat: null });
  expect(store.nutrition[0].payload.favorite).toBe(true);
  await expect(page.locator('.nutrition-meals')).toContainText('Partial macros');
  await expect(page.locator('.nutrition-daily__macros')).toContainText('Not recorded');
  await page.reload();
  await openSection(page, 'Nutrition');
  expect((await read(page)).nutrition).toEqual(store.nutrition);
});

test('favorite reuse and portion correction preserve unknown macros and the original meal', async ({ page }) => {
  await page.getByRole('button', { name: 'Quick entry', exact: true }).click();
  const quick = page.getByRole('dialog', { name: 'Quick nutrition entry', exact: true });
  await quick.getByLabel('Meal name · optional', { exact: true }).fill('Favorite yogurt');
  await quick.getByLabel('Calories · kcal', { exact: true }).fill('250');
  await quick.getByLabel('Protein · g', { exact: true }).fill('20');
  await quick.getByLabel('Save as a favorite meal', { exact: true }).check();
  await quick.getByRole('button', { name: 'Save quick entry', exact: true }).click();
  const original = (await read(page)).nutrition[0];
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await editor.locator('details').filter({ has: page.locator('summary').filter({ hasText: /^Favorite meals$/ }) }).getByRole('button', { name: 'Favorite yogurt 250 kcal', exact: true }).click();
  await editor.getByRole('button', { name: 'Half portion', exact: true }).click();
  await expect(editor.getByLabel('Calories · kcal', { exact: true })).toHaveValue('125');
  await expect(editor.getByLabel('Protein · g', { exact: true })).toHaveValue('10');
  await expect(editor.getByLabel('Carbs · g', { exact: true })).toHaveValue('');
  await expect(editor).toContainText('Partial macros');
  await editor.getByRole('button', { name: 'Save meal', exact: true }).click();
  const store = await read(page);
  expect(store.nutrition).toHaveLength(2);
  expect(store.nutrition.find((record: { id: string }) => record.id === original.id)).toEqual(original);
  expect(store.nutrition.find((record: { id: string }) => record.id !== original.id).payload.foods[0]).toMatchObject({ calories: 125, protein: 10, carbs: null, fat: null });
});

test('missing macros can be corrected later and small-screen numeric inputs remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Quick entry', exact: true }).click();
  const quick = page.getByRole('dialog', { name: 'Quick nutrition entry', exact: true });
  await quick.getByLabel('Calories · kcal', { exact: true }).fill('200');
  await quick.getByLabel('Protein · g', { exact: true }).fill('15');
  await quick.getByLabel('Quantity · portions', { exact: true }).fill('1.5');
  expect(await quick.getByLabel('Protein · g', { exact: true }).getAttribute('inputmode')).toBe('decimal');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await quick.getByRole('button', { name: 'Save quick entry', exact: true }).click();
  await page.locator('.nutrition-meal').click();
  const editor = page.getByRole('dialog', { name: 'Edit meal', exact: true });
  await editor.getByLabel('Carbs · g', { exact: true }).fill('30');
  await editor.getByLabel('Fat · g', { exact: true }).fill('0');
  await editor.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.locator('.nutrition-meals')).not.toContainText('Partial macros');
  const store = await read(page);
  expect(store.nutrition).toHaveLength(1);
  expect(store.nutrition[0].payload.foods[0]).toMatchObject({ calories: 300, protein: 22.5, carbs: 30, fat: 0 });
});

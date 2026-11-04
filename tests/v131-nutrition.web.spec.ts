import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';
import { openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, withTargets = true) {
  await page.clock.install({ time: new Date('2026-11-03T17:00:00Z') });
  const nutrition = [
    { id: 'saved-lunch', date: '2026-11-03', version: 2, payload: { kind: 'meal', name: 'My saved lunch', foods: [{ name: 'Rice and tofu', portion: 'Bowl', calories: 600, protein: 25, carbs: 90, fat: 12 }], source: 'manual', notes: '', assumptions: '', confidence: null } },
    { id: 'weight-saved', date: '2026-11-02', version: 1, payload: { kind: 'weight', kg: 64.3 } },
    ...(withTargets ? [{ id: 'targets', date: '2026-11-01', version: 3, payload: { kind: 'targets', calories: 2800, protein: 120, carbs: 350, fat: 80, goalWeight: 68 } }] : []),
  ];
  await page.addInitScript(({ profile, nutrition, reminders }) => {
    if (!localStorage.getItem('setline.gym.v1') || JSON.parse(localStorage.getItem('setline.gym.v1')!).profileVersion === 0) localStorage.setItem('setline.gym.v1', JSON.stringify({
      schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition, reminders, activities: [],
    }));
  }, { profile: DEFAULT_PROFILE, nutrition, reminders: defaultReminderState() });
  await page.goto('/');
  await openSection(page, 'Nutrition');
  await page.locator('.nutrition-tools > summary').click();
}

async function openTargets(page: Page) {
  await page.getByRole('button', { name: /^Targets/, exact: false }).click();
  return page.getByRole('dialog', { name: 'Daily targets', exact: true });
}

test('V13.1 nutrition is a reviewed opt-in and preserves meals, goal weight, routine and calculation details', async ({ page }) => {
  await seed(page);
  const before = await read(page);
  const targets = await openTargets(page);
  await targets.getByRole('button', { name: /^V13.1 starting targets/ }).click();
  const proposal = targets.getByRole('region', { name: 'V13.1 nutrition recommendation', exact: true });
  await expect(proposal).toContainText('3,050 kcal/day');
  await expect(proposal).toContainText('130 g');
  await expect(proposal).toContainText('420 g');
  await expect(proposal).toContainText('95 g');
  await expect(proposal).toContainText('3,055 kcal');
  await page.screenshot({ path: test.info().outputPath('v131-targets-review.png') });
  expect(await read(page)).toEqual(before);
  await proposal.getByRole('button', { name: 'Keep current targets', exact: true }).click();
  expect(await read(page)).toEqual(before);
  await targets.getByRole('button', { name: /^V13.1 starting targets/ }).click();
  await proposal.getByRole('button', { name: 'Apply V13.1 targets', exact: true }).click();
  await expect(proposal.getByRole('status')).toContainText('V13.1 targets saved');
  const after = await read(page);
  expect(after.nutrition.find((record: any) => record.id === 'targets').payload).toEqual({ kind: 'targets', calories: 3050, protein: 130, carbs: 420, fat: 95, goalWeight: 68 });
  expect(after.nutrition.filter((record: any) => record.id !== 'targets')).toEqual(before.nutrition.filter((record: any) => record.id !== 'targets'));
  expect(after.profile).toEqual(before.profile);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.reminders).toEqual(before.reminders);
  await page.reload();
  await openSection(page, 'Nutrition');
  await expect(page.locator('.nutrition-totals')).toContainText('of 3050 kcal');
  await expect(page.locator('.nutrition-meals')).toContainText('My saved lunch');
});

test('an unset goal offers 66–67 kg only after the V13.1 target confirmation', async ({ page }) => {
  await seed(page, false);
  const targets = await openTargets(page);
  expect((await read(page)).nutrition.some((record: any) => record.payload.kind === 'targets')).toBe(false);
  await targets.getByRole('button', { name: /^V13.1 starting targets/ }).click();
  await expect(targets).toContainText('Your goal weight will start at 66.5 kg');
  expect((await read(page)).nutrition.some((record: any) => record.payload.kind === 'targets')).toBe(false);
  await targets.getByRole('button', { name: 'Apply V13.1 targets', exact: true }).click();
  await expect(targets.getByRole('status')).toContainText('V13.1 targets saved');
  expect((await read(page)).nutrition.find((record: any) => record.payload.kind === 'targets').payload.goalWeight).toBe(66.5);
});

test('meal cues are individually enabled, follow volleyball days and remain editable without changing supplements', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seed(page);
  const before = await read(page);
  const meals = page.locator('.meal-timing-options');
  await meals.locator(':scope > summary').click();
  await page.screenshot({ path: test.info().outputPath('v131-meal-reminders-small.png') });
  expect((await read(page)).reminders).toEqual(before.reminders);
  await meals.getByRole('button', { name: 'Add Pre-volleyball meal reminder', exact: true }).click();
  await expect(meals.getByRole('button', { name: 'Add Pre-volleyball meal reminder', exact: true })).toBeDisabled();
  const after = await read(page);
  expect(after.reminders.items.filter((item: any) => item.reminder.kind !== 'meal')).toEqual(before.reminders.items);
  expect(after.reminders.items.filter((item: any) => item.reminder.kind === 'meal')).toHaveLength(1);
  expect(after.reminders.entries).toEqual([]);
  await meals.getByRole('button', { name: 'Edit routine', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mark Pre-volleyball meal done', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Pre-volleyball meal reminder', exact: true }).click();
  const form = page.getByRole('form', { name: 'Reminder form', exact: true });
  await form.getByLabel('Reminder time · Berlin', { exact: true }).fill('17:00');
  await form.getByRole('checkbox', { name: 'Use this once-daily meal reminder on the selected days.', exact: true }).check();
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(form).not.toBeVisible();
  await page.getByRole('button', { name: 'Mark Pre-volleyball meal done', exact: true }).click();
  expect((await read(page)).reminders.entries[0].entry.reminderId).toBe('meal-pre-volleyball');
  expect((await read(page)).reminders.entries).toHaveLength(1);
  await page.getByLabel('Routine date', { exact: true }).fill('2026-11-04');
  await expect(page.getByRole('button', { name: 'Mark Pre-volleyball meal done', exact: true })).toHaveCount(0);
  const manage = page.locator('.reminder-panel__manage');
  await manage.locator(':scope > summary').click();
  await expect(manage).toContainText('Not scheduled today');
  await expect(page.getByRole('button', { name: 'Edit Pre-volleyball meal reminder', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  const persisted = await read(page);
  expect(persisted.reminders.items.find((item: any) => item.reminder.id === 'meal-pre-volleyball').reminder.time).toBe('17:00');
  expect(persisted.reminders.items.filter((item: any) => item.reminder.kind !== 'meal')).toEqual(before.reminders.items);
});

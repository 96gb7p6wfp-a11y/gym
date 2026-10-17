import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
async function openPlan(page: Page) {
  await page.getByRole('tab', { name: 'More', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  await page.locator('.native-program-options > summary').click();
}
async function activate(page: Page, matches: number[] = []) {
  await openPlan(page);
  const program = page.getByRole('region', { name: '8-week volleyball-first program', exact: true });
  await program.getByLabel('Start Monday', { exact: true }).fill('2026-10-19');
  for (const week of matches) await program.getByRole('checkbox', { name: `Week ${week}`, exact: true }).check();
  await program.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram?.startDate).toBe('2026-10-19');
  return program;
}
async function day(page: Page, name: string) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name} `) }).click();
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.goto('/');
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.plan[0].name = 'My saved upper plan';
  profile.plan[0].exercises[0].sets = 2;
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 0, sessions: [], nutrition: [], activities: [] })), { key: STORE, profile });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
});

test('activates the full master plan, saves the old week and keeps run/PE as scheduled cues', async ({ page }) => {
  const before = await read(page);
  await activate(page);
  const saved = await read(page);
  expect(saved.profile.preMasterPlan).toEqual(before.profile.plan);
  expect(saved.profile.plan[0].exercises).toHaveLength(8);
  expect(saved.sessions).toEqual(before.sessions);
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Upper Power A');
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Week 1');
  await day(page, 'Thu'); await expect(page.locator('.master-day-note')).toContainText('Easy 5 km');
  await day(page, 'Fri'); await expect(page.locator('.master-day-note')).toContainText('School PE');
  expect((await read(page)).activities).toEqual([]);
  await page.reload(); await day(page, 'Wed');
  await expect(page.locator('.session-card h2')).toHaveText('Main Jump + Heavy Lower A');
});

test('match week uses a short Saturday primer and keeps Sunday match time separate from club practice', async ({ page }) => {
  await activate(page, [1]);
  await day(page, 'Sun');
  await expect(page.locator('.session-card h2')).toHaveText('Match');
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Match · log your actual duration');
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).not.toContainText('20:00');
  await day(page, 'Sat');
  await expect(page.locator('.session-card h2')).toHaveText('Pre-Match Primer');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  expect((await read(page)).sessions).toHaveLength(0);
  await page.getByRole('group', { name: 'Program readiness', exact: true }).getByRole('button', { name: 'Green', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  const active = (await read(page)).sessions[0].session;
  expect(active.name).toBe('Pre-Match Primer'); expect(active.exercises[0].logs).toHaveLength(3);
  expect(active.exercises[0].target).toBe('1 rep');
});

test('Saturday yellow and red adjust only future work, then green restores the base session', async ({ page }) => {
  await activate(page); await day(page, 'Sat');
  const readiness = page.getByRole('group', { name: 'Program readiness', exact: true });
  await readiness.getByRole('button', { name: 'Yellow', exact: true }).click();
  await page.locator('.planned-preview > summary').click();
  const preview = page.locator('.planned-preview');
  await expect(preview).not.toContainText('Hurdle Hops');
  await expect(preview.locator('.planned-exercise').filter({ hasText: 'Approach Jump' })).toContainText('2 sets');
  await readiness.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Recovery');
  await readiness.getByRole('button', { name: 'Green', exact: true }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Reactive + Hard Lower B');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  const active = (await read(page)).sessions[0].session;
  expect(active.exercises.find((exercise: { name: string }) => exercise.name === 'Approach Jump').logs).toHaveLength(3);
  expect(active.exercises.some((exercise: { name: string }) => exercise.name === 'Hurdle Hops')).toBe(true);
});

test('week four creates reduced snapshot doses and later plan edits cannot rewrite that active session', async ({ page }) => {
  await activate(page); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  for (let week = 0; week < 3; week++) await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await day(page, 'Wed'); await expect(page.locator('.master-day-note')).toContainText('Week 4 · Deload');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  const active = (await read(page)).sessions[0].session;
  expect(active.exercises.find((exercise: { name: string }) => exercise.name === 'Approach Jump').logs).toHaveLength(3);
  expect(active.exercises.find((exercise: { name: string }) => exercise.name === 'CMJ with Arm Swing').logs).toHaveLength(2);
  await openPlan(page); const program = page.getByRole('region', { name: '8-week volleyball-first program', exact: true });
  await program.getByText('Schedule & options', { exact: true }).click();
  await program.getByRole('checkbox', { name: 'Week 4', exact: true }).check();
  await program.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.matchWeeks).toEqual([4]);
  expect((await read(page)).sessions[0].session).toEqual(active);
});

test('logs a decimal loaded carry as metres and preserves the unit after refresh on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await activate(page); await day(page, 'Wed');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.locator('.focused-movements > summary').click();
  await page.getByRole('button', { name: 'Train Suitcase Carry', exact: true }).click();
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('textbox', { name: 'Suitcase Carry set 1 weight in kilograms', exact: true }).fill('12.5');
  await current.getByRole('spinbutton', { name: 'Suitcase Carry set 1 distance in metres', exact: true }).fill('25');
  await current.getByRole('button', { name: 'Complete Suitcase Carry set 1', exact: true }).click();
  await expect.poll(async () => (await read(page)).sessions[0].session.exercises.find((exercise: { name: string }) => exercise.name === 'Suitcase Carry').logs[0].done).toBe(true);
  await page.reload();
  const carry = (await read(page)).sessions[0].session.exercises.find((exercise: { name: string }) => exercise.name === 'Suitcase Carry');
  expect(carry.quantityUnit).toBe('m'); expect(carry.logs[0].kg).toBe(12.5); expect(carry.logs[0].reps).toBe(25);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('returning to the saved plan restores it exactly without deleting program workout history', async ({ page }) => {
  const before = await read(page); await activate(page);
  await day(page, 'Mon'); await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  const active = (await read(page)).sessions[0];
  await openPlan(page); await page.getByRole('button', { name: 'Return to saved plan', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Return to your saved plan?', exact: true });
  await confirmation.getByRole('button', { name: 'Restore saved plan', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram).toBeUndefined();
  const after = await read(page); expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.sessions).toEqual([active]); expect(after.nutrition).toEqual(before.nutrition);
});

test('editing a deload preview retains the normal base prescription instead of permanently reducing it', async ({ page }) => {
  await activate(page); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  for (let week = 0; week < 3; week++) await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await day(page, 'Wed'); await page.getByRole('button', { name: 'Edit day', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Edit Wednesday', exact: true });
  await builder.getByRole('button', { name: 'Edit Approach Jump', exact: true }).click();
  await expect(builder.getByLabel('Sets', { exact: true })).toHaveValue('4');
  await builder.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(builder).not.toBeVisible();
  expect((await read(page)).profile.plan[2].exercises[0].sets).toBe(4);
  await page.locator('.planned-preview > summary').click();
  await expect(page.locator('.planned-exercise').filter({ hasText: 'Approach Jump' })).toContainText('3 sets');
});

test('a custom match-weekend edit does not replace the non-match lower day', async ({ page }) => {
  await activate(page, [1]); await day(page, 'Sat');
  await page.getByRole('button', { name: 'Edit day', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Edit Saturday', exact: true });
  await builder.getByRole('button', { name: 'Edit Chest-Supported Row', exact: true }).click();
  await builder.getByLabel('Sets', { exact: true }).fill('1');
  await builder.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(builder).not.toBeVisible();
  expect((await read(page)).profile.masterMatchWeekend[0].exercises.find((exercise: { name: string }) => exercise.name === 'Chest-Supported Row').sets).toBe(1);
  expect((await read(page)).profile.plan[5].name).toBe('Reactive + Hard Lower B');
  await openPlan(page); const program = page.getByRole('region', { name: '8-week volleyball-first program', exact: true });
  await program.getByText('Schedule & options', { exact: true }).click();
  await program.getByRole('checkbox', { name: 'Week 1', exact: true }).uncheck();
  await program.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.matchWeeks).toEqual([]);
  await day(page, 'Sat');
  await expect(page.locator('.session-card h2')).toHaveText('Reactive + Hard Lower B');
});

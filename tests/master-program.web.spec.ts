import { openSection, finishWarmup } from './helpers/navigation';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
async function openPlan(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
}
async function activate(page: Page, matches: number[] = []) {
  await openPlan(page);
  const program = page.getByRole('region', { name: '8-week volleyball-first program', exact: true });
  await program.getByLabel('Start Monday', { exact: true }).fill('2026-10-19');
  for (const week of matches) await program.getByRole('checkbox', { name: `Week ${week}`, exact: true }).check();
  await program.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram?.revision).toBe('8.1');
  return program;
}
async function day(page: Page, name: string) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name} `) }).click();
}
async function readiness(page: Page, status: 'Green' | 'Yellow' | 'Red') {
  const details = page.locator('.master-readiness');
  if (!await details.evaluate(element => element.hasAttribute('open'))) await details.locator(':scope > summary').click();
  await page.getByRole('group', { name: 'Program readiness', exact: true }).getByRole('button', { name: status, exact: true }).click();
  await expect(page.getByRole('group', { name: 'Program readiness', exact: true }).getByRole('button', { name: status, exact: true })).toHaveAttribute('aria-pressed', 'true');
}
async function preview(page: Page) {
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.goto('/');
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.plan[0].name = 'My saved upper plan';
  profile.plan[0].exercises[0].sets = 2;
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 0, sessions: [], nutrition: [], activities: [] })), { key: STORE, profile });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
});

test('activates V8.1, saves the old week and keeps PE planned while the easy run stays optional', async ({ page }) => {
  const before = await read(page);
  await activate(page);
  const saved = await read(page);
  expect(saved.profile.preMasterPlan).toEqual(before.profile.plan);
  expect(saved.profile.plan[0].exercises).toHaveLength(10);
  expect(saved.sessions).toEqual(before.sessions);
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Upper A');
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Week 1');
  await day(page, 'Thu'); await expect(page.locator('.master-day-note')).not.toContainText('Easy 5 km');
  await day(page, 'Fri'); await expect(page.locator('.master-day-note')).toContainText('School PE');
  expect((await read(page)).activities).toEqual([]);
  await page.reload(); await day(page, 'Wed');
  await expect(page.locator('.session-card h2')).toHaveText('Main Jump + Heavy Lower A');
});

test('non-match Saturday is recovery without a heavy gate and Sunday is Heavy Lower B', async ({ page }) => {
  await activate(page);
  await day(page, 'Sat');
  await expect(page.locator('.session-card h2')).toContainText('Recovery');
  await expect(page.locator('.master-readiness')).toHaveCount(0);
  const saturday = await preview(page);
  await expect(saturday.getByRole('list', { name: 'Scheduled exercises', exact: true })).toHaveCount(0);
  await expect(saturday).not.toContainText('Leg Press');
  await saturday.getByRole('button', { name: 'Close', exact: true }).click();
  await day(page, 'Sun');
  await expect(page.locator('.session-card h2')).toHaveText('Heavy Lower B');
  const sunday = await preview(page);
  await expect(sunday).toContainText('75–90 min');
  await expect(sunday.getByRole('list', { name: 'Scheduled exercises', exact: true })).toContainText('Leg Press');
  await expect(sunday.getByRole('list', { name: 'Scheduled exercises', exact: true })).not.toContainText('Trap Bar Jump');
  expect((await read(page)).sessions).toEqual([]);
});

test('match week uses a short Saturday primer and keeps Sunday match time separate from club practice', async ({ page }) => {
  await activate(page, [1]);
  await day(page, 'Sun');
  await expect(page.locator('.session-card h2')).toContainText('Match');
  const matchPreview = await preview(page);
  await expect(matchPreview).not.toContainText('Heavy Lower B');
  await expect(matchPreview).not.toContainText('20:00');
  await matchPreview.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Upper A');
  await expect(page.locator('.page-header')).toContainText(/Monday,? 19 October/);
  await day(page, 'Sat');
  await expect(page.locator('.session-card h2')).toHaveText(/Pre-match Primer/i);
  const primer = await preview(page);
  await expect(primer).toContainText('12–18 min');
  await primer.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const active = (await read(page)).sessions[0].session;
  expect(active.name).toMatch(/Pre-match Primer/i);
  expect(active.exercises.some((exercise: { name: string }) => /Hack Squat|Leg Press/.test(exercise.name))).toBe(false);
  expect(active.exercises.find((exercise: { name: string }) => /Approach Jump/.test(exercise.name)).logs).toHaveLength(3);
});

test('Sunday yellow and red affect future work and green restores the base strength session', async ({ page }) => {
  await activate(page); await day(page, 'Sun');
  await readiness(page, 'Yellow');
  const reduced = await preview(page);
  await expect(reduced.getByRole('list', { name: 'Scheduled exercises', exact: true })).toContainText('Leg Press');
  await expect(reduced.getByRole('list', { name: 'Scheduled exercises', exact: true })).not.toContainText('Split-squat Jump');
  await reduced.getByRole('button', { name: 'Close', exact: true }).click();
  await readiness(page, 'Red');
  await expect(page.locator('.session-card h2')).toContainText('Recovery');
  await readiness(page, 'Green');
  await expect(page.locator('.session-card h2')).toHaveText('Heavy Lower B');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const active = (await read(page)).sessions[0].session;
  expect(active.exercises[0].name).toBe('Leg Press');
  expect(active.exercises[0].logs).toHaveLength(3);
  expect(active.exercises.some((exercise: { optionalWork?: boolean }) => exercise.optionalWork)).toBe(false);
});

test('Wednesday complex alternates Hack Squat and CMJ with their own 4-minute and 2.5-minute rests', async ({ page }) => {
  await activate(page); await day(page, 'Wed'); await readiness(page, 'Green');
  const before = await read(page);
  const sheet = await preview(page);
  await expect(sheet).toContainText('240 sec rest');
  await expect(sheet).toContainText('150 sec rest');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  expect((await read(page)).sessions).toEqual(before.sessions);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  await page.locator('.focused-movements > summary').click();
  await page.getByRole('button', { name: 'Train Hack Squat', exact: true }).click();
  await page.clock.pauseAt(new Date('2026-10-19T10:05:00Z'));
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('textbox', { name: 'Hack Squat set 1 weight in kilograms', exact: true }).fill('70');
  await current.getByRole('spinbutton', { name: 'Hack Squat set 1 reps', exact: true }).fill('6');
  await current.getByRole('button', { name: 'Complete Hack Squat set 1', exact: true }).click();
  await expect(current.getByRole('heading', { level: 2 })).toHaveText(/CMJ|Countermovement/);
  await expect(page.locator('.rest-floating')).toContainText('04:00');
  await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
  await current.getByRole('spinbutton', { name: 'CMJ with Arm Swing set 1 reps', exact: true }).fill('2');
  await current.getByRole('button', { name: /Complete .* set 1/ }).click();
  await expect(current.getByRole('heading', { level: 2 })).toHaveText('Hack Squat');
  await expect(page.locator('.rest-floating')).toContainText('02:30');
  const active = (await read(page)).sessions[0].session;
  expect(active.exercises.find((exercise: { name: string }) => exercise.name === 'Hack Squat').logs).toHaveLength(3);
  expect(active.exercises.some((exercise: { optionalWork?: boolean }) => exercise.optionalWork)).toBe(false);
});

test('week four snapshots reduced Wednesday and Sunday work and program edits cannot rewrite active records', async ({ page }) => {
  await activate(page); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  for (let week = 0; week < 3; week++) await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await day(page, 'Sun');
  const sunday = await preview(page);
  const legPress = sunday.getByRole('listitem').filter({ hasText: 'Leg Press' });
  await expect(legPress).toContainText('2 ×');
  await sunday.getByRole('button', { name: 'Close', exact: true }).click();
  await day(page, 'Wed'); await expect(page.locator('.master-day-note')).toContainText('Week 4 · Deload');
  await readiness(page, 'Green');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const active = (await read(page)).sessions[0].session;
  expect(active.exercises.find((exercise: { name: string }) => /Approach Jump/.test(exercise.name)).logs.length).toBeLessThan(4);
  const hack = active.exercises.find((exercise: { name: string }) => exercise.name === 'Hack Squat');
  const cmj = active.exercises.find((exercise: { name: string }) => /CMJ|Countermovement/.test(exercise.name));
  expect(hack.logs).toHaveLength(2); expect(cmj.logs).toHaveLength(2);
  await openPlan(page); const program = page.getByRole('region', { name: '8-week volleyball-first program', exact: true });
  await program.getByText('Schedule & options', { exact: true }).click();
  await program.getByRole('checkbox', { name: 'Week 4', exact: true }).check();
  await program.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.matchWeeks).toEqual([4]);
  expect((await read(page)).sessions[0].session).toEqual(active);
});

test('a carry deliberately added from the library still logs decimal kilograms and metres on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await activate(page); await day(page, 'Wed'); await readiness(page, 'Green');
  const sheet = await preview(page);
  await sheet.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Add exercise', exact: true });
  await library.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill('Suitcase Carry');
  await library.getByRole('button', { name: 'Select Suitcase Carry', exact: true }).click();
  await page.locator('.exercise-library-sheet').getByRole('button', { name: 'Add exercise', exact: true }).click();
  await sheet.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
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
  await finishWarmup(page);
  const active = (await read(page)).sessions[0];
  await openPlan(page); await page.getByRole('button', { name: 'Return to saved plan', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Return to your saved plan?', exact: true });
  await confirmation.getByRole('button', { name: 'Restore saved plan', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram).toBeUndefined();
  const after = await read(page); expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.sessions).toEqual([active]); expect(after.nutrition).toEqual(before.nutrition);
});

test('editing a deload base retains the normal prescription instead of permanently reducing it', async ({ page }) => {
  await activate(page); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  for (let week = 0; week < 3; week++) await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await day(page, 'Wed'); await openPlan(page);
  await page.getByRole('button', { name: 'Edit Wednesday', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Edit Wednesday', exact: true });
  await builder.getByRole('button', { name: /Edit .*Approach Jump/ }).click();
  await expect(builder.getByLabel('Sets', { exact: true })).toHaveValue('4');
  await builder.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(builder).not.toBeVisible();
  expect((await read(page)).profile.plan[2].exercises[0].sets).toBe(4);
  await day(page, 'Wed');
  const sheet = await preview(page);
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).getByRole('listitem').filter({ hasText: 'Approach Jump' })).toContainText('2 ×');
});

test('a custom match-primer edit does not replace the non-match Sunday lower session', async ({ page }) => {
  await activate(page, [1]); await day(page, 'Sat');
  await openPlan(page);
  await page.getByRole('button', { name: 'Edit Saturday', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Edit Saturday', exact: true });
  await builder.getByRole('button', { name: /Edit .*Approach Jump/ }).click();
  await builder.getByLabel('Sets', { exact: true }).fill('2');
  await builder.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(builder).not.toBeVisible();
  expect((await read(page)).profile.masterMatchWeekend[0].exercises.find((exercise: { name: string }) => /Approach Jump/.test(exercise.name)).sets).toBe(2);
  expect((await read(page)).profile.plan[6].name).toBe('Heavy Lower B');
  await openPlan(page); const program = page.getByRole('region', { name: '8-week volleyball-first program', exact: true });
  await program.getByText('Schedule & options', { exact: true }).click();
  await program.getByRole('checkbox', { name: 'Week 1', exact: true }).uncheck();
  await program.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.matchWeeks).toEqual([]);
  await day(page, 'Sat'); await expect(page.locator('.session-card h2')).toContainText('Recovery');
  await day(page, 'Sun'); await expect(page.locator('.session-card h2')).toHaveText('Heavy Lower B');
});

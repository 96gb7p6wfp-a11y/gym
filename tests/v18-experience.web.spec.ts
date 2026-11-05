import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV81VolleyballMasterPlan, createVolleyballMasterPlan } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-04';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const program = (page: Page) => page.getByRole('region', { name: '8-week volleyball-first program', exact: true });

async function seed(page: Page, { appearance = 'light', cleared = false, legacy = false, customized = false, date = DATE } = {}) {
  await page.clock.setSystemTime(new Date(`${date}T10:00:00Z`));
  const plan = legacy ? createV81VolleyballMasterPlan() : createVolleyballMasterPlan();
  if (customized) {
    plan[0] = { ...plan[0], name: 'My existing Monday',
      exercises: plan[0].exercises.slice(0, 2), note: 'A deliberate saved substitution and order.' };
  }
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, plan,
    masterMatchWeekend: (legacy ? createV81VolleyballMasterPlan(true) : createVolleyballMasterPlan(true)).slice(5),
    masterProgram: { version: 1, revision: legacy ? '8.1' : '13.1', startDate: '2026-11-02', matchWeeks: [],
      clearance: { impact: cleared ? 'cleared' : 'restricted', heavyLifting: cleared ? 'cleared' : 'unknown' } },
  });
  const history = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[3], 3, '2026-10-29', profile, []), 'completed'));
  const logged = history.exercises.find(exercise => exercise.mode === 'weight')!;
  Object.assign(logged.logs[0], { kg: 25, reps: 8, rir: 2, done: true });
  await page.evaluate(({ key, profile, history, reminders }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 4, sessions: [{ session: history, version: 2 }],
    nutrition: [{ id: 'preserved-weight', date: '2026-11-01', version: 1, payload: { kind: 'weight', kg: 64.3 } }],
    activities: [], reminders,
  })), { key: STORE, profile, history, reminders: defaultReminderState() });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

async function openProgram(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  await expect(program(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const [width, appearance] of [[320, 'light'], [390, 'dark']] as const) {
  test(`reduced workout explains its purpose and changes before starting at ${width}px in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await seed(page, { appearance });
    const before = await read(page);
    const today = page.getByRole('region', { name: 'Your day', exact: true });
    await expect(today.getByLabel('Planned effort', { exact: true })).toHaveText('Preparation');
    await expect(today.getByRole('button', { name: 'Review training guidance', exact: true })).toContainText('Heavy-lifting guidance is unconfirmed');
    await expect(today).not.toContainText('70–85');
    const start = today.getByRole('button', { name: 'Start workout', exact: true });
    const nav = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
    const bounds = (await start.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(52);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y);
    await today.getByRole('button', { name: 'View workout', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
    const explanation = preview.getByRole('region', { name: 'Workout prescription', exact: true });
    await expect(explanation).toContainText('at most two easy sets, RPE 5');
    await explanation.locator('.workout-prescription__details > summary').click();
    await expect(explanation).toContainText('Easy movement preparation');
    await expect(explanation).toContainText('Review recorded impact/lifting guidance');
    await explanation.locator('.workout-prescription__changes > summary').click();
    await expect(explanation.getByRole('list', { name: 'Prescription changes', exact: true })).toContainText('RPE 5');
    expect(await read(page)).toEqual(before);
    expect(await preview.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await explanation.getByRole('button', { name: 'Review training guidance', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
    const training = settings.getByRole('region', { name: 'Training', exact: true });
    await expect(training).toBeVisible();
    await expect(training.getByLabel('Heavy lifting clearance', { exact: true })).toHaveValue('unknown');
    await expect(training.getByLabel('Impact clearance', { exact: true })).toHaveValue('restricted');
    expect(await read(page)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('a cleared normal strength day displays the full existing prescription without automatically adding work', async ({ page }) => {
  await seed(page, { cleared: true });
  const before = await read(page);
  const today = page.getByRole('region', { name: 'Your day', exact: true });
  await expect(today.getByLabel('Planned effort', { exact: true })).toHaveText('Demanding');
  await expect(today.getByRole('button', { name: 'Review training guidance', exact: true })).toHaveCount(0);
  await today.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true })).toContainText('4 × 4–6');
  await expect(preview.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li'))
    .toHaveCount(before.profile.plan[2].exercises.filter((exercise: { optionalWork?: boolean }) => !exercise.optionalWork).length);
  expect(await read(page)).toEqual(before);
});

test('unsaved program choices survive midnight and app rerenders, then save without changing history', async ({ page }) => {
  await seed(page, { cleared: true, date: '2026-11-08' });
  await page.clock.setSystemTime(new Date('2026-11-08T22:59:00Z'));
  await openProgram(page);
  const options = program(page).locator('.master-program__config');
  await options.locator(':scope > summary').click();
  const match = options.getByRole('checkbox', { name: 'Week 2', exact: true });
  await match.check();
  await options.locator('.master-program__clearance > summary').click();
  const note = options.getByLabel('Personal guidance note', { exact: true });
  await note.fill('My deliberate guidance draft remains pending.');
  const before = await read(page);
  await expect(options.getByRole('status', { name: 'Program changes', exact: true })).toHaveText('Program changes are not saved yet.');
  await page.clock.setSystemTime(new Date('2026-11-09T00:01:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(match).toBeChecked();
  await expect(note).toHaveValue('My deliberate guidance draft remains pending.');
  await expect(options.getByLabel('Start Monday', { exact: true })).toHaveValue('2026-11-02');
  expect(await read(page)).toEqual(before);
  await options.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.matchWeeks).toEqual([2]);
  await expect.poll(async () => (await read(page)).profile.masterProgram.clearance.note).toBe('My deliberate guidance draft remains pending.');
  const saved = await read(page);
  expect(saved.sessions).toEqual(before.sessions);
  expect(saved.nutrition).toEqual(before.nutrition);
  expect(saved.reminders).toEqual(before.reminders);
  expect(saved.profile.plan).toEqual(before.profile.plan);
});

test('an ambiguous customized week requires explicit recommendations approval and can be cancelled without writes', async ({ page }) => {
  await seed(page, { cleared: true, legacy: true, customized: true });
  const before = await read(page);
  await openProgram(page);
  await program(page).getByRole('button', { name: 'Upgrade to V13.1', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Upgrade to V13.1', exact: true });
  await expect(review.getByRole('region', { name: 'Personal customization review', exact: true })).toContainText('My existing Monday');
  await expect(review.getByRole('button', { name: 'Apply V13.1', exact: true })).toBeDisabled();
  await review.getByRole('button', { name: 'Keep current program', exact: true }).click();
  expect(await read(page)).toEqual(before);
  await program(page).getByRole('button', { name: 'Upgrade to V13.1', exact: true }).click();
  const approval = review.getByRole('checkbox', { name: 'Use V13.1 recommendations for unmapped edits', exact: true });
  await expect(approval).not.toBeChecked();
  await approval.check();
  await review.getByRole('button', { name: 'Apply V13.1', exact: true }).click();
  await expect(review).not.toBeVisible();
  const after = await read(page);
  expect(after.profile.masterProgram.revision).toBe('13.1');
  expect(after.profile.masterProgramBackup.plan).toEqual(before.profile.plan);
  expect(after.profile.appearance).toBe(before.profile.appearance);
  expect(after.profile.bodyWeight).toBe(before.profile.bodyWeight);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.reminders).toEqual(before.reminders);
});

test('leaving and restarting a program keeps reported guidance visible instead of resetting it to unknown', async ({ page }) => {
  await seed(page, { cleared: true });
  const before = await read(page);
  await openProgram(page);
  await program(page).getByRole('button', { name: 'Return to saved plan', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Return to your saved plan?', exact: true });
  await confirmation.getByRole('button', { name: 'Restore saved plan', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect.poll(async () => (await read(page)).profile.masterProgram).toBeUndefined();
  const options = program(page).locator('.master-program__config');
  await options.locator('.master-program__clearance > summary').click();
  await expect(options.getByLabel('Impact clearance', { exact: true })).toHaveValue('cleared');
  await expect(options.getByLabel('Heavy lifting clearance', { exact: true })).toHaveValue('cleared');
  expect((await read(page)).profile.trainingGuidance).toEqual(before.profile.masterProgram.clearance);
  await options.getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.clearance).toEqual(before.profile.masterProgram.clearance);
  const after = await read(page);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.profile.appearance).toBe(before.profile.appearance);
});

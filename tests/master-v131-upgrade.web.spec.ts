import { expect, test, type Page } from '@playwright/test';
import { acknowledgeProgramUpgrade } from './helpers/navigation';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV81VolleyballMasterPlan } from '../src/volleyball-master-plan';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const program = (page: Page) => page.getByRole('region', { name: '8-week volleyball-first program', exact: true });

async function seedV81(page: Page, active = false) {
  const plan = createV81VolleyballMasterPlan();
  plan[0].name = 'My V8.1 upper session';
  plan[0].exercises[1].sets = 2;
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan,
    masterProgram: { version: 1, revision: '8.1', startDate: '2026-10-05', matchWeeks: [2, 4, 7],
      clearance: { impact: 'cleared', heavyLifting: 'cleared' } },
    masterMatchWeekend: createV81VolleyballMasterPlan(true).slice(5),
    preMasterPlan: structuredClone(DEFAULT_PROFILE.plan),
    masterProgramBackup: { savedAt: 1000, plan: structuredClone(DEFAULT_PROFILE.plan) },
    sessionDrafts: [{ date: '2026-11-04', slot: 'main', customized: true,
      plan: { ...structuredClone(plan[2]), name: 'My equipment substitution' } }],
    timerSoundEnabled: true, timerSoundVolume: 0.35,
    customWorkouts: [{ ...structuredClone(plan[0]), id: '83b5449d-466b-409d-909d-bb2603f41d24' }],
  });
  const complete = SessionSchema.parse(stopSessionTimers(createSession(plan[0], 0, '2026-10-26', profile, []), 'completed'));
  complete.exercises[0].logs[0] = { ...complete.exercises[0].logs[0], kg: 2, reps: 3, done: true };
  const sessions = [{ session: complete, version: 3 }];
  if (active) sessions.push({ session: SessionSchema.parse(createSession(plan[0], 0, '2026-11-02', profile, [])), version: 2 });
  await page.evaluate(({ key, profile, sessions }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 5, sessions,
    nutrition: [{ id: 'saved-weight', date: '2026-11-01', version: 1, payload: { kind: 'weight', kg: 64.4 } }], activities: [],
    performanceVersion: 1, performance: { jumps: [], readiness: [] },
  })), { key: STORE, profile, sessions });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
}

async function review(page: Page) {
  await openPlan(page);
  // V9 is the primary offer; archived-program coverage deliberately selects
  // the still-supported V13.1 upgrade from the existing program controls.
  await program(page).getByRole('button', { name: 'Upgrade to V13.1', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Upgrade to V13.1', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}
async function apply(page: Page) {
  const sheet = await review(page);
  await acknowledgeProgramUpgrade(page);
  await sheet.getByRole('button', { name: 'Apply V13.1', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect.poll(async () => (await read(page)).profile.masterProgram.revision).toBe('13.1');
}
async function openPlan(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T11:00:00Z') });
  await page.goto('/');
});

test('V13.1 review is explicit and closing it leaves a saved V8.1 program untouched', async ({ page }) => {
  await seedV81(page);
  const before = await read(page);
  const sheet = await review(page);
  await expect(sheet.getByRole('heading', { name: 'Review changes', exact: true })).toBeVisible();
  await expect(sheet).toContainText('Lower Strength B');
  await expect(sheet).toContainText('Approach Power + Upper A');
  await expect(sheet).toContainText('Lower Strength + Reactive Power');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await read(page)).toEqual(before);
});

test('applying V13.1 preserves records, V8.1, older backup and the current cycle', async ({ page }) => {
  await seedV81(page, true);
  const before = await read(page);
  await apply(page);
  const after = await read(page);
  expect(after.profile.masterProgram).toEqual({ ...before.profile.masterProgram, revision: '13.1' });
  expect(after.profile.masterProgramBackup.plan).toEqual(before.profile.plan);
  expect(after.profile.masterProgramBackup.masterProgram.revision).toBe('8.1');
  expect(after.profile.masterProgramArchive).toEqual([before.profile.masterProgramBackup]);
  for (const field of ['sessions', 'nutrition', 'activities', 'performance']) expect(after[field]).toEqual(before[field]);
  for (const field of ['sessionDrafts', 'customWorkouts', 'timerSoundEnabled', 'timerSoundVolume', 'nutrition']) expect(after.profile[field]).toEqual(before.profile[field]);
  await page.reload();
  expect((await read(page)).sessions).toEqual(before.sessions);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.locator('.session-card h2')).toHaveText('My V8.1 upper session');
  await expect(page.getByText('V13.1 applies to your next workout. This session keeps its original plan.', { exact: true })).toBeVisible();
});

test('V13.1 can restore V8.1 and keeps the older personal program available', async ({ page }) => {
  await seedV81(page);
  const before = await read(page);
  await apply(page);
  await program(page).getByRole('button', { name: 'Restore previous program', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Restore your previous program?', exact: true });
  await confirmation.getByRole('button', { name: 'Restore previous program', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  const after = await read(page);
  expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.profile.masterProgram).toEqual(before.profile.masterProgram);
  expect(after.profile.trainingGuidance).toEqual(before.profile.masterProgram.clearance);
  expect(after.profile.masterProgramBackup).toEqual(before.profile.masterProgramBackup);
  expect(after.sessions).toEqual(before.sessions);
});

test('moving Saturday Lower B requires confirmation and produces one Sunday session', async ({ page }) => {
  await seedV81(page);
  await apply(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Lower Strength B');
  const workoutOptions = page.locator('.workout-template-actions');
  if (!await workoutOptions.evaluate(element => element.hasAttribute('open'))) await workoutOptions.locator(':scope > summary').click();
  const readiness = workoutOptions.locator('.master-schedule-options');
  if (!await readiness.evaluate(element => element.hasAttribute('open'))) await readiness.locator(':scope > summary').click();
  const before = await read(page);
  await readiness.getByRole('button', { name: 'Move Lower B to Sunday', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Move Lower B to Sunday?', exact: true });
  await confirmation.getByRole('button', { name: 'Keep schedule', exact: true }).click();
  expect(await read(page)).toEqual(before);
  await readiness.getByRole('button', { name: 'Move Lower B to Sunday', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Move to Sunday', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(page.locator('.session-card h2')).toContainText('Recovery');
  await page.getByRole('button', { name: /^Sun / }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Lower Strength B');
  expect((await read(page)).sessions).toEqual(before.sessions);
  expect((await read(page)).profile.masterProgram.rescheduledLowerDates).toEqual(['2026-11-07']);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await expect(page.locator('.session-card h2')).toContainText('Recovery');
});

test('personal clearance status is editable in secondary program settings without changing history', async ({ page }) => {
  await seedV81(page);
  await apply(page);
  await openPlan(page);
  const options = program(page).locator('.master-program__config');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
  await options.getByText('Impact & lifting guidance', { exact: true }).click();
  await options.getByLabel('Impact clearance', { exact: true }).selectOption('unknown');
  await options.getByLabel('Heavy lifting clearance', { exact: true }).selectOption('restricted');
  await options.getByLabel('Personal guidance note', { exact: true }).fill('Use comfortable movement; review loading before increasing.');
  const before = await read(page);
  await options.getByRole('button', { name: 'Save program', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.clearance).toEqual({
    impact: 'unknown', heavyLifting: 'restricted', note: 'Use comfortable movement; review loading before increasing.',
  });
  expect((await read(page)).sessions).toEqual(before.sessions);
});

import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const TODAY = '2026-11-06';
const SATURDAY = '2026-11-07';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);

// Only isolated browser-context data is used. This fixture is not a claim about
// the athlete's actual medical guidance, readiness or completed training.
async function seedConfirmedMatch(page: Page, readiness: 'green' | 'yellow') {
  const guidance = { impact: 'cleared' as const, heavyLifting: 'cleared' as const,
    note: 'Isolated QA guidance, not a real athlete profile.' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    appearance: 'light', presentationMode: 'athlete', bodyWeight: 70.5, timerSoundEnabled: false,
    plan: createV9VolleyballMasterPlan(), trainingGuidance: guidance,
    masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', v9EffectiveDate: TODAY,
      matchWeeks: [1], clearance: guidance, readiness: [{ date: SATURDAY, status: readiness }], dailyReadiness: [{ date: SATURDAY, feeling: readiness === 'green' ? 'normal' : 'tired' }] },
    masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
  });
  const state = { schemaVersion: 1, profile, profileVersion: 5, sessions: [], nutrition: [],
    activities: [], reminders: defaultReminderState(),
    performance: { jumps: [], readiness: [] }, performanceVersion: 2 };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return state;
}

async function previewPrimer(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}

const requiredPrimer = [
  ['Easy Dynamic Movement', '1 × 3–4 min'],
  ['Ankle and Hip Mobility', '1 × 3 min'],
  ['Controlled Approach Footwork', '2 × 3 reps'],
  ['Light Shoulder Activation', '2 × 10 reps'],
] as const;

async function expectGentlePrimer(sheet: Locator) {
  const rows = sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li');
  await expect(rows).toHaveCount(requiredPrimer.length);
  for (const [index, [name, dose]] of requiredPrimer.entries()) {
    await expect(rows.nth(index).getByRole('button', { name: `Exercise details for ${name}`, exact: true })).toBeVisible();
    await expect(rows.nth(index)).toContainText(dose);
  }
  await expect(sheet).toContainText('10–15 min');
  await expect(sheet.locator('.plan-preview__warmup')).toHaveCount(0);
  await expect(sheet).toContainText('No additional long warm-up checklist');
  const prescription = sheet.getByRole('region', { name: 'Workout prescription', exact: true });
  await expect(prescription.locator('summary').first()).toContainText('Light primer');
  await prescription.locator('.workout-prescription__details > summary').click();
  const fact = (label: string) => prescription.locator('.workout-prescription__facts > div')
    .filter({ has: sheet.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
  await expect(fact('Objective')).toContainText('stay fresh for the match');
  await expect(fact('Objective')).toContainText('full rest is also valid');
  await expect(fact('Objective')).not.toContainText('Develop force production');
  await expect(fact('Effort')).toContainText('No heavy lifting or maximal jumps');
  await expect(fact('Progression')).toContainText('Do not add load, jumps or catch-up work');
  await expect(fact('Progression')).not.toContainText('small load increase');
  await expect(prescription).toContainText('4 planned exercises');
  await expect(prescription).toContainText('1 optional');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('confirmed-match Saturday is a light primer and starts its exact dose directly without invented completion', async ({ page }) => {
  const before = await seedConfirmedMatch(page, 'green');
  const saved = await raw(page);
  const sheet = await previewPrimer(page);
  await expect(sheet.getByRole('heading', { name: 'Pre-Match Primer', exact: true })).toBeVisible();
  await expectGentlePrimer(sheet);
  // Inspecting guidance must never edit the underlying plan or record activity.
  expect(await raw(page)).toBe(saved);
  // Repeated activation of the same Start control must still create one session.
  await sheet.getByRole('button', { name: 'Start workout', exact: true }).evaluate(button => {
    for (let tap = 0; tap < 10; tap += 1) (button as HTMLButtonElement).click();
  });
  await expect.poll(async () => (await read(page)).sessions.length).toBe(1);
  await expect(page.getByRole('dialog', { name: 'Warm-up', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })
    .getByRole('heading', { name: 'Easy Dynamic Movement', exact: true })).toBeVisible();
  // The timed input suggests the lower end of the prescribed 3–4 minutes on
  // mount. Wait for that unfinished planning value before testing persistence.
  await expect.poll(async () => (await read(page)).sessions[0].session.exercises[0].logs[0].seconds).toBe(180);
  const after = await read(page);
  const session = after.sessions[0].session;
  expect(session).toMatchObject({ date: SATURDAY, status: 'active', programRevision: '9',
    programSessionId: 'v9-match-primer', finishedAt: null });
  expect(session.exercises.map((exercise: { name: string; target: string; sets: number }) =>
    [exercise.name, `${exercise.sets} × ${exercise.target}`])).toEqual(requiredPrimer);
  expect(session.exercises.map((exercise: { mode: string }) => exercise.mode)).toEqual(['timed', 'timed', 'bodyweight', 'bodyweight']);
  const logs = session.exercises.flatMap((exercise: { logs: { done: boolean; kg: number | null; reps: number | null; seconds: number | null }[] }) => exercise.logs);
  expect(logs).toHaveLength(6);
  expect(logs.every((log: { done: boolean; kg: number | null; reps: number | null; seconds: number | null }) =>
    !log.done && log.kg == null)).toBe(true);
  expect(logs.map((log: {reps: number | null}) => log.reps)).toEqual([null, null, 3, 3, 10, 10]);
  expect(logs[0].seconds).toBe(180);
  expect(logs.slice(1).every((log: { seconds: number | null }) => log.seconds == null)).toBe(true);
  expect(session.exercises.every((exercise: { runningSince: number | null }) => exercise.runningSince == null)).toBe(true);
  expect(session.warmup ?? []).toEqual([]);
  expect(after.sessions.some((row: { session: { status: string } }) => row.session.status === 'completed')).toBe(false);
  expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
  expect(after.profile.masterProgram.matchWeeks).toEqual([1]);
  expect(after.profile.masterProgram.matchTimes).toBeUndefined();
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.activities).toEqual([]);
  expect(after.performance).toEqual(before.performance);
  expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBeNull();
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })
    .getByRole('heading', { name: 'Easy Dynamic Movement', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Warm-up', exact: true })).toHaveCount(0);
  const resumed = await read(page);
  expect(resumed.sessions).toEqual(after.sessions);
  expect(resumed.profile.sessionDrafts).toEqual(after.profile.sessionDrafts);
});

test('Yellow match-week primer keeps its gentle guidance and exact dose while explicitly offering rest', async ({ page }) => {
  await seedConfirmedMatch(page, 'yellow');
  const saved = await raw(page);
  const sheet = await previewPrimer(page);
  await sheet.getByRole('button', { name: 'Recommended today', exact: true }).click();
  await expect(sheet.getByRole('heading', { name: 'Modified — Pre-Match Primer or Rest', exact: true })).toBeVisible();
  await expectGentlePrimer(sheet);
  await expect(sheet.getByRole('group', { name: 'Workout adjustments', exact: true })).toContainText('You selected Tired');
  await expect(sheet).not.toContainText('Leg Press');
  expect((await read(page)).sessions).toEqual([]);
  expect((await read(page)).activities).toEqual([]);
  expect(await raw(page)).toBe(saved);
});

test('an intentional date-specific primer warm-up remains available before explicit workout start', async ({ page }) => {
  const before = await seedConfirmedMatch(page, 'green');
  const preparation = { key: 'qa-custom-primer-preparation', name: 'My comfortable shoulder rehearsal',
    target: '5 easy repetitions', cue: 'A deliberate isolated QA preparation choice. Keep the movement gentle.', done: false };
  const customPlan = { ...createV9VolleyballMasterPlan(true)[5], warmup: [preparation] };
  before.profile = ProfileSchema.parse({ ...before.profile, sessionDrafts: [{ date: SATURDAY, slot: 'main',
    plan: customPlan, customized: true, readiness: 'green', reviewedForCoach: 1,
    reviewedForProgram: { revision: '9', programSessionId: 'v9-match-primer' } }] });
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state: before });
  await page.reload();
  const sheet = await previewPrimer(page);
  await expect(sheet).toContainText('Custom workout for this date');
  const rows = sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li');
  await expect(rows).toHaveCount(4);
  for (const [index, [name, dose]] of requiredPrimer.entries()) {
    await expect(rows.nth(index)).toContainText(name);
    await expect(rows.nth(index)).toContainText(dose);
  }
  await sheet.getByRole('button', { name: 'Start workout', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  await expect(warmup.getByRole('list', { name: 'Quick warm-up exercises', exact: true }).locator(':scope > li')).toHaveCount(1);
  await expect(warmup.getByRole('heading', { name: preparation.name, exact: true })).toBeVisible();
  await expect(warmup).toContainText(preparation.target);
  await expect(warmup.getByRole('checkbox', { name: `Complete ${preparation.name} in warmup`, exact: true })).not.toBeChecked();
  expect((await read(page)).sessions).toEqual([]);
  expect((await read(page)).activities).toEqual([]);
  expect((await read(page)).profile.sessionDrafts[0].plan.warmup).toEqual([preparation]);
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(async () => (await read(page)).sessions.length).toBe(1);
  await expect(warmup).not.toBeVisible();
  const after = await read(page);
  const session = after.sessions[0].session;
  expect(session).toMatchObject({ status: 'active', programSessionId: 'v9-match-primer', programRevision: '9' });
  expect(session.warmup).toEqual([preparation]);
  expect(session.exercises.map((exercise: { name: string; sets: number; target: string }) =>
    [exercise.name, `${exercise.sets} × ${exercise.target}`])).toEqual(requiredPrimer);
  expect(session.exercises.every((exercise: { logs: { done: boolean }[] }) => exercise.logs.every(log => !log.done))).toBe(true);
  expect(after.profile.sessionDrafts[0].plan).toEqual(customPlan);
  expect(after.profile.sessionDrafts[0].reviewedForProgram).toEqual({ revision: '9', programSessionId: 'v9-match-primer' });
  expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
  expect(after.profile.masterProgram).toEqual(before.profile.masterProgram);
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.activities).toEqual([]);
});

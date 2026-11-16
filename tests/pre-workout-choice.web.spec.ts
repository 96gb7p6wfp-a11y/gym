import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-14';
const gate = (page: Page) => page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const read = async (page: Page) => JSON.parse((await raw(page))!);
const active = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session;
async function seed(page: Page, { restricted = false, stalePoor = false, custom = false, deload = false } = {}) {
  const guidance = { impact: restricted ? 'restricted' as const : 'cleared' as const,
    heavyLifting: restricted ? 'unknown' as const : 'cleared' as const, note: 'Isolated automated fixture.' };
  const week = createV9VolleyballMasterPlan();
  const edited = structuredClone(week[5]);
  Object.assign(edited.exercises.find(exercise => exercise.name === 'Leg Press')!, { sets: 4, defaultKg: 72.5 });
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: week,
    appearance: 'dark', presentationMode: 'athlete', trainingGuidance: guidance,
    masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [], calendarMatches: [], clearance: guidance,
      dailyReadiness: [{ date: '2026-11-13', feeling: 'tired' }, ...(stalePoor ? [{ date: DATE, feeling: 'poor' }] : [])],
      ...(deload ? { trainingPhases: [{ startDate: '2026-11-09', endDate: '2026-11-15', phase: 'deload' }] } : {}) },
    ...(custom ? { sessionDrafts: [{ date: DATE, slot: 'main', plan: edited, customized: true, readiness: 'green',
      reviewedForCoach: 1, reviewedForProgram: { revision: '9', programSessionId: edited.programSessionId } }] } : {}) });
  const history = SessionSchema.parse(stopSessionTimers(createSession(week[0], 0, '2026-11-09', profile, []), 'completed'));
  Object.assign(history.exercises.find(exercise => exercise.name === 'Incline Machine Press')!.logs[0], { done: true, kg: 60, reps: 8, rir: 2 });
  const state = { schemaVersion: 1, profile, profileVersion: 4, sessions: [{ session: history, version: 2 }],
    nutrition: [{ id: 'qa-choice-weight', date: DATE, version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: defaultReminderState(), performance: { jumps: [], readiness: [] }, performanceVersion: 1 };
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), state);
  await page.reload();
  return state;
}
async function open(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Start (?:adjusted )?workout$/ }).click();
  await expect(gate(page)).toBeVisible();
}
async function notQuite(page: Page) {
  await gate(page).getByRole('button', { name: 'Not quite', exact: true }).click();
}
async function warm(page: Page) {
  await gate(page).getByRole('button', { name: 'Yes — already warmed up', exact: true }).click();
}
function choices(page: Page) { return gate(page).getByRole('group', { name: 'Training adjustment', exact: true }); }

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('Not quite requires a deliberate choice and selecting or declining suggestions is read-only', async ({ page }) => {
  await seed(page, { custom: true });
  const before = await raw(page);
  await open(page); await notQuite(page); await warm(page);
  await expect(choices(page).getByRole('button')).toHaveCount(4);
  for (const button of await choices(page).getByRole('button').all()) await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(gate(page).locator('.pre-workout__start')).toBeDisabled();
  expect(await raw(page)).toBe(before);
  await choices(page).getByRole('button', { name: 'Use suggested lighter workout', exact: true }).click();
  await expect(gate(page).getByRole('button', { name: 'Start lighter workout', exact: true })).toBeEnabled();
  await gate(page).getByText(/^Review \d+ changes?$/).click();
  await expect(gate(page).locator('.pre-workout__changes')).toContainText('Leg Press');
  await expect(gate(page).locator('.pre-workout__changes')).toContainText('Original:');
  await expect(gate(page).locator('.pre-workout__changes')).toContainText('For this session:');
  await choices(page).getByRole('button', { name: 'Continue original workout', exact: true }).click();
  await expect(gate(page).getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  await expect(gate(page).getByRole('status', { name: 'Starting prescription' })).toContainText('11 exercises');
  await gate(page).getByText('Original workout reference', { exact: true }).click();
  await expect(gate(page).locator('.pre-workout__original')).toContainText('30 working sets');
  expect(await raw(page)).toBe(before);
  await gate(page).getByRole('button', { name: 'Close', exact: true }).click();
  expect(await raw(page)).toBe(before);
  expect(await active(page)).toBeUndefined();
});

test('Rest today needs no warmup answer and creates no session or changed settings', async ({ page }) => {
  await seed(page, { stalePoor: true, custom: true });
  const before = await raw(page);
  await open(page); await notQuite(page);
  await choices(page).getByRole('button', { name: 'Rest today', exact: true }).click();
  await expect(gate(page).getByRole('group', { name: 'Warmed up?', exact: true })).toHaveCount(0);
  await expect(gate(page).locator('.pre-workout__start')).toBeEnabled();
  await gate(page).locator('.pre-workout__start').click();
  await expect(gate(page)).toHaveCount(0);
  expect(await raw(page)).toBe(before);
  await page.reload();
  expect(await raw(page)).toBe(before);
  expect(await active(page)).toBeUndefined();
});

test('continue original after Not quite keeps the full custom dose without inventing positive readiness', async ({ page }) => {
  const before = await seed(page, { stalePoor: true, custom: true });
  await open(page); await notQuite(page);
  await choices(page).getByRole('button', { name: 'Continue original workout', exact: true }).click();
  await warm(page);
  await gate(page).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page), state = await read(page);
  expect(session.exercises).toHaveLength(11);
  const leg = session.exercises.find((exercise: { name: string }) => exercise.name === 'Leg Press');
  expect(leg.logs).toHaveLength(4);
  expect(leg.logs.every((log: { kg: number }) => log.kg === 72.5)).toBe(true);
  expect(state.profile.masterProgram.dailyReadiness).toEqual(before.profile.masterProgram!.dailyReadiness);
  expect(state.profile.plan).toEqual(before.profile.plan);
  expect(state.profile.sessionDrafts[0].plan).toEqual(before.profile.sessionDrafts![0].plan);
  expect(state.nutrition).toEqual(before.nutrition);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
});

test('choosing original after Not quite never bypasses medical restrictions', async ({ page }) => {
  const before = await seed(page, { restricted: true });
  await open(page); await notQuite(page);
  await choices(page).getByRole('button', { name: 'Continue original workout', exact: true }).click();
  await warm(page);
  await expect(gate(page)).toContainText('Continuing the original cannot bypass these limits');
  await gate(page).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page), state = await read(page);
  expect(session.exercises).toHaveLength(9);
  expect(session.exercises.every((exercise: { preparationOnly: boolean; sets: number }) => exercise.preparationOnly && exercise.sets <= 2)).toBe(true);
  expect(state.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
  expect(state.profile.plan).toEqual(before.profile.plan);
});

test('declining a selected lighter phase starts the eligible original without rewriting phase settings', async ({ page }) => {
  const before = await seed(page, { deload: true });
  await open(page); await notQuite(page);
  await choices(page).getByRole('button', { name: 'Continue original workout', exact: true }).click();
  await warm(page);
  await gate(page).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page), state = await read(page);
  expect(session.exercises).toHaveLength(11);
  expect(session.exercises.reduce((sum: number, exercise: { logs: unknown[] }) => sum + exercise.logs.length, 0)).toBe(29);
  expect(state.profile.masterProgram.trainingPhases).toEqual(before.profile.masterProgram!.trainingPhases);
  expect(state.profile.masterProgram.dailyReadiness).toEqual(before.profile.masterProgram!.dailyReadiness);
  expect(state.profile.plan).toEqual(before.profile.plan);
});

test('a legacy V13.1 athlete can reject Week4 and old red reductions without changing the original program', async ({ page }) => {
  const fixture = await seed(page);
  const plan = createVolleyballMasterPlan();
  fixture.profile = ProfileSchema.parse({ ...fixture.profile, plan,
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-10-19', matchWeeks: [],
      clearance: fixture.profile.trainingGuidance, readiness: [{ date: DATE, status: 'red' }] },
  });
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), fixture);
  await page.reload();
  await open(page); await notQuite(page);
  await choices(page).getByRole('button', { name: 'Continue original workout', exact: true }).click();
  await warm(page);
  await gate(page).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page), state = await read(page);
  expect(session.name).toBe(plan[5].name);
  expect(session.exercises.reduce((sum: number, exercise: { logs: unknown[] }) => sum + exercise.logs.length, 0)).toBe(13);
  expect(session.exercises.map((exercise: { sets: number }) => exercise.sets)).toEqual(plan[5].exercises.map(exercise => exercise.sets));
  expect(state.profile.plan).toEqual(fixture.profile.plan);
  expect(state.profile.masterProgram).toEqual(fixture.profile.masterProgram);
});

test('recovery is an explicit session choice, not a consequence of Not quite', async ({ page }) => {
  const before = await seed(page);
  await open(page); await notQuite(page); await warm(page);
  await expect(gate(page).locator('.pre-workout__start')).toBeDisabled();
  await choices(page).getByRole('button', { name: 'Switch to recovery session', exact: true }).click();
  await gate(page).getByRole('button', { name: 'Start recovery', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const state = await read(page);
  expect((await active(page)).kind).toBe('recovery');
  expect((await active(page)).exercises).toEqual([]);
  expect(state.profile.plan).toEqual(before.profile.plan);
  expect(state.profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
});

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1024, height: 768 }]) {
  test(`all four decisions and original reference remain usable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page);
    await open(page); await notQuite(page);
    const closeGeometry = await gate(page).evaluate(element => {
      const close = element.querySelector('[data-slot="dialog-close"]')!.getBoundingClientRect();
      const body = element.querySelector('.dialog-scroll')!.getBoundingClientRect();
      return { closeBottom: close.bottom, scrollTop: body.top };
    });
    expect(closeGeometry.closeBottom).toBeLessThanOrEqual(closeGeometry.scrollTop + 1);
    await page.screenshot({ path: testInfo.outputPath(`pre-workout-choices-${viewport.width}.png`) });
    for (const button of await choices(page).getByRole('button').all()) {
      const dimensions = await button.evaluate(element => ({ width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height, overflow: element.scrollWidth > element.clientWidth }));
      expect(dimensions.height).toBeGreaterThanOrEqual(44);
      expect(dimensions.overflow).toBe(false);
    }
    await choices(page).getByRole('button', { name: 'Use suggested lighter workout', exact: true }).click();
    await warm(page);
    await gate(page).getByRole('button', { name: 'Start lighter workout', exact: true }).scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`pre-workout-${viewport.width}.png`) });
    await choices(page).getByRole('button', { name: 'Continue original workout', exact: true }).click();
    await expect(gate(page).getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  });
}

import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan';
import { upgradeToV9 } from '../src/master-program-upgrade';
import { defaultReminderState } from '../src/reminders';
import { findLibraryExercise } from '../src/exercise-library';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const active = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session;

async function seed(page: Page, restricted = false) {
  const cleared = { impact: 'cleared' as const, heavyLifting: 'cleared' as const, note: 'Isolated archive-source QA fixture.' };
  const oldPlan = createVolleyballMasterPlan();
  const previous = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: oldPlan,
    presentationMode: 'athlete', appearance: 'dark', trainingGuidance: cleared,
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [], clearance: cleared },
  });
  const profile = upgradeToV9(previous, '2026-11-16', Date.parse('2026-11-16T10:00:00Z'));
  if (restricted) {
    profile.trainingGuidance = { impact: 'restricted', heavyLifting: 'unknown', note: 'Current isolated QA guidance overrides archived clearance.' };
    profile.masterProgram!.clearance = profile.trainingGuidance;
  }
  const history = SessionSchema.parse(stopSessionTimers(createSession(oldPlan[5], 5, '2026-11-07', previous, []), 'completed'));
  const state = { schemaVersion: 1, profile, profileVersion: 6, sessions: [{ session: history, version: 2 }],
    nutrition: [{ id: 'native-archive-weight', date: '2026-11-16', version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: defaultReminderState() };
  await page.evaluate(state => { localStorage.setItem('setline.gym.v1', JSON.stringify(state)); sessionStorage.clear(); }, state);
  await page.reload();
  return { state, oldPlan };
}

async function startSaturday(page: Page, previousWeek: boolean) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  if (previousWeek) await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await page.getByRole('button', { name: /^Start (?:(?:adjusted )?workout|recovery)$/ }).click();
  const check = page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
  await check.getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
  await check.getByRole('button', { name: 'Yes — already warmed up', exact: true }).click();
  await check.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-17T10:00:00Z') });
  await page.goto('/');
});

test('a pre-V9 date starts its archived original prescription rather than the new program', async ({ page }) => {
  const { state, oldPlan } = await seed(page);
  await startSaturday(page, true); // 14 November, before the explicit 16 November activation.
  const session = await active(page), after = await read(page);
  expect(session.date).toBe('2026-11-14');
  expect(session.programRevision).toBe('13.1');
  expect(session.name).toBe(oldPlan[5].name);
  expect(session.exercises.map((exercise: { key: string; logs: unknown[]; target: string; rest: number }) =>
    [exercise.key, exercise.logs.length, exercise.target, exercise.rest])).toEqual(oldPlan[5].exercises.filter(exercise => !exercise.optionalWork)
      .map(exercise => [exercise.key, exercise.sets, exercise.target, exercise.rest]));
  expect(after.profile).toEqual(state.profile);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === state.sessions[0].session.id)).toEqual(state.sessions[0]);
  expect(after.nutrition).toEqual(state.nutrition);
});

test('archived plans use current medical guidance without restoring archived clearance', async ({ page }) => {
  const { state } = await seed(page, true);
  await startSaturday(page, true);
  const session = SessionSchema.parse(await active(page)), after = await read(page);
  expect(session.date).toBe('2026-11-14');
  expect(session.programRevision).toBe('13.1');
  // A logging mode is movement identity, not medical permission. Existing
  // guidance keeps weighted movements as unloaded, low-effort preparation.
  expect(session.exercises.length).toBeGreaterThan(0);
  for (const exercise of session.exercises) {
    expect(exercise.preparationOnly, exercise.name).toBe(true);
    expect(exercise.sets, exercise.name).toBeGreaterThanOrEqual(1);
    expect(exercise.sets, exercise.name).toBeLessThanOrEqual(2);
    expect(exercise.logs, exercise.name).toHaveLength(exercise.sets);
    expect(exercise.targetRpe, exercise.name).toBe(5);
    expect(exercise.defaultKg, exercise.name).toBe(0);
    expect(exercise.superset, exercise.name).toBeUndefined();
    expect(exercise.jumpContactsPerRep ?? 0, exercise.name).toBe(0);
    expect(exercise.name).not.toMatch(/\b(?:jump|hops?|bounds?|throws?|slams?|sprints?)\b/i);
    expect(['Power', 'Plyometric']).not.toContain(findLibraryExercise(exercise)?.category);
    for (const log of exercise.logs) {
      expect(log.kg, exercise.name).toBe(0);
      expect(log.done, exercise.name).toBe(false);
      expect(log.rir, exercise.name).toBeNull();
    }
  }
  expect(after.profile).toEqual(state.profile);
  expect(after.profile.trainingGuidance).toEqual(state.profile.trainingGuidance);
  expect(after.profile.masterProgram.clearance).toEqual(state.profile.masterProgram!.clearance);
  expect(after.profile.masterProgramBackup).toEqual(state.profile.masterProgramBackup);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === state.sessions[0].session.id)).toEqual(state.sessions[0]);
  expect(after.nutrition).toEqual(state.nutrition);
});

test('a date after activation still starts the selected full V9 Lower B, preserving the archive', async ({ page }) => {
  const { state } = await seed(page);
  await startSaturday(page, false); // 21 November.
  const session = await active(page), after = await read(page);
  expect(session.date).toBe('2026-11-21');
  expect(session.programRevision).toBe('9');
  expect(session.programSessionId).toBe('v9-lower-b');
  expect(session.exercises).toHaveLength(11);
  expect(session.exercises.reduce((sum: number, exercise: { logs: unknown[] }) => sum + exercise.logs.length, 0)).toBe(29);
  expect(after.profile).toEqual(state.profile);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === state.sessions[0].session.id)).toEqual(state.sessions[0]);
});

import { expect, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../../src/domain.js';
import { createV9VolleyballMasterPlan, createVolleyballMasterPlan } from '../../src/volleyball-master-plan';
import { applyV9Clearance, v9PhasePlan } from '../../src/volleyball-v9-plan';
import { defaultReminderState } from '../../src/reminders';

export const COACH_STORE = 'setline.gym.v1';
export const COACH_TODAY = '2026-11-06';
export const COACH_SATURDAY = '2026-11-07';
export const COACH_SUNDAY = '2026-11-08';
export const coachRead = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COACH_STORE);
export const coachRaw = (page: Page) => page.evaluate(key => localStorage.getItem(key), COACH_STORE);
export const coachPreview = (page: Page) => page.getByRole('dialog', { name: 'Workout preview', exact: true });

export async function seedCoach(page: Page, options: {
  guidance?: 'cleared' | 'unknown' | 'restricted'; appearance?: 'light' | 'dark';
  legacyMatches?: boolean; oldDraft?: boolean; legacyReadiness?: boolean;
} = {}) {
  const guidance = { impact: options.guidance ?? 'cleared', heavyLifting: options.guidance ?? 'cleared',
    note: 'Isolated QA fixture. Not an actual athlete medical statement.' };
  const legacy = createVolleyballMasterPlan();
  const history = SessionSchema.parse(stopSessionTimers(createSession(legacy[2], 2, '2026-10-28', DEFAULT_PROFILE, []), 'completed'));
  Object.assign(history.exercises.find(exercise => exercise.name === 'Hack Squat')!.logs[0], { kg: 70, reps: 6, rir: 2, done: true });
  const obsolete = applyV9Clearance(v9PhasePlan(createV9VolleyballMasterPlan()[5], 4), { impact: 'unknown', heavyLifting: 'unknown' });
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete',
    appearance: options.appearance ?? 'light', bodyWeight: 70, restSeconds: 105, timerSoundEnabled: false,
    plan: createV9VolleyballMasterPlan(), masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5), trainingGuidance: guidance,
    masterProgram: { version: 1, revision: '9', v9EffectiveDate: '2026-10-12', startDate: '2026-10-12',
      matchWeeks: options.legacyMatches ? [1, 4] : [], clearance: guidance,
      ...(!options.legacyMatches ? { calendarMatches: [] } : {}),
      dailyReadiness: [],
      ...(options.legacyReadiness ? { readiness: [{ date: COACH_SATURDAY, status: 'red' }, { date: '2026-10-30', status: 'yellow' }] } : {}),
    },
    ...(options.oldDraft ? { sessionDrafts: [
      { date: COACH_SATURDAY, slot: 'main', customized: true, readiness: 'green', plan: obsolete },
      { date: '2026-10-28', slot: 'main', customized: true, plan: structuredClone(legacy[2]) },
      { date: '2026-11-14', slot: 'main', customized: true, plan: { ...structuredClone(legacy[5]), name: 'Separate future custom workout' } },
    ] } : {}),
  });
  const state = { schemaVersion: 1, profile, profileVersion: 4, sessions: [{ session: history, version: 3 }],
    nutrition: [{ id: 'qa-body-weight', date: COACH_TODAY, version: 1, payload: { kind: 'weight', kg: 70.1 } }],
    activities: [], reminders: defaultReminderState(), performanceVersion: 2,
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-11-02', type: 'approach', measurement: 'height', cm: 66,
      source: 'measured', conditions: 'Indoor court, QA fixture', notes: '' }], readiness: [],
      sprints: [{ id: crypto.randomUUID(), date: '2026-11-02', distanceM: 10, seconds: 2.1, timingMethod: 'manual',
        protocol: 'Standing start to torso finish', conditions: 'Indoor QA court' }] },
  };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: COACH_STORE, state });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return state;
}

export async function coachDay(page: Page, day: 'Sat' | 'Sun' | 'Fri' | 'Wed') {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${day} `) }).click();
}

export async function openCoachPreview(page: Page) {
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(coachPreview(page)).toBeVisible();
  return coachPreview(page);
}

/** Compatibility fixture for observations already saved by prior app versions.
 * New answers belong to the explicit pre-workout check, not read-only planning.
 * Only the isolated Playwright store is changed; no workout is created. */
export async function seedSavedFeeling(page: Page, feeling: 'Great' | 'Normal' | 'Tired' | 'Poor') {
  await page.evaluate(({ key, date, feeling }) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.profile.masterProgram.dailyReadiness = [
      ...(state.profile.masterProgram.dailyReadiness ?? []).filter((row: { date: string }) => row.date !== date),
      { date, feeling },
    ];
    state.profileVersion += 1;
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: COACH_STORE, date: COACH_SATURDAY, feeling: feeling.toLowerCase() });
  await page.reload();
  await coachDay(page, 'Sat');
  await expect.poll(async () => (await coachRead(page)).profile.masterProgram.dailyReadiness
    .find((entry: { date: string }) => entry.date === COACH_SATURDAY)?.feeling).toBe(feeling.toLowerCase());
}

export async function expectCoachFullSaturday(page: Page) {
  const sheet = coachPreview(page);
  await expect(sheet.getByRole('heading', { name: 'Lower B — Full Strength', exact: true })).toBeVisible();
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true }).locator(':scope > li')).toHaveCount(11);
  await expect(sheet).toContainText('29 sets');
  await expect(sheet).toContainText('85–105 min');
}

export async function expectCoachPreserved(page: Page, before: Awaited<ReturnType<typeof seedCoach>>) {
  const after = await coachRead(page);
  for (const key of ['sessions', 'nutrition', 'activities', 'reminders', 'performance']) expect(after[key]).toEqual(before[key as keyof typeof before]);
  for (const key of ['plan', 'masterMatchWeekend', 'trainingGuidance', 'bodyWeight', 'restSeconds', 'timerSoundEnabled', 'appearance']) {
    expect(after.profile[key]).toEqual(before.profile[key as keyof typeof before.profile]);
  }
}

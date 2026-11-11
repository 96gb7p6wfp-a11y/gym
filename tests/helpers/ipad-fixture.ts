import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../../src/domain.js';
import { createV9VolleyballMasterPlan } from '../../src/volleyball-v9-plan.ts';
import { defaultReminderState } from '../../src/reminders.ts';

export const IPAD_STORE = 'setline.gym.v1';
export const IPAD_TODAY = '2026-11-11';

/** Isolated visual/interaction QA data. Never load this into a personal origin. */
export function createIpadFixture(appearance: 'light' | 'dark' = 'light', active = false) {
  const plan = createV9VolleyballMasterPlan();
  const clearance = { impact: 'cleared' as const, heavyLifting: 'cleared' as const, note: 'Isolated QA fixture only, not medical clearance.' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, presentationMode: 'athlete', plan,
    trainingGuidance: clearance, masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [], calendarMatches: [], dailyReadiness: [], clearance } });
  function recorded(date: string, gain: number) {
    const result = SessionSchema.parse(stopSessionTimers(createSession(plan[0], 0, date, profile, []), 'completed'));
    result.startedAt = Date.parse(`${date}T08:00:00Z`); result.finishedAt = result.startedAt + 70 * 60_000; result.elapsedMs = 70 * 60_000;
    result.exercises.forEach((exercise, index) => {
      exercise.logs.forEach(log => Object.assign(log, { done: true, rir: 2,
        ...(exercise.mode === 'timed' ? { seconds: 20 } : { reps: /slam/i.test(exercise.name) ? 3 : /pull.up/i.test(exercise.name) ? 6 : 8 }),
        kg: /slam/i.test(exercise.name) ? 2 : exercise.mode === 'weight' ? 25 + index * 2.5 + gain : 0 }));
    });
    return SessionSchema.parse(result);
  }
  const sessions = [recorded('2026-11-02', 0), recorded('2026-11-09', 2.5)].map(session => ({ session, version: 1 }));
  if (active) {
    const session = SessionSchema.parse(createSession(plan[0], 2, IPAD_TODAY, profile, sessions.map(row => row.session)));
    session.startedAt = Date.parse(`${IPAD_TODAY}T09:00:00Z`); session.runningSince = null; session.elapsedMs = 12 * 60_000;
    sessions.unshift({ session, version: 1 });
  }
  return { schemaVersion: 1, profile, profileVersion: 1, sessions,
    nutrition: [['2026-10-26', 69], ['2026-10-29', 69.2], ['2026-10-30', 69.4], ['2026-11-02', 70], ['2026-11-05', 70.2], ['2026-11-06', 70.4]]
      .map(([date, kg], index) => ({ id: `qa-ipad-weight-${index}`, date, version: 1, payload: { kind: 'weight', kg } })),
    activities: [], reminders: defaultReminderState(), performanceVersion: 1,
    performance: { jumps: [
      { id: crypto.randomUUID(), date: '2026-11-02', type: 'standing', measurement: 'height', source: 'measured', cm: 65, standingReachCm: 235, touchCm: 300, conditions: 'Same isolated QA indoor court', notes: '' },
      { id: crypto.randomUUID(), date: '2026-11-02', type: 'approach', measurement: 'height', source: 'measured', cm: 70, standingReachCm: 235, touchCm: 305, conditions: 'Same isolated QA indoor court', notes: '' },
      { id: crypto.randomUUID(), date: '2026-11-09', type: 'approach', measurement: 'height', source: 'measured', cm: 72, standingReachCm: 235, touchCm: 307, conditions: 'Same isolated QA indoor court', notes: '' },
    ], readiness: [] } };
}

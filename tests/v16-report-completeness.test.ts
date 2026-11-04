import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, getCalories, stopSessionTimers } from '../src/domain.js';
import { estimateActivity, type ActivityRecord } from '../src/activities.ts';
import { getWeeklyReport, reportCalorieSummary, type ReportSession } from '../src/weekly-report.ts';

function workout(date: string, bodyWeight: number | null = 64): ReportSession {
  const movement = { ...DEFAULT_PROFILE.plan[0].exercises[0], key: 'weekly-press', exerciseId: 'chest-press', name: 'Machine Chest Press',
    mode: 'weight', perSide: false, target: '8 reps', sets: 2 };
  const started = SessionSchema.parse(createSession({ ...DEFAULT_PROFILE.plan[0], exercises: [movement] }, 0, date, { ...DEFAULT_PROFILE, bodyWeight }, []));
  started.runningSince = null;
  started.elapsedMs = 30 * 60_000;
  started.exercises[0].logs[0] = { ...started.exercises[0].logs[0], done: true, kg: 60, reps: 8, rir: 2 };
  return SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + started.elapsedMs));
}
const report = (sessions: ReportSession[], activities: ActivityRecord[] = []) => getWeeklyReport({ weekStart: '2026-11-02', sessions, activities, plan: DEFAULT_PROFILE.plan });

test('a workout without body weight or watch calories produces an unavailable estimate, never a recorded zero', () => {
  const session = workout('2026-11-02', null);
  const before = structuredClone(session);
  const totals = report([session]).totals;
  assert.equal(totals.missingCalorieEstimates, 1);
  assert.equal(totals.recordedCalorieEstimates, 0);
  assert.match(reportCalorieSummary(totals), /^Active calories not estimated/);
  assert.doesNotMatch(reportCalorieSummary(totals), /0 active kcal/);
  assert.deepEqual(session, before);
});

test('a real zero watch reading remains a known zero even without a body weight', () => {
  const session = workout('2026-11-02', null);
  session.watchCalories = 0;
  const totals = report([session]).totals;
  assert.equal(totals.activeCalories, 0);
  assert.equal(totals.missingCalorieEstimates, undefined);
  assert.equal(totals.recordedCalorieEstimates, undefined);
  assert.equal(reportCalorieSummary(totals), '0 active kcal logged / est.');
});

test('mixed weeks keep an explicit recorded subtotal and identify the missing estimate', () => {
  const unknown = workout('2026-11-02', null);
  const watch = workout('2026-11-03', null);
  watch.watchCalories = 125;
  const run: ActivityRecord = { version: 1, activity: {
    id: crypto.randomUUID(), date: '2026-11-04', type: 'run', name: 'Running', durationMinutes: 20, distanceKm: 3,
    intensity: 'moderate', bodyWeightKg: 61, watchCalories: null, notes: '', createdAt: Date.now(), deletedAt: null,
  } };
  const totals = report([unknown, watch], [run]).totals;
  assert.equal(totals.activeCalories, 125 + estimateActivity(run.activity).calories);
  assert.equal(totals.missingCalorieEstimates, 1);
  assert.equal(totals.recordedCalorieEstimates, 2);
  assert.match(reportCalorieSummary(totals), /308 active kcal recorded \/ estimated · partial; 1 training entry without calorie data/);
});

test('legacy known estimates and previous-week missing data retain their distinct semantics', () => {
  const known = workout('2026-11-02');
  const previous = workout('2026-10-26', null);
  const result = report([previous, known]);
  assert.equal(result.totals.activeCalories, getCalories(known));
  assert.equal(result.totals.missingCalorieEstimates, undefined);
  assert.equal(result.previous.missingCalorieEstimates, 1);
  assert.match(reportCalorieSummary(result.previous), /not estimated/);
});

test('weekly comparisons use the shared movement configuration and optional machine identity', () => {
  const previous = workout('2026-10-26');
  previous.exercises[0].equipmentLabel = 'Technogym Chest Press';
  const current = workout('2026-11-02');
  current.exercises[0].equipmentLabel = '  TECHNOGYM   Chest Press ';
  current.exercises[0].logs[0].kg = 65;
  let comparison = report([previous, current]).performance;
  assert.equal(comparison.length, 1);
  assert.equal(comparison[0].previous, 60);
  assert.equal(comparison[0].current, 65);
  assert.equal(comparison[0].effort, 'matched');
  assert.equal(comparison[0].rir, 2);
  assert.equal(comparison[0].previousDate, '2026-10-26');
  assert.equal(comparison[0].currentDate, '2026-11-02');
  for (const patch of [{ equipmentLabel: 'Matrix Chest Press' }, { equipmentLabel: undefined }, { perSide: true }, { quantityUnit: 'm' }]) {
    const incompatible = structuredClone(current);
    Object.assign(incompatible.exercises[0], patch);
    assert.deepEqual(report([previous, incompatible]).performance, []);
  }
  assert.equal(previous.exercises[0].equipmentLabel, 'Technogym Chest Press');
});

test('weekly load comparisons never interpret fewer reps or different recorded RIR as a matching gain', () => {
  const previous = workout('2026-10-26');
  const current = workout('2026-11-02');
  current.exercises[0].logs[0].kg = 65;
  current.exercises[0].logs[0].reps = 5;
  assert.deepEqual(report([previous, current]).performance, []);
  current.exercises[0].logs[0].reps = 8;
  current.exercises[0].logs[0].rir = 0;
  assert.deepEqual(report([previous, current]).performance, []);
  current.exercises[0].logs[0].rir = 10;
  assert.deepEqual(report([previous, current]).performance, []);
  current.exercises[0].logs[0].rir = null;
  const before = structuredClone([previous, current]);
  const comparison = report([previous, current]).performance;
  assert.equal(comparison.length, 1);
  assert.equal(comparison[0].effort, 'unrecorded');
  assert.equal(comparison[0].rir, null);
  assert.deepEqual([previous, current], before);
});

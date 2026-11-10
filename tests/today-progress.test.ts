import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, PlanDaySchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { getTodayConsistency, getTodayProgress } from '../src/today-progress.ts';
import type { ActivityRecord } from '../src/activities.ts';
import type { JumpEntry, PerformanceData } from '../src/performance-data.ts';
import type { ReportSession } from '../src/weekly-report.ts';

const TODAY = '2026-11-10';
const emptyPerformance = (): PerformanceData => ({ jumps: [], readiness: [] });
function lift(date: string, kg = 70, reps = 6, rir: number | null = 2, equipmentLabel = 'QA Machine A'): ReportSession {
  const movement = toPlanExercise(findLibraryExercise('Hack Squat')!);
  const plan = PlanDaySchema.parse({ name: 'QA gym', kind: 'strength', minutes: 60, note: '',
    exercises: [{ ...movement, sets: 1, equipmentLabel }] });
  const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, DEFAULT_PROFILE, []), 'completed'));
  Object.assign(session.exercises[0].logs[0], { kg, reps, rir, done: true });
  return session;
}
const jump = (date: string, cm: number, extra: Partial<JumpEntry> = {}): JumpEntry => ({
  id: crypto.randomUUID(), date, cm, type: 'approach', measurement: 'height', source: 'measured', notes: '',
  standingReachCm: 235, touchCm: 235 + cm, conditions: 'QA same wall and shoes', ...extra,
});
const activity = (date: string, name = 'Volleyball', extra: Partial<ActivityRecord['activity']> = {}): ActivityRecord => ({
  version: 1, activity: { id: crypto.randomUUID(), date, type: 'other', name, durationMinutes: 120,
    distanceKm: null, intensity: 'moderate', bodyWeightKg: 70, watchCalories: null, notes: '', createdAt: 1000, deletedAt: null, ...extra },
});

test('Today highlights matched exercise, reps, equipment and recorded effort without inventing profile data', () => {
  const sessions = [lift('2026-10-27', 70), lift('2026-11-09', 75)];
  const result = getTodayProgress({ sessions, today: TODAY });
  assert.equal(result.metrics.length, 1);
  assert.deepEqual(result.metrics[0], { id: 'strength', label: 'Strength', name: 'Hack Squat', value: '+5', unit: 'kg',
    detail: 'at the same 6 reps · RIR 2', date: '2026-11-09', positive: true, comparison: '70 → 75 kg · QA Machine A' });
  assert.match(result.insight, /logged \+5 kg.*same 6 reps and RIR/);
  assert.equal(result.metrics.some(metric => metric.id === 'weight'), false);
});

test('first records, fewer reps, a different machine and different known effort never become a proven gain', () => {
  for (const sessions of [
    [lift('2026-11-09', 75)],
    [lift('2026-10-27', 70, 8), lift('2026-11-09', 75, 5)],
    [lift('2026-10-27', 70, 6, 3), lift('2026-11-09', 75, 6, 0)],
    [lift('2026-10-27', 70, 6, 2, 'QA Machine A'), lift('2026-11-09', 90, 6, 2, 'QA Machine B')],
  ]) {
    const result = getTodayProgress({ sessions, today: TODAY });
    assert.ok(result.metrics.length > 0);
    assert.ok(result.metrics.every(metric => metric.positive === false && !metric.value.startsWith('+')));
    assert.doesNotMatch(result.insight, /logged \+|improved/);
  }
});

test('unknown RIR keeps the recorded performance but does not produce a matched-effort improvement', () => {
  const result = getTodayProgress({ sessions: [lift('2026-10-27', 70, 6, null), lift('2026-11-09', 75, 6, null)], today: TODAY });
  assert.equal(result.metrics[0].value, '75');
  assert.equal(result.metrics[0].positive, false);
  assert.match(result.metrics[0].detail, /effort not recorded/);
  assert.equal(result.metrics[0].comparison, undefined);
});

test('Today jumping compares recorded compatible height protocols and keeps touch and estimates separate', () => {
  const performance = { ...emptyPerformance(), jumps: [jump('2026-10-27', 70), jump('2026-11-09', 72),
    jump('2026-11-10', 315, { measurement: 'touch', standingReachCm: undefined, touchCm: undefined }),
    jump('2026-11-10', 99, { source: 'video-estimate' })] };
  const result = getTodayProgress({ sessions: [], performance, today: TODAY });
  assert.equal(result.metrics.length, 1);
  assert.equal(result.metrics[0].id, 'approach');
  assert.equal(result.metrics[0].value, '+2');
  assert.match(result.metrics[0].comparison!, /70 → 72 cm/);
  assert.doesNotMatch(JSON.stringify(result), /315|99/);
  const different = getTodayProgress({ sessions: [], performance: { ...performance, jumps: [...performance.jumps,
    jump('2026-11-10', 68, { conditions: 'Different QA outdoor setup' })] }, today: TODAY });
  assert.equal(different.metrics[0].value, '68');
  assert.equal(different.metrics[0].positive, false);
});

test('same-day ambiguous jump setups and unavailable setup details never produce cherry-picked gains', () => {
  const ambiguous = getTodayProgress({ sessions: [], today: TODAY, performance: { ...emptyPerformance(), jumps: [
    jump('2026-11-09', 70), jump('2026-11-09', 80, { conditions: 'Other QA setup' }),
  ] } });
  assert.equal(ambiguous.metrics.length, 0);
  const unknown = getTodayProgress({ sessions: [], today: TODAY, performance: { ...emptyPerformance(), jumps: [
    jump('2026-10-27', 65, { standingReachCm: undefined, touchCm: undefined, conditions: undefined }),
    jump('2026-11-09', 70, { standingReachCm: undefined, touchCm: undefined, conditions: undefined }),
  ] } });
  assert.equal(unknown.metrics[0].value, '70');
  assert.equal(unknown.metrics[0].positive, false);
  assert.equal(unknown.metrics[0].comparison, undefined);
});

test('body weight prefers adequately sampled weekly averages and never calls their direction muscle gain', () => {
  const records = [
    ['2026-10-26', 69], ['2026-10-29', 69.2], ['2026-10-30', 69.4],
    ['2026-11-02', 70], ['2026-11-05', 70.2], ['2026-11-06', 70.4],
  ].map(([date, kg]) => ({ date: String(date), payload: { kind: 'weight', kg } }));
  const result = getTodayProgress({ sessions: [], nutritionRecords: records, today: TODAY });
  const weight = result.metrics.find(metric => metric.id === 'weight')!;
  assert.equal(weight.value, '70.2');
  assert.equal(weight.name, 'Weekly average');
  assert.match(weight.comparison!, /\+1 kg between recorded weekly averages/);
  assert.equal(weight.positive, false);
  const partial = getTodayProgress({ sessions: [], nutritionRecords: [{ date: TODAY, payload: { kind: 'weight', kg: 70.3 } }], today: TODAY });
  assert.equal(partial.metrics[0].name, 'Latest check-in');
  assert.equal(partial.metrics[0].comparison, undefined);
  assert.doesNotMatch(JSON.stringify(result), /muscle gain|stronger|fat loss/);
});

test('weekly consistency counts actual completed working days and actual volleyball days, not plans or duplicates', () => {
  const first = lift('2026-11-09');
  const duplicateDay = lift('2026-11-09');
  const active = lift(TODAY); active.status = 'active';
  const empty = lift(TODAY); empty.exercises[0].logs[0].done = false;
  const future = lift('2026-11-11');
  const deleted = lift(TODAY); deleted.deletedAt = 1000;
  const primer = lift(TODAY); primer.programRevision = '9'; primer.programSessionId = 'v9-approach-technique';
  const sport = lift(TODAY); sport.kind = 'sport'; sport.name = 'Volleyball';
  const result = getTodayConsistency({ sessions: [first, duplicateDay, active, empty, future, deleted, primer, sport],
    activities: [activity(TODAY), activity(TODAY), activity('2026-11-11'), activity(TODAY, 'Volleyball named PE', { trainingExposure: { sport: 'pe' } })],
    plan: createV9VolleyballMasterPlan(), today: TODAY });
  assert.equal(result.completedGymDays, 1);
  assert.equal(result.plannedGymDays, 4);
  assert.equal(result.volleyballDays, 1);
  assert.equal(result.days.filter(day => day.hasActivity).length, 2);
});

test('empty and Simple states offer a practical next step, use no owner measurements, and projections never write inputs', () => {
  const empty = getTodayProgress({ sessions: [], today: TODAY, athleteMode: false });
  assert.deepEqual(empty.metrics, []);
  assert.doesNotMatch(empty.insight, /jump|\d+ kg|\d+ cm/);
  const active = lift(TODAY); active.status = 'active';
  const future = lift('2026-11-11');
  const deleted = lift('2026-11-09'); deleted.deletedAt = 1000;
  const sessions = [active, future, deleted];
  const performance = { ...emptyPerformance(), jumps: [jump('2026-11-11', 90)] };
  const before = JSON.stringify({ sessions, performance });
  assert.deepEqual(getTodayProgress({ sessions, performance, today: TODAY }).metrics, []);
  assert.equal(JSON.stringify({ sessions, performance }), before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, PlanDaySchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library.ts';
import { coachPeriodStart, getCoachConsistency, getCoachJumpSeries, getCoachStrengthTrends, primaryCoachJump } from '../src/coach-progress.ts';
import type { JumpEntry } from '../src/performance-data.ts';
import type { ReportSession } from '../src/weekly-report.ts';

const TODAY = '2026-11-06';
function lift(date: string, options: { name?: string; kg?: number; reps?: number; rir?: number | null; equipment?: string; logs?: { kg: number; reps: number; rir: number | null }[] } = {}): ReportSession {
  const name = options.name ?? 'Hack Squat';
  const catalogue = findLibraryExercise(name) ?? (/assisted/i.test(name) ? findLibraryExercise('Pull-Up') : undefined);
  assert.ok(catalogue, name);
  const exercise = { ...toPlanExercise(catalogue), name, sets: options.logs?.length ?? 1,
    ...(options.equipment ? { equipmentLabel: options.equipment } : {}) };
  const plan = PlanDaySchema.parse({ name: 'Recorded strength', kind: 'strength', minutes: 60, note: '', exercises: [exercise] });
  const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, DEFAULT_PROFILE, []), 'completed'));
  session.exercises[0].logs = session.exercises[0].logs.map((log, index) => ({ ...log, done: true,
    kg: options.logs?.[index].kg ?? options.kg ?? 70, reps: options.logs?.[index].reps ?? options.reps ?? 6,
    rir: options.logs ? options.logs[index].rir : options.rir === undefined ? 2 : options.rir }));
  return session;
}
const jump = (date: string, cm: number, options: Partial<JumpEntry> = {}): JumpEntry => ({ id: crypto.randomUUID(), date, type: 'approach', measurement: 'height', cm, notes: '', ...options });

test('coach strength reports the latest two fixed-rep performances with matched effort and machine', () => {
  const sessions = [lift('2026-10-20', { kg: 65, equipment: 'Matrix' }), lift('2026-10-27', { kg: 70, equipment: 'Matrix' }), lift('2026-11-03', { kg: 75, equipment: 'Matrix' })];
  const [trend] = getCoachStrengthTrends(sessions, TODAY, '4w');
  assert.equal(trend.previous?.kg, 70);
  assert.equal(trend.latest.kg, 75);
  assert.equal(trend.change, 5);
  assert.equal(trend.latest.reps, 6);
  assert.equal(trend.effortMatched, true);
  assert.equal(trend.improvementAcrossDays, true);
  assert.equal(trend.equipmentLabel, 'Matrix');
});

test('a heavier set with fewer reps does not become proven improvement', () => {
  const [trend] = getCoachStrengthTrends([lift('2026-10-20', { kg: 70, reps: 8 }), lift('2026-11-03', { kg: 75, reps: 5 })], TODAY, '4w');
  assert.equal(trend.latest.kg, 75);
  assert.equal(trend.latest.reps, 5);
  assert.equal(trend.previous, null);
  assert.equal(trend.change, null);
  assert.equal(trend.improvementAcrossDays, false);
});

test('known equipment and effort differences cannot be merged into a gain', () => {
  const machines = getCoachStrengthTrends([lift('2026-10-20', { kg: 70, equipment: 'Technogym' }), lift('2026-11-03', { kg: 90, equipment: 'Matrix' })], TODAY, '4w');
  assert.equal(machines.length, 2);
  assert.ok(machines.every(item => item.previous === null));
  const [effort] = getCoachStrengthTrends([lift('2026-10-20', { kg: 70, rir: 3 }), lift('2026-11-03', { kg: 75, rir: 0 })], TODAY, '4w');
  assert.equal(effort.previous, null);
  assert.equal(effort.change, null);
});

test('missing RIR stays unknown and cannot support a matched-effort improvement claim', () => {
  const [trend] = getCoachStrengthTrends([lift('2026-10-20', { kg: 70, rir: null }), lift('2026-10-27', { kg: 72.5 }), lift('2026-11-03', { kg: 75, rir: null })], TODAY, '4w');
  assert.equal(trend.change, 2.5);
  assert.equal(trend.latest.rir, null);
  assert.equal(trend.effortMatched, false);
  assert.equal(trend.improvementAcrossDays, false);
});

test('most-observed latest rep cohort wins even when it reports a decline', () => {
  const [trend] = getCoachStrengthTrends([
    lift('2026-10-20', { logs: [{ kg: 80, reps: 6, rir: 2 }, { kg: 50, reps: 8, rir: 2 }] }),
    lift('2026-11-03', { logs: [{ kg: 75, reps: 6, rir: 2 }, { kg: 75, reps: 6, rir: 2 }, { kg: 90, reps: 8, rir: 2 }] }),
  ], TODAY, '4w');
  assert.equal(trend.latest.reps, 6);
  assert.equal(trend.change, -5);
  assert.equal(trend.improvementAcrossDays, false);
});

test('main lifts lead and bodyweight pull-up reps compare only the same added load', () => {
  const sessions = [
    lift('2026-11-01', { name: 'Chest-Supported Row' }),
    lift('2026-11-02', { name: 'Romanian Deadlift' }),
    lift('2026-11-03', { name: 'Hack Squat' }),
    lift('2026-10-20', { name: 'Pull-Up', kg: 0, reps: 8 }),
    lift('2026-11-04', { name: 'Pull-Up', kg: 0, reps: 10 }),
  ];
  const result = getCoachStrengthTrends(sessions, TODAY, '4w');
  assert.equal(result[0].name, 'Hack Squat');
  assert.equal(result[1].name, 'Romanian Deadlift');
  const pull = result.find(item => /pull-up/i.test(item.name))!;
  assert.equal(pull.unit, 'reps');
  assert.equal(pull.change, 2);
  const loaded = getCoachStrengthTrends([...sessions, lift('2026-11-05', { name: 'Pull-Up', kg: 5, reps: 6 })], TODAY, '4w').find(item => /pull-up/i.test(item.name))!;
  assert.equal(loaded.previous, null);
});

test('periods include recorded dates only and all-time includes older comparable strength', () => {
  const sessions = [lift('2026-03-01', { kg: 60 }), lift('2026-09-01', { kg: 65 }), lift('2026-11-03', { kg: 70 })];
  assert.equal(getCoachStrengthTrends(sessions, TODAY, '4w')[0].change, null);
  assert.equal(getCoachStrengthTrends(sessions, TODAY, '12w')[0].change, 5);
  assert.equal(getCoachStrengthTrends(sessions, TODAY, 'all')[0].points.length, 3);
  assert.equal(coachPeriodStart('2026-03-30', '4w'), '2026-03-03');
});

test('active, deleted and unchecked sets and ballistic weight cannot create strength trends', () => {
  const active = lift('2026-11-01'); active.status = 'active';
  const deleted = lift('2026-11-02'); deleted.deletedAt = 12;
  const unchecked = lift('2026-11-03'); unchecked.exercises[0].logs[0].done = false;
  const slam = lift('2026-11-04', { name: 'Medicine Ball Spike Slam', kg: 20 });
  assert.deepEqual(getCoachStrengthTrends([active, deleted, unchecked, slam], TODAY, 'all'), []);
});

test('jump trends separate reach/conditions, touch values and video estimates', () => {
  const entries = [
    jump('2026-10-20', 70, { standingReachCm: 235, touchCm: 305, conditions: 'Indoor · same shoes' }),
    jump('2026-10-27', 72, { standingReachCm: 235, touchCm: 307, conditions: 'Indoor · same shoes' }),
    jump('2026-11-03', 65, { standingReachCm: 235, touchCm: 300, conditions: 'Outdoor grass' }),
    jump('2026-11-04', 315, { measurement: 'touch' }),
    jump('2026-11-05', 85, { source: 'video-estimate' }),
  ];
  const series = getCoachJumpSeries([], entries, TODAY, '4w');
  assert.equal(series.length, 2);
  const latest = primaryCoachJump(series, 'approach')!;
  assert.equal(latest.latest.cm, 65);
  assert.equal(latest.previous, null);
  assert.equal(latest.best, 65);
  assert.equal(series.find(item => item.conditions.startsWith('Indoor'))!.change, 2);
});

test('missing jump measurements and stale periods never invent a chart or improvement', () => {
  assert.deepEqual(getCoachJumpSeries([], [], TODAY, '4w'), []);
  const entries = [jump('2026-03-01', 60), jump('2026-04-01', 65)];
  const [recent] = getCoachJumpSeries([], entries, TODAY, '4w');
  assert.equal(recent.points.length, 0);
  assert.equal(recent.change, null);
  assert.equal(recent.latest.date, '2026-04-01');
  assert.equal(getCoachJumpSeries([], entries, TODAY, 'all')[0].change, 5);
});

test('progress helpers never modify stored inputs or synthesize records', () => {
  const sessions = [lift('2026-10-20'), lift('2026-11-03', { kg: 75 })];
  const jumps = [jump('2026-10-20', 65), jump('2026-11-03', 67)];
  const before = JSON.stringify({ sessions, jumps });
  getCoachStrengthTrends(sessions, TODAY, 'all');
  getCoachJumpSeries(sessions, jumps, TODAY, 'all');
  assert.equal(JSON.stringify({ sessions, jumps }), before);
});


test('consistency uses completed dated records, excludes V9 primers, and never invents plan adherence', () => {
  const first = lift('2026-11-01');
  const sameDay = lift('2026-11-01');
  const primer = lift('2026-11-02'); primer.programRevision = '9'; primer.programSessionId = 'v9-match-primer'; primer.name = 'Renamed easy preparation';
  const technique = lift('2026-11-03'); technique.programRevision = '9'; technique.programSessionId = 'v9-approach-technique';
  const older = lift('2026-08-01');
  const active = lift('2026-11-04'); active.status = 'active';
  const result = getCoachConsistency([first, sameDay, primer, technique, older, active], [], TODAY, '4w');
  assert.deepEqual(result, { gymDays: 1, gymSessions: 2, volleyballRecords: 0 });
  assert.equal(getCoachConsistency([first, sameDay, primer, technique, older, active], [], TODAY, 'all').gymDays, 2);
});


test('mixed pull-up and assisted names retain the latest record without inventing comparable assistance', () => {
  const [trend] = getCoachStrengthTrends([lift('2026-10-20', { name: 'Pull-ups / Assisted Pull-ups', kg: 0, reps: 8 }), lift('2026-11-03', { name: 'Pull-ups / Assisted Pull-ups', kg: 0, reps: 12 })], TODAY, 'all');
  assert.equal(trend.latest.reps, 12);
  assert.equal(trend.previous, null);
  assert.equal(trend.change, null);
  assert.equal(trend.improvementAcrossDays, false);
  assert.match(trend.configurationNote!, /Assistance is not recorded/);
});

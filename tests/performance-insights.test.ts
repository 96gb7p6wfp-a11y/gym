import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { getProgressionRecommendation, getWeightSummary, getJumpSummaries, getPersonalRecords, getPerformanceSummary, estimateOneRepMax, exerciseIntent, exercisePerformanceIdentity, areComparableExercises } from '../src/performance-insights.ts';
import type { ReportSession } from '../src/weekly-report.ts';
import type { JumpEntry } from '../src/performance-data.ts';

function session(date: string, kg = 70, reps = 8, rir: number | null = 2): ReportSession {
  const started = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []));
  started.runningSince = null;
  started.elapsedMs = 40 * 60_000;
  started.startedAt = new Date(`${date}T12:00:00Z`).getTime();
  const finished = SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + started.elapsedMs));
  const exercise = { ...finished.exercises[0], key: 'squat', name: 'Back Squat', group: 'Lower strength', target: '6–8', mode: 'weight' as const, sets: 3, logs: finished.exercises[0].logs.slice(0, 3).map((log, i) => ({ ...log, id: `${date}-${i}`, done: true, kg, reps, rir })) };
  finished.exercises = [exercise];
  return SessionSchema.parse(finished);
}
const exercise = () => session('2026-10-01').exercises[0];
const weight = (date: string, kg: number) => ({ date, payload: { kind: 'weight', kg, notes: '' } });
const jump = (date: string, type: JumpEntry['type'], measurement: JumpEntry['measurement'], cm: number): JumpEntry => ({ id: crypto.randomUUID(), date, type, measurement, cm, notes: '' });

test('progression requires repeatable completed sessions, upper rep range and recorded reserve before a small load increase', () => {
  const history = [session('2026-10-01'), session('2026-10-08')];
  const result = getProgressionRecommendation(exercise(), history, '2026-10-15', { loadIncrementKg: 2.5 });
  assert.equal(result.kind, 'load'); assert.equal(result.kg, 72.5); assert.equal(result.reps, 6);
  assert.ok(result.kg! <= 70 * 1.05); assert.deepEqual(result.previous, { kg: 70, reps: 8 });
  assert.equal(history[1].exercises[0].logs[0].kg, 70, 'recommendation never changes stored logs');
  assert.equal(getProgressionRecommendation(exercise(), history.slice(0, 1), '2026-10-15').kind, 'hold');
  assert.equal(getProgressionRecommendation(exercise(), history.map(s => ({ ...s, exercises: s.exercises.map(e => ({ ...e, logs: e.logs.map(l => ({ ...l, rir: null })) })) })), '2026-10-15').kind, 'hold');
});
test('rep progression stays inside the prescribed range and large equipment increments are held', () => {
  const result = getProgressionRecommendation(exercise(), [session('2026-10-08', 70, 7)], '2026-10-15');
  assert.equal(result.kind, 'reps'); assert.equal(result.kg, 70); assert.equal(result.reps, 8);
  const tooLarge = getProgressionRecommendation(exercise(), [session('2026-10-01', 10), session('2026-10-08', 10)], '2026-10-15', { loadIncrementKg: 2.5 });
  assert.equal(tooLarge.kind, 'hold'); assert.equal(tooLarge.kg, 10);
});
test('an incomplete final set or exhausted set blocks an automatic load increase', () => {
  const history = [session('2026-10-01'), session('2026-10-08')];
  history[1].exercises[0].logs.at(-1)!.done = false;
  assert.equal(getProgressionRecommendation(exercise(), history, '2026-10-15').kind, 'hold');
  history[1].exercises[0].logs.at(-1)!.done = true;
  history[1].exercises[0].logs.at(-1)!.rir = 0;
  assert.equal(getProgressionRecommendation(exercise(), history, '2026-10-15').kind, 'hold');
});
test('performance declines, near-term volleyball and low energy moderate suggestions', () => {
  assert.equal(getProgressionRecommendation(exercise(), [session('2026-10-01'), session('2026-10-08', 70, 5, 0)], '2026-10-15').kind, 'reduce');
  const history = [session('2026-10-01'), session('2026-10-08')];
  const sport = getProgressionRecommendation(exercise(), history, '2026-10-15', { volleyballWithin24Hours: true });
  assert.equal(sport.kind, 'hold'); assert.match(sport.cue, /skip extra leg sets/);
  const tired = getProgressionRecommendation(exercise(), history, '2026-10-15', { readiness: { energy: 'low', soreness: 'low' } });
  assert.equal(tired.kind, 'hold'); assert.equal(tired.kg, undefined);
});
test('power and timed work progress through quality, without heavier-load recommendations', () => {
  const power = { ...exercise(), name: 'Trap Bar Jump', group: 'Power' };
  const result = getProgressionRecommendation(power, [], '2026-10-15');
  assert.equal(result.kind, 'quality'); assert.equal(result.kg, undefined); assert.match(result.cue, /fast/);
  assert.match(exerciseIntent(power), /Fast intent/);
  const timed = { ...exercise(), name: 'Copenhagen Plank', mode: 'timed' as const, target: '20–30 sec' };
  assert.equal(getProgressionRecommendation(timed, [], '2026-10-15').kind, 'quality');
});
test('deleted, active, future and renamed exercises do not supply a progression baseline', () => {
  const valid = session('2026-10-01');
  const wrong = [ { ...valid, status: 'active' as const }, { ...valid, status: 'deleted' as const }, { ...valid, date: '2026-11-01' }, { ...valid, exercises: [{ ...valid.exercises[0], name: 'Front Squat' }] } ];
  assert.equal(getProgressionRecommendation(exercise(), wrong, '2026-10-15').kind, 'baseline');
});
test('canonical exercise IDs preserve comparisons after copying a movement into a session', () => {
  const a = session('2026-10-01'), b = session('2026-10-08');
  Object.assign(a.exercises[0], { exerciseId: 'barbell-squat', key: 'old-key' });
  Object.assign(b.exercises[0], { exerciseId: 'barbell-squat', key: 'new-key' });
  const result = getProgressionRecommendation({ ...exercise(), key: 'today-key', exerciseId: 'barbell-squat' }, [a, b], '2026-10-15');
  assert.equal(result.kind, 'load');
});
test('body weight uses daily averages and well-sampled weekly averages instead of daily fluctuations', () => {
  const result = getWeightSummary([weight('2026-10-05', 64), weight('2026-10-05', 66), weight('2026-10-07', 64), weight('2026-10-09', 63), weight('2026-10-12', 65), weight('2026-10-14', 64.5), weight('2026-10-16', 64), weight('2026-10-17', 100)], '2026-10-16');
  assert.equal(result.points[0].kg, 65); assert.equal(result.weeks[0].days, 3);
  assert.equal(result.weeks[0].kg, 64); assert.equal(result.weeklyAverage, 64.5);
  assert.equal(result.change30Days, 0.5); assert.equal(result.current, 64);
});
test('three consecutive completed adequately sampled stable weeks suggest calories without altering targets', () => {
  const records = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09'].map(date => weight(date, 64));
  const before = JSON.stringify(records);
  const result = getWeightSummary(records, '2026-10-15');
  assert.equal(result.stableThreeWeeks, true); assert.match(result.insight!, /100–150 kcal/);
  assert.equal(JSON.stringify(records), before);
  assert.equal(getWeightSummary(records.filter((_, i) => i % 3 === 0), '2026-10-15').stableThreeWeeks, false);
  assert.equal(getWeightSummary(records.filter(record => !record.date.startsWith('2026-09-2')), '2026-10-15').stableThreeWeeks, false);
});
test('missing, sparse or invalid body-weight records never create a gain trend', () => {
  const empty = getWeightSummary([], '2026-10-15', 64);
  assert.equal(empty.current, 64); assert.equal(empty.weeklyAverage, null); assert.equal(empty.change30Days, null);
  const sparse = getWeightSummary([weight('2026-10-01', 64), weight('2026-10-08', 66), weight('2026-02-31', 70)], '2026-10-15');
  assert.equal(sparse.change30Days, null); assert.equal(sparse.stableThreeWeeks, false);
});
test('jump series keep standing, approach, block, height, touch and distance distinct', () => {
  const recorded = session('2026-10-08');
  recorded.exercises[0] = { ...recorded.exercises[0], name: 'Approach Jump', measurement: 'height', mode: 'bodyweight', logs: [{ ...recorded.exercises[0].logs[0], kg: null, measurementCm: 66 }] };
  const distance = structuredClone(recorded); distance.exercises[0].measurement = 'distance'; distance.exercises[0].logs[0].measurementCm = 250;
  const data = [jump('2026-10-01', 'approach', 'height', 64), jump('2026-10-12', 'approach', 'height', 68), jump('2026-10-12', 'approach', 'touch', 305), jump('2026-10-12', 'standing', 'height', 52), jump('2026-10-12', 'block', 'height', 60), jump('2026-11-01', 'approach', 'height', 100)];
  const result = getJumpSummaries([recorded, distance], data, '2026-10-15');
  assert.equal(result.length, 4);
  const approach = result.find(item => item.type === 'approach' && item.measurement === 'height')!;
  assert.equal(approach.current, 68); assert.equal(approach.best, 68); assert.equal(approach.change30Days, 4);
  assert.equal(result.find(item => item.measurement === 'touch')!.current, 305);
});
test('estimated 1RM and PRs require valid completed weighted sets and label estimates', () => {
  assert.equal(estimateOneRepMax(100, 1), null); assert.equal(estimateOneRepMax(100, 11), null);
  assert.equal(estimateOneRepMax(100, 6), 120); assert.equal(estimateOneRepMax(0, 6), null);
  const first = session('2026-10-01', 70, 6), second = session('2026-10-08', 72.5, 6);
  second.exercises[0].logs.push({ ...second.exercises[0].logs[0], id: 'unfinished', done: false, kg: 300, reps: 10 });
  const result = getPersonalRecords([first, second], '2026-10-15');
  const load = result.find(record => record.kind === 'weight')!;
  assert.equal(load.value, 72.5); assert.equal(load.isNew, true);
  assert.equal(result.find(record => record.kind === 'volume')!.value, 1305);
  assert.match(result.find(record => record.kind === 'estimated-1rm')!.context, /Estimated/);
  assert.equal(getPersonalRecords([first], '2026-10-15').some(record => record.isNew), false);
});
test('performance summary uses matched rep counts and makes unknown load explicit', () => {
  const missing = getPerformanceSummary({ sessions: [], today: '2026-10-15', plan: DEFAULT_PROFILE.plan });
  assert.equal(missing.load.level, 'unknown'); assert.equal(missing.strengthChanges.length, 0); assert.equal(missing.gymSessions, 0);
  assert.match(missing.load.cue, /cannot be inferred/);
  const before = session('2026-10-01', 70, 8), after = session('2026-10-08', 80, 5);
  const mismatched = getPerformanceSummary({ sessions: [before, after], today: '2026-10-15' });
  assert.deepEqual(mismatched.strengthChanges, []);
  after.exercises[0].logs.forEach(log => { log.reps = 8; });
  const matching = getPerformanceSummary({ sessions: [before, after], today: '2026-10-15' });
  assert.equal(matching.strengthChanges[0].current, 80); assert.equal(matching.strengthChanges[0].percent, 14.3);
  assert.ok(matching.insights.length <= 3);
});
test('gym, volleyball, weekly volume and readiness remain separate meaningful observations', () => {
  const gym = session('2026-10-12', 70, 8);
  const volley = { ...session('2026-10-13'), name: 'Volleyball', kind: 'sport' as const, exercises: [] };
  const result = getPerformanceSummary({ sessions: [gym, volley], plan: DEFAULT_PROFILE.plan, today: '2026-10-15', performance: { jumps: [], readiness: [{ id: crypto.randomUUID(), date: '2026-10-15', energy: 'normal', soreness: 'high' }] } });
  assert.equal(result.gymSessions, 1); assert.equal(result.volleyballSessions, 1);
  assert.equal(result.weeklyVolumeKg, 1680); assert.equal(result.weeklySets, 3);
  assert.equal(result.load.level, 'higher'); assert.match(result.load.cue, /check-in/);
});
test('bodyweight rep records do not pretend added load is a total-body estimated 1RM', () => {
  const a = session('2026-10-01', 70, 8), b = session('2026-10-08', 70, 10);
  for (const s of [a, b]) { s.exercises[0].name = 'Pull-Up'; s.exercises[0].mode = 'bodyweight'; s.exercises[0].logs.forEach(log => { log.kg = null; }); }
  const records = getPersonalRecords([a, b], '2026-10-15');
  assert.equal(records.length, 1); assert.equal(records[0].kind, 'reps'); assert.equal(records[0].value, 10); assert.equal(records[0].isNew, true);
  assert.equal(records[0].sessionId, b.id); assert.match(records[0].context, /Bodyweight/);
});
test('a rise in weighted work is disclosed even when completed set count stays equal', () => {
  const result = getPerformanceSummary({ sessions: [session('2026-10-03', 50), session('2026-10-05', 50), session('2026-10-10', 70), session('2026-10-12', 70)], today: '2026-10-15' });
  assert.equal(result.load.level, 'higher'); assert.match(result.load.cue, /weighted work/);
});
test('chart identity matches canonical movement copies while separating names, modes and measurement types', () => {
  const original = { ...exercise(), exerciseId: 'squat' };
  const copied = { ...original, key: 'unique-today-key', name: '  Back   Squat ' };
  assert.equal(areComparableExercises(original, copied), true);
  assert.equal(exercisePerformanceIdentity(original), exercisePerformanceIdentity(copied));
  assert.equal(areComparableExercises(original, { ...copied, name: 'Front Squat' }), false);
  assert.equal(areComparableExercises(original, { ...copied, mode: 'bodyweight' }), false);
  assert.equal(areComparableExercises({ ...original, measurement: 'height' }, { ...copied, measurement: 'touch' }), false);
  assert.equal(areComparableExercises(original, { ...copied, exerciseId: 'another-machine' }), false);
});
test('leg soreness moderates leg work without automatically blocking upper-body progression', () => {
  const context = { readiness: { energy: 'normal' as const, soreness: 'high' as const } };
  const history = [session('2026-10-01'), session('2026-10-08')];
  assert.equal(getProgressionRecommendation(exercise(), history, '2026-10-15', context).kind, 'hold');
  const upper = { ...exercise(), name: 'Bench Press', group: 'Upper strength' };
  const upperHistory = history.map(s => ({ ...s, exercises: [{ ...s.exercises[0], name: upper.name, group: upper.group }] }));
  assert.equal(getProgressionRecommendation(upper, upperHistory, '2026-10-15', context).kind, 'load');
  const nordic = { ...exercise(), name: 'Nordic Curl', group: '' };
  assert.equal(getProgressionRecommendation(nordic, [], '2026-10-15', context).kind, 'hold');
});
test('paused squat jump and distance tests do not inflate a standing countermovement jump trend', () => {
  const logged = session('2026-10-08');
  logged.exercises[0] = { ...logged.exercises[0], name: 'Squat Jump', mode: 'bodyweight', measurement: 'height', logs: [{ ...logged.exercises[0].logs[0], kg: null, measurementCm: 72 }] };
  const result = getJumpSummaries([logged], [jump('2026-10-01', 'standing', 'height', 55)], '2026-10-15');
  assert.equal(result.length, 1); assert.equal(result[0].current, 55); assert.equal(result[0].best, 55);
  assert.equal(getPersonalRecords([logged], '2026-10-15').find(record => record.kind === 'height')!.value, 72);
});

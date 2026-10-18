import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { getDailyMotivation, getProgressTakeaway } from '../src/coaching-summary.ts';
import { getPerformanceSummary } from '../src/performance-insights.ts';
import type { JumpEntry } from '../src/performance-data.ts';
import type { ReportSession } from '../src/weekly-report.ts';

const TODAY = '2026-10-18';
const jump = (date: string, cm: number, measurement: JumpEntry['measurement'] = 'height', type: JumpEntry['type'] = 'approach'): JumpEntry => ({ id: crypto.randomUUID(), date, type, measurement, cm, notes: '' });
const weight = (date: string, kg: number) => ({ date, payload: { kind: 'weight', kg, notes: '' } });
function session(date: string, kg: number, reps = 6): ReportSession {
  const started = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []));
  started.runningSince = null;
  started.elapsedMs = 45 * 60_000;
  started.startedAt = new Date(`${date}T12:00:00Z`).getTime();
  const saved = SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + started.elapsedMs));
  const exercise = saved.exercises[0];
  saved.exercises = [{ ...exercise, key: 'hack-squat', name: 'Hack Squat', group: 'Strength', mode: 'weight', measurement: undefined, target: '4–6', sets: 3,
    logs: exercise.logs.slice(0, 3).map(log => ({ ...log, done: true, kg, reps, rir: 2 })) }];
  return SessionSchema.parse(saved);
}

test('empty and profile-only records give an honest next step rather than invented progress', () => {
  const summary = getPerformanceSummary({ sessions: [], bodyWeight: 64, today: TODAY });
  const takeaway = getProgressTakeaway(summary);
  assert.deepEqual(takeaway, {
    basis: 'baseline', observation: 'Your baseline starts here.',
    nextStep: 'Log a jump height, then repeat the same test.',
  });
  assert.doesNotMatch(`${takeaway.observation} ${takeaway.nextStep}`, /improv|stronger|recovered|\d+%/i);
});

test('one recent jump and an old result do not create a 30-day improvement', () => {
  const summary = getPerformanceSummary({ sessions: [], today: TODAY,
    performance: { jumps: [jump('2026-08-01', 65), jump('2026-10-17', 68)], readiness: [] } });
  assert.equal(getProgressTakeaway(summary).basis, 'baseline');
  assert.doesNotMatch(getProgressTakeaway(summary).observation, /up|down|3 cm/);
});

test('approach-height progress leads and is not inflated by touch or another jump protocol', () => {
  const summary = getPerformanceSummary({ sessions: [session('2026-10-01', 70), session('2026-10-15', 75)], today: TODAY,
    performance: { jumps: [jump('2026-10-01', 65), jump('2026-10-17', 67.5), jump('2026-10-01', 300, 'touch'), jump('2026-10-17', 350, 'touch'), jump('2026-10-01', 55, 'height', 'standing'), jump('2026-10-17', 65, 'height', 'standing')], readiness: [] } });
  const before = JSON.stringify(summary);
  const takeaway = getProgressTakeaway(summary);
  assert.equal(takeaway.observation, 'Approach jump is up 2.5 cm across recorded test days.');
  assert.equal(takeaway.nextStep, 'Keep jump reps fast and landings controlled.');
  assert.equal(JSON.stringify(summary), before, 'coaching does not reorder or alter the supplied summary');
});

test('touch improvements are explicitly called touch and never presented as jump height', () => {
  const summary = getPerformanceSummary({ sessions: [], today: TODAY,
    performance: { jumps: [jump('2026-10-01', 315, 'touch'), jump('2026-10-17', 317.5, 'touch')], readiness: [] } });
  assert.equal(getProgressTakeaway(summary).observation, 'Approach touch is up 2.5 cm across recorded test days.');
});

test('a declining approach test is not hidden by improving strength or standing jumps', () => {
  const summary = getPerformanceSummary({ sessions: [session('2026-10-01', 70), session('2026-10-15', 75)], today: TODAY,
    performance: { jumps: [jump('2026-10-01', 70), jump('2026-10-17', 65), jump('2026-10-01', 50, 'height', 'standing'), jump('2026-10-17', 60, 'height', 'standing')], readiness: [] } });
  const takeaway = getProgressTakeaway(summary);
  assert.equal(takeaway.observation, 'Approach jump is down 5 cm across recorded test days.');
  assert.match(takeaway.nextStep, /Retest under similar conditions/);
  assert.doesNotMatch(`${takeaway.observation} ${takeaway.nextStep}`, /overtrained|injur|fatigue caused|increase load/);
});

test('strength takeaways require matched reps and suggest controlled progression', () => {
  const comparable = getPerformanceSummary({ sessions: [session('2026-10-01', 70), session('2026-10-15', 72.5)], today: TODAY });
  assert.equal(getProgressTakeaway(comparable).observation, 'Hack Squat: 2.5 kg more at 6 reps.');
  assert.match(getProgressTakeaway(comparable).nextStep, /Repeat cleanly before adding load/);
  const differentReps = getPerformanceSummary({ sessions: [session('2026-10-01', 70), session('2026-10-15', 75, 4)], today: TODAY });
  assert.equal(getProgressTakeaway(differentReps).basis, 'baseline');
  assert.match(getProgressTakeaway(differentReps).observation, /2 gym sessions are recorded/);
});

test('declining comparable loads suggest restraint rather than forced overload', () => {
  const summary = getPerformanceSummary({ sessions: [session('2026-10-01', 70), session('2026-10-15', 65)], today: TODAY });
  const takeaway = getProgressTakeaway(summary);
  assert.equal(takeaway.observation, 'Hack Squat: 5 kg less at 6 reps.');
  assert.match(takeaway.nextStep, /avoid grinding reps/);
});

test('weight coaching uses adequately sampled weeks and never changes targets', () => {
  const nutritionRecords = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09'].map(date => weight(date, 64));
  const before = JSON.stringify(nutritionRecords);
  const summary = getPerformanceSummary({ sessions: [], nutritionRecords, today: TODAY });
  const takeaway = getProgressTakeaway(summary);
  assert.equal(takeaway.observation, 'Your weekly-average weight has been stable for 3 weeks.');
  assert.match(takeaway.nextStep, /^Consider \+100–150 kcal\/day/);
  assert.equal(JSON.stringify(nutritionRecords), before);
  const sparse = getPerformanceSummary({ sessions: [], nutritionRecords: [weight('2026-10-01', 64), weight('2026-10-15', 65)], today: TODAY });
  assert.equal(getProgressTakeaway(sparse).basis, 'baseline');
});

test('recorded low readiness moderates the next step even when the jump is improving', () => {
  const summary = getPerformanceSummary({ sessions: [], today: TODAY, performance: {
    jumps: [jump('2026-10-01', 65), jump('2026-10-17', 68)],
    readiness: [{ id: crypto.randomUUID(), date: TODAY, energy: 'low', soreness: 'low' }],
  } });
  const takeaway = getProgressTakeaway(summary);
  assert.match(takeaway.observation, /up 3 cm/);
  assert.match(takeaway.nextStep, /leave extra leg work out/);
  const noComparison = getPerformanceSummary({ sessions: [], today: TODAY, performance: { jumps: [], readiness: [{ id: crypto.randomUUID(), date: TODAY, energy: 'low', soreness: 'low' }] } });
  assert.equal(getProgressTakeaway(noComparison).observation, 'Your latest check-in suggests an easier day.');
});

test('quiet daily encouragement supports recovery and court performance without extra training demands', () => {
  assert.match(getDailyMotivation({ kind: 'recovery' }), /Easy movement.*fresher legs/);
  assert.match(getDailyMotivation({ kind: 'sport' }), /next play/);
  assert.equal(getDailyMotivation({ kind: 'strength', active: true }), 'One clean set at a time.');
  assert.match(getDailyMotivation({ kind: 'strength', completed: true }), /Recovery is part/);
  for (const kind of ['strength', 'sport', 'recovery'] as const) assert.doesNotMatch(getDailyMotivation({ kind }), /failure|extra sets|no pain|push through/i);
});

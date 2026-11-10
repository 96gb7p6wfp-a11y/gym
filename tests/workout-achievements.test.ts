import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, ExerciseSchema, PlanDaySchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { formatWorkoutDuration, formatWorkoutSet, getWorkoutAchievements } from '../src/workout-achievements.ts';
import type { ReportSession } from '../src/weekly-report.ts';

function workout(date: string, options: { kg?: number; reps?: number; rir?: number | null; equipment?: string; name?: string; mode?: 'weight' | 'bodyweight' | 'timed'; measurement?: 'height' | 'touch'; quantityUnit?: 'm'; seconds?: number; measurementCm?: number; preparationOnly?: boolean; count?: number; perSide?: boolean } = {}): ReportSession {
  const exercise = ExerciseSchema.parse({ key: 'press', exerciseId: 'chest-press', name: options.name ?? 'Machine Chest Press',
    group: 'Strength', sets: options.count ?? 3, target: '6–8 reps', rest: 120, perSide: options.perSide ?? false,
    mode: options.mode ?? 'weight', equipmentLabel: options.equipment, measurement: options.measurement, quantityUnit: options.quantityUnit,
    preparationOnly: options.preparationOnly });
  const plan = PlanDaySchema.parse({ name: 'Upper A — Spike Power + Strength', kind: 'strength', minutes: 90, note: '', exercises: [exercise] });
  const result = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, DEFAULT_PROFILE, []), 'completed'));
  result.startedAt = Date.parse(`${date}T10:00:00Z`); result.finishedAt = result.startedAt + 111 * 60_000;
  result.elapsedMs = 111 * 60_000;
  result.exercises[0].logs.forEach(log => Object.assign(log, { kg: options.kg ?? 60, reps: options.reps ?? 8,
    rir: options.rir === undefined ? 2 : options.rir, done: true, seconds: options.seconds ?? null,
    ...(options.measurementCm != null ? { measurementCm: options.measurementCm } : {}) }));
  return result;
}

test('duration uses hours and minutes without a long decimal-minute number', () => {
  assert.equal(formatWorkoutDuration(111 * 60_000), '1h 51m');
  assert.equal(formatWorkoutDuration(60 * 60_000), '1h');
  assert.equal(formatWorkoutDuration(168 * 60 * 60_000), '168h');
  assert.equal(formatWorkoutDuration(45_000), '1m');
  assert.equal(formatWorkoutDuration(0), '—');
  assert.equal(formatWorkoutDuration(Number.NaN), '—');
});

test('a first workout is a baseline and duplicate copies of the current snapshot cannot fabricate improvement', () => {
  const session = workout('2026-11-09');
  const result = getWorkoutAchievements(session, [session, structuredClone(session)]);
  assert.equal(result.newRecordCount, 0);
  assert.equal(result.baselineCount, 1);
  assert.equal(result.highlight?.status, 'baseline');
  assert.equal(result.highlight?.label, 'First recorded performance');
  assert.equal(result.comparison, null);
});

test('three improved sets create one distinct achievement, not weight/reps/volume/e1RM achievements', () => {
  const previous = workout('2026-11-02', { kg: 55 });
  const session = workout('2026-11-09', { kg: 60 });
  const before = structuredClone([session, previous]);
  const result = getWorkoutAchievements(session, [previous, structuredClone(previous), session]);
  assert.equal(result.newRecordCount, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.highlight?.status, 'new-record');
  assert.equal(result.highlight?.comparison, 'Machine Chest Press: +5 kg at the same 8 reps.');
  assert.match(result.highlight!.context, /RIR 2 matched/);
  assert.deepEqual([session, previous], before);
});

test('a repeated best is explicitly distinguished from a new record and an ordinary lower set', () => {
  const previous = workout('2026-11-02', { kg: 60 });
  const matched = getWorkoutAchievements(workout('2026-11-09', { kg: 60 }), [previous]);
  assert.equal(matched.newRecordCount, 0);
  assert.equal(matched.highlight?.status, 'repeated-best');
  assert.equal(matched.highlight?.label, 'Personal best matched');
  assert.equal(matched.comparison, null);
  const ordinary = getWorkoutAchievements(workout('2026-11-09', { kg: 55 }), [previous]);
  assert.equal(ordinary.highlight?.status, 'ordinary');
  assert.equal(ordinary.comparison, null);
});

test('a larger load with fewer reps is a new comparison baseline, never proven progress', () => {
  const result = getWorkoutAchievements(workout('2026-11-09', { kg: 65, reps: 5 }), [workout('2026-11-02', { kg: 60, reps: 8 })]);
  assert.equal(result.newRecordCount, 0);
  assert.equal(result.highlight?.status, 'baseline');
  assert.equal(result.highlight?.label, 'New comparison baseline');
  assert.equal(result.comparison, null);
});

test('equipment changes or known different effort cannot generate a comparable record', () => {
  const previous = workout('2026-11-02', { kg: 55, equipment: 'Machine A', rir: 3 });
  for (const session of [workout('2026-11-09', { kg: 60, equipment: 'Machine B', rir: 3 }),
    workout('2026-11-09', { kg: 60, equipment: 'Machine A', rir: 0 })]) {
    const result = getWorkoutAchievements(session, [previous]);
    assert.equal(result.newRecordCount, 0);
    assert.equal(result.comparison, null);
  }
});

test('matching equipment case and spacing still compares without labeling older unlabeled history', () => {
  const previous = workout('2026-11-02', { kg: 55, equipment: '  Matrix   Chest Press ' });
  const session = workout('2026-11-09', { kg: 60, equipment: 'matrix chest press' });
  assert.equal(getWorkoutAchievements(session, [previous]).newRecordCount, 1);
  const unlabelled = workout('2026-11-02', { kg: 55 });
  assert.equal(getWorkoutAchievements(session, [unlabelled]).newRecordCount, 0);
  assert.equal(unlabelled.exercises[0].equipmentLabel, undefined);
});

test('unknown effort stays explicit rather than being invented for a recorded same-rep best', () => {
  const result = getWorkoutAchievements(workout('2026-11-09', { kg: 60, rir: null }), [workout('2026-11-02', { kg: 55, rir: null })]);
  assert.equal(result.newRecordCount, 1);
  assert.match(result.comparison!, /Effort was not recorded in both sets/);
  assert.doesNotMatch(result.highlight!.context, /RIR 2 matched/);
});

test('more reps only compare at the same load, including genuinely unassisted bodyweight pull-ups', () => {
  const previous = workout('2026-11-02', { kg: 60, reps: 8 });
  const result = getWorkoutAchievements(workout('2026-11-09', { kg: 60, reps: 10 }), [previous]);
  assert.equal(result.newRecordCount, 1);
  assert.match(result.comparison!, /\+2 reps at the same 60 kg/);
  const first = workout('2026-11-02', { name: 'Pull-Up', mode: 'bodyweight', kg: 0, reps: 8 });
  first.exercises[0].logs.forEach(log => { log.kg = null; });
  const next = workout('2026-11-09', { name: 'Pull-Up', mode: 'bodyweight', kg: 0, reps: 10 });
  assert.equal(getWorkoutAchievements(next, [first]).newRecordCount, 1);
  assert.match(getWorkoutAchievements(next, [first]).comparison!, /with no added load/);
  assert.match(getWorkoutAchievements(next, [first]).highlight!.context, /body mass not matched/);
  const assisted = workout('2026-11-09', { name: 'Assisted Pull-Up', mode: 'bodyweight', kg: 0, reps: 10 });
  assert.equal(getWorkoutAchievements(assisted, [workout('2026-11-02', { name: 'Assisted Pull-Up', mode: 'bodyweight', kg: 0, reps: 8 })]).newRecordCount, 0);
});

test('active, deleted, future and unchecked sets never become evidence of a personal best', () => {
  const current = workout('2026-11-09', { kg: 60 });
  const active = workout('2026-11-02', { kg: 55 }); active.status = 'active';
  const deleted = workout('2026-11-02', { kg: 55 }); deleted.deletedAt = 20;
  const unchecked = workout('2026-11-02', { kg: 55 }); unchecked.exercises[0].logs.forEach(log => { log.done = false; });
  const result = getWorkoutAchievements(current, [active, deleted, unchecked, workout('2026-11-16', { kg: 55 })]);
  assert.equal(result.newRecordCount, 0);
  assert.equal(result.highlight?.status, 'baseline');
  current.status = 'active';
  assert.deepEqual(getWorkoutAchievements(current, []), { records: [], newRecordCount: 0, baselineCount: 0, highlight: null, comparison: null });
});

test('two entries of the same movement within a workout do not create two achievements', () => {
  const current = workout('2026-11-09', { kg: 60 });
  current.exercises.push({ ...structuredClone(current.exercises[0]), key: 'press-second-block' });
  const result = getWorkoutAchievements(current, [workout('2026-11-02', { kg: 55 })]);
  assert.equal(result.newRecordCount, 1);
  assert.equal(result.records.length, 1);
});

test('best means all comparable history, not just a weaker most-recent session', () => {
  const result = getWorkoutAchievements(workout('2026-11-09', { kg: 60 }), [workout('2026-10-19', { kg: 65 }), workout('2026-11-02', { kg: 55 })]);
  assert.equal(result.highlight?.status, 'ordinary');
  assert.equal(result.newRecordCount, 0);
  assert.equal(result.comparison, null);
});

test('an older dominating set prevents a weaker rep-cohort improvement or repeat from becoming an achievement', () => {
  const strongest = workout('2026-10-19', { kg: 70, reps: 8 });
  const weakerCohort = workout('2026-11-02', { kg: 65, reps: 6 });
  const current = workout('2026-11-09', { kg: 65, reps: 8 });
  const result = getWorkoutAchievements(current, [strongest, weakerCohort]);
  assert.equal(result.highlight?.status, 'ordinary');
  assert.equal(result.newRecordCount, 0);
  assert.equal(result.comparison, null);
  const repeated = getWorkoutAchievements(current, [strongest, workout('2026-11-02', { kg: 65, reps: 8 })]);
  assert.equal(repeated.highlight?.status, 'ordinary');
});

test('power-ball loading, sprint metres and timed carries never produce strength achievements', () => {
  for (const options of [
    { name: 'Medicine Ball Spike Slam', kg: 3, reps: 3 },
    { name: '10 m Acceleration', mode: 'bodyweight' as const, quantityUnit: 'm' as const, reps: 10, seconds: 2.2 },
    { name: 'Suitcase Hold', mode: 'timed' as const, seconds: 30, kg: 20 },
  ]) {
    const result = getWorkoutAchievements(workout('2026-11-09', options), [workout('2026-11-02', { ...options, kg: 1 })]);
    assert.equal(result.newRecordCount, 0);
    assert.equal(result.comparison, null);
  }
});

test('workout jump measurements without a test setup stay logged measurements, not fabricated jump improvement', () => {
  const previous = workout('2026-11-02', { name: 'Approach Jump', mode: 'bodyweight', measurement: 'height', measurementCm: 70, reps: 1 });
  const current = workout('2026-11-09', { name: 'Approach Jump', mode: 'bodyweight', measurement: 'height', measurementCm: 72, reps: 1 });
  const result = getWorkoutAchievements(current, [previous]);
  assert.equal(result.newRecordCount, 0);
  assert.equal(result.comparison, null);
  assert.equal(result.highlight?.valueLabel, '72 cm · jump height');
  assert.match(result.highlight!.context, /test setup not recorded/);
});

test('set highlights keep timed, sprint, unilateral and touch units distinct', () => {
  const unloaded = workout('2026-11-09', { kg: 0 }).exercises[0];
  assert.equal(formatWorkoutSet(unloaded, unloaded.logs[0]), '0 kg × 8');
  const timed = workout('2026-11-09', { mode: 'timed', seconds: 30, kg: 20, perSide: true }).exercises[0];
  assert.equal(formatWorkoutSet(timed, timed.logs[0]), '30 sec / side · 20 kg');
  const sprint = workout('2026-11-09', { mode: 'bodyweight', quantityUnit: 'm', reps: 10, seconds: 2.2 }).exercises[0];
  assert.equal(formatWorkoutSet(sprint, sprint.logs[0]), '10 m · 2.2 sec measured');
  const touch = workout('2026-11-09', { mode: 'bodyweight', measurement: 'touch', measurementCm: 315 }).exercises[0];
  assert.equal(formatWorkoutSet(touch, touch.logs[0]), '315 cm · highest touch');
});

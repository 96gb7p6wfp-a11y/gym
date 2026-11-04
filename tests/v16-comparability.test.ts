import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ExerciseSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { areComparableExercises, areComparableSetEfforts, getPerformanceSummary, getPersonalRecords, getProgressionRecommendation, isOneRepMaxExercise, normalizeEquipmentLabel, strengthChangeInsight } from '../src/performance-insights.ts';
import { previousPerformance } from '../src/previous-performance.ts';
import { previousSetReuse } from '../src/workout-reuse.ts';
import { getTrainingJourney } from '../src/training-journey.ts';
import type { ReportSession } from '../src/weekly-report.ts';

const TODAY = '2026-11-03';

function workout(date: string, kg = 60, reps = 8, rir: number | null = 2, equipmentLabel?: string): ReportSession {
  const movement = DEFAULT_PROFILE.plan[0].exercises[0];
  const plan = { ...DEFAULT_PROFILE.plan[0], name: 'Upper strength', exercises: [{ ...movement, key: 'press', exerciseId: 'chest-press', name: 'Machine Chest Press', group: 'Strength', mode: 'weight', target: '6–8 reps', sets: 2, equipmentLabel }] };
  const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, DEFAULT_PROFILE, []), 'completed'));
  session.startedAt = Date.parse(`${date}T10:00:00Z`);
  session.exercises[0].logs.forEach(log => Object.assign(log, { done: true, kg, reps, rir, seconds: null }));
  return session;
}

test('equipment identity is optional, normalized and distinct from unlabeled legacy history', () => {
  const legacy = workout('2026-10-05').exercises[0];
  const known = { ...legacy, equipmentLabel: '  Technogym   Chest Press  ' };
  const before = structuredClone([legacy, known]);
  assert.equal(normalizeEquipmentLabel(known.equipmentLabel), 'technogym chest press');
  assert.equal(normalizeEquipmentLabel('   '), null);
  assert.equal(areComparableExercises(known, { ...known, equipmentLabel: 'TECHNOGYM Chest Press' }), true);
  assert.equal(areComparableExercises(known, { ...known, equipmentLabel: 'Matrix Chest Press' }), false);
  assert.equal(areComparableExercises(known, legacy), false);
  assert.equal(areComparableExercises(legacy, { ...legacy, equipmentLabel: undefined }), true);
  assert.deepEqual([legacy, known], before);
  assert.equal(Object.hasOwn(ExerciseSchema.parse(JSON.parse(JSON.stringify(legacy))), 'equipmentLabel'), false);
});

test('equipment, logging type and movement configuration all affect reuse, previous metrics and progression', () => {
  const previous = workout('2026-10-12', 60, 8, 2, 'Technogym Chest Press');
  const current = { ...previous.exercises[0], equipmentLabel: 'Matrix Chest Press' };
  assert.equal(previousPerformance(current, [previous], TODAY), undefined);
  assert.equal(previousSetReuse(current, 0, [previous], TODAY, 'today'), null);
  assert.equal(getProgressionRecommendation(current, [previous], TODAY).kind, 'baseline');
  for (const patch of [{ perSide: true }, { quantityUnit: 'm' as const }, { measurement: 'height' as const }, { mode: 'bodyweight' as const }]) {
    assert.equal(areComparableExercises(previous.exercises[0], { ...previous.exercises[0], ...patch }), false);
  }
});

test('personal records and long-term series separate machines while preserving unlabeled records', () => {
  const sessions = [workout('2026-10-05', 60, 8, 2, 'Technogym Chest Press'), workout('2026-10-12', 65, 8, 2, 'TECHNOGYM Chest Press'),
    workout('2026-10-19', 90, 8, 2, 'Matrix Chest Press'), workout('2026-10-26', 100)];
  const before = structuredClone(sessions);
  const loads = getPersonalRecords(sessions, TODAY).filter(record => record.kind === 'weight');
  assert.equal(loads.length, 3);
  assert.deepEqual(loads.map(record => record.value).sort((a, b) => a - b), [65, 90, 100]);
  assert.equal(loads.find(record => record.value === 90)?.context.includes('Matrix Chest Press'), true);
  const series = getTrainingJourney({ sessions, today: TODAY }).series.filter(item => item.metric === 'strength');
  assert.equal(series.length, 3);
  assert.equal(series.find(item => /Technogym/i.test(item.name))?.points.length, 2);
  assert.equal(series.find(item => !/Chest Press · 8 reps ·/.test(item.name))?.points.length, 1);
  assert.deepEqual(sessions, before);
});

test('higher absolute weight at different reps or a different recorded effort never proves a comparable gain', () => {
  const first = workout('2026-10-12', 60, 8, 3);
  const fewerReps = workout('2026-10-26', 65, 5, 3);
  assert.deepEqual(getPerformanceSummary({ sessions: [first, fewerReps], today: TODAY }).strengthChanges, []);
  const harder = workout('2026-10-26', 65, 8, 0);
  const summary = getPerformanceSummary({ sessions: [first, harder], today: TODAY });
  assert.deepEqual(summary.strengthChanges, []);
  assert.equal(summary.insights.some(insight => /Machine Chest Press:/.test(insight)), false);
  assert.equal(areComparableSetEfforts({ rir: 3 }, { rir: 0 }), false);
  assert.equal(areComparableSetEfforts({ rir: 6 }, { rir: 0 }), false);
  assert.equal(areComparableSetEfforts({ rir: 10 }, { rir: 10 }), true);
  assert.equal(areComparableSetEfforts({ rir: null }, { rir: 0 }), true);
});

test('supported load insights identify the change, dates, equipment, effort and next action', () => {
  const sessions = [workout('2026-10-12', 60, 8, 2, 'Technogym Chest Press'), workout('2026-10-19', 62.5, 8, 2, 'Technogym Chest Press'), workout('2026-10-26', 65, 8, 2, 'Technogym Chest Press')];
  const summary = getPerformanceSummary({ sessions, today: TODAY });
  assert.equal(summary.strengthChanges.length, 1);
  const change = summary.strengthChanges[0];
  assert.equal(change.sessionCount, 3);
  assert.equal(change.effort, 'matched');
  assert.equal(change.rir, 2);
  assert.match(strengthChangeInsight(change), /\+5 kg at 8 reps, 2026-10-12 → 2026-10-26 · Technogym Chest Press/);
  assert.match(strengthChangeInsight(change), /RIR 2 in both comparisons; 3 recorded training days/);
  assert.match(strengthChangeInsight(change), /Repeat the same setup and rep target/);
});

test('unrecorded effort stays usable with an explicit qualification and no invented recovery', () => {
  const summary = getPerformanceSummary({ sessions: [workout('2026-10-12', 60, 8, null), workout('2026-10-26', 65, 8, null)], today: TODAY });
  assert.equal(summary.strengthChanges[0].current, 65);
  assert.equal(summary.strengthChanges[0].effort, 'unrecorded');
  assert.match(summary.insights.join(' '), /Effort was not recorded for both comparisons/);
  const empty = getPerformanceSummary({ sessions: [], today: TODAY });
  assert.equal(empty.load.level, 'unknown');
  assert.match(empty.load.cue, /Recovery cannot be inferred from missing logs/);
  assert.equal(empty.insights.length, 0);
});

test('estimated 1RM stays limited to conventional loaded strength rather than power, time, jumps or carries', () => {
  const session = workout('2026-10-26');
  const exercise = session.exercises[0];
  assert.equal(isOneRepMaxExercise(exercise), true);
  assert.equal(getPersonalRecords([session], TODAY).some(record => record.kind === 'estimated-1rm'), true);
  for (const patch of [{ name: 'Medicine Ball Spike Slam' }, { name: 'Loaded Squat Jump' }, { name: 'Assisted Pull-Up' }, { quantityUnit: 'm' as const }, { measurement: 'touch' as const }, { mode: 'timed' as const }]) {
    const changed = { ...exercise, ...patch };
    assert.equal(isOneRepMaxExercise(changed), false);
    assert.equal(getPersonalRecords([{ ...session, exercises: [changed] }], TODAY).some(record => record.kind === 'estimated-1rm'), false);
  }
});

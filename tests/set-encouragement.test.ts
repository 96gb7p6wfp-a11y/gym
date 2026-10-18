import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completedSetCue, setQualityCue, type CueSet } from '../src/set-encouragement.ts';

const log: CueSet = { kg: 70, reps: 6, seconds: null, rir: 2 };
const base = { exercise: { mode: 'weight' as const }, completed: log, setNumber: 1, totalSets: 3 };

test('power cues prioritize quality rather than adding jumps or chasing fatigue', () => {
  assert.equal(setQualityCue({ mode: 'bodyweight', category: 'Plyometric' }),
    'Fast, fresh reps. Stop if height or speed drops.');
  assert.equal(setQualityCue({ mode: 'weight', category: 'Power' }, true),
    'Today’s challenge: clean reps, with a little left in reserve.');
});

test('timed and recovery work get appropriate cues without load challenges', () => {
  assert.equal(setQualityCue({ mode: 'timed', category: 'Core' }),
    'Your challenge: steady breathing, steady position.');
  assert.equal(setQualityCue({ mode: 'timed', category: 'Recovery' }),
    'Easy range. Steady breathing. No pushing into pain.');
});

test('completion feedback only claims a load or rep improvement on comparable logs', () => {
  assert.equal(completedSetCue({ ...base, previous: { ...log, reps: 5 } }),
    'More reps at the same load. Take your planned rest.');
  assert.equal(completedSetCue({ ...base, previous: { ...log, kg: 67.5 } }),
    'More load at the same reps. Take your planned rest.');
  assert.equal(completedSetCue({ ...base, previous: { ...log, kg: 75, reps: 5 } }),
    'Set 1 of 3 logged. One step at a time.');
  assert.equal(completedSetCue(base), 'Set 1 of 3 logged. One step at a time.');
});

test('carry distance and bodyweight reps are not described as load progression', () => {
  assert.equal(completedSetCue({ ...base, exercise: { mode: 'weight', quantityUnit: 'm' }, previous: { ...log, reps: 5 } }),
    'Set 1 of 3 logged. One step at a time.');
  assert.equal(completedSetCue({ ...base, exercise: { mode: 'bodyweight' }, previous: { ...log, reps: 5 } }),
    'Set 1 of 3 logged. One step at a time.');
});

test('power exercises do not turn a heavier log into a load-chasing challenge', () => {
  assert.equal(completedSetCue({ ...base, exercise: { mode: 'weight', category: 'Power' }, previous: { ...log, kg: 60 } }),
    'Set 1 of 3 logged. One step at a time.');
});

test('an exhausted set or low-readiness day takes precedence over comparative praise', () => {
  assert.equal(completedSetCue({ ...base, completed: { ...log, rir: 0 }, previous: { ...log, kg: 60 } }),
    'Set logged. Rest fully; keep the next set controlled.');
  assert.equal(completedSetCue({ ...base, easeBack: true, previous: { ...log, reps: 5 } }),
    'Set logged. Rest fully; keep the next set controlled.');
});

test('paired transitions preserve planned recovery and identify the next movement', () => {
  assert.equal(completedSetCue({ ...base, nextInPair: 'CMJ with Arm Swing' }),
    'Set logged. Take your planned rest, then CMJ with Arm Swing.');
  assert.equal(completedSetCue({ ...base, nextInPair: 'CMJ with Arm Swing', hasRest: false }),
    'Set logged. Next in your pair: CMJ with Arm Swing.');
});

test('jump feedback uses a recorded result without inventing a personal record', () => {
  const touch = { ...base, exercise: { mode: 'bodyweight' as const, measurement: 'touch' as const }, previousMeasurement: 'touch' as const, completed: { ...log, measurementCm: 317 }, previous: { ...log, measurementCm: 315 } };
  assert.equal(completedSetCue(touch), 'A higher touch logged. Recover before the next jump.');
  assert.equal(completedSetCue({ ...touch, previous: { ...log, measurementCm: null } }),
    'Set 1 of 3 logged. One step at a time.');
  assert.equal(completedSetCue({ ...touch, previousMeasurement: 'height' }),
    'Set 1 of 3 logged. One step at a time.');
  assert.equal(completedSetCue({ ...touch, previousMeasurement: undefined }),
    'Set 1 of 3 logged. One step at a time.');
});

test('completing the prescribed session prompts recovery instead of extra work', () => {
  assert.equal(completedSetCue({ ...base, allDone: true, previous: { ...log, reps: 5 } }),
    'Planned sets logged. Time to recover.');
  assert.equal(completedSetCue({ ...base, movementDone: true }),
    'Movement complete. A fresh start for the next one.');
});

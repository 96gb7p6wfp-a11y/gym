import test from 'node:test';
import assert from 'node:assert/strict';
import { getExerciseIntent, getSessionPurpose } from '../src/training-purpose.ts';

test('recommended training purposes keep volleyball and jump performance explicit', () => {
  assert.equal(getSessionPurpose({ name: 'Main Jump + Complex Lower', kind: 'strength' }).title, 'Explosive Lower');
  assert.match(getSessionPurpose({ name: 'Main Jump + Complex Lower', kind: 'strength' }).subtitle, /jump height/i);
  assert.equal(getSessionPurpose({ name: 'Lower Strength', kind: 'strength' }).title, 'Lower Strength');
  assert.match(getSessionPurpose({ name: 'Upper Power + Muscle', kind: 'strength' }).subtitle, /hitting power/i);
  assert.match(getSessionPurpose({ name: 'Volleyball', kind: 'sport' }).fatigue, /extra leg work/i);
});

test('custom purposes preserve names and never invent a readiness measurement', () => {
  const custom = getSessionPurpose({ name: 'Hotel Workout', kind: 'strength', goal: 'hypertrophy' });
  assert.equal(custom.title, 'Hotel Workout');
  assert.match(custom.subtitle, /muscle/i);
  assert.match(getSessionPurpose({ name: 'Upper Power B', kind: 'strength', goal: 'hypertrophy' }).subtitle, /muscle/i);
  assert.doesNotMatch(custom.fatigue, /recovered|good|low fatigue/i);
  assert.match(getSessionPurpose({ name: 'Easy Day', kind: 'recovery' }).focus, /easy pace/i);
});

test('exercise intent distinguishes spring contacts, power, strength and control', () => {
  assert.match(getExerciseIntent({ name: 'Pogo Jump' }), /quick contacts/i);
  assert.match(getExerciseIntent({ name: 'Trap Bar Jump' }), /explosive intent/i);
  assert.match(getExerciseIntent({ name: 'Barbell Squat' }), /controlled lowering/i);
  assert.match(getExerciseIntent({ name: 'Cable Lateral Raise' }), /controlled reps/i);
  assert.match(getExerciseIntent({ name: 'Side Plank' }), /steady breathing/i);
});

test('V8.1 purposes describe the new upper/lower roles and retest without fixed contact claims', () => {
  assert.equal(getSessionPurpose({ name: 'Upper A', kind: 'strength', goal: 'power', programRevision: '8.1' }).subtitle, 'Spike Power + Strength + Physique');
  assert.equal(getSessionPurpose({ name: 'Upper B', kind: 'strength', goal: 'power', programRevision: '8.1' }).subtitle, 'Rotational Power + Shoulder + Physique');
  assert.equal(getSessionPurpose({ name: 'Heavy Lower B', kind: 'strength', goal: 'strength', programRevision: '8.1' }).subtitle, 'Strength + Single-leg Stability');
  const normal = getSessionPurpose({ name: 'Main Jump + Heavy Lower A', programRevision: '8.1', exercises: [{ group: 'A1 · Complex pair' }] });
  assert.match(normal.fatigue, /4 min.*CMJ.*2–3 min/);
  const retest = getSessionPurpose({ name: 'Main Jump + Heavy Lower A', programRevision: '8.1', exercises: [{ group: 'Standing vertical retest' }] });
  assert.match(retest.subtitle, /Fresh Jump Tests/);
  assert.doesNotMatch(retest.fatigue, /complex|4 min/);
  assert.doesNotMatch(retest.focus, /24/);
});

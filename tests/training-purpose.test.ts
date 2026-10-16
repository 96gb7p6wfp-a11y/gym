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

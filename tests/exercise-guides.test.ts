import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { getExerciseGuide, type GuideExercise } from '../src/exercise-guides.ts';

function defaultMovements(): GuideExercise[] {
  return DEFAULT_PROFILE.plan.flatMap(day => [day, day.extraSession].filter(Boolean).flatMap(item =>
    [...(item!.exercises ?? []), ...(item!.warmup ?? []), ...(item!.cooldown ?? [])]
  ));
}

test('every default workout, primer, warm-up and cooldown has specific technique', () => {
  const exercises = defaultMovements();
  const names = new Set(exercises.map(exercise => exercise.name));
  assert.equal(names.size, 55, 'include all recovery and variation names');
  for (const exercise of exercises) {
    const guide = getExerciseGuide(exercise);
    assert.equal(guide.isGeneric, false, `${exercise.name} needs a specific guide`);
    assert.equal(guide.steps.length, 3);
    assert.ok(guide.feel.length > 20);
    assert.equal(guide.mistakes.length, 2);
    assert.ok(guide.caution.length > 20);
    assert.equal(guide.demonstration.label, 'Find a video demonstration');
    const url = new URL(guide.demonstration.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'www.youtube.com');
    assert.equal(url.pathname, '/results');
    assert.equal(url.searchParams.get('search_query'), `${exercise.name} exercise technique`);
  }
});

test('custom renames ignore retained keys and keep only their own saved cue', () => {
  const guide = getExerciseGuide({ key: 'rdl', name: 'My custom balance drill', cue: 'Use the wall for support.' });
  assert.equal(guide.isGeneric, true);
  assert.ok(guide.steps.some(step => step.includes('Use the wall for support.')));
  assert.ok(!guide.steps.some(step => step.includes('slide the weights')));
  assert.ok(guide.feel.includes('depend on this movement'));
});

test('name matching handles capitalization, spacing and Unicode dash variants', () => {
  assert.equal(getExerciseGuide({ name: '  romanian   DEADLIFT ' }).isGeneric, false);
  assert.equal(getExerciseGuide({ name: 'Ankle Knee–to–Wall' }).isGeneric, false);
  assert.equal(getExerciseGuide({ name: 'RDL' }).isGeneric, false);
  assert.equal(getExerciseGuide({ name: 'Romanian Deadlift + jump' }).isGeneric, true);
});

test('a retained key does not override a recognized replacement movement', () => {
  const guide = getExerciseGuide({ key: 'rdl', name: 'Biceps Curl' });
  assert.equal(guide.isGeneric, false);
  assert.match(guide.feel, /front of your upper arms/i);
  assert.ok(!guide.feel.includes('hamstrings'));
});

test('hinge guide explains hamstrings, close weights, controlled depth and rounding errors', () => {
  const guide = getExerciseGuide({ name: 'Romanian Deadlift' });
  assert.match(guide.steps.join(' '), /hips backward/);
  assert.match(guide.steps.join(' '), /close to your legs/);
  assert.match(guide.feel, /hamstrings and glutes/);
  assert.match(guide.mistakes.join(' '), /rounding the back/);
  assert.match(guide.caution, /not the floor/);
});

test('jump guides prioritize landing quality and recovery instead of endless repetitions', () => {
  for (const name of ['Approach Jump', 'Countermovement Jump', 'Broad Jump', 'Arm-Swing Jump']) {
    const guide = getExerciseGuide({ name });
    assert.match(guide.steps.join(' '), /land/i);
    assert.match(guide.caution, /clear|painful|comparisons|controlled landing/i);
    assert.match(guide.mistakes.join(' '), /land|quality|timing/i);
  }
});

test('bench, medicine-ball and Copenhagen guides include their equipment and progression cautions', () => {
  assert.match(getExerciseGuide({ name: 'Machine Chest Press / Bench Press' }).caution, /spotter|safety bars/);
  assert.match(getExerciseGuide({ name: 'Medicine Ball Spike Slam' }).caution, /rebound/);
  assert.match(getExerciseGuide({ name: 'Copenhagen Plank' }).caution, /knee-supported/);
  assert.match(getExerciseGuide({ name: 'Bodyweight Squat' }).caution, /past the toes can be normal/);
});

test('search link encodes user content and never claims to be a verified demonstration', () => {
  const name = 'Custom "lift" / #1 & <movement> 😀';
  const guide = getExerciseGuide({ name });
  const url = new URL(guide.demonstration.url);
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.searchParams.get('search_query'), `${name} exercise technique`);
  assert.equal([...url.searchParams].length, 1);
  assert.equal(url.hash, '');
  assert.match(guide.caution, /search link is a starting point/);
});

test('returned guide data can be edited without mutating future guides', () => {
  const first = getExerciseGuide({ name: 'Pallof Press' });
  const original = first.steps[0];
  first.steps[0] = 'Changed';
  first.mistakes.push('Changed');
  const second = getExerciseGuide({ name: 'Pallof Press' });
  assert.equal(second.steps[0], original);
  assert.equal(second.mistakes.length, 2);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { getExerciseGuide, getExerciseLoadingGuidance, type GuideExercise } from '../src/exercise-guides.ts';

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
    assert.notEqual(guide.loading.category, 'general', `${exercise.name} needs load guidance`);
    assert.equal(guide.loading.target, exercise.target);
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

test('main lifts keep the exact day-specific rep target and progress only after clean sets', () => {
  const names = ['Hack Squat', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Machine Chest Press / Bench Press', 'Chest-Supported Row', 'Neutral-Grip Lat Pulldown'];
  for (const exercise of defaultMovements().filter(exercise => names.includes(exercise.name))) {
    const loading = getExerciseLoadingGuidance(exercise);
    assert.equal(loading.category, 'strength', exercise.name);
    assert.equal(loading.target, exercise.target);
    assert.match(loading.advice, /saved rep range/);
    assert.match(loading.progression!, /every set.*top of your rep range.*clean technique.*2 good reps left.*smallest available weight increment/);
  }
  assert.equal(getExerciseLoadingGuidance({ name: 'Hack Squat', target: '4–6 reps' }).target, '4–6 reps');
  assert.equal(getExerciseLoadingGuidance({ name: 'Hack Squat', target: '3–4 reps' }).target, '3–4 reps');
  assert.equal(getExerciseLoadingGuidance({ name: 'Chest-Supported Row', target: '12–15 reps' }).target, '12–15 reps', 'custom targets must not be replaced by low-rep advice');
});

test('accessories prioritize control and cuff work is very light', () => {
  for (const name of ['Cable Lateral Raise', 'Reverse Pec Deck', 'Biceps Curl', 'Hammer Curl', 'Triceps Pushdown', 'Leg Curl', 'Standing Calf Raise', 'Tibialis Raise']) {
    const loading = getExerciseLoadingGuidance({ name, target: '12–20 reps' });
    assert.equal(loading.category, 'control', name);
    assert.match(loading.advice, /no swinging, bouncing or shortened reps/);
    assert.match(loading.progression!, /smallest available weight increment/);
  }
  assert.match(getExerciseLoadingGuidance({ name: 'Cable External Rotation' }).advice, /very light resistance/);
  assert.equal(getExerciseLoadingGuidance({ name: 'Band / Cable External Rotation' }).category, 'preparation');
});

test('power and warm-up exercises are not given heavy or high-fatigue progression', () => {
  for (const name of ['Medicine Ball Spike Slam', 'Medicine Ball Rotational Throw', 'Medicine Ball Overhead Throw / Slam', 'Approach Jump', 'Pogo Jump', 'Broad Jump', 'Countermovement Jump', 'Arm-Swing Jump']) {
    const loading = getExerciseLoadingGuidance({ name, mode: name === 'Pogo Jump' ? 'timed' : 'weight', target: '4 reps' });
    assert.equal(loading.category, 'power', name);
    assert.match(loading.advice, /stop.*speed.*drops/);
    assert.equal(loading.progression, undefined);
  }
  for (const name of ['Easy Pogo', 'Progressive Jumps', 'Bodyweight Squat', 'Light Face Pull', 'Light Squat / Hinge Warm-up']) {
    const loading = getExerciseLoadingGuidance({ name });
    assert.equal(loading.category, 'preparation', name);
    assert.match(loading.advice, /rather than tired/);
    assert.equal(loading.progression, undefined);
  }
});

test('core, carries and timed custom lift variants use posture and duration advice', () => {
  for (const name of ['Pallof Press', 'Side Plank', 'Copenhagen Plank']) {
    const loading = getExerciseLoadingGuidance({ name, mode: 'timed', target: '30–45 sec' });
    assert.equal(loading.category, 'core');
    assert.match(loading.advice, /posture and breathe.*reps or time/);
    assert.equal(loading.progression, undefined);
  }
  const carry = getExerciseLoadingGuidance({ name: 'Suitcase Carry', target: '30 m' });
  assert.equal(carry.category, 'carry');
  assert.equal(carry.target, '30 m');
  assert.match(carry.advice, /saved time or distance.*without leaning/);
  const timedSquat = getExerciseLoadingGuidance({ name: 'Hack Squat', mode: 'timed', target: '20 sec' });
  assert.equal(timedSquat.category, 'general');
  assert.equal(timedSquat.target, '20 sec');
  assert.equal(timedSquat.progression, undefined);
  assert.match(timedSquat.advice, /saved duration/);
  const bodyweightShin = getExerciseLoadingGuidance({ name: 'Tibialis Raise', mode: 'bodyweight', target: '15–20 reps' });
  assert.equal(bodyweightShin.category, 'control');
  assert.match(bodyweightShin.progression!, /every set.*clean technique.*slightly harder variation/);
  assert.doesNotMatch(bodyweightShin.progression!, /weight increment/);
});

test('renames ignore retained keys for loading and recognized replacements get their own advice', () => {
  const custom = getExerciseGuide({ key: 'hack-squat', name: 'My balance drill', target: '8 / side', mode: 'bodyweight' });
  assert.equal(custom.loading.category, 'general');
  assert.equal(custom.loading.target, '8 / side');
  assert.match(custom.loading.advice, /confirm technique/);
  assert.equal(custom.loading.progression, undefined);
  const renamed = getExerciseLoadingGuidance({ key: 'rdl', name: ' Cable   Lateral Raise ', target: '15–20 reps' });
  assert.equal(renamed.category, 'control');
  assert.equal(renamed.target, '15–20 reps');
  assert.equal(getExerciseLoadingGuidance({ name: 'Romanian Deadlift + jump' }).category, 'general');
});

test('loading results do not share mutations or targets between movements', () => {
  const first = getExerciseLoadingGuidance({ name: 'RDL', target: ' 5–8 reps ' });
  assert.equal(first.target, '5–8 reps');
  first.advice = 'Changed';
  first.target = 'Changed';
  const second = getExerciseLoadingGuidance({ name: 'RDL' });
  assert.match(second.advice, /challenging load/);
  assert.equal(second.target, undefined);
});

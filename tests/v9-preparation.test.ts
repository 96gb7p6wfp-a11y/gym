import assert from 'node:assert/strict';
import test from 'node:test';
import { createV9VolleyballMasterPlan, applyV9Clearance, applyV9Readiness } from '../src/volleyball-v9-plan.ts';
import { getQuickWarmup, getQuickWarmupPresentation, getSessionPreparation } from '../src/session-preparation.ts';
import { getExerciseGuide, getExerciseLoadingGuidance } from '../src/exercise-guides.ts';

const prepare = (plan: ReturnType<typeof createV9VolleyballMasterPlan>[number]) =>
  getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });

test('each full V9 gym day keeps one concise prescribed preparation without changing the working dose', () => {
  const week = createV9VolleyballMasterPlan();
  for (const index of [0, 2, 3, 5]) {
    const day = week[index], before = structuredClone(day);
    const result = prepare(day);
    assert.deepEqual(result, day.warmup, day.name);
    assert.deepEqual(getQuickWarmup(day, result), result);
    assert.ok(result.length >= 3 && result.length <= 5, day.name);
    assert.ok(result.every(item => !item.done));
    assert.deepEqual(day, before);
  }
  assert.match(getQuickWarmupPresentation(week[0]).duration, /6–8 min/);
  assert.match(getQuickWarmupPresentation(week[0]).rampUp, /lighter.*pulling|more-assisted pulling/);
  assert.match(getQuickWarmupPresentation(week[2]).rampUp, /three sets in the complex, never three extra sets/);
  assert.match(getQuickWarmupPresentation(week[3]).rampUp, /shuffles and plants/);
  assert.match(getQuickWarmupPresentation(week[5]).rampUp, /Leg Press.*Smith Bulgarian Split Squat.*Hip Thrust/);
});

test('stable V9 session identity keeps preparation appropriate after a user renames the session', () => {
  const day = createV9VolleyballMasterPlan()[2];
  const renamed = { ...day, name: 'My Wednesday', warmup: undefined };
  assert.deepEqual(getSessionPreparation({ ...renamed, phase: 'warmup' }), day.warmup);
  assert.match(getQuickWarmupPresentation(renamed).rampUp, /Hack Squat/);
});

test('the V9 match primer and optional technique routine do not grow an extra mandatory warm-up', () => {
  const primer = createV9VolleyballMasterPlan(true)[5];
  const technique = createV9VolleyballMasterPlan()[1].extraSession!;
  for (const day of [primer, technique]) {
    assert.deepEqual(prepare(day), []);
    assert.deepEqual(getQuickWarmup(day), []);
    assert.equal(day.warmup?.length, 0);
  }
  assert.equal(getQuickWarmupPresentation(primer).duration, 'Included in primer');
  assert.match(getQuickWarmupPresentation(primer).rampUp, /No extra checklist, heavy lifting or maximal jumps/);
  assert.equal(getQuickWarmupPresentation(technique).duration, 'Included in technique');
  assert.match(getQuickWarmupPresentation(technique).rampUp, /Skip.*practice already/);
});

test('saved V9 preparation substitutions and honest completion checks are retained without mutation', () => {
  const day = createV9VolleyballMasterPlan()[0];
  const items = day.warmup!.map((item, index) => index === 0
    ? { ...item, name: 'My approved preparation', target: 'My saved duration', cue: 'Gentle only.', done: true } : item);
  const before = structuredClone(items);
  const result = getSessionPreparation({ ...day, phase: 'warmup', items });
  assert.deepEqual(result, items);
  assert.deepEqual(getQuickWarmup(day, result), items);
  assert.notEqual(result[0], items[0]);
  assert.deepEqual(items, before);
});

test('unknown or restricted V9 guidance cannot reintroduce removed jumps, throws or heavy warm-up sets', () => {
  for (const status of ['unknown', 'restricted'] as const) {
    const day = applyV9Clearance(createV9VolleyballMasterPlan()[2], { impact: status, heavyLifting: status });
    const result = prepare(day);
    assert.ok(!result.some(item => /jump|pogo|throw/i.test(item.name)));
    assert.deepEqual(getQuickWarmup(day, result), result);
    const presentation = getQuickWarmupPresentation(day);
    assert.match(presentation.rampUp, /Do not add heavy loading, maximal jumps or ballistic work/);
    assert.doesNotMatch(presentation.rampUp, /2–4 progressively loaded/);
  }
});

test('Yellow V9 recommendations keep the modified preparation rather than restoring the full jump block', () => {
  const day = applyV9Readiness(createV9VolleyballMasterPlan()[2], 'yellow');
  const result = prepare(day);
  assert.ok(!result.some(item => /jump|pogo|throw/i.test(item.name)));
  assert.deepEqual(getQuickWarmup(day, result), day.warmup);
  assert.ok(!day.exercises.some(item => item.jumpContactsPerRep));
});

test('V9 sprint and agility guides require a clear movement area and never manufacture timing results', () => {
  const week = createV9VolleyballMasterPlan();
  const speed = [...week[2].exercises, ...week[3].exercises].filter(item => item.group === 'Speed');
  assert.equal(speed.length, 4);
  for (const exercise of speed) {
    const guide = getExerciseGuide(exercise);
    assert.equal(guide.isGeneric, false, exercise.name);
    const text = [...guide.steps, ...guide.mistakes, guide.caution, guide.loading.advice].join(' ');
    assert.match(text, /clear|unobstructed|non-slip/i, exercise.name);
    assert.match(text, /machines|obstacles|stopping space/i, exercise.name);
    assert.equal(guide.loading.category, 'power');
  }
  const sprint = getExerciseGuide(week[2].exercises.find(item => item.prescribedDistanceM === 5)!);
  assert.match(sprint.caution, /only when actually measured/);
  assert.match(sprint.loading.advice, /consistent method/);
  const reaction = getExerciseGuide(week[3].exercises.find(item => /Reaction/.test(item.name))!);
  assert.match(reaction.caution, /not a measured reaction-time test/);
});

test('V9 timed holds retain seconds and controlled loading guidance rather than rep-based progression', () => {
  const week = createV9VolleyballMasterPlan();
  const holds = [...week[0].exercises, ...week[2].exercises, ...week[5].exercises]
    .filter(item => item.mode === 'timed');
  assert.ok(holds.length >= 5);
  for (const exercise of holds) {
    const guide = getExerciseGuide(exercise);
    assert.equal(guide.isGeneric, false, exercise.name);
    assert.equal(guide.loading.target, exercise.target);
    assert.doesNotMatch(guide.loading.progression ?? '', /top.*rep range|estimated.*1RM/i);
  }
  const suitcase = getExerciseGuide(week[2].exercises.find(item => item.exerciseId === 'suitcase-static-hold')!);
  assert.match(suitcase.caution, /seconds/);
  assert.match(suitcase.mistakes.join(' '), /30-second hold as 30 repetitions/);
});

test('V9 slam and reactive-jump guides retain light power intent and quality stop rules', () => {
  const week = createV9VolleyballMasterPlan();
  const slam = getExerciseGuide(week[0].exercises[0]);
  assert.match(slam.steps.join(' '), /2–3 kg.*both hands/);
  const loaded = getExerciseGuide(week[2].exercises.find(item => item.name === 'Light Dumbbell Squat Jump')!);
  assert.match(loaded.caution, /2–4 kg per hand/);
  assert.match(loaded.loading.advice, /log both dumbbells combined/);
  const split = getExerciseLoadingGuidance(week[5].exercises.find(item => item.exerciseId === 'split-squat-jump')!);
  assert.match(split.advice, /Do not automatically add reps, load or box height/);
});

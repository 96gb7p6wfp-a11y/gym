import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionPreparation, getWarmupPresentation, getWarmupStepInfo, type WarmupPlan } from '../src/session-preparation.ts';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { PreparationSchema } from '../src/domain.js';

const lower: WarmupPlan = { kind: 'strength', goal: 'strength', name: 'Lower Strength', exercises: [
  { name: 'Hack Squat', mode: 'weight' }, { name: 'Romanian Deadlift', mode: 'weight' },
] };
const upper: WarmupPlan = { kind: 'strength', goal: 'hypertrophy', name: 'Upper Strength', exercises: [
  { name: 'Incline Machine Press', mode: 'weight' }, { name: 'Lat Pulldown', mode: 'weight' },
] };
const generate = (plan: WarmupPlan) => getSessionPreparation({ ...plan, phase: 'warmup' });

test('warm-up labels distinguish recovery, court, lower strength, upper strength and power', () => {
  assert.equal(getWarmupPresentation(lower).title, 'Lower Strength Preparation');
  assert.equal(getWarmupPresentation(upper).title, 'Upper Body Preparation');
  const power = { ...upper, goal: 'power', exercises: [{ name: 'Medicine Ball Spike Slam' }, ...upper.exercises] };
  assert.equal(getWarmupPresentation(power).title, 'Upper Power Preparation');
  assert.equal(getWarmupPresentation({ ...lower, exercises: [{ name: 'Approach Jump' }, ...lower.exercises] }).title, 'Jump + Lower Power Preparation');
  assert.equal(getWarmupPresentation({ kind: 'recovery', exercises: [] }).duration, '5 min');
  assert.equal(getWarmupPresentation({ kind: 'sport', exercises: [{ name: 'Volleyball practice' }] }).title, 'Court Preparation');
});

test('lower strength uses dynamic mobility, glute/trunk activation and squat/hinge rehearsal', () => {
  const names = generate(lower).map(item => item.name);
  for (const name of ['Ankle Knee-to-Wall', '90/90 Hip Switch', 'Glute Bridge', 'Dead Bug', 'Bodyweight Squat', 'Unloaded Hip Hinge', 'Light Rehearsal Sets']) assert.ok(names.includes(name), name);
  assert.equal(names[0], 'Easy Walk + Arm Swing');
  assert.ok(!names.some(name => /jump|pogo|stretch|throw|arm circles/i.test(name)));
});

test('upper power adds gradual throwing preparation without extra lower-body work', () => {
  const plan = { ...upper, goal: 'power', exercises: [{ name: 'Medicine Ball Rotational Throw' }, ...upper.exercises] };
  const names = generate(plan).map(item => item.name);
  for (const name of ['Arm Circles', 'Wall Slide', 'Light External Rotation', 'Scapular Row', 'Thoracic Rotation', 'Progressive Throw Rehearsal']) assert.ok(names.includes(name), name);
  assert.ok(!generate(upper).some(item => item.name === 'Progressive Throw Rehearsal'));
  assert.ok(!names.some(name => /ankle|hip switch|squat|pogo/i.test(name)));
});

test('master jump preparation preserves prescribed contacts and starts with general movement', () => {
  const plan = createVolleyballMasterPlan()[2];
  const items = getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });
  assert.equal(items[0].name, 'Easy Walk + Arm Swing');
  assert.equal(items.at(-1)?.name, 'Jump Ramp-Up');
  assert.ok(items.some(item => item.name === 'Snap-Down Landing'));
  for (const original of plan.warmup ?? []) assert.deepEqual(items.find(item => item.key === original.key), original);
  assert.deepEqual(getSessionPreparation({ ...plan, phase: 'warmup', items }), items);
  assert.equal(PreparationSchema.safeParse(items).success, true);
});

test('short technique and pre-match primers do not gain additional jumps or pogo contacts', () => {
  const plans = [createVolleyballMasterPlan()[1].extraSession!, createVolleyballMasterPlan(true)[5]];
  for (const plan of plans) {
    const items = getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });
    assert.ok(!items.some(item => /jump ramp|pogo|progressive jump/i.test(item.name)), plan.name);
    assert.equal(getWarmupPresentation(plan).title, 'Technique Preparation');
    assert.equal(getWarmupPresentation(plan).duration, '5–6 min');
  }
});

test('safe substitutes persist through regeneration and do not re-add the replaced drill', () => {
  const plan = createVolleyballMasterPlan()[2];
  const items = getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });
  const jump = items.find(item => item.name === 'Jump Ramp-Up')!;
  const replacement = getWarmupStepInfo(jump, plan).alternatives.find(item => item.name === 'No-Impact Takeoff Rehearsal')!;
  const substituted = items.map(item => item.key === jump.key ? { ...item, ...replacement, done: false } : item);
  const restored = getSessionPreparation({ ...plan, phase: 'warmup', items: substituted });
  assert.equal(restored.filter(item => item.name === replacement.name).length, 1);
  assert.ok(!restored.some(item => item.name === jump.name));
  assert.match(restored.find(item => item.key === jump.key)!.cue, /avoid maximal jumping/);
  assert.deepEqual(getSessionPreparation({ ...plan, phase: 'warmup', items: restored }), restored);
});

test('specific lift preparation refers to the first strength exercise, not a throw or jump', () => {
  const plan = createVolleyballMasterPlan()[2];
  const rehearsal = generate(plan).find(item => item.name === 'Light Rehearsal Sets')!;
  const info = getWarmupStepInfo(rehearsal, plan);
  assert.match(info.followUp ?? '', /^At Hack Squat:/);
  assert.match(info.followUp ?? '', /before working sets/);
  assert.match(info.followUp ?? '', /short of fatigue/);
  assert.doesNotMatch(info.followUp ?? '', /^At Approach Jump:/);
});

test('custom preparation instructions and checks remain intact in smart warm-up', () => {
  const custom = { key: 'physio', name: 'Prescribed drill', target: 'As advised', cue: 'Keep this exact instruction.', done: true };
  const items = getSessionPreparation({ ...lower, phase: 'warmup', items: [custom] });
  assert.deepEqual(items[0], custom);
  assert.equal(getWarmupStepInfo(custom, lower).technique, custom.cue);
  assert.deepEqual(getWarmupStepInfo(custom, lower).alternatives, []);
  assert.equal(PreparationSchema.safeParse(items).success, true);
});

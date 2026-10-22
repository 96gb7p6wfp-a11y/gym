import test from 'node:test';
import assert from 'node:assert/strict';
import { getSessionPreparation, getWarmupPresentation, getWarmupStepInfo, getQuickWarmup, getQuickWarmupPresentation, getQuickWarmupCue, type WarmupPlan } from '../src/session-preparation.ts';
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


test('quick preparation is a stable three-to-four-drill subset of actual saved preparation', () => {
  for (const plan of [...createVolleyballMasterPlan(), createVolleyballMasterPlan(true)[5]]) {
    const full = getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });
    const before = structuredClone(full);
    const quick = getQuickWarmup(plan, full);
    assert.ok(quick.length >= 2 && quick.length <= 4, `${plan.name}: ${quick.length}`);
    for (const item of quick) assert.deepEqual(item, full.find(saved => saved.key === item.key));
    const completed = full.map(item => ({ ...item, done: quick.some(selected => selected.key === item.key) }));
    assert.deepEqual(getQuickWarmup(plan, completed).map(item => item.key), quick.map(item => item.key));
    assert.ok(getQuickWarmup(plan, completed).every(item => item.done));
    assert.deepEqual(full, before);
  }
});

test('quick prep fits normal session demands while specific loading remains explicit', () => {
  assert.equal(getQuickWarmupPresentation(upper).duration, '3–4 min');
  assert.equal(getQuickWarmupPresentation(lower).duration, '3–4 min');
  assert.equal(getQuickWarmupPresentation(createVolleyballMasterPlan()[2]).duration, '4–5 min');
  assert.match(getQuickWarmupPresentation(lower).rampUp, /lighter sets of Hack Squat/);
  assert.match(getQuickWarmupPresentation(createVolleyballMasterPlan()[0]).rampUp, /Build throwing speed gradually/);
  assert.match(getQuickWarmupPresentation(createVolleyballMasterPlan()[2]).rampUp, /Build jump intensity gradually/);
  assert.match(getQuickWarmupPresentation(createVolleyballMasterPlan(true)[5]).rampUp, /Do not add extra contacts/);
  assert.equal(getQuickWarmupPresentation({ kind: 'recovery', exercises: [] }).duration, '2–3 min');
});

test('quick jump preparation never adds contacts or duplicates prescribed jumping', () => {
  const plan = createVolleyballMasterPlan()[2];
  const full = getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });
  const quick = getQuickWarmup(plan, full);
  const pogo = quick.find(item => /pogo/i.test(item.name));
  assert.ok(pogo);
  assert.deepEqual(pogo, plan.warmup?.find(item => item.key === pogo.key));
  for (const primer of [createVolleyballMasterPlan()[1].extraSession!, createVolleyballMasterPlan(true)[5]]) {
    const preparation = getSessionPreparation({ ...primer, phase: 'warmup', items: primer.warmup });
    assert.ok(!getQuickWarmup(primer, preparation).some(item => /jump|pogo/i.test(item.name)));
  }
});

test('quick completion leaves custom and supplemental instructions intact', () => {
  const custom = { key: 'physio', name: 'Prescribed drill', target: 'As advised', cue: 'Keep this exact instruction.', done: false };
  const full = getSessionPreparation({ ...upper, phase: 'warmup', items: [custom] });
  const keys = new Set(getQuickWarmup(upper, full).map(item => item.key));
  const completed = full.map(item => keys.has(item.key) ? { ...item, done: true } : item);
  assert.deepEqual(completed.find(item => item.key === custom.key), custom);
  assert.equal(PreparationSchema.safeParse(completed).success, true);
  assert.ok(getQuickWarmup(upper, completed).every(item => getQuickWarmupCue(item).length < 90));
});

test('a warm-up substitution keeps its quick-prep slot before and after reload', () => {
  const full = getSessionPreparation({ ...upper, phase: 'warmup' });
  const quick = getQuickWarmup(upper, full);
  const first = quick[0];
  const replacement = getWarmupStepInfo(first, upper).alternatives[0];
  const changed = full.map(item => item.key === first.key ? { ...item, ...replacement, done: true } : item);
  const reloaded = getSessionPreparation({ ...upper, phase: 'warmup', items: JSON.parse(JSON.stringify(changed)) });
  assert.deepEqual(getQuickWarmup(upper, changed).map(item => item.key), quick.map(item => item.key));
  assert.deepEqual(getQuickWarmup(upper, reloaded).map(item => item.key), quick.map(item => item.key));
  assert.equal(getQuickWarmup(upper, reloaded)[0].name, replacement.name);
  assert.equal(getQuickWarmup(upper, reloaded)[0].done, true);
  // Old backups may contain a renamed drill under its original identity.
  const renamed = full.map(item => item.key === first.key ? { ...item, name: 'My shoulder preparation', cue: 'Use this saved cue.' } : item);
  assert.deepEqual(getQuickWarmup(upper, renamed).map(item => item.key), quick.map(item => item.key));
  assert.equal(getQuickWarmupCue(getQuickWarmup(upper, renamed)[0]), 'Use this saved cue.');
});

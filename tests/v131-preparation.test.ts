import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMasterClearance, createV81VolleyballMasterPlan, createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { getQuickWarmup, getQuickWarmupPresentation, getSessionPreparation } from '../src/session-preparation.ts';

const prepare = (plan: ReturnType<typeof createVolleyballMasterPlan>[number]) =>
  getSessionPreparation({ ...plan, phase: 'warmup', items: plan.warmup });
const names = (plan: ReturnType<typeof createVolleyballMasterPlan>[number]) => getQuickWarmup(plan, prepare(plan)).map(item => item.name).join(' · ');

test('V13.1 preparation stays one concise prescribed sequence for the actual session', () => {
  const plan = createVolleyballMasterPlan();
  for (const index of [0, 2, 3, 5]) {
    const day = plan[index];
    assert.equal(day.programRevision, '13.1');
    const before = structuredClone(day);
    const prepared = prepare(day);
    assert.deepEqual(prepared, day.warmup);
    assert.deepEqual(getQuickWarmup(day, prepared), prepared);
    assert.ok(prepared.length > 0 && prepared.length <= 7, day.name);
    assert.deepEqual(day, before);
  }
  assert.match(names(plan[0]), /ankle|knee.to.wall/i);
  assert.match(names(plan[0]), /shoulder|wall slide|rotation/i);
  assert.match(names(plan[2]), /squat|hinge/i);
  assert.match(names(plan[3]), /shoulder|scapular|rotation/i);
  assert.doesNotMatch(names(plan[3]), /pogo|hurdle|drop jump/i);
  assert.doesNotMatch(names(plan[5]), /jump|pogo|hurdle/i);
});

test('an explicit empty V13.1 preparation never restores raw impact drills or a zero-step checklist', () => {
  const monday = { ...createVolleyballMasterPlan()[0], warmup: [] };
  assert.deepEqual(prepare(monday), []);
  assert.deepEqual(getQuickWarmup(monday), []);
  const primer = createVolleyballMasterPlan(true)[5];
  assert.deepEqual(prepare(primer), []);
  assert.deepEqual(getQuickWarmup(primer), []);
  assert.equal(getQuickWarmupPresentation(primer).duration, 'Included in primer');
  assert.match(getQuickWarmupPresentation(primer).rampUp, /No maximal jumps or heavy lifting/);
});

test('V13.1 keeps warm-up substitutions, completed checks and personalised instructions intact', () => {
  const day = createVolleyballMasterPlan()[0];
  const customised = (day.warmup ?? []).map((item, index) => index === 0
    ? { ...item, name: 'My prescribed preparation', target: 'As advised', cue: 'Easy movement only.', done: true }
    : item);
  const before = structuredClone(customised);
  const prepared = getSessionPreparation({ ...day, phase: 'warmup', items: customised });
  assert.deepEqual(prepared, customised);
  assert.deepEqual(getQuickWarmup(day, prepared), customised);
  assert.deepEqual(customised, before);
  assert.notEqual(prepared[0], customised[0]);
});

test('V8.1 snapshots retain their own prescribed warm-up and loading advice', () => {
  const old = createV81VolleyballMasterPlan()[2];
  const before = structuredClone(old);
  const prepared = getSessionPreparation({ ...old, phase: 'warmup' });
  assert.deepEqual(prepared, old.warmup);
  assert.equal(getQuickWarmupPresentation(old).duration, '6–9 min');
  assert.match(getQuickWarmupPresentation(old).rampUp, /Hack Squat/);
  assert.deepEqual(old, before);
});

test('V13.1 ramp-up advice reflects separate Wednesday exercises and Saturday hip extension work', () => {
  const plan = createVolleyballMasterPlan();
  assert.match(getQuickWarmupPresentation(plan[0]).title, /Approach.*Upper/);
  assert.match(getQuickWarmupPresentation(plan[2]).rampUp, /CMJ and Hack Squat are separate exercises/);
  assert.match(getQuickWarmupPresentation(plan[5]).rampUp, /Hip Thrust/);
  assert.match(getQuickWarmupPresentation(plan[3]).rampUp, /Landmine Press and Chest Press/);
  assert.doesNotMatch(getQuickWarmupPresentation(plan[5]).rampUp, /Leg Press|Trap Bar/);
});

test('uncertain clearance keeps preparation advice easy instead of restoring heavy ramp-up or impact', () => {
  const day = applyMasterClearance(createVolleyballMasterPlan()[0]);
  const prepared = prepare(day);
  assert.ok(day.exercises.every(exercise => exercise.preparationOnly));
  assert.ok(!prepared.some(item => /jump|pogo|throw/i.test(item.name)));
  const presentation = getQuickWarmupPresentation(day);
  assert.equal(presentation.title, 'Easy Session Preparation');
  assert.match(presentation.rampUp, /Do not add heavy loading, maximal jumps or ballistic work/);
  assert.doesNotMatch(presentation.rampUp, /2–4|build toward jump speed/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { COOLDOWN, DEFAULT_PROFILE, PreparationSchema, UPPER_WARMUP } from '../src/domain.js';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { getSessionPreparation, type PreparationExercise } from '../src/session-preparation.ts';
import { getStretchRoutine, type StretchStep } from '../src/stretch-routine.ts';

const shoulder = { key: 'shoulder', exerciseId: 'cable-lateral-raise', name: 'Cable Lateral Raise', group: 'Shoulders' };
const squat = { key: 'squat', exerciseId: 'hack-squat', name: 'Hack Squat', group: 'Quads' };
const done = (exercise: PreparationExercise) => ({ ...exercise, logs: [{ done: true }] });
const names = (items: StretchStep[]) => items.map(item => item.name);
const guide = (phase: 'warmup' | 'cooldown', exercises: PreparationExercise[], extra = {}) =>
  getSessionPreparation({ phase, kind: 'strength', exercises, ...extra });

test('shoulder-only preparation is dynamic before training and shoulder-specific afterward', () => {
  const warmup = guide('warmup', [shoulder], { items: DEFAULT_PROFILE.plan[2].warmup });
  assert.ok(names(warmup).includes('Arm Circles'));
  assert.ok(names(warmup).includes('Wall Slide'));
  assert.ok(names(warmup).includes('Light Rehearsal Sets'));
  assert.ok(!names(warmup).some(name => /ankle|calf|hip|squat|pogo|jump/i.test(name)));
  const cooldown = guide('cooldown', [done(shoulder)], { items: COOLDOWN });
  assert.ok(names(cooldown).includes('Cross-Body Shoulder Stretch'));
  assert.ok(!names(cooldown).some(name => /calf|gastrocnemius|soleus|hip|glute|hamstring|lat|pec/i.test(name)));
});

test('lower-body and jump preparation does not add unrelated upper-body stretches', () => {
  const exercises = [squat, { name: 'Romanian Deadlift' }, { name: 'Approach Jump' }];
  const warmup = guide('warmup', exercises, { items: UPPER_WARMUP });
  assert.ok(names(warmup).includes('Jump Ramp-Up'));
  assert.ok(names(warmup).includes('Unloaded Hip Hinge'));
  assert.ok(!names(warmup).some(name => /wall slide|face pull|arm circles|external rotation/i.test(name)));
  const cooldown = guide('cooldown', exercises);
  assert.ok(names(cooldown).includes('Standing Quad Stretch'));
  assert.ok(names(cooldown).includes('Hamstring Stretch'));
  assert.ok(names(cooldown).includes('Gastrocnemius Stretch'));
  assert.ok(!names(cooldown).some(name => /shoulder|pec|lat stretch/i.test(name)));
});

test('mixed sessions preview the plan but cool down only muscles with logged work', () => {
  const mixed = [done(shoulder), { ...squat, logs: [{ done: false }] }];
  assert.ok(names(guide('warmup', mixed)).includes('Bodyweight Squat'));
  const cooldown = guide('cooldown', mixed, { items: COOLDOWN });
  assert.ok(names(cooldown).includes('Cross-Body Shoulder Stretch'));
  assert.ok(!names(cooldown).some(name => /quad|calf|soleus|gastrocnemius|glute|hip|hamstring/i.test(name)));
});

test('finished unlogged strength sessions do not claim any muscle was trained', () => {
  const cooldown = guide('cooldown', [shoulder, squat], { completedOnly: true, items: COOLDOWN });
  assert.deepEqual(names(cooldown), ['Easy Walk + Breathing']);
  assert.ok(names(guide('cooldown', [shoulder])).includes('Cross-Body Shoulder Stretch'));
});

test('volleyball keeps ankle/hip and shoulder preparation without adding a jump workout', () => {
  const options = { kind: 'sport' as const, exercises: [{ name: 'Volleyball practice' }], completedOnly: true };
  const warmup = getSessionPreparation({ ...options, phase: 'warmup' });
  assert.ok(names(warmup).includes('Ankle Knee-to-Wall'));
  assert.ok(names(warmup).includes('90/90 Hip Switch'));
  assert.ok(names(warmup).includes('Arm Circles'));
  assert.ok(!names(warmup).some(name => /pogo|jump/i.test(name)));
  const cooldown = getSessionPreparation({ ...options, phase: 'cooldown' });
  assert.ok(names(cooldown).includes('Cross-Body Shoulder Stretch'));
  assert.ok(names(cooldown).includes('Gastrocnemius Stretch'));
});

test('recovery remains usable without gym exercises and keeps existing recovery keys', () => {
  const result = getSessionPreparation({ phase: 'cooldown', kind: 'recovery', exercises: [], completedOnly: true });
  assert.deepEqual(result, getStretchRoutine());
  assert.equal(result.find(item => item.name === 'Hip Flexor Stretch')?.key, 'recovery-hip-flexor');
  assert.ok(result.length > 0);
});

test('custom instructions, edited default text and checked movement IDs stay intact', () => {
  const custom = { key: 'physio', name: 'My shoulder drill', target: 'As prescribed', cue: 'Gentle only', done: true };
  const editedDefault = { ...COOLDOWN[0], target: 'My prescribed duration', done: false };
  const checkedDefault = { ...COOLDOWN[1], done: true };
  const original = [custom, editedDefault, checkedDefault, ...UPPER_WARMUP];
  const before = structuredClone(original);
  const result = guide('cooldown', [done(shoulder)], { items: original });
  assert.deepEqual(result.find(item => item.key === custom.key), custom);
  assert.deepEqual(result.find(item => item.key === editedDefault.key), editedDefault);
  assert.deepEqual(result.find(item => item.key === checkedDefault.key), checkedDefault);
  assert.deepEqual(original, before);
  assert.deepEqual(guide('cooldown', [done(shoulder)], { items: result }), result);
});

test('master-plan jump warm-up retains prescribed ramp, pogo and mobility targets/cues', () => {
  const plan = createVolleyballMasterPlan()[2];
  const result = guide('warmup', plan.exercises, { items: plan.warmup });
  for (const source of plan.warmup ?? []) {
    assert.deepEqual(result.find(item => item.key === source.key), source, source.name);
  }
  assert.equal(result.filter(item => item.name === 'Jump Ramp-Up').length, 1);
  assert.equal(result.filter(item => item.name === 'Pogo Jump').length, 1);
});

test('adding, replacing and removing exercises updates the automatic guide', () => {
  const first = guide('warmup', [squat]);
  const replaced = guide('warmup', [shoulder], { items: first });
  assert.ok(names(replaced).includes('Arm Circles'));
  assert.ok(!names(replaced).includes('Bodyweight Squat'));
  const mixed = guide('warmup', [shoulder, squat], { items: replaced });
  assert.ok(names(mixed).includes('Bodyweight Squat'));
  assert.ok(names(mixed).includes('Arm Circles'));
});

test('default-generated checks keep their IDs and state and do not mutate templates', () => {
  const first = guide('cooldown', [shoulder]);
  const shoulderStep = first.find(item => item.name === 'Cross-Body Shoulder Stretch')!;
  shoulderStep.done = true;
  const next = guide('cooldown', [done(shoulder)], { items: first });
  assert.deepEqual(next.find(item => item.key === shoulderStep.key), shoulderStep);
  assert.equal(guide('cooldown', [shoulder]).find(item => item.key === shoulderStep.key)?.done, false);
  assert.deepEqual(guide('cooldown', [done(shoulder)], { items: next }), next);
});

test('unknown movements use explicit group labels, without reusing a misleading old exercise key', () => {
  const unknown = { key: 'squat', name: 'My side-delt exercise', group: 'Shoulders' };
  const result = guide('cooldown', [unknown]);
  assert.ok(names(result).includes('Cross-Body Shoulder Stretch'));
  assert.ok(!names(result).some(name => /quad|glute/i.test(name)));
});

test('preparation remains schema-valid at the 20-step cap and preserves supplied custom instructions', () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ key: `custom-${index}`, name: `Prescribed drill ${index}`, target: '15 sec', cue: 'As advised', done: index === 0 }));
  const result = guide('cooldown', [shoulder, squat], { items });
  assert.deepEqual(result, items);
  assert.equal(PreparationSchema.safeParse(result).success, true);
  assert.notEqual(result, items);
  assert.notEqual(result[0], items[0]);
});

test('targeted cooldown stretches appear before automatic walking and retain custom ordering and checks', () => {
  const initial = guide('cooldown', [done(shoulder)]);
  assert.equal(initial[0].name, 'Cross-Body Shoulder Stretch');
  assert.equal(initial.at(-1)?.name, 'Easy Walk + Breathing');
  const automaticWalk = { ...initial.find(item => item.name === 'Easy Walk + Breathing')!, done: true };
  const firstCustom = { key: 'physio-first', name: 'Prescribed first drill', target: '15 sec', cue: 'As advised', done: true };
  const editedWalk = { ...createVolleyballMasterPlan()[0].cooldown![0], target: 'My prescribed walking time' };
  const lastCustom = { key: 'physio-last', name: 'Prescribed next drill', target: '20 sec', cue: 'Gentle', done: false };
  const items = [firstCustom, automaticWalk, editedWalk, lastCustom];
  const before = structuredClone(items);
  const result = guide('cooldown', [done(shoulder)], { items });
  assert.deepEqual(result.slice(0, 3), [firstCustom, editedWalk, lastCustom]);
  assert.equal(result[3].name, 'Cross-Body Shoulder Stretch');
  assert.deepEqual(result.at(-1), automaticWalk);
  assert.deepEqual(items, before);
  assert.equal(PreparationSchema.safeParse(result).success, true);
  assert.deepEqual(guide('cooldown', [done(shoulder)], { items: result }), result);
});

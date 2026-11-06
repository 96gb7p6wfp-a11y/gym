import assert from 'node:assert/strict';
import test from 'node:test';
import { getWorkoutPrescription } from '../src/training-prescription.ts';
import { createVolleyballMasterPlan, resolveMasterProgramPlan, type MasterProgramSettings } from '../src/volleyball-master-plan.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import type { PlanDay } from '../src/workout-customization.ts';

const date = '2026-11-07';
const settings: MasterProgramSettings = { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [1],
  clearance: { impact: 'cleared', heavyLifting: 'cleared' } };
const primer = () => createV9VolleyballMasterPlan(true)[5];

test('the actual V9 match primer is easy preparation without changing its complete prescription', () => {
  for (const options of [undefined, settings, { ...settings, clearance: undefined }]) {
    const plan = primer(), before = structuredClone(plan), originalSettings = structuredClone(options);
    const view = getWorkoutPrescription({ plan, settings: options, date });
    assert.equal(view.label, 'Light primer');
    assert.equal(view.difficulty, 'light');
    assert.equal(view.workingSets, 6, 'planned intervals and bodyweight sets remain intact');
    assert.equal(view.mandatoryExercises, 4);
    assert.equal(view.optionalExercises, 1);
    assert.equal(view.duration, '10–15 min');
    assert.equal(view.durationEstimated, false);
    assert.match(view.objective, /stay fresh for the match/);
    assert.match(view.objective, /full rest is also valid/);
    assert.match(view.intensity, /No heavy lifting or maximal jumps/);
    assert.match(view.intensity, /stop before fatigue/);
    assert.match(view.progression, /Do not add load, jumps or catch-up work/);
    assert.doesNotMatch(view.progression, /load increase|rep target/);
    assert.doesNotMatch(view.intensity, /Strength effort/);
    assert.deepEqual(plan, before);
    assert.deepEqual(options, originalSettings);
  }
});

test('V9 primer guidance uses stable identity through a user title edit and a saved snapshot', () => {
  const plan = { ...primer(), name: 'My gentle Saturday preparation' };
  const view = getWorkoutPrescription({ plan, source: 'snapshot', settings: { ...settings, readiness: [{ date, status: 'red' }] }, date });
  assert.equal(view.label, 'Light primer');
  assert.equal(view.readiness, 'unrecorded', 'a present readiness report is not assigned to an older saved snapshot');
  assert.deepEqual(view.reasons.map(reason => reason.code), ['saved-snapshot']);
});

test('the primer name or identity never conceals heavy loading, high effort or explosive custom work', () => {
  const customizations: Array<(plan: PlanDay) => void> = [
    plan => { plan.programSessionId = 'custom-saturday'; },
    plan => { plan.programRevision = '13.1'; },
    plan => { plan.exercises[0].mode = 'weight'; plan.exercises[0].targetRpe = 8; },
    plan => { plan.exercises[0].defaultKg = 20; },
    plan => { plan.exercises[0].targetRpe = 9; },
    plan => { plan.exercises[0].targetRir = 1; },
    plan => { plan.exercises[0].jumpContactsPerRep = 1; },
    plan => { plan.exercises[0].name = 'Maximal Approach Jump'; },
    plan => { plan.exercises[0].quantityUnit = 'm'; },
    plan => { plan.exercises.push({ ...plan.exercises[3], key: 'optional-heavy', optionalWork: true, mode: 'weight', targetRpe: 9 }); },
  ];
  for (const customize of customizations) {
    const plan = primer(); customize(plan);
    const before = structuredClone(plan), view = getWorkoutPrescription({ plan });
    assert.notEqual(view.label, 'Light primer');
    assert.notEqual(view.difficulty, 'light', 'the new primer branch cannot make modified hard work easy');
    assert.deepEqual(plan, before);
  }
});

test('Yellow primer remains optional and easy while Red resolves to recovery without restored work', () => {
  for (const status of ['green', 'yellow', 'red'] as const) {
    const options = { ...settings, readiness: [{ date, status }] };
    const plan = resolveMasterProgramPlan(createV9VolleyballMasterPlan(), options, date)[5];
    const before = structuredClone(plan), view = getWorkoutPrescription({ plan, settings: options, date });
    assert.equal(view.difficulty, 'light');
    assert.equal(view.readiness, status);
    if (status === 'red') {
      assert.equal(view.label, 'Recovery');
      assert.equal(view.workingSets, 0);
      assert.match(view.intensity, /stop before fatigue/);
    } else {
      assert.equal(view.label, 'Light primer');
      assert.equal(view.workingSets, 6);
      assert.match(view.objective, /full rest is also valid/);
    }
    if (status !== 'green') assert.ok(view.reasons.some(reason => reason.code === `readiness-${status}`));
    assert.deepEqual(plan, before);
  }
});

test('full no-match V9 Lower B and legacy V13.1 strength retain their existing effort guidance', () => {
  const full = createV9VolleyballMasterPlan()[5];
  const view = getWorkoutPrescription({ plan: full, settings: { ...settings, matchWeeks: [] }, date });
  assert.equal(full.exercises.length, 11);
  assert.equal(view.difficulty, 'demanding');
  assert.equal(view.label, 'Demanding');
  assert.match(view.progression, /small load increase/);
  const legacy = getWorkoutPrescription({ plan: createVolleyballMasterPlan()[2] });
  assert.equal(legacy.difficulty, 'demanding');
  assert.doesNotMatch(legacy.objective, /stay fresh for the match/);
});

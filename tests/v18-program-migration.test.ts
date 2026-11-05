import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { reviewMasterProgramUpgrade, restorePreviousMasterProgram, upgradeMasterProgram } from '../src/master-program-upgrade.ts';
import { createV81VolleyballMasterPlan, createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { effectiveTrainingGuidance } from '../src/training-guidance.ts';

function profile() {
  return ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    plan: createV81VolleyballMasterPlan(), masterMatchWeekend: createV81VolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '8.1', startDate: '2026-10-19', matchWeeks: [2],
      clearance: { impact: 'cleared', heavyLifting: 'cleared', note: 'My existing report' } },
    appearance: 'dark', timerSoundEnabled: false, timerSoundVolume: .3,
  });
}
const exercise = (plan: ReturnType<typeof profile>['plan'], day: number, key: string) => plan[day].exercises.find(item => item.key === key)!;

test('an untouched parsed V8.1 week is not mistaken for customization because of property order', () => {
  const current = profile(), before = structuredClone(current);
  const review = reviewMasterProgramUpgrade(current);
  assert.deepEqual(review, { preserved: [], needsReview: [] });
  const next = upgradeMasterProgram(current, 1000);
  assert.deepEqual(next.plan, ProfileSchema.shape.plan.parse(createVolleyballMasterPlan()));
  assert.deepEqual(next.masterMatchWeekend, ProfileSchema.shape.masterMatchWeekend.parse(createVolleyballMasterPlan(true).slice(5)));
  assert.deepEqual(current, before);
});

test('compatible user equipment, planned zero, repetitions, rest and effort survive a reviewed version change', () => {
  const current = profile();
  Object.assign(exercise(current.plan, 0, 'master-incline-a'), {
    equipmentLabel: 'Technogym incline press', defaultKg: 0, sets: 4, target: '7–9 reps', rest: 135,
    targetRpe: 7.5, cue: 'My saved range of motion',
  });
  const before = structuredClone(current);
  const review = reviewMasterProgramUpgrade(current);
  assert.equal(review.needsReview.length, 0);
  assert.ok(review.preserved.some(item => item.exercise === 'Incline Machine Chest Press' && item.fields?.includes('equipmentLabel')));
  const next = upgradeMasterProgram(current, 2000);
  const saved = exercise(next.plan, 0, 'master-incline-a');
  for (const field of ['equipmentLabel', 'defaultKg', 'sets', 'target', 'rest', 'targetRpe', 'cue'] as const) {
    assert.deepEqual(saved[field], exercise(before.plan, 0, 'master-incline-a')[field]);
  }
  assert.equal(saved.name, 'Incline Chest Press', 'the new compatible exercise recommendation keeps its current name');
  assert.deepEqual(next.masterProgramBackup?.plan, before.plan);
  assert.deepEqual(current, before);
});

test('compatible equipment follows its unique movement when V13.1 moves lower work from Sunday to Saturday', () => {
  const current = profile();
  Object.assign(exercise(current.plan, 6, 'master-leg-curl'), { equipmentLabel: 'Matrix seated curl', defaultKg: 32.5 });
  const review = reviewMasterProgramUpgrade(current);
  assert.equal(review.needsReview.length, 0);
  assert.match(review.preserved[0].message, /Saturday/);
  const next = upgradeMasterProgram(current, 3000);
  assert.equal(exercise(next.plan, 5, 'master-leg-curl').equipmentLabel, 'Matrix seated curl');
  assert.equal(exercise(next.plan, 5, 'master-leg-curl').defaultKg, 32.5);
  assert.equal(next.plan[6].kind, 'recovery');
  assert.equal(next.plan.flatMap(day => day.exercises).filter(item => item.key === 'master-leg-curl').length, 1);
});

test('structural custom sessions require explicit replacement and never produce an accidental hybrid week', () => {
  const current = profile();
  current.plan[6].name = 'My Sunday lower session';
  exercise(current.plan, 0, 'master-row-a').equipmentLabel = 'My chest-supported row';
  const before = structuredClone(current), review = reviewMasterProgramUpgrade(current);
  assert.ok(review.needsReview.some(item => item.day === 6));
  assert.throws(() => upgradeMasterProgram(current, 4000), /cannot be mapped safely/);
  assert.throws(() => upgradeMasterProgram(current, 4000, { weeklyCustomizationPolicy: 'preserve' }), /keep your current program/);
  assert.deepEqual(current, before);
  const accepted = upgradeMasterProgram(current, 4000, { weeklyCustomizationPolicy: 'recommendations' });
  assert.equal(accepted.masterProgram?.revision, '13.1');
  assert.equal(accepted.plan[5].name, 'Lower Strength B');
  assert.equal(accepted.plan[6].kind, 'recovery');
  assert.equal(exercise(accepted.plan, 0, 'master-row-a').equipmentLabel, 'My chest-supported row');
  assert.deepEqual(accepted.masterProgramBackup?.plan, before.plan);
});

test('a substitution with a different movement configuration is reviewed rather than relabeled as comparable', () => {
  const current = profile();
  Object.assign(exercise(current.plan, 0, 'master-incline-a'), { name: 'Custom bodyweight press', mode: 'bodyweight', exerciseId: 'push-up', defaultKg: 0 });
  assert.ok(reviewMasterProgramUpgrade(current).needsReview.some(item => item.day === 0));
  assert.throws(() => upgradeMasterProgram(current), /cannot be mapped safely/);
  const next = upgradeMasterProgram(current, 5000, { weeklyCustomizationPolicy: 'recommendations' });
  assert.equal(exercise(next.plan, 0, 'master-incline-a').equipmentLabel, undefined);
  assert.equal(exercise(next.plan, 0, 'master-incline-a').mode, 'weight');
  assert.equal(exercise(next.masterProgramBackup!.plan, 0, 'master-incline-a').mode, 'bodyweight');
});

test('current guidance and unrelated personal preferences survive upgrade and program recovery', () => {
  const current = profile();
  current.trainingGuidance = { impact: 'restricted', heavyLifting: 'cleared', note: 'My current instructions' };
  const next = upgradeMasterProgram(current, 6000);
  assert.deepEqual(effectiveTrainingGuidance(next), current.trainingGuidance);
  assert.deepEqual(next.masterProgram?.clearance, current.trainingGuidance);
  const restored = restorePreviousMasterProgram(next);
  assert.deepEqual(restored.trainingGuidance, current.trainingGuidance);
  assert.deepEqual(restored.masterProgram?.clearance, current.trainingGuidance, 'old cleared impact must not replace a current restriction');
  for (const field of ['appearance', 'timerSoundEnabled', 'timerSoundVolume', 'bodyWeight', 'restSeconds', 'nutrition', 'volleyballSchedule'] as const) {
    assert.deepEqual(restored[field], current[field]);
  }
  assert.deepEqual(restored.plan, current.plan);
  assert.deepEqual(next.masterProgramBackup?.masterProgram, current.masterProgram, 'the archived original remains exact evidence');
});

test('restoring a plain week retains V13.1 implicit unknown rather than importing older approval', () => {
  const current = ProfileSchema.parse({ ...profile(), plan: createVolleyballMasterPlan(),
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-10-19', matchWeeks: [] },
    masterProgramBackup: { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan) },
  });
  const restored = restorePreviousMasterProgram(current);
  assert.equal(restored.masterProgram, undefined);
  assert.deepEqual(restored.trainingGuidance, { impact: 'unknown', heavyLifting: 'unknown' });
  assert.deepEqual(restored.plan, ProfileSchema.parse(DEFAULT_PROFILE).plan);
});

test('program review and repeated upgrade never rewrite archived versions or introduce a nonexistent revision', () => {
  const current = profile(), next = upgradeMasterProgram(current, 7000);
  const before = structuredClone(next);
  assert.deepEqual(reviewMasterProgramUpgrade(next), { preserved: [], needsReview: [] });
  assert.deepEqual(upgradeMasterProgram(next, 8000), before);
  assert.deepEqual(next, before);
  assert.equal(ProfileSchema.safeParse({ ...current, masterProgram: { ...current.masterProgram, revision: '12' } }).success, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import type { PlanDay } from '../src/workout-customization';
import {
  effectiveMasterProgram, effectiveTrainingGuidance, type TrainingGuidance,
} from '../src/training-guidance.ts';
import {
  applyTrainingGuidance, createV81VolleyballMasterPlan, createVolleyballMasterPlan,
  resolveMasterProgramPlan, type MasterProgramSettings,
} from '../src/volleyball-master-plan.ts';

const cleared: TrainingGuidance = { impact: 'cleared', heavyLifting: 'cleared', note: 'My recorded guidance' };
const unknown: TrainingGuidance = { impact: 'unknown', heavyLifting: 'unknown' };
const restricted: TrainingGuidance = { impact: 'restricted', heavyLifting: 'restricted', note: 'My current limits' };
const settings: MasterProgramSettings = { version: 1, revision: '13.1', startDate: '2026-10-19', matchWeeks: [] };

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function assertPreparation(day: ReturnType<typeof createVolleyballMasterPlan>[number]) {
  assert.ok(day.exercises.length > 0, 'a reduced session keeps a genuine preparation prescription');
  assert.ok(day.exercises.every(exercise => exercise.sets <= 2));
  assert.ok(day.exercises.every(exercise => exercise.preparationOnly === true));
  assert.ok(day.exercises.every(exercise => exercise.targetRpe === 5));
  assert.ok(day.exercises.every(exercise => exercise.defaultKg === 0));
  assert.ok(day.exercises.every(exercise => !/jump|throw|slam|drop|pogo|hop/i.test(exercise.name)),
    'unconfirmed/restricted impact must not retain explosive work');
}

test('current user guidance wins over an older nested approval, including an explicit unknown status', () => {
  const profile = freeze({ trainingGuidance: unknown, masterProgram: { ...settings, clearance: cleared } });
  const before = structuredClone(profile);
  assert.deepEqual(effectiveTrainingGuidance(profile), unknown);
  assert.deepEqual(effectiveMasterProgram(profile)?.clearance, unknown);
  assert.notEqual(effectiveMasterProgram(profile), profile.masterProgram);
  assert.deepEqual(profile, before);
  assert.deepEqual(profile.masterProgram.clearance, cleared, 'reading must not rewrite the old program');
});

test('legacy guidance remains readable without manufacturing profile fields or changing saved bytes', async () => {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), masterProgram: { ...settings, clearance: restricted } });
  const values = new Map([[STORAGE_KEY, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 7,
    sessions: [], nutrition: [], activities: [] })]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const raw = values.get(STORAGE_KEY);
  const loaded = ProfileSchema.parse((await createLocalClient(storage).request('/api/tracker')).profile);
  assert.deepEqual(effectiveTrainingGuidance(loaded), restricted);
  assert.equal(Object.hasOwn(loaded, 'trainingGuidance'), false);
  assert.equal(values.get(STORAGE_KEY), raw, 'hydration and guidance selection are read-only');
  assert.deepEqual(effectiveMasterProgram(loaded)?.clearance, restricted);
});

test('V13.1 implicit unknown guidance is derived read-only while legacy and plain profiles remain unspecified', async () => {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), masterProgram: settings });
  const values = new Map([[STORAGE_KEY, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 3,
    sessions: [], nutrition: [], activities: [] })]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const raw = values.get(STORAGE_KEY);
  const loaded = freeze(ProfileSchema.parse((await createLocalClient(storage).request('/api/tracker')).profile));
  assert.deepEqual(effectiveTrainingGuidance(loaded), unknown,
    'leaving V13.1 must retain the unknown guidance already enforced by that program');
  assert.deepEqual(effectiveMasterProgram(loaded)?.clearance, unknown);
  assert.equal(loaded.masterProgram?.clearance, undefined);
  assert.equal(Object.hasOwn(loaded, 'trainingGuidance'), false);
  assert.equal(values.get(STORAGE_KEY), raw);
  assert.equal(effectiveTrainingGuidance({}), undefined);
  assert.equal(effectiveTrainingGuidance({ masterProgram: { ...settings, revision: '8.1' } }), undefined);
  const { revision: _revision, ...legacy } = settings;
  assert.equal(effectiveTrainingGuidance({ masterProgram: legacy }), undefined);
});

test('an established legacy installation with no guidance gets no invented approval or restriction', () => {
  const legacySettings: MasterProgramSettings = { ...settings, revision: '8.1' };
  const profile = freeze({ masterProgram: legacySettings });
  const plain = freeze(structuredClone(DEFAULT_PROFILE.plan[0]));
  const legacy = freeze(createV81VolleyballMasterPlan()[2]);
  assert.equal(effectiveTrainingGuidance(profile), undefined);
  assert.equal(effectiveMasterProgram(profile), legacySettings);
  assert.equal(effectiveMasterProgram({ trainingGuidance: restricted }), undefined);
  assert.equal(applyTrainingGuidance(plain), plain);
  assert.equal(applyTrainingGuidance(legacy), legacy);
  assert.equal(Object.hasOwn(profile, 'trainingGuidance'), false);
});

for (const guidance of [unknown, restricted]) {
  test(`explicit ${guidance.impact} guidance follows plain and legacy strength prescriptions without changing their version`, () => {
    const v81 = createV81VolleyballMasterPlan()[2];
    const { programRevision: _revision, ...plain } = structuredClone(v81);
    const originals: PlanDay[] = [plain, v81];
    for (const original of originals) {
      const before = structuredClone(original);
      freeze(original);
      const guarded = applyTrainingGuidance(original, guidance);
      assertPreparation(guarded);
      assert.equal(guarded.programRevision, original.programRevision);
      assert.equal(Object.hasOwn(guarded, 'programRevision'), Object.hasOwn(original, 'programRevision'));
      assert.deepEqual(original, before);
    }
  });
}

test('recorded clearance preserves the full prescription and non-strength sessions remain untouched', () => {
  const base = freeze(createVolleyballMasterPlan());
  assert.equal(applyTrainingGuidance(base[2], cleared), base[2]);
  assert.equal(applyTrainingGuidance(base[1], restricted), base[1]);
  assert.equal(applyTrainingGuidance(base[6], restricted), base[6]);
  const legacy = freeze(createV81VolleyballMasterPlan()[2]);
  assert.equal(applyTrainingGuidance(legacy, cleared), legacy);
});

test('impact and lifting permissions stay independent instead of reducing every cleared strength day', () => {
  const original = freeze(createVolleyballMasterPlan()[2]);
  const withoutImpact = applyTrainingGuidance(original, { impact: 'restricted', heavyLifting: 'cleared' });
  const squat = withoutImpact.exercises.find(exercise => exercise.key === 'master-hack')!;
  assert.equal(squat.sets, 4);
  assert.equal(squat.targetRpe, 8);
  assert.equal(squat.preparationOnly, undefined);
  assert.equal(withoutImpact.exercises.some(exercise => exercise.key === 'master-cmj'), false);
  const withoutHeavy = applyTrainingGuidance(original, { impact: 'cleared', heavyLifting: 'restricted' });
  assert.ok(withoutHeavy.exercises.filter(exercise => exercise.mode === 'weight')
    .every(exercise => exercise.sets <= 2 && exercise.targetRpe === 5 && exercise.defaultKg === 0));
  const bodyweightJump = withoutHeavy.exercises.find(exercise => exercise.key === 'master-cmj')!;
  assert.equal(bodyweightJump.sets, 3);
  assert.equal(bodyweightJump.defaultKg, 0);
  assert.equal(bodyweightJump.preparationOnly, undefined);
});

test('V13.1 without recorded approval remains preparation, while a cleared full Wednesday retains meaningful loading', () => {
  const base = freeze(createVolleyballMasterPlan());
  const before = structuredClone(base);
  const conservative = resolveMasterProgramPlan(base, settings, '2026-10-21');
  assertPreparation(conservative[2]);
  const full = resolveMasterProgramPlan(base, { ...settings, clearance: cleared }, '2026-10-21');
  const weighted = full[2].exercises.filter(exercise => exercise.mode === 'weight');
  assert.ok(weighted.some(exercise => exercise.sets >= 3));
  assert.ok(weighted.some(exercise => (exercise.targetRpe ?? 0) >= 7));
  assert.ok(full[2].exercises.some(exercise => exercise.key === 'master-cmj'));
  assert.deepEqual(base, before);
});

test('explicit guidance remains enforced beyond the eight-week block and on saved extra sessions', () => {
  const base = createV81VolleyballMasterPlan();
  base[1].extraSession = structuredClone(base[2]);
  const before = structuredClone(base);
  freeze(base);
  const legacySettings: MasterProgramSettings = { ...settings, revision: '8.1', clearance: restricted };
  for (const date of ['2026-10-12', '2026-10-21', '2026-12-14']) {
    const plan = resolveMasterProgramPlan(base, legacySettings, date);
    assertPreparation(plan[2]);
    assertPreparation(plan[1].extraSession!);
    assert.equal(plan[2].programRevision, '8.1');
    assert.equal(plan[1].extraSession!.programRevision, '8.1');
  }
  assert.deepEqual(base, before);
});

test('legacy guidance absence preserves the whole resolved week after the block instead of imposing new defaults', () => {
  const base = freeze(createV81VolleyballMasterPlan());
  const profile = freeze({ masterProgram: { ...settings, revision: '8.1' as const } });
  const plan = resolveMasterProgramPlan(base, effectiveMasterProgram(profile)!, '2026-12-14');
  assert.deepEqual(plan, base);
  assert.notEqual(plan, base, 'the resolver may clone a week but cannot rewrite its prescription');
});

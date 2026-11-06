import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV81VolleyballMasterPlan, createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { reviewV9ProgramUpgrade, restorePreviousMasterProgram, upgradeMasterProgram, upgradeToV9 } from '../src/master-program-upgrade.ts';
import { createLocalClient, PRE_RESTORE_KEY, STORAGE_KEY } from '../src/storage.ts';
import { getV9DraftDisposition } from '../src/v9-upcoming-workouts.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';

const TODAY = '2026-11-06';
const cleared = { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated test settings' } as const;

function fixture(revision: '8.1' | '13.1' = '13.1') {
  const factory = revision === '13.1' ? createVolleyballMasterPlan : createV81VolleyballMasterPlan;
  return ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: factory(),
    masterMatchWeekend: factory(true).slice(5),
    masterProgram: { version: 1, revision, startDate: '2026-11-02', matchWeeks: [2, 4],
      matchTimes: [{ week: 2, startTime: '17:30' }], previousSundayMatch: true,
      clearance: cleared, readiness: [{ date: '2026-11-07', status: 'green' }],
      rescheduledLowerDates: ['2026-11-07'], optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: true } },
    preMasterPlan: structuredClone(DEFAULT_PROFILE.plan),
    appearance: 'dark', presentationMode: 'athlete', bodyWeight: 69.5,
    restSeconds: 105, timerSoundEnabled: false, timerSoundVolume: .25,
    nutrition: { age: 22, heightCm: 178, sex: 'male', activityFactor: 1.7, surplusKcal: 100 },
    customWorkouts: [{ ...structuredClone(factory()[0]), id: '20000000-0000-4000-8000-000000000001', name: 'My saved template' }],
  });
}

test('V9 review is read-only and offers a distinct full replacement from unchanged V13.1', () => {
  const current = fixture(), before = structuredClone(current);
  const review = reviewV9ProgramUpgrade(current, TODAY);
  assert.equal(review.currentRevision, 'V13.1');
  assert.equal(review.targetRevision, '9');
  assert.deepEqual(review.needsReview, []);
  assert.equal(review.schedule[0].exercises.length, 11);
  assert.equal(review.schedule[5].programSessionId, 'v9-lower-b');
  assert.equal(review.schedule[5].exercises.length, 11);
  assert.equal(review.matchWeekend[0].programSessionId, 'v9-match-primer');
  assert.equal(review.matchWeekend[1].programSessionId, 'v9-match');
  assert.deepEqual(current, before, 'review and cancellation have no profile mutation');
});

test('explicit V9 activation preserves the cycle, actual match settings, guidance and unrelated personal fields', () => {
  const current = fixture(), before = structuredClone(current);
  current.trainingGuidance = { impact: 'restricted', heavyLifting: 'cleared', note: 'Current user-entered guidance' };
  const expectedGuidance = structuredClone(current.trainingGuidance);
  const next = upgradeToV9(current, TODAY, 12345);
  assert.equal(next.masterProgram?.revision, '9');
  assert.equal(next.masterProgram?.v9EffectiveDate, TODAY);
  assert.equal(next.masterProgram?.startDate, current.masterProgram!.startDate);
  for (const field of ['matchWeeks', 'matchTimes', 'readiness', 'previousSundayMatch'] as const) {
    assert.deepEqual(next.masterProgram?.[field], current.masterProgram?.[field]);
  }
  assert.equal(next.masterProgram?.rescheduledLowerDates, undefined, 'the old moved-Lower-B rule must not relocate the new Saturday');
  assert.equal(next.masterProgram?.optional, undefined, 'old optional-arm flags must not shorten the complete V9 dose');
  assert.deepEqual(next.trainingGuidance, expectedGuidance);
  assert.deepEqual(next.masterProgram?.clearance, expectedGuidance);
  for (const field of ['appearance', 'presentationMode', 'bodyWeight', 'restSeconds', 'timerSoundEnabled', 'timerSoundVolume', 'nutrition', 'volleyballSchedule', 'customWorkouts', 'preMasterPlan'] as const) {
    assert.deepEqual(next[field], current[field], field);
  }
  assert.deepEqual(next.masterProgramBackup, { savedAt: 12345, plan: current.plan, masterProgram: current.masterProgram,
    masterMatchWeekend: current.masterMatchWeekend, preMasterPlan: current.preMasterPlan });
  assert.deepEqual(current.plan, before.plan);
  assert.equal(current.masterProgram?.revision, '13.1');
});

test('V9 upgrades from V8.1 or a plain personal week without numeric version ordering or implicit medical approval', () => {
  const older = fixture('8.1');
  assert.equal(upgradeToV9(older, TODAY, 12).masterProgram?.revision, '9');
  const plain = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance: 'dark', restSeconds: 115 });
  const before = structuredClone(plain);
  assert.ok(reviewV9ProgramUpgrade(plain, TODAY).needsReview.length > 0);
  assert.throws(() => upgradeToV9(plain, TODAY, 13), /custom prescriptions/);
  const next = upgradeToV9(plain, TODAY, 13, { weeklyCustomizationPolicy: 'recommendations' });
  assert.equal(next.masterProgram?.revision, '9');
  assert.equal(next.masterProgram?.startDate, '2026-11-02');
  assert.equal(next.masterProgram?.clearance, undefined, 'selecting a new program does not assert clinician clearance');
  assert.deepEqual(next.preMasterPlan, plain.plan);
  assert.deepEqual(next.masterProgramBackup?.plan, plain.plan);
  assert.deepEqual(plain, before);
  assert.deepEqual(restorePreviousMasterProgram(next).plan, plain.plan);
});

test('compatible planned load/equipment survive but custom working doses require explicit recommendations approval', () => {
  const current = fixture();
  const old = current.plan[2].exercises.find(exercise => exercise.name === 'Romanian Deadlift')!;
  Object.assign(old, { defaultKg: 57.5, equipmentLabel: 'My bar and platform' });
  const review = reviewV9ProgramUpgrade(current, TODAY);
  assert.deepEqual(review.needsReview, []);
  const next = upgradeToV9(current, TODAY, 25);
  const carried = next.plan[2].exercises.find(exercise => exercise.name === 'Romanian Deadlift')!;
  assert.equal(carried.defaultKg, 57.5);
  assert.equal(carried.equipmentLabel, 'My bar and platform');
  assert.equal(carried.sets, 3);
  assert.equal(carried.target, '5–7 reps');

  current.plan[5].name = 'My personally shortened Saturday';
  current.plan[5].exercises = current.plan[5].exercises.slice(0, 2);
  const before = structuredClone(current);
  assert.ok(reviewV9ProgramUpgrade(current, TODAY).needsReview.some(row => row.day === 5));
  assert.throws(() => upgradeToV9(current, TODAY, 26), /custom prescriptions/);
  assert.deepEqual(current, before);
  const accepted = upgradeToV9(current, TODAY, 26, { weeklyCustomizationPolicy: 'recommendations' });
  assert.equal(accepted.plan[5].exercises.length, 11);
  assert.equal(accepted.plan[5].programSessionId, 'v9-lower-b');
  assert.deepEqual(accepted.masterProgramBackup?.plan, before.plan);
});

test('future old five-item drafts remain stored and quarantined until a named replace or keep decision', () => {
  const current = fixture();
  current.sessionDrafts = [{ date: '2026-11-07', slot: 'main', customized: true,
    plan: structuredClone(current.plan[5]), readiness: 'green' }];
  const before = structuredClone(current), key = '2026-11-07:main';
  const review = reviewV9ProgramUpgrade(current, TODAY);
  const row = review.upcomingDrafts.find(item => item.key === key)!;
  assert.equal(row.currentExerciseCount, 5);
  assert.equal(row.recommendedExerciseCount, 11);
  assert.equal(row.disposition, 'review-required');
  assert.equal(row.canKeep, true);
  const pending = upgradeToV9(current, TODAY, 40);
  assert.deepEqual(pending.sessionDrafts, current.sessionDrafts);
  assert.equal(getV9DraftDisposition(pending.sessionDrafts![0], createV9VolleyballMasterPlan()[5]).kind, 'review-needed');
  const replaced = upgradeToV9(current, TODAY, 41, { replaceDraftKeys: [key] });
  assert.deepEqual(replaced.sessionDrafts, []);
  assert.deepEqual(replaced.masterProgramBackup?.sessionDrafts, current.sessionDrafts);
  const kept = upgradeToV9(current, TODAY, 42, { keepDraftKeys: [key] });
  assert.deepEqual(kept.sessionDrafts![0].plan, current.sessionDrafts[0].plan);
  assert.deepEqual(kept.sessionDrafts![0].reviewedForProgram, { revision: '9', programSessionId: 'v9-lower-b' });
  assert.equal(getV9DraftDisposition(kept.sessionDrafts![0], createV9VolleyballMasterPlan()[5]).kind, 'custom');
  assert.deepEqual(current, before);
});

test('reviewing already active V9 changes only approved upcoming drafts and never rotates the archive or effective date', () => {
  const current = fixture();
  current.sessionDrafts = [{ date: '2026-11-07', slot: 'main', customized: true, plan: structuredClone(current.plan[5]) }];
  const activated = upgradeToV9(current, TODAY, 50), before = structuredClone(activated);
  const review = reviewV9ProgramUpgrade(activated, TODAY);
  assert.deepEqual(review.needsReview, []);
  const reviewed = upgradeToV9(activated, TODAY, 999, { replaceDraftKeys: ['2026-11-07:main'] });
  assert.deepEqual(reviewed, { ...before, sessionDrafts: [] });
  assert.equal(reviewed.masterProgram?.v9EffectiveDate, TODAY);
  assert.deepEqual(activated, before);
  assert.throws(() => upgradeMasterProgram(reviewed, 1000), /V9 is already active/);
});

test('the complete older V13.1 and V8.1 archive chain remains restorable without restoring old medical flags', () => {
  const v81 = fixture('8.1');
  const v131 = upgradeMasterProgram(v81, 60, { weeklyCustomizationPolicy: 'recommendations' });
  v131.trainingGuidance = { impact: 'restricted', heavyLifting: 'unknown' };
  const v9 = upgradeToV9(v131, TODAY, 70);
  assert.equal(v9.masterProgramArchive?.length, 1);
  const restored131 = restorePreviousMasterProgram(v9);
  assert.equal(restored131.masterProgram?.revision, '13.1');
  assert.deepEqual(restored131.plan, v131.plan);
  assert.deepEqual(restored131.masterProgram?.clearance, v131.trainingGuidance);
  const restored81 = restorePreviousMasterProgram(restored131);
  assert.equal(restored81.masterProgram?.revision, '8.1');
  assert.deepEqual(restored81.plan, v81.plan);
  assert.deepEqual(restored81.trainingGuidance, v131.trainingGuidance);
  assert.deepEqual(restored81.masterProgram?.clearance, v131.trainingGuidance);
});

test('full archive capacity and invalid review inputs fail without modifying the source profile', () => {
  const current = fixture();
  const snapshot = { savedAt: 1, plan: structuredClone(current.plan) };
  current.masterProgramBackup = structuredClone(snapshot);
  current.masterProgramArchive = Array.from({ length: 20 }, () => structuredClone(snapshot));
  const before = structuredClone(current);
  assert.throws(() => upgradeToV9(current, TODAY, 80), /Export a backup/);
  assert.throws(() => upgradeToV9(current, '2026-02-30', 80), /valid local date/);
  assert.throws(() => upgradeToV9(current, TODAY, -1), /valid time/);
  assert.throws(() => upgradeToV9(current, TODAY, 80, { weeklyCustomizationPolicy: 'unsafe' as 'preserve' }), /weekly customizations/);
  assert.deepEqual(current, before);
});

test('a checkpointed V9 profile update preserves exact completed and active sessions and remains restorable as a version-one backup', async () => {
  const profile = fixture();
  const completed = stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed');
  Object.assign(completed.exercises[2].logs[0], { kg: 52.5, reps: 8, rir: 2, done: true });
  const active = SessionSchema.parse(createSession(profile.plan[2], 2, '2026-11-04', profile, []));
  active.runningSince = null;
  const state = { schemaVersion: 1, profile, profileVersion: 4,
    sessions: [{ session: completed, version: 7 }, { session: active, version: 2 }],
    nutrition: [{ id: 'retained-weight', date: '2026-11-01', version: 2, payload: { kind: 'weight', kg: 69.1 } }],
    activities: [], reminders: { items: [], entries: [] }, performance: { jumps: [], readiness: [] }, performanceVersion: 1 };
  const values = new Map<string, string>([[STORAGE_KEY, JSON.stringify(state)]]);
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const client = createLocalClient(storage);
  const next = upgradeToV9(profile, TODAY, 90, { activeDates: [active.date] });
  await client.request('/api/tracker', { action: 'profile', profile: next, expectedVersion: 4, checkpoint: true });
  const saved = JSON.parse(values.get(STORAGE_KEY)!);
  assert.deepEqual(saved.sessions, state.sessions);
  assert.deepEqual(saved.nutrition, state.nutrition);
  assert.deepEqual(saved.performance, state.performance);
  assert.equal(saved.profile.masterProgram.revision, '9');
  assert.equal(JSON.parse(values.get(PRE_RESTORE_KEY)!).raw, JSON.stringify(state));
  const backup = JSON.parse(client.exportBackup());
  assert.equal(backup.version, 1);
  const restoredValues = new Map<string, string>();
  const restored = createLocalClient({ getItem: key => restoredValues.get(key) ?? null,
    setItem: (key, value) => { restoredValues.set(key, value); }, removeItem: key => { restoredValues.delete(key); } });
  restored.importBackup(JSON.stringify(backup));
  const roundtrip = await restored.request('/api/tracker');
  assert.deepEqual(roundtrip.profile, saved.profile);
  assert.deepEqual(roundtrip.sessions, saved.sessions);
  const fallback = client.previousRestoreCopy();
  assert.ok(fallback && !fallback.recovery, 'the exact pre-upgrade checkpoint is a supported old-format backup');
  restored.importBackup(fallback.text);
  const rolledBack = await restored.request('/api/tracker');
  assert.deepEqual(rolledBack.profile, state.profile);
  assert.deepEqual(rolledBack.sessions, state.sessions);
  assert.deepEqual(JSON.parse(restored.exportBackup()).data.nutrition, state.nutrition);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createV9VolleyballMasterPlan, resolveMasterProgramPlan, resolveV9PlanningBase } from '../src/volleyball-master-plan.ts';
import { getWorkoutPrescription } from '../src/training-prescription.ts';
import { getCoachRecords, saveCalendarMatch } from '../src/coach-schedule.ts';
import { restorePreviousMasterProgram, upgradeToV9 } from '../src/master-program-upgrade.ts';
import { applyV9UpcomingDraftDecisions, getV9DraftDisposition } from '../src/v9-upcoming-workouts.ts';
import { isGymTraining } from '../src/training-classification.ts';

const today = '2026-11-06', saturday = '2026-11-07';
const unknown = { impact: 'unknown' as const, heavyLifting: 'unknown' as const };
const settings = { version: 1 as const, revision: '9' as const, startDate: '2026-10-12', matchWeeks: [],
  readiness: [{ date: saturday, status: 'green' as const }], clearance: unknown };

test('the screenshot requires guidance plus old phase; default coaching keeps an honest full reference and scales the safe dose', () => {
  const full = createV9VolleyballMasterPlan();
  const old = resolveMasterProgramPlan(full, { ...settings, periodizationMode: 'legacy-cycle' }, saturday)[5];
  assert.equal(old.name, 'Modified — Easy Preparation');
  assert.equal(old.exercises.length, 9);
  assert.equal(old.exercises.reduce((sum, exercise) => sum + exercise.sets, 0), 17);
  const actual = resolveMasterProgramPlan(full, settings, saturday)[5];
  const reference = resolveV9PlanningBase(full, settings, saturday)[5];
  const explanation = getWorkoutPrescription({ plan: actual, originalPlan: reference, settings, date: saturday });
  assert.equal(reference.name, 'Lower B — Full Strength');
  assert.equal(reference.exercises.length, 11);
  assert.equal(reference.exercises.reduce((sum, exercise) => sum + exercise.sets, 0), 29);
  assert.equal(actual.exercises.reduce((sum, exercise) => sum + exercise.sets, 0), 18);
  assert.equal(explanation.readiness, 'unrecorded');
  assert.ok(explanation.missingContext.length);
  assert.ok(!explanation.reasons.some(reason => reason.code === 'deload'));
  assert.ok(explanation.reasons.some(reason => reason.code === 'clearance-lifting-unknown'));
  assert.notEqual(explanation.duration, '85–105 min');
  assert.equal(explanation.durationEstimated, true);
  assert.deepEqual(full, createV9VolleyballMasterPlan());
});

test('shared date records survive restoring a plain personal plan and explicitly selecting V9 again', () => {
  const calendarMatches = [{ date: '2026-11-08', scheduled: true, opponent: 'QA team' }, { date: '2026-11-15', scheduled: false }];
  const dailyReadiness = [{ date: saturday, feeling: 'tired' as const }];
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: createV9VolleyballMasterPlan(),
    masterProgram: { ...settings, calendarMatches, dailyReadiness }, trainingGuidance: unknown,
    masterProgramBackup: { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan) } });
  const before = structuredClone(profile);
  const restored = restorePreviousMasterProgram(profile);
  assert.equal(restored.masterProgram, undefined);
  assert.deepEqual(restored.coachRecords, { calendarMatches, dailyReadiness });
  const upgraded = upgradeToV9(restored, today, 2, { weeklyCustomizationPolicy: 'recommendations' });
  assert.deepEqual(upgraded.masterProgram?.calendarMatches, calendarMatches);
  assert.deepEqual(upgraded.masterProgram?.dailyReadiness, dailyReadiness);
  assert.deepEqual(upgraded.trainingGuidance, unknown);
  assert.deepEqual(profile, before);
});

test('explicit empty date arrays and an Off match do not resurrect older archived choices', () => {
  const current = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: createV9VolleyballMasterPlan(),
    masterProgram: { ...settings, calendarMatches: [], dailyReadiness: [] },
    coachRecords: { calendarMatches: [{ date: '2026-11-08', scheduled: true }], dailyReadiness: [{ date: saturday, feeling: 'great' }] },
    masterProgramBackup: { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan), masterProgram: { ...settings, revision: '13.1' } } });
  const restored = restorePreviousMasterProgram(current);
  assert.deepEqual(restored.masterProgram?.calendarMatches, []);
  assert.deepEqual(restored.masterProgram?.dailyReadiness, []);
  assert.deepEqual(getCoachRecords(restored), { calendarMatches: [], dailyReadiness: [] });
  const off = saveCalendarMatch({ ...settings, matchWeeks: [4] }, { date: '2026-11-08', scheduled: false });
  assert.equal(resolveMasterProgramPlan(createV9VolleyballMasterPlan(), off, saturday)[5].programSessionId, 'v9-lower-b');
});

test('older intentional V9 date edits require review without deletion; explicit Keep stamps the new review', () => {
  const plan = createV9VolleyballMasterPlan()[5];
  const draft = { date: saturday, slot: 'main' as const, customized: true, plan: { ...plan, exercises: plan.exercises.slice(2) } };
  assert.equal(getV9DraftDisposition(draft, plan, { coach: true }).kind, 'review-needed');
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: createV9VolleyballMasterPlan(), masterProgram: settings, sessionDrafts: [draft] });
  const kept = applyV9UpcomingDraftDecisions(profile, today, { keepDraftKeys: [`${saturday}:main`] })!;
  assert.equal(kept[0].reviewedForCoach, 1);
  assert.deepEqual(kept[0].plan, draft.plan);
  assert.equal(getV9DraftDisposition(kept[0], plan, { coach: true }).kind, 'custom');
  assert.equal(profile.sessionDrafts?.[0].reviewedForCoach, undefined);
});

test('a renamed V9 primer and optional technique never count as a full gym-day obligation', () => {
  const match = createV9VolleyballMasterPlan(true);
  assert.equal(isGymTraining({ ...match[5], name: 'My quiet preparation' }), false);
  assert.equal(isGymTraining(createV9VolleyballMasterPlan()[1].extraSession!), false);
  assert.equal(isGymTraining(createV9VolleyballMasterPlan()[5]), true);
});

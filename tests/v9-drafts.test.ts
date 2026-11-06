import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import {
  applyV9UpcomingDraftDecisions, getV9DraftDisposition, recommendedV9Workout,
  reviewV9UpcomingWorkouts, v9SettingsForProfile,
} from '../src/v9-upcoming-workouts.ts';

const TODAY = '2026-11-06';
const cleared = { impact: 'cleared', heavyLifting: 'cleared' } as const;
const normal = () => createV9VolleyballMasterPlan();
const match = () => createV9VolleyballMasterPlan(true);
function fixture() {
  const old = createVolleyballMasterPlan();
  return ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: old,
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [2], clearance: cleared },
    sessionDrafts: [
      { date: '2026-10-31', slot: 'main', customized: true, plan: structuredClone(old[5]) },
      { date: '2026-11-07', slot: 'main', customized: true, plan: structuredClone(old[5]) },
      { date: '2026-11-09', slot: 'main', customized: true, plan: structuredClone(old[0]) },
      { date: '2026-11-10', slot: 'extra', customized: true, plan: structuredClone(old[1].extraSession!) },
      { date: '2026-11-11', slot: 'main', customized: false, plan: structuredClone(old[2]) },
      { date: '2026-11-14', slot: 'main', customized: true, plan: structuredClone(createVolleyballMasterPlan(true)[5]) },
    ],
  });
}

test('an old five-exercise non-match Saturday is review-needed, not an automatic V9 override', () => {
  const old = fixture().sessionDrafts![1], before = structuredClone(old);
  const recommended = normal()[5];
  assert.equal(old.plan.exercises.length, 5);
  assert.equal(recommended.exercises.length, 11);
  assert.equal(getV9DraftDisposition(old, recommended).kind, 'review-needed');
  assert.deepEqual(old, before);
});

test('template identity and prescribed movements, not displayed titles, separate Saturday primer and Lower B', () => {
  const wrongPrimer = { date: '2026-11-07', slot: 'main' as const, customized: true, plan: match()[5] };
  wrongPrimer.plan.name = 'Lower B — Full Strength';
  assert.equal(getV9DraftDisposition(wrongPrimer, normal()[5]).kind, 'schedule-conflict');
  const oldPrimer = { ...wrongPrimer, plan: createVolleyballMasterPlan(true)[5] };
  oldPrimer.plan.name = 'My Saturday strength';
  assert.equal(getV9DraftDisposition(oldPrimer, normal()[5]).kind, 'schedule-conflict', 'legacy prescription keys identify a renamed primer without relying on its title');
  const wrongLower = { date: '2026-11-14', slot: 'main' as const, customized: true, plan: normal()[5],
    reviewedForProgram: { revision: '9' as const, programSessionId: 'v9-match-primer' } };
  wrongLower.plan.name = 'Pre-Match Primer';
  assert.equal(getV9DraftDisposition(wrongLower, match()[5]).kind, 'schedule-conflict');
});

test('a valid V9 primer edit and its optional walking entry remain reviewable and applicable', () => {
  const plan = match()[5];
  assert.ok(plan.exercises.some(exercise => exercise.optionalWork && /walk/i.test(exercise.name)));
  const draft = { date: '2026-11-14', slot: 'main' as const, customized: true, plan };
  assert.equal(getV9DraftDisposition(draft, match()[5]).kind, 'custom');
  const shoulder = plan.exercises.find(exercise => /shoulder/i.test(exercise.name))!;
  Object.assign(shoulder, { name: 'Wall Slide', exerciseId: 'wall-slide' });
  assert.equal(getV9DraftDisposition(draft, match()[5]).kind, 'custom', 'a known gentle mobility replacement remains usable');
  const old = { ...draft, plan: createVolleyballMasterPlan(true)[5],
    reviewedForProgram: { revision: '9' as const, programSessionId: 'v9-match-primer' } };
  assert.equal(getV9DraftDisposition(old, match()[5]).kind, 'custom');
});

test('heavy or jumping work cannot masquerade as a primer even with the primer identity and recovery label', () => {
  const plan = match()[5];
  plan.exercises.push(normal()[5].exercises.find(exercise => exercise.name === 'Leg Press')!);
  const draft = { date: '2026-11-14', slot: 'main' as const, customized: true, plan,
    reviewedForProgram: { revision: '9' as const, programSessionId: 'v9-match-primer' } };
  assert.equal(getV9DraftDisposition(draft, match()[5]).kind, 'schedule-conflict');
  plan.kind = 'recovery';
  assert.equal(getV9DraftDisposition(draft, match()[5]).kind, 'schedule-conflict');
});

test('Sunday match and no-match recovery never accept the opposite old session', () => {
  const oldMatch = createVolleyballMasterPlan(true)[6];
  assert.equal(getV9DraftDisposition({ date: '2026-11-08', slot: 'main', customized: true, plan: oldMatch }, normal()[6]).kind, 'schedule-conflict');
  assert.equal(getV9DraftDisposition({ date: '2026-11-15', slot: 'main', customized: true, plan: normal()[5] }, match()[6]).kind, 'schedule-conflict');
  const approvedMatch = { date: '2026-11-15', slot: 'main' as const, customized: true, plan: oldMatch,
    reviewedForProgram: { revision: '9' as const, programSessionId: 'v9-match' } };
  assert.equal(getV9DraftDisposition(approvedMatch, match()[6]).kind, 'custom');
});

test('a heavy custom routine labelled recovery cannot replace the V9 rest day', () => {
  const plan = normal()[6];
  plan.exercises = [normal()[5].exercises.find(exercise => exercise.name === 'Leg Press')!];
  assert.equal(getV9DraftDisposition({ date: '2026-11-08', slot: 'main', customized: true, plan }, normal()[6]).kind, 'schedule-conflict');
  const walking = normal()[6];
  walking.exercises = [match()[5].exercises.find(exercise => /walk/i.test(exercise.name))!];
  assert.equal(getV9DraftDisposition({ date: '2026-11-08', slot: 'main', customized: true, plan: walking }, normal()[6]).kind, 'custom');
});

test('date review excludes past dates, protects active dates and reports exact full Saturday counts', () => {
  const current = fixture(), before = structuredClone(current);
  const rows = reviewV9UpcomingWorkouts(current, TODAY, { activeDates: ['2026-11-09'] });
  assert.equal(rows.some(row => row.date < TODAY), false);
  const saturday = rows.find(row => row.date === '2026-11-07')!;
  assert.equal(saturday.currentExerciseCount, 5);
  assert.equal(saturday.recommendedExerciseCount, 11);
  assert.equal(saturday.recommendedName, 'Lower B — Full Strength');
  assert.equal(saturday.canKeep, true);
  const active = rows.find(row => row.date === '2026-11-09')!;
  assert.equal(active.disposition, 'active-preserved');
  assert.equal(active.canKeep, false);
  const primer = rows.find(row => row.date === '2026-11-14')!;
  assert.equal(primer.recommendedName, 'Pre-Match Primer');
  assert.deepEqual(current, before);
});

test('only selected future custom drafts are replaced; old preparation refresh and exact active/past edits stay separate', () => {
  const current = fixture(), before = structuredClone(current);
  const result = applyV9UpcomingDraftDecisions(current, TODAY, { replaceDraftKeys: ['2026-11-07:main'], activeDates: ['2026-11-09'] })!;
  assert.equal(result.some(draft => draft.date === '2026-11-07'), false);
  assert.equal(result.some(draft => draft.date === '2026-11-11'), false, 'an obsolete future preparation cache is refreshed by the approved program update');
  assert.deepEqual(result.find(draft => draft.date === '2026-10-31'), current.sessionDrafts![0]);
  assert.deepEqual(result.find(draft => draft.date === '2026-11-09'), current.sessionDrafts![2]);
  assert.deepEqual(result.find(draft => draft.date === '2026-11-10'), current.sessionDrafts![3]);
  assert.deepEqual(current, before);
});

test('a keep decision records exact session approval without rewriting the original exercise prescription', () => {
  const current = fixture();
  const result = applyV9UpcomingDraftDecisions(current, TODAY, { keepDraftKeys: ['2026-11-07:main'] })!;
  const kept = result.find(draft => draft.date === '2026-11-07')!;
  assert.deepEqual(kept.plan, current.sessionDrafts![1].plan);
  assert.deepEqual(kept.reviewedForProgram, { revision: '9', programSessionId: 'v9-lower-b' });
  assert.equal(getV9DraftDisposition(kept, normal()[5]).kind, 'custom');
  assert.equal(getV9DraftDisposition(kept, match()[5]).kind, 'schedule-conflict', 'a later match switch invalidates the opposite Saturday approval');
});

test('invalid, duplicate, conflicting, past or active decisions fail atomically without profile mutation', () => {
  const current = fixture(), before = structuredClone(current);
  const cases = [
    { replaceDraftKeys: ['2026-11-07:main', '2026-11-07:main'] },
    { replaceDraftKeys: ['2026-11-07:main'], keepDraftKeys: ['2026-11-07:main'] },
    { replaceDraftKeys: ['2026-10-31:main'] },
    { replaceDraftKeys: ['2026-11-20:main'] },
    { keepDraftKeys: ['2026-11-09:main'], activeDates: ['2026-11-09'] },
    { replaceDraftKeys: ['2026-11-09:main'], activeDates: ['2026-11-09'] },
  ];
  for (const options of cases) {
    assert.throws(() => applyV9UpcomingDraftDecisions(current, TODAY, options));
    assert.deepEqual(current, before);
  }
  assert.throws(() => reviewV9UpcomingWorkouts(current, TODAY, { activeDates: ['not-a-date'] }), /valid local date/);
});

test('an extra slot removed by V9 stays stored and cannot silently become the main session', () => {
  const current = fixture();
  current.sessionDrafts!.push({ date: '2026-11-12', slot: 'extra', customized: true, plan: structuredClone(current.plan[0]) });
  const row = reviewV9UpcomingWorkouts(current, TODAY).find(row => row.key === '2026-11-12:extra')!;
  assert.equal(row.recommendedName, null);
  assert.equal(row.disposition, 'schedule-conflict');
  assert.equal(row.canKeep, false);
  assert.equal(recommendedV9Workout(current, TODAY, '2026-11-12', 'extra'), undefined);
  assert.throws(() => applyV9UpcomingDraftDecisions(current, TODAY, { keepDraftKeys: [row.key] }), /cannot replace/);
  assert.deepEqual(applyV9UpcomingDraftDecisions(current, TODAY)!.find(draft => draft.date === '2026-11-12'), current.sessionDrafts!.at(-1));
});

test('current V9 preparation caches survive a repeated review while older preparations are refreshed', () => {
  const current = fixture();
  current.plan = normal();
  current.masterMatchWeekend = match().slice(5);
  current.masterProgram = { ...current.masterProgram!, revision: '9', v9EffectiveDate: TODAY };
  current.sessionDrafts = [{ date: '2026-11-07', slot: 'main', customized: false, plan: structuredClone(normal()[5]) }];
  current.sessionDrafts[0].plan.warmup![0].done = true;
  const before = structuredClone(current);
  assert.equal(reviewV9UpcomingWorkouts(current, TODAY)[0].disposition, 'preparation-preserved');
  assert.deepEqual(applyV9UpcomingDraftDecisions(current, TODAY), current.sessionDrafts);
  assert.deepEqual(current, before);
});

test('program settings retain confirmed match dates, leave unknown times unset and never grant guidance', () => {
  const current = fixture();
  current.masterProgram!.matchTimes = [{ week: 2, startTime: '18:00' }];
  current.trainingGuidance = { impact: 'restricted', heavyLifting: 'unknown' };
  const next = v9SettingsForProfile(current, TODAY);
  assert.equal(next.startDate, current.masterProgram!.startDate);
  assert.deepEqual(next.matchWeeks, [2]);
  assert.deepEqual(next.matchTimes, current.masterProgram!.matchTimes);
  assert.deepEqual(next.clearance, current.trainingGuidance);
  const noTime = recommendedV9Workout({ ...current, trainingGuidance: cleared,
    masterProgram: { ...current.masterProgram!, matchTimes: undefined } }, TODAY, '2026-11-15', 'main')!;
  assert.equal(noTime.programSessionId, 'v9-match');
  assert.equal(noTime.startTime, undefined);
  const noConfirmedMatch = recommendedV9Workout({ ...current, trainingGuidance: cleared,
    masterProgram: { ...current.masterProgram!, matchWeeks: [], matchTimes: [{ week: 2, startTime: '18:00' }] } }, TODAY, '2026-11-14', 'main')!;
  assert.equal(noConfirmedMatch.programSessionId, 'v9-lower-b', 'a time entry alone must not confirm a match');
});

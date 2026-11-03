import assert from 'node:assert/strict';
import test from 'node:test';
import { TrainingExposureSchema, getTrainingExposureSummary } from '../src/training-exposure.ts';
import { createReachJumpEntries, JumpEntrySchema, PerformanceDataSchema } from '../src/performance-data.ts';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { ExtraActivitySchema } from '../src/activities.ts';
import { getWeeklyReport } from '../src/weekly-report.ts';
import { getJumpSummaries, getPerformanceSummary, getPersonalRecords, getProgressionRecommendation, getWeightSummary } from '../src/performance-insights.ts';

const date = '2026-11-02';
const weight = (date: string, kg: number) => ({ date, payload: { kind: 'weight', kg, notes: '' } });
const completed = (name: string, kind: 'sport' | 'strength' = 'sport') => {
  const session = SessionSchema.parse(stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []), 'completed'));
  return { ...session, name, kind };
};

test('optional sport observations survive session/activity validation without creating historical defaults', () => {
  const exposure = { sport: 'volleyball' as const, hardJumpContacts: 24, contactSource: 'recorded' as const,
    sessionRpe: 7.5, shoulderSoreness: 'mild' as const, kneeSoreness: 'none' as const, achillesSoreness: 'none' as const };
  assert.deepEqual(SessionSchema.parse({ ...completed('Volleyball'), trainingExposure: exposure }).trainingExposure, exposure);
  assert.equal(SessionSchema.parse(completed('Volleyball')).trainingExposure, undefined);
  const activity = { id: 'pe-load', date, name: 'School PE', type: 'other', durationMinutes: 110, distanceKm: null,
    intensity: 'moderate', bodyWeightKg: 64, watchCalories: null, notes: '', createdAt: Date.now(), deletedAt: null, trainingExposure: { ...exposure, sport: 'pe' } };
  assert.equal(ExtraActivitySchema.parse(activity).trainingExposure?.sport, 'pe');
  assert.equal(TrainingExposureSchema.safeParse({ hardJumpContacts: 1.5 }).success, false);
  assert.equal(TrainingExposureSchema.safeParse({ hardJumpContacts: -1 }).success, false);
  assert.equal(TrainingExposureSchema.safeParse({ sessionRpe: 11 }).success, false);
});

test('recorded gym, volleyball and PE contacts remain separate from estimates and unknown exposure', () => {
  const gym = completed('Approach Power + Upper A', 'strength');
  gym.exercises = [{ ...gym.exercises[0], jumpContactsPerRep: 1, logs: [
    { ...gym.exercises[0].logs[0], done: true, reps: 2 }, { ...gym.exercises[0].logs[0], done: false, reps: 50 },
  ] }];
  const volleyball = { ...completed('Volleyball'), trainingExposure: { hardJumpContacts: 22, contactSource: 'recorded' as const } };
  const estimated = { ...completed('Volleyball Match'), trainingExposure: { hardJumpContacts: 35, contactSource: 'estimate' as const } };
  const unknown = completed('Volleyball');
  const active = { ...completed('Volleyball'), status: 'active', trainingExposure: { hardJumpContacts: 100 } };
  const result = getTrainingExposureSummary({ sessions: [gym, volleyball, volleyball, estimated, unknown, active],
    activities: [{ version: 1, activity: { id: 'pe', date, name: 'School PE', deletedAt: null, trainingExposure: { hardJumpContacts: 8, contactSource: 'recorded' as const } } }],
    startDate: date, endDate: '2026-11-08' });
  assert.deepEqual(result, { completedGymContacts: 2, recordedVolleyballContacts: 22, recordedPeContacts: 8, recordedOtherContacts: 0,
    estimatedSportContacts: 35, unclassifiedSportContacts: 0, volleyballSessions: 3, peSessions: 1, unmeasuredSportSessions: 1, observationCount: 0 });
});

test('a newer deleted activity version cannot revive old recorded contacts', () => {
  const activity = { id: 'pe', date, name: 'School PE', deletedAt: null, trainingExposure: { hardJumpContacts: 10 } };
  const result = getTrainingExposureSummary({ sessions: [], activities: [
    { version: 2, activity: { ...activity, deletedAt: Date.now() } }, { version: 1, activity },
  ], startDate: date, endDate: date });
  assert.equal(result.recordedPeContacts, 0);
  assert.equal(result.peSessions, 0);
});

test('jump test conditions are retained without promoting a video estimate into a measured result', () => {
  const entries = createReachJumpEntries({ date, standingReachCm: 235, standingTouchCm: 310, approachTouchCm: 316,
    conditions: 'Same court and shoes; rested before testing.', notes: 'Three attempts.', source: 'video-estimate' });
  assert.deepEqual(entries.map(entry => entry.cm), [75, 81]);
  assert.ok(entries.every(entry => entry.conditions === 'Same court and shoes; rested before testing.' && entry.source === 'video-estimate'));
  assert.equal(PerformanceDataSchema.parse({ jumps: entries, readiness: [] }).jumps.length, 2);
  assert.equal(JumpEntrySchema.safeParse({ ...entries[0], conditions: 'x'.repeat(301) }).success, false);
});

test('a well-sampled two-week plateau suggests food only; sparse, stale and future records do not', () => {
  const dates = ['2026-10-20', '2026-10-23', '2026-10-25', '2026-10-27', '2026-10-30', '2026-11-02'];
  const records = dates.map(date => weight(date, 64));
  const before = JSON.stringify(records);
  assert.equal(getWeightSummary(records, date).stableTwoWeeks, true);
  assert.match(getWeightSummary(records, date).insight!, /150–200 kcal/);
  assert.equal(JSON.stringify(records), before);
  assert.equal(getWeightSummary(records.slice(1), date).stableTwoWeeks, false);
  assert.equal(getWeightSummary(records, '2026-11-08').stableTwoWeeks, false);
  assert.equal(getWeightSummary(records.concat(weight('2026-11-03', 75)), date).current, 64);
  const gaining = records.map((record, index) => weight(record.date, index < 3 ? 64 : 64.2));
  assert.equal(getWeightSummary(gaining, date).stableTwoWeeks, false);
});

test('weekly reports expose actual contact counts and sampled weight averages without marking the plan completed', () => {
  const volleyball = { ...completed('Volleyball'), trainingExposure: { hardJumpContacts: 18, contactSource: 'recorded' as const } };
  const report = getWeeklyReport({ weekStart: date, sessions: [volleyball], activities: [], plan: DEFAULT_PROFILE.plan,
    nutritionRecords: [weight('2026-10-26', 64), weight('2026-10-28', 64), weight('2026-10-30', 64), weight(date, 64.2), weight('2026-11-04', 64.2), weight('2026-11-06', 64.2)] });
  assert.equal(report.jumpExposure.recordedVolleyballContacts, 18);
  assert.equal(report.jumpExposure.completedGymContacts, 0);
  assert.equal(report.completedPlannedGymDays, 0);
  assert.equal(report.weightTrend.changeKg, 0.2);
});

test('easy preparation alternatives never inherit a heavy overload suggestion from old records', () => {
  const exercise = { ...completed('Upper A', 'strength').exercises[0], preparationOnly: true };
  const result = getProgressionRecommendation(exercise, [], date);
  assert.equal(result.kind, 'quality');
  assert.equal(result.kg, undefined);
  assert.match(result.cue, /unloaded or light rehearsal/);
  const pullup = { ...exercise, preparationOnly: false, name: 'Pull-up / Assisted Pull-up', mode: 'bodyweight' as const, target: '4–6 reps' };
  assert.match(getProgressionRecommendation(pullup, [], date).cue, /6 clean reps/);
});

test('preparation-only logs stay recorded but cannot earn PRs, comparisons or overload eligibility', () => {
  const strength = (day: string, kg: number, preparationOnly = false) => {
    const session = { ...completed('Lower Strength', 'strength'), date: day };
    session.exercises = [{ ...session.exercises[0], key: 'hack', exerciseId: 'hack-squat', name: 'Hack Squat',
      mode: 'weight', target: '4–6 reps', sets: 3, preparationOnly,
      logs: Array.from({ length: 3 }, () => ({ ...session.exercises[0].logs[0], id: crypto.randomUUID(), kg, reps: 6, done: true, rir: 2 })) }];
    return SessionSchema.parse(session);
  };
  const before = strength('2026-10-19', 70);
  const preparation = strength('2026-10-26', 85, true);
  const current = strength('2026-11-02', 72.5);
  const history = [before, preparation, current];
  const raw = JSON.stringify(history);
  const records = getPersonalRecords(history, date);
  assert.equal(records.find(record => record.kind === 'weight')?.value, 72.5);
  assert.equal(records.some(record => record.sessionId === preparation.id), false);
  const summary = getPerformanceSummary({ sessions: history, today: date });
  assert.deepEqual(summary.strengthChanges.map(change => [change.previous, change.current]), [[70, 72.5]]);
  const recommendation = getProgressionRecommendation(before.exercises[0], [before, preparation], date);
  assert.equal(recommendation.previous?.kg, 70);
  assert.notEqual(recommendation.kind, 'load', 'a preparation session cannot satisfy the second earned working session');
  const weekly = getWeeklyReport({ weekStart: date, sessions: [preparation, current], activities: [], plan: DEFAULT_PROFILE.plan });
  assert.deepEqual(weekly.performance, []);
  assert.equal(JSON.stringify(history), raw, 'analysis never rewrites preparation or working logs');
  const preparationJump = { ...preparation, exercises: [{ ...preparation.exercises[0], name: 'Countermovement Jump',
    exerciseId: 'countermovement-jump', mode: 'bodyweight' as const, measurement: 'height' as const,
    logs: preparation.exercises[0].logs.map(log => ({ ...log, measurementCm: 90 })) }] };
  assert.deepEqual(getJumpSummaries([preparationJump], [], date), []);
});

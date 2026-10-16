import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers, estimatedCalories } from '../src/domain.js';
import { createVolleyballMasterPlan, resolveMasterProgramPlan, getMasterProgramWeek, getMasterProgramPhase, MasterProgramSettingsSchema, masterScheduledEvents, masterPlannedMinutes } from '../src/volleyball-master-plan.ts';
import { findComplexPair } from '../src/training-flow.ts';
import { createLocalClient } from '../src/storage.ts';
import { getPersonalRecords, getProgressionRecommendation, getPerformanceSummary } from '../src/performance-insights.ts';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library.ts';

const settings = { version: 1 as const, startDate: '2026-10-19', matchWeeks: [2] };
const exercise = (day: ReturnType<typeof createVolleyballMasterPlan>[number], name: string) => day.exercises.find(item => item.name === name)!;

test('both master weeks validate, keep volleyball twice and leave optional arms and pogos out', () => {
  for (const match of [false, true]) {
    const plan = createVolleyballMasterPlan(match);
    assert.equal(ProfileSchema.safeParse({ ...DEFAULT_PROFILE, plan, masterProgram: settings, preMasterPlan: DEFAULT_PROFILE.plan, masterMatchWeekend: createVolleyballMasterPlan(true).slice(5) }).success, true);
    assert.equal(plan.length, 7);
    assert.equal(plan[1].name, 'Volleyball'); assert.equal(plan[4].name, 'Volleyball');
    assert.equal(plan[1].minutes, 120); assert.equal(plan[4].minutes, 120);
    assert.equal(plan[0].exercises.length, 8); assert.equal(plan[3].exercises.length, 9);
    assert.ok(plan[1].extraSession); assert.equal(plan[1].extraSession.exercises.length, 3);
    assert.ok(!plan[5].exercises.some(item => /Broad Jump/.test(item.name)));
  }
});

test('Wednesday has 14 maximal jumps and one rested, adjacent complex pair', () => {
  const day = createVolleyballMasterPlan()[2];
  assert.equal(exercise(day, 'Approach Jump').sets * 2, 8);
  assert.equal(exercise(day, 'CMJ with Arm Swing').sets * 2, 6);
  assert.equal(exercise(day, 'Approach Jump').measurement, 'touch');
  assert.equal(exercise(day, 'CMJ with Arm Swing').measurement, 'height');
  const session = createSession(day, 2, '2026-10-21', DEFAULT_PROFILE, []);
  const pair = findComplexPair(session.exercises, 'master-hack');
  assert.ok(pair); assert.equal(pair.second.key, 'master-cmj');
  assert.equal(exercise(day, 'Hack Squat').rest, 150); assert.equal(exercise(day, 'CMJ with Arm Swing').rest, 150);
  assert.equal(exercise(day, 'Hack Squat').targetRpe, 8);
});

test('Sunday match replaces only the weekend and never mutates a saved session or base plan', () => {
  const base = createVolleyballMasterPlan(); base[0].exercises[0].sets = 2;
  const active = createSession(base[2], 2, '2026-10-21', DEFAULT_PROFILE, []);
  const snapshot = structuredClone(active), old = structuredClone(base);
  const match = resolveMasterProgramPlan(base, settings, '2026-10-31');
  assert.equal(match[0].exercises[0].sets, 2);
  assert.equal(match[5].name, 'Pre-Match Primer'); assert.equal(match[6].name, 'Match');
  assert.equal(exercise(match[5], 'Approach Jump').sets, 3);
  assert.equal(exercise(match[5], 'Approach Jump').target, '1 rep');
  assert.ok(!match[5].exercises.some(item => /Hack|Leg Press|Drop Jump/.test(item.name)));
  assert.deepEqual(base, old); assert.deepEqual(active, snapshot);
  assert.equal(resolveMasterProgramPlan(base, settings, '2026-10-24')[5].name, 'Reactive + Hard Lower B');
});

test('week four deloads exact jump doses and week eight peaks without raising box height', () => {
  const base = createVolleyballMasterPlan();
  const four = resolveMasterProgramPlan(base, settings, '2026-11-11');
  assert.equal(exercise(four[2], 'Approach Jump').sets, 3);
  assert.equal(exercise(four[2], 'CMJ with Arm Swing').sets, 2);
  assert.equal(exercise(four[5], 'Approach Jump').sets, 2);
  assert.equal(exercise(four[5], 'Drop Jump').sets, 2);
  assert.equal(exercise(four[2], 'Hack Squat').sets, 2);
  const eight = resolveMasterProgramPlan(base, settings, '2026-12-09');
  assert.equal(exercise(eight[2], 'Approach Jump').sets, 2);
  assert.equal(exercise(eight[2], 'Hack Squat').sets, 2);
  assert.equal(eight[0].exercises.length, base[0].exercises.length);
  assert.equal(exercise(eight[5], 'Drop Jump').cue, exercise(base[5], 'Drop Jump').cue);
  assert.ok(!eight[5].exercises.some(item => /Hurdle/.test(item.name)));
});

test('readiness is date-specific, reduces jumping and removes maximal work for red', () => {
  const base = createVolleyballMasterPlan();
  const yellow = resolveMasterProgramPlan(base, { ...settings, readiness: [{ date: '2026-10-24', status: 'yellow' }] }, '2026-10-24');
  assert.equal(exercise(yellow[5], 'Approach Jump').sets, 2);
  assert.equal(exercise(yellow[5], 'Drop Jump').sets, 2);
  assert.ok(!yellow[5].exercises.some(item => /Hurdle/.test(item.name)));
  assert.equal(exercise(yellow[5], 'Leg Press').sets, 3);
  assert.equal(yellow[2].exercises.length, base[2].exercises.length);
  const red = resolveMasterProgramPlan(base, { ...settings, readiness: [{ date: '2026-10-24', status: 'red' }] }, '2026-10-24');
  assert.equal(red[5].kind, 'recovery'); assert.equal(red[5].exercises.length, 0);
  assert.equal(resolveMasterProgramPlan(base, { ...settings, readiness: [{ date: '2026-10-24', status: 'green' }] }, '2026-10-24')[5].exercises.length, base[5].exercises.length);
});

test('a red Tuesday check also removes jumping from the separate technique primer', () => {
  const plan = resolveMasterProgramPlan(createVolleyballMasterPlan(), { ...settings, readiness: [{ date: '2026-10-20', status: 'red' }] }, '2026-10-20');
  assert.equal(plan[1].name, 'Volleyball');
  assert.equal(plan[1].extraSession!.kind, 'recovery');
  assert.equal(plan[1].extraSession!.exercises.length, 0);
});

test('custom match weekends remain distinct from the saved non-match base', () => {
  const base = createVolleyballMasterPlan(); base[5].exercises[3].sets = 2;
  const weekend = createVolleyballMasterPlan(true).slice(5); weekend[0].exercises[2].sets = 1;
  const resolved = resolveMasterProgramPlan(base, settings, '2026-10-31', weekend);
  assert.equal(resolved[5].exercises[2].sets, 1);
  assert.equal(resolveMasterProgramPlan(base, settings, '2026-10-24', weekend)[5].exercises[3].sets, 2);
  assert.equal(base[5].exercises[2].name, 'Hurdle Hops');
});

test('calendar weeks cross DST, reject invalid settings and do not repeat after eight weeks', () => {
  assert.equal(getMasterProgramWeek(settings.startDate, '2026-10-18'), null);
  assert.equal(getMasterProgramWeek(settings.startDate, '2026-10-25'), 1);
  assert.equal(getMasterProgramWeek(settings.startDate, '2026-10-26'), 2);
  assert.equal(getMasterProgramWeek(settings.startDate, '2026-12-13'), 8);
  assert.equal(getMasterProgramWeek(settings.startDate, '2026-12-14'), null);
  assert.deepEqual([1, 4, 5, 8].map(getMasterProgramPhase), ['Build 1', 'Deload', 'Build 2', 'Peak / retest']);
  for (const invalid of [{ ...settings, startDate: '2026-10-20' }, { ...settings, matchWeeks: [1, 1] }, { ...settings, matchWeeks: [9] }, { ...settings, startDate: '2026-02-30' }]) assert.equal(MasterProgramSettingsSchema.safeParse(invalid).success, false);
});

test('easy running and PE are scheduled cues, never invented completed activities', () => {
  assert.equal(masterScheduledEvents(settings, '2026-10-22')[0].name, 'Easy 5 km');
  assert.match(masterScheduledEvents(settings, '2026-10-23')[0].detail, /2 h/);
  assert.deepEqual(masterScheduledEvents(settings, '2026-10-24'), []);
  assert.deepEqual(masterScheduledEvents(settings, '2026-10-15'), []);
});

test('PE fueling time counts the scheduled load without counting a recorded PE extra twice', () => {
  assert.equal(masterPlannedMinutes(settings, '2026-10-23', 120, []), 240);
  const extras = [{ name: 'School PE', durationMinutes: 120 }];
  assert.equal(masterPlannedMinutes(settings, '2026-10-23', 120, extras) + 120, 240);
  assert.equal(masterPlannedMinutes(settings, '2026-10-23', 120, [{ name: 'Hochsprung', durationMinutes: 60 }]) + 60, 240);
  assert.equal(masterPlannedMinutes(settings, '2026-10-22', 80, extras), 80);
});

test('optional work is explicit and base plans stay unchanged', () => {
  const base = createVolleyballMasterPlan();
  const plan = resolveMasterProgramPlan(base, { ...settings, optional: { mondayArms: true, thursdayArms: true, tuesdayPogos: true } }, '2026-10-19');
  assert.equal(plan[0].exercises.length, 10); assert.equal(plan[3].exercises.length, 11);
  assert.equal(plan[1].extraSession!.exercises[2].name, 'Pogo Jump');
  assert.equal(base[0].exercises.length, 8);
});

test('carry metres persist without generating rep volume, strength PRs or load progression', () => {
  const carry = exercise(createVolleyballMasterPlan()[2], 'Suitcase Carry');
  assert.equal(toPlanExercise(findLibraryExercise('Suitcase Carry')!).quantityUnit, 'm');
  const session = SessionSchema.parse(stopSessionTimers(createSession({ ...createVolleyballMasterPlan()[2], exercises: [carry] }, 2, '2026-10-21', DEFAULT_PROFILE, []), 'completed'));
  session.exercises[0].logs[0] = { ...session.exercises[0].logs[0], done: true, kg: 20, reps: 25 };
  assert.equal(SessionSchema.parse(session).exercises[0].quantityUnit, 'm');
  assert.equal(estimatedCalories(session.exercises), 0);
  assert.deepEqual(getPersonalRecords([session], '2026-10-22'), []);
  assert.equal(getProgressionRecommendation(carry, [session], '2026-10-22').kind, 'quality');
  assert.equal(getPerformanceSummary({ sessions: [session], activities: [], plan: createVolleyballMasterPlan(), today: '2026-10-22' }).weeklyVolumeKg, 0);
  const assisted = { ...carry, quantityUnit: undefined, name: 'Assisted Pull-up' };
  assert.equal(getProgressionRecommendation(assisted, [], '2026-10-22').kind, 'quality');
});

test('primer and yellow-day lifting cannot suggest extra load after strong historical sets', () => {
  const row = exercise(createVolleyballMasterPlan(true)[5], 'Chest-Supported Row');
  const history = ['2026-10-19', '2026-10-22'].map(date => {
    const session = SessionSchema.parse(stopSessionTimers(createSession({ ...createVolleyballMasterPlan()[0], exercises: [row] }, 0, date, DEFAULT_PROFILE, []), 'completed'));
    session.exercises[0].logs.forEach(log => Object.assign(log, { done: true, kg: 60, reps: 10, rir: 3 }));
    return session;
  });
  assert.equal(getProgressionRecommendation(row, history, '2026-10-24').kind, 'quality');
  assert.equal(getProgressionRecommendation({ ...row, targetRpe: undefined }, history, '2026-10-24', { lowFatigueSession: true }).kg, undefined);
});

test('legacy profiles and full backups preserve the old plan, master configuration and session snapshots', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const client = createLocalClient(storage);
  const before = await client.request('/api/tracker');
  const beforeProfile = ProfileSchema.parse(before.profile);
  assert.equal(beforeProfile.masterProgram, undefined);
  const profile = ProfileSchema.parse({ ...beforeProfile, plan: createVolleyballMasterPlan(), preMasterPlan: beforeProfile.plan, masterMatchWeekend: createVolleyballMasterPlan(true).slice(5), masterProgram: settings });
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 });
  const after = await client.request('/api/tracker');
  const afterProfile = ProfileSchema.parse(after.profile);
  assert.deepEqual(afterProfile.preMasterPlan, beforeProfile.plan);
  assert.deepEqual(afterProfile.masterProgram, settings);
  const exported = client.exportBackup();
  client.importBackup(exported);
  assert.deepEqual((await client.request('/api/tracker')).profile, after.profile);
  const invalid = JSON.parse(exported);
  invalid.data.profile.masterProgram.matchWeeks = [9];
  assert.throws(() => client.importBackup(JSON.stringify(invalid)), /training plan/i);
  assert.deepEqual((await client.request('/api/tracker')).profile, after.profile);
});

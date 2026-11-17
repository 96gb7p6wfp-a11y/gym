import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { createRecommendedMasterPlan, createVolleyballMasterPlan, createV81VolleyballMasterPlan,
  resolveMasterProgramPlan, type MasterProgramSettings } from '../src/volleyball-master-plan.ts';
import type { PlanDay } from '../src/workout-customization';

const cleared = { impact: 'cleared' as const, heavyLifting: 'cleared' as const };
const count = (day: PlanDay) => day.exercises.filter(exercise => !exercise.optionalWork).reduce((sum, exercise) => sum + exercise.sets, 0);
const original = { originalPrescription: true };
function settings(revision?: MasterProgramSettings['revision']): MasterProgramSettings {
  return { version: 1, revision, startDate: '2026-11-02', matchWeeks: [], clearance: cleared };
}

for (const [revision, build, fullSets] of [
  ['13.1', createVolleyballMasterPlan, 20],
  ['8.1', createV81VolleyballMasterPlan, 24],
] as const) {
  test(`${revision}: original working dose survives Week4/8 and stale readiness without changing default recommendations`, () => {
    const base = build();
    const config = { ...settings(revision), readiness: [{ date: '2026-11-25', status: 'red' as const }] };
    const before = structuredClone({ base, config });
    const scheduled = resolveMasterProgramPlan(base, config, '2026-11-25');
    assert.equal(scheduled[2].kind, 'recovery');
    const normalFour = resolveMasterProgramPlan(base, settings(revision), '2026-11-25');
    assert.equal(count(normalFour[2]), 14);
    const selected = resolveMasterProgramPlan(base, config, '2026-11-25', undefined, original);
    assert.equal(selected[2].kind, 'strength');
    assert.equal(count(selected[2]), fullSets);
    assert.deepEqual(selected[2].exercises, base[2].exercises);
    const eight = resolveMasterProgramPlan(base, config, '2026-12-23', undefined, original);
    assert.deepEqual(eight[2].exercises, base[2].exercises);
    assert.deepEqual(resolveMasterProgramPlan(base, config, '2026-11-25', undefined, { originalPrescription: false }), scheduled);
    assert.deepEqual({ base, config }, before);
  });
}

test('legacy original keeps confirmed match scheduling, unknown match time and explicit moved sessions', () => {
  const base = createVolleyballMasterPlan();
  const config = { ...settings('13.1'), matchWeeks: [4], readiness: [{ date: '2026-11-28', status: 'red' as const }] };
  const weekend = createVolleyballMasterPlan(true).slice(5);
  const plan = resolveMasterProgramPlan(base, config, '2026-11-28', weekend, original);
  assert.equal(plan[5].name, weekend[0].name);
  assert.deepEqual(plan[5].exercises, weekend[0].exercises);
  assert.equal(plan[6].kind, 'sport');
  assert.equal(plan[6].startTime, undefined);
  assert.equal(plan[0].exercises.some(exercise => exercise.key === 'master-hurdle'), false);
  assert.ok(plan[0].exercises.find(exercise => exercise.key === 'master-approach')!.sets <= 3);
  const moved = resolveMasterProgramPlan(base, { ...settings('13.1'), rescheduledLowerDates: ['2026-11-28'] },
    '2026-11-28', undefined, original);
  assert.equal(moved[5].kind, 'recovery');
  assert.deepEqual(moved[6].exercises, base[5].exercises);
});

test('original resolution retains previous-match safeguards and deliberately enabled optional work', () => {
  const v131 = createVolleyballMasterPlan();
  const afterMatch = resolveMasterProgramPlan(v131, { ...settings('13.1'), matchWeeks: [3] }, '2026-11-23', undefined, original);
  assert.equal(afterMatch[0].exercises.some(exercise => exercise.key === 'master-approach' || exercise.key === 'master-hurdle'), false);
  const v81 = createV81VolleyballMasterPlan();
  const config = { ...settings('8.1'), optional: { mondayArms: false, thursdayArms: true, tuesdayPogos: false } };
  const enabled = resolveMasterProgramPlan(v81, config, '2026-11-25', undefined, original);
  assert.equal(enabled[3].exercises.find(exercise => exercise.key === 'master-hammer')!.optionalWork, false);
  assert.equal(enabled[3].exercises.find(exercise => exercise.key === 'master-pushdown')!.optionalWork, false);
});

test('legacy original is still constrained by unconfirmed heavy-lifting and restricted impact guidance', () => {
  for (const revision of ['13.1', '8.1'] as const) {
    const base = revision === '13.1' ? createVolleyballMasterPlan() : createV81VolleyballMasterPlan();
    const config = { ...settings(revision), clearance: { impact: 'restricted' as const, heavyLifting: 'unknown' as const } };
    const before = structuredClone(config);
    const plan = resolveMasterProgramPlan(base, config, '2026-11-25', undefined, original);
    assert.ok(plan[2].exercises.length > 0);
    assert.equal(plan[2].exercises.some(exercise => exercise.jumpContactsPerRep), false);
    assert.ok(plan[2].exercises.every(exercise => exercise.preparationOnly && exercise.sets <= 2 && exercise.defaultKg === 0));
    assert.deepEqual(config, before);
  }
});

test('unversioned original preserves enabled accessories and leaves default compatibility resolution intact', () => {
  const config = { ...settings(), optional: { mondayArms: true, thursdayArms: true, tuesdayPogos: true } };
  const base = createRecommendedMasterPlan(config);
  const before = structuredClone(base);
  const defaultPlan = resolveMasterProgramPlan(base, config, '2026-11-25');
  const selected = resolveMasterProgramPlan(base, config, '2026-11-25', undefined, original);
  assert.ok(count(selected[2]) > count(defaultPlan[2]));
  assert.equal(selected[0].exercises.length, base[0].exercises.length + 2);
  assert.ok(selected[1].extraSession!.exercises.some(exercise => /Pogo/.test(exercise.name)));
  assert.deepEqual(base, before);
  assert.deepEqual(defaultPlan, resolveMasterProgramPlan(base, config, '2026-11-25', undefined, {}));
});

test('V9 original keeps date-specific match routing and clearance while omitting accepted optional phase/readiness reductions', () => {
  const base = createV9VolleyballMasterPlan();
  const config = { ...settings('9'), calendarMatches: [], trainingPhases: [
    { startDate: '2026-11-23', endDate: '2026-11-29', phase: 'deload' as const },
  ], dailyReadiness: [{ date: '2026-11-28', feeling: 'poor' as const }] };
  const unchanged = structuredClone({ base, config });
  const selected = resolveMasterProgramPlan(base, config, '2026-11-28', undefined, original);
  assert.equal(selected[5].exercises.length, 11);
  assert.equal(count(selected[5]), 29);
  assert.equal(resolveMasterProgramPlan(base, config, '2026-11-28')[5].kind, 'recovery');
  const match = resolveMasterProgramPlan(base, { ...config, calendarMatches: [{ date: '2026-11-29', scheduled: true }] },
    '2026-11-28', undefined, original);
  assert.equal(match[5].programSessionId, 'v9-match-primer');
  assert.equal(match[6].programSessionId, 'v9-match');
  assert.equal(match[6].startTime, undefined);
  const restricted = resolveMasterProgramPlan(base, { ...config, clearance: { impact: 'restricted', heavyLifting: 'unknown' } },
    '2026-11-28', undefined, original);
  assert.ok(restricted[5].exercises.every(exercise => exercise.preparationOnly && exercise.sets <= 2));
  assert.deepEqual({ base, config }, unchanged);
});

test('original resolution never mutates saved active or completed snapshots or deliberately edited loads', () => {
  const base = createVolleyballMasterPlan();
  base[2].exercises.find(exercise => exercise.name === 'Hack Squat')!.defaultKg = 72.5;
  const active = createSession(base[2], 2, '2026-11-18', DEFAULT_PROFILE, []);
  const history = stopSessionTimers(structuredClone(active), 'completed');
  const before = structuredClone({ base, active, history });
  const selected = resolveMasterProgramPlan(base, settings('13.1'), '2026-11-25', undefined, original);
  assert.equal(selected[2].exercises.find(exercise => exercise.name === 'Hack Squat')!.defaultKg, 72.5);
  assert.deepEqual({ base, active, history }, before);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, previousExercise, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise } from '../src/exercise-library.ts';
import { findComplexPair } from '../src/training-flow.ts';
import { isGymTraining } from '../src/training-classification.ts';
import {
  MasterProgramSettingsSchema, applyMasterClearance, applyMasterReadiness,
  createRecommendedMasterPlan, createV81VolleyballMasterPlan, createVolleyballMasterPlan,
  getMasterProgramWeek, isMasterReadinessRequired, masterJumpContacts,
  masterScheduledEvents, masterPlannedMinutes, resolveMasterProgramPlan, type MasterProgramSettings,
} from '../src/volleyball-master-plan.ts';

const settings: MasterProgramSettings = {
  version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [],
  clearance: { impact: 'cleared', heavyLifting: 'cleared' },
};
const base = () => createVolleyballMasterPlan();
const resolve = (date = '2026-11-02', changes: Partial<MasterProgramSettings> = {}) =>
  resolveMasterProgramPlan(base(), { ...settings, ...changes }, date);
const totalContacts = (plan: ReturnType<typeof base>) => plan.reduce((sum, day) => sum + masterJumpContacts(day).planned, 0);
const movement = (day: ReturnType<typeof base>[number], key: string) => day.exercises.find(item => item.key === `master-${key}`)!;

test('V13.1 is the new factory while V8.1 and unversioned recommendations remain distinct and readable', () => {
  assert.equal(base()[0].name, 'Approach Power + Upper A');
  assert.ok(base().every(day => day.programRevision === '13.1'));
  const old = createRecommendedMasterPlan({ ...settings, revision: '8.1' });
  assert.deepEqual(old, createV81VolleyballMasterPlan());
  assert.equal(old[5].kind, 'recovery'); assert.equal(old[6].name, 'Heavy Lower B');
  const legacy = createRecommendedMasterPlan({ version: 1, startDate: settings.startDate, matchWeeks: [] });
  assert.equal(legacy[5].name, 'Reactive + Hard Lower B');
  for (const plan of [base(), old, legacy]) assert.ok(ProfileSchema.safeParse({ ...DEFAULT_PROFILE, plan }).success);
});

test('Monday has the prescribed strength, hypertrophy and jump work without default trap-bar jumping', () => {
  const day = base()[0];
  assert.deepEqual(day.exercises.map(item => [item.key, item.sets, item.target, item.rest]), [
    ['master-approach', 4, '2 reps', 150], ['master-hurdle', 2, '3 reps', 120],
    ['master-spike', 4, '3 reps', 90], ['master-pullup', 4, '4–6 reps', 150],
    ['master-incline-a', 4, '6–8 reps', 150], ['master-row-a', 4, '8–10 reps', 120],
    ['master-lateral', 3, '12–20 reps', 60], ['master-curl', 2, '8–12 reps', 60],
    ['master-pushdown', 2, '10–15 reps', 60], ['master-crunch', 2, '10–15 reps', 60],
  ]);
  assert.equal(day.durationRange, '80–95 min');
  assert.equal(masterJumpContacts(day).planned, 14);
  assert.ok(!base().some(day => day.exercises.some(item => /trap.bar jump/i.test(item.name))));
});

test('Wednesday contains seven separately ordered movements and no V8 strength–power complex', () => {
  const day = base()[2];
  assert.deepEqual(day.exercises.map(item => [item.key, item.sets, item.rest]), [
    ['master-cmj', 3, 150], ['master-hack', 4, 210], ['master-rdl', 3, 180],
    ['master-bulgarian-a', 3, 120], ['master-soleus', 3, 90],
    ['master-calf-isometric', 2, 60], ['master-pallof', 2, 45],
  ]);
  assert.equal(findComplexPair(createSession(day, 2, '2026-11-04', DEFAULT_PROFILE, []).exercises, 'master-hack'), null);
  assert.equal(masterJumpContacts(day).planned, 6);
  assert.ok(!day.exercises.some(item => /drop|depth|hurdle|loaded jump/i.test(item.name)));
  assert.equal(movement(day, 'pallof').target, '25 sec');
  assert.equal(movement(day, 'pallof').mode, 'timed');
  assert.equal(movement(day, 'calf-isometric').target, '30–45 sec');
});

test('Thursday preserves the exact ten-exercise order and meaningful chest/arm work', () => {
  const day = base()[3];
  assert.deepEqual(day.exercises.map(item => [item.key, item.sets, item.rest]), [
    ['master-rotation', 3, 90], ['master-landmine', 3, 120], ['master-pulldown', 3, 120],
    ['master-flat-press', 3, 120], ['master-fly', 3, 75], ['master-rear', 3, 75],
    ['master-lateral', 2, 60], ['master-incline-curl', 3, 60], ['master-rope-extension', 3, 60],
    ['master-rotation-cuff', 2, 45],
  ]);
  assert.equal(day.exercises.filter(item => item.optionalWork).length, 0);
  assert.equal(movement(day, 'rear').superset?.rounds, 2);
  assert.equal(movement(day, 'rear').superset?.order, 2);
  assert.equal(movement(day, 'lateral').superset?.order, 1);
  assert.equal(movement(day, 'incline-curl').superset?.rounds, 3);
  assert.equal(movement(day, 'rope-extension').superset?.restAfterRound, 75);
});

test('non-match Saturday is Lower B and Sunday is recovery with four substantial gym days', () => {
  const plan = resolve();
  assert.equal(plan[5].name, 'Lower Strength B'); assert.equal(plan[6].name, 'Recovery');
  assert.equal(plan[5].durationRange, '45–55 min');
  assert.deepEqual(plan[5].exercises.map(item => [item.key, item.sets]), [
    ['master-hip-thrust', 3], ['master-step-up', 2], ['master-leg-curl', 3],
    ['master-split-isometric', 2], ['master-calf', 3],
  ]);
  assert.equal(plan.filter(isGymTraining).length, 4);
  assert.equal(totalContacts(plan), 20);
});

test('match weekend is optional non-impact preparation plus competition, with no fixed invented match time', () => {
  const plan = resolve('2026-11-09', { matchWeeks: [2] });
  assert.equal(plan[5].name, 'Pre-Match Primer or Rest');
  assert.equal(plan[5].durationRange, '10–15 min · optional');
  assert.equal(plan[6].name, 'Volleyball Match'); assert.equal(plan[6].startTime, undefined);
  assert.equal(masterJumpContacts(plan[5]).planned, 0);
  assert.ok(!plan[5].exercises.some(item => /jump|deadlift|squat|press/i.test(item.name)));
  assert.equal(plan.filter(isGymTraining).length, 3);
  assert.equal(totalContacts(plan), 12);
  assert.equal(movement(plan[0], 'approach').sets, 3);
  assert.equal(movement(plan[0], 'hurdle'), undefined);
});

test('Sunday match start remains editable and Monday after competition omits maximal jumping', () => {
  const match = resolve('2026-11-09', { matchWeeks: [2], matchTimes: [{ week: 2, startTime: '14:30' }] });
  assert.equal(match[6].startTime, '14:30');
  const following = resolve('2026-11-16', { matchWeeks: [2] });
  assert.equal(masterJumpContacts(following[0]).planned, 0);
  assert.equal(following[0].exercises.filter(item => /master-(pullup|incline-a|row-a)/.test(item.key)).length, 3);
  assert.equal(totalContacts(following), 6);
  assert.equal(masterJumpContacts(resolve('2026-11-02', { previousSundayMatch: true })[0]).planned, 0);
});

test('an explicit Saturday-to-Sunday move transfers one session without duplicate work or changing templates', () => {
  const original = base(); const snapshot = structuredClone(original);
  const moved = resolveMasterProgramPlan(original, { ...settings, rescheduledLowerDates: ['2026-11-07'] }, '2026-11-07');
  assert.equal(moved[5].kind, 'recovery'); assert.equal(moved[6].name, 'Lower Strength B');
  assert.deepEqual(moved[6].exercises, original[5].exercises);
  assert.equal(moved.filter(isGymTraining).length, 4);
  assert.deepEqual(original, snapshot);
  assert.equal(resolve('2026-11-14', { rescheduledLowerDates: ['2026-11-07'] })[5].name, 'Lower Strength B');
});

test('competition overrides a previously moved lower session and no Saturday lower work returns', () => {
  const plan = resolve('2026-11-07', { matchWeeks: [1], rescheduledLowerDates: ['2026-11-07'] });
  assert.equal(plan[5].name, 'Pre-Match Primer or Rest'); assert.equal(plan[6].name, 'Volleyball Match');
  assert.ok(!plan.some(day => day.name === 'Lower Strength B'));
});

test('readiness checks follow Monday, Wednesday and the actual lower-B day rather than Sunday by default', () => {
  const plan = resolve();
  for (const [date, index] of [['2026-11-02', 0], ['2026-11-04', 2], ['2026-11-07', 5]] as const)
    assert.equal(isMasterReadinessRequired(settings, date, plan[index]), true);
  assert.equal(isMasterReadinessRequired(settings, '2026-11-08', plan[6]), false);
  const movedSettings = { ...settings, rescheduledLowerDates: ['2026-11-07'] };
  const moved = resolve('2026-11-07', movedSettings);
  assert.equal(isMasterReadinessRequired(movedSettings, '2026-11-07', moved[5]), false);
  assert.equal(isMasterReadinessRequired(movedSettings, '2026-11-08', moved[6]), true);
  const matchSettings = { ...settings, matchWeeks: [1] };
  assert.equal(isMasterReadinessRequired(matchSettings, '2026-11-07', resolve('2026-11-07', matchSettings)[5]), false);
});

test('yellow omits supplementary explosive work and reduces demanding sets without changing another day', () => {
  const original = base(); const snapshot = structuredClone(original);
  const plan = resolveMasterProgramPlan(original, { ...settings, readiness: [{ date: '2026-11-02', status: 'yellow' }] }, '2026-11-02');
  assert.equal(masterJumpContacts(plan[0]).planned, 0);
  assert.ok(!plan[0].exercises.some(item => item.key === 'master-spike'));
  assert.equal(movement(plan[0], 'pullup').sets, 3);
  assert.ok(plan[0].exercises.every(item => (item.targetRpe ?? 7) <= 7));
  assert.deepEqual(plan[2], original[2]); assert.deepEqual(original, snapshot);
  const saturday = resolve('2026-11-07', { readiness: [{ date: '2026-11-07', status: 'yellow' }] });
  assert.equal(movement(saturday[5], 'hip-thrust').sets, 2);
});

test('red gives recovery for the relevant session without rewriting completed or active snapshots', () => {
  const original = base(); const active = createSession(original[2], 2, '2026-11-04', DEFAULT_PROFILE, []);
  const snapshot = structuredClone(active);
  const plan = resolve('2026-11-04', { readiness: [{ date: '2026-11-04', status: 'red' }] });
  assert.equal(plan[2].kind, 'recovery'); assert.equal(plan[2].exercises.length, 0);
  assert.deepEqual(active, snapshot);
  assert.match(plan[2].note, /persistent|worsening/i);
});

test('week four reduces approximately one third of working sets and half extra contacts on the new weekdays', () => {
  const regular = resolve(); const deload = resolve('2026-11-23');
  assert.equal(totalContacts(deload), 10);
  for (const index of [0, 2, 3, 5]) {
    const strengthSets = (plan: ReturnType<typeof base>) => plan[index].exercises.filter(item => !item.jumpContactsPerRep).reduce((sum, item) => sum + item.sets, 0);
    const ratio = strengthSets(deload) / strengthSets(regular);
    assert.ok(ratio >= 0.55 && ratio <= 0.75, `day ${index} reduction ${ratio}`);
  }
  assert.equal(deload[6].kind, 'recovery');
  assert.ok(movement(deload[3], 'rear').sets > movement(deload[3], 'lateral').superset!.rounds!);
});

test('week eight fresh tests replace normal jumping, with no supplementary full-volume block', () => {
  const plan = resolve('2026-12-21');
  assert.equal(getMasterProgramWeek(settings.startDate, '2026-12-21'), 8);
  assert.equal(totalContacts(plan), 4);
  assert.equal(movement(plan[0], 'hurdle'), undefined);
  assert.equal(movement(plan[0], 'approach').target, '1 rep');
  assert.equal(movement(plan[2], 'cmj').target, '1 rep');
  assert.equal(movement(plan[2], 'hack').sets, 2);
  assert.ok(!plan[2].exercises.some(item => /complex/i.test(item.group)));
});

test('unknown clearance resolves to easy alternatives without deleting the approved base prescription', () => {
  const original = base(); const snapshot = structuredClone(original);
  const plan = resolveMasterProgramPlan(original, { ...settings, clearance: undefined }, settings.startDate);
  assert.equal(totalContacts(plan), 0);
  assert.ok(!plan.some(day => day.exercises.some(item => ['master-spike', 'master-rotation'].includes(item.key))));
  assert.equal(plan[0].exercises[0].name, 'Controlled Approach Footwork');
  assert.ok(plan.filter(day => day.kind === 'strength').every(day => day.exercises.every(item => item.preparationOnly && (item.targetRpe ?? 5) <= 5)));
  assert.match(plan[0].note, /not confirmed/);
  assert.deepEqual(original, snapshot);
});

test('clearance for impact and heavy lifting is independent and restrictions never turn into automatic approval', () => {
  const noImpact = applyMasterClearance(base()[0], { impact: 'restricted', heavyLifting: 'cleared' });
  assert.equal(masterJumpContacts(noImpact).planned, 0);
  assert.equal(movement(noImpact, 'pullup').sets, 4);
  const easyLifting = applyMasterClearance(base()[0], { impact: 'cleared', heavyLifting: 'unknown' });
  assert.equal(masterJumpContacts(easyLifting).planned, 14);
  assert.equal(movement(easyLifting, 'pullup').preparationOnly, true);
  const ready = applyMasterReadiness(base()[0], 'green');
  assert.equal(masterJumpContacts(applyMasterClearance(ready)).planned, 0);
});

test('preparation alternatives never refill old heavy loads from historical performance', () => {
  const original = base()[2];
  const old = SessionSchema.parse(createSession(original, 2, '2026-10-28', DEFAULT_PROFILE, []));
  old.status = 'completed';
  for (const log of old.exercises.find(item => item.key === 'master-hack')!.logs) Object.assign(log, { done: true, kg: 150, reps: 6 });
  const easy = applyMasterClearance(original);
  const session = SessionSchema.parse(createSession(easy, 2, '2026-11-04', DEFAULT_PROFILE, [old]));
  assert.ok(session.exercises.find(item => item.key === 'master-hack')!.logs.every(log => log.kg === 0));
});

test('impact clearance does not approve externally loaded jumping or refill added load', () => {
  const day = base()[0];
  const trap = { ...movement(day, 'approach'), key: 'custom-trap-jump', name: 'Trap Bar Jump',
    exerciseId: 'trap-bar-jump', mode: 'weight' as const, defaultKg: 40 };
  for (const heavyLifting of ['unknown', 'restricted'] as const) {
    const safe = applyMasterClearance({ ...day, exercises: [trap] }, { impact: 'cleared', heavyLifting });
    assert.ok(!safe.exercises.some(item => item.name === 'Trap Bar Jump'));
    assert.equal(safe.exercises[0].preparationOnly, true);
    const unloaded = applyMasterClearance(day, { impact: 'cleared', heavyLifting });
    assert.ok(!unloaded.exercises.some(item => /slam/i.test(item.name)));
    assert.equal(masterJumpContacts(unloaded).planned, 14);
    const old = SessionSchema.parse(stopSessionTimers(createSession(day, 0, '2026-10-26', DEFAULT_PROFILE, []), 'completed'));
    old.exercises[0].logs.forEach(log => Object.assign(log, { done: true, reps: 2, kg: 20 }));
    const session = SessionSchema.parse(createSession(unloaded, 0, '2026-11-02', DEFAULT_PROFILE, [old]));
    assert.ok(session.exercises[0].logs.every(log => log.kg === 0));
  }
});

test('cleared working sessions use the last working load instead of newer preparation logs', () => {
  const day = base()[2];
  const working = SessionSchema.parse(stopSessionTimers(createSession(day, 2, '2026-10-21', DEFAULT_PROFILE, []), 'completed'));
  const hack = working.exercises.find(item => item.key === 'master-hack')!;
  hack.logs.forEach(log => Object.assign(log, { done: true, reps: 6, kg: 70 }));
  const preparation = SessionSchema.parse(stopSessionTimers(createSession(applyMasterClearance(day), 2, '2026-10-28', DEFAULT_PROFILE, []), 'completed'));
  preparation.exercises.find(item => item.key === 'master-hack')!.logs.forEach(log => Object.assign(log, { done: true, reps: 6, kg: 0 }));
  const history = [working, preparation];
  assert.equal(previousExercise(history, hack.exerciseId ?? hack.key, '2026-11-04')!.session.id, working.id);
  const current = SessionSchema.parse(createSession(day, 2, '2026-11-04', DEFAULT_PROFILE, history));
  assert.ok(current.exercises.find(item => item.key === 'master-hack')!.logs.every(log => log.kg === 70));
});

test('structured PE records reduce remaining planned PE time without relying on activity names', () => {
  assert.equal(masterPlannedMinutes(settings, '2026-11-06', 120, [
    { name: 'Friday class', durationMinutes: 90, trainingExposure: { sport: 'pe' } },
  ]), 150);
});

test('clearance and yellow readiness cover custom library plyometrics beyond the recommended exercise keys', () => {
  const custom = { ...base()[0], name: 'My jump session', exercises: [{
    ...movement(base()[0], 'approach'), key: 'my-box-jump', name: 'Box Jump', exerciseId: 'box-jump', jumpContactsPerRep: undefined,
  }] };
  const resolved = applyMasterClearance(custom);
  assert.ok(!resolved.exercises.some(item => item.name === 'Box Jump'));
  assert.equal(resolved.exercises[0].name, 'Easy Dynamic Movement');
  assert.equal(resolved.exercises[0].preparationOnly, true);
  assert.ok(!applyMasterReadiness(custom, 'yellow').exercises.some(item => item.name === 'Box Jump'));
});

test('every main prescription and safe alternative has a real canonical library identity', () => {
  const days = [...base(), ...createVolleyballMasterPlan(true), ...resolve(settings.startDate, { clearance: undefined })];
  for (const day of days) for (const item of [...day.exercises, ...(day.extraSession?.exercises ?? [])]) {
    assert.ok(item.exerciseId, item.name);
    assert.equal(findLibraryExercise(item.exerciseId!)?.id, item.exerciseId, `${item.name}: ${item.exerciseId}`);
    assert.ok(item.benefit?.trim(), item.name);
  }
});

test('a saved recurring gym replacement cannot displace a V13.1 Sunday match', () => {
  const weekend = createVolleyballMasterPlan(true).slice(5);
  weekend[1] = { ...base()[5], name: 'My saved Sunday lower template' };
  const snapshot = structuredClone(weekend);
  const plan = resolveMasterProgramPlan(base(), { ...settings, matchWeeks: [1] }, '2026-11-08', weekend);
  assert.equal(plan[6].name, 'Volleyball Match');
  assert.equal(plan[6].kind, 'sport');
  assert.deepEqual(weekend, snapshot);
});

test('only done main-set repetitions count as completed gym contacts; preparation and sports remain separate', () => {
  const day = base()[0]; const session = createSession(day, 0, settings.startDate, DEFAULT_PROFILE, []);
  session.exercises[0].logs[0] = { ...session.exercises[0].logs[0], done: true, reps: 2 };
  session.exercises[0].logs[1] = { ...session.exercises[0].logs[1], done: false, reps: 2 };
  session.exercises[1].logs[0] = { ...session.exercises[1].logs[0], done: true, reps: 3 };
  assert.deepEqual(masterJumpContacts(day, session), { planned: 14, completed: 5 });
  assert.equal(masterJumpContacts(base()[1]).planned, 0);
  assert.equal(masterJumpContacts(base()[4]).completed, 0);
  assert.equal(masterJumpContacts(day).completed, 0);
});

test('Berlin calendar-day settings validate moves and competition dates across DST without UTC shifts', () => {
  const dst = { ...settings, startDate: '2027-03-22', rescheduledLowerDates: ['2027-03-27'] };
  assert.ok(MasterProgramSettingsSchema.safeParse(dst).success);
  const plan = resolveMasterProgramPlan(base(), dst, '2027-03-28');
  assert.equal(plan[6].name, 'Lower Strength B');
  assert.equal(getMasterProgramWeek(dst.startDate, '2027-03-29'), 2);
  for (const invalid of [{ ...settings, rescheduledLowerDates: ['2026-11-08'] }, { ...settings, rescheduledLowerDates: ['2026-11-07', '2026-11-07'] }, { ...settings, clearance: { impact: 'approved', heavyLifting: 'unknown' } }])
    assert.equal(MasterProgramSettingsSchema.safeParse(invalid).success, false);
});

test('scheduled volleyball and PE are cues, never completed activities or automatic hard running', () => {
  assert.equal(base()[1].minutes, 120); assert.equal(base()[4].minutes, 120);
  assert.deepEqual(masterScheduledEvents(settings, '2026-11-05'), []);
  assert.equal(masterScheduledEvents(settings, '2026-11-06')[0].name, 'School PE');
  assert.deepEqual(masterScheduledEvents(settings, '2026-11-07'), []);
  assert.match(base()[1].note, /8–10 h sleep/);
});

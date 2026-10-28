import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { createVolleyballMasterPlan, createRecommendedMasterPlan, resolveMasterProgramPlan,
  applyMasterReadiness, getMasterOptionalExercises, isMasterReadinessRequired, masterJumpContacts,
  masterScheduledEvents, masterPlannedMinutes, MasterProgramSettingsSchema, type MasterProgramSettings } from '../src/volleyball-master-plan.ts';
import { findComplexPair, nextStepAfterCompletion } from '../src/training-flow.ts';

const settings: MasterProgramSettings = { version: 1, revision: '8.1', startDate: '2026-10-19', matchWeeks: [2] };
const plan = (date = '2026-10-21', patch: Partial<MasterProgramSettings> = {}) => resolveMasterProgramPlan(createVolleyballMasterPlan(), { ...settings, ...patch }, date);
const item = (day: ReturnType<typeof createVolleyballMasterPlan>[number], key: string) => day.exercises.find(exercise => exercise.key === `master-${key}`)!;
const requiredSets = (day: ReturnType<typeof createVolleyballMasterPlan>[number]) => day.exercises.filter(exercise => !exercise.optionalWork).reduce((sum, exercise) => sum + exercise.sets, 0);

test('V8.1 weekly recommendation has Sunday heavy, Saturday recovery, and four substantial gym days', () => {
  const base = plan();
  assert.equal(ProfileSchema.safeParse({ ...DEFAULT_PROFILE, plan: base, masterProgram: settings }).success, true);
  assert.deepEqual(base.map(day => day.name), ['Upper A', 'Volleyball', 'Main Jump + Heavy Lower A', 'Upper B', 'Volleyball', 'Recovery / Optional Mobility', 'Heavy Lower B']);
  assert.deepEqual(base.flatMap((day, index) => day.kind === 'strength' ? [index] : []), [0, 2, 3, 6]);
  assert.deepEqual([0, 2, 3, 6].map(index => requiredSets(base[index])), [25, 24, 23, 17]);
  assert.equal(base[5].exercises.length, 0);
  assert.equal(base[5].durationRange, '0–25 min');
  assert.equal(base[6].durationRange, '75–90 min');
  assert.equal(base[1].minutes, 120); assert.equal(base[4].minutes, 120);
  assert.equal(base[1].extraSession!.durationRange, '5–10 min');
  assert.equal(item(base[1].extraSession!, 'penultimate').sets, 2);
  assert.equal(item(base[1].extraSession!, 'approach').sets, 3);
  assert.match(item(base[1].extraSession!, 'approach').cue!, /75–85%/);
  assert.ok(base.every(day => day.exercises.every(exercise => exercise.benefit)));
  assert.ok(!base.some(day => day.exercises.some(exercise => /trap.?bar.*jump/i.test(exercise.name))));
});

test('match weekends contain a 12–18 minute primer and no Sunday heavy workout or invented match time', () => {
  const week = plan('2026-11-01');
  assert.equal(week[5].name, 'Pre-Match Primer');
  assert.equal(week[5].durationRange, '12–18 min');
  assert.equal(week[5].minutes, 15);
  assert.equal(masterJumpContacts(week[5]).planned, 3);
  assert.equal(week[6].name, 'Volleyball Match');
  assert.equal(week[6].kind, 'sport');
  assert.equal(week[6].startTime, undefined);
  assert.ok(!week[5].exercises.some(exercise => /hack|leg press|deadlift|bulgarian/i.test(exercise.name)));
  assert.ok(!week[6].exercises.some(exercise => /leg press|lower/i.test(exercise.name)));
  const timed = plan('2026-11-01', { matchTimes: [{ week: 2, startTime: '14:30' }] });
  assert.equal(timed[6].startTime, '14:30');
  assert.equal(plan('2026-10-25', { matchTimes: [{ week: 2, startTime: '14:30' }] })[6].startTime, undefined);
  assert.equal(MasterProgramSettingsSchema.safeParse({ ...settings, matchTimes: [{ week: 2, startTime: '25:00' }] }).success, false);
  assert.equal(MasterProgramSettingsSchema.safeParse({ ...settings, matchTimes: [{ week: 2, startTime: '14:00' }, { week: 2, startTime: '15:00' }] }).success, false);
});

test('Wednesday preparation is one practical seven-movement prescription before demanding work', () => {
  const day = createVolleyballMasterPlan()[2];
  assert.equal(day.warmup!.length, 7);
  assert.deepEqual(day.warmup!.map(step => step.target), ['2–3 min', '8 / side', '6 / side', '8 reps', '5 / leg', '2 × 8', '3 reps · easy → faster']);
  assert.match(day.note, /Ramp up heavy lifts separately/);
  assert.equal(item(day, 'drop').sets, 2); assert.equal(item(day, 'drop').rest, 120);
  assert.match(item(day, 'drop').cue!, /15–20 cm/);
  assert.equal(item(day, 'loaded-jump').sets, 2);
  assert.match(item(day, 'loaded-jump').cue!, /2–4 kg in each hand/);
  assert.equal(item(day, 'pallof').mode, 'timed');
  assert.equal(item(day, 'pallof').target, '20 sec');
});

test('the Hack Squat → CMJ linked complex alternates with distinct manually adjustable rest times', () => {
  const day = plan()[2];
  const session = SessionSchema.parse(createSession(day, 2, '2026-10-21', DEFAULT_PROFILE, []));
  const pair = findComplexPair(session.exercises, 'master-hack');
  assert.ok(pair); assert.equal(pair.second.key, 'master-cmj');
  assert.equal(pair.first.rest, 240); assert.equal(pair.second.rest, 150);
  assert.equal(pair.first.logs.length, 3); assert.equal(pair.second.logs.length, 3);
  pair.first.logs[0].done = true;
  assert.equal(nextStepAfterCompletion(session.exercises, pair.first.key, pair.first.logs[0].id)?.exerciseKey, pair.second.key);
  assert.equal(item(day, 'hack').targetRpe, 8);
  item(day, 'hack').rest = 270;
  assert.equal(item(day, 'hack').rest, 270);
});

test('24 planned Wednesday contacts are a ceiling and only completed logged jump reps count', () => {
  const day = plan()[2];
  assert.deepEqual(masterJumpContacts(day), { planned: 24, completed: 0 });
  const session = SessionSchema.parse(createSession(day, 2, '2026-10-21', DEFAULT_PROFILE, []));
  const approach = session.exercises.find(exercise => exercise.key === 'master-approach')!;
  approach.logs[0] = { ...approach.logs[0], done: true, reps: 2, measurementCm: 316 };
  // Measuring a touch records that same physical set, not extra contacts.
  assert.deepEqual(masterJumpContacts(day, session), { planned: 24, completed: 2 });
  session.warmup = day.warmup!.map(step => ({ ...step, done: true }));
  assert.equal(masterJumpContacts(day, session).completed, 2);
  session.exercises.find(exercise => exercise.key === 'master-hack')!.logs[0].done = true;
  assert.equal(masterJumpContacts(day, session).completed, 2);
  assert.ok(session.exercises.every(exercise => exercise.key !== 'master-short-foot'));
  const optional = plan('2026-10-25', { optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false, sundaySplitSquatJump: true } })[6];
  assert.equal(masterJumpContacts(optional).planned, 8, '2 sets × 2 reps × both legs');
});

test('optional work stays discoverable but is not inserted into default working sets or sessions', () => {
  const base = plan();
  assert.equal(base[3].exercises.filter(exercise => exercise.optionalWork).length, 3);
  assert.equal(getMasterOptionalExercises(3, settings).length, 3);
  const session = SessionSchema.parse(createSession(base[3], 3, '2026-10-22', DEFAULT_PROFILE, []));
  assert.ok(!session.exercises.some(exercise => ['master-plyo-pushup', 'master-hammer', 'master-pushdown'].includes(exercise.key)));
  const enabled = plan('2026-10-22', { optional: { mondayArms: false, thursdayArms: true, tuesdayPogos: false, thursdayPlyoPushup: true } });
  assert.equal(enabled[0].exercises.length, 10, 'Monday arms are already part of the revised prescription');
  assert.equal(enabled[3].exercises.length, base[3].exercises.length, 'enable work instead of duplicating exercises');
  assert.equal(requiredSets(enabled[3]), requiredSets(base[3]) + 6);
  assert.ok(enabled[3].exercises.every(exercise => !exercise.optionalWork));
});

test('deload reduces the correct Wednesday and Sunday prescriptions and preserves rested paired rounds', () => {
  const base = plan(); const deload = plan('2026-11-11');
  assert.equal(deload[5].kind, 'recovery');
  assert.equal(deload[6].name, 'Heavy Lower B');
  assert.equal(masterJumpContacts(deload[2]).planned, 13);
  assert.equal(item(deload[2], 'hack').sets, 2); assert.equal(item(deload[2], 'cmj').sets, 2);
  assert.equal(item(deload[2], 'hack').rest, 240); assert.equal(item(deload[2], 'cmj').rest, 150);
  for (const day of [0, 2, 3, 6]) {
    const ratio = requiredSets(deload[day]) / requiredSets(base[day]);
    assert.ok(ratio >= 0.5 && ratio <= 0.61, `day ${day} uses roughly 40–50% fewer demanding sets`);
  }
  const match = plan('2026-11-15', { matchWeeks: [4] });
  assert.equal(match[5].minutes, 15); assert.equal(masterJumpContacts(match[5]).planned, 3);
  assert.equal(match[6].kind, 'sport');
});

test('week eight fresh retests replace normal complex jumping and supplementary plyometrics', () => {
  const peak = plan('2026-12-09');
  assert.equal(masterJumpContacts(peak[2]).planned, 4);
  assert.ok(!peak[2].exercises.some(exercise => ['master-drop', 'master-loaded-jump'].includes(exercise.key)));
  assert.ok(!peak[6].exercises.some(exercise => exercise.key === 'master-split-jump'));
  assert.equal(peak[2].exercises[0].key, 'master-approach');
  assert.equal(peak[2].exercises[1].key, 'master-cmj');
  assert.ok(peak[2].exercises.findIndex(exercise => exercise.key === 'master-hack') > 1);
  assert.ok(!peak[2].exercises.some(exercise => /[A-Z][12] · Complex pair/.test(exercise.group)), 'no orphaned complex labels during fresh tests');
  assert.match(peak[2].note, /fresh standing\/approach tests replace the usual complex jumps/i);
});

test('readiness belongs to Wednesday and non-match Sunday rather than Saturday recovery', () => {
  const base = plan();
  assert.equal(isMasterReadinessRequired(settings, '2026-10-21', base[2]), true);
  assert.equal(isMasterReadinessRequired(settings, '2026-10-24', base[5]), false);
  assert.equal(isMasterReadinessRequired(settings, '2026-10-25', base[6]), true);
  assert.equal(isMasterReadinessRequired(settings, '2026-11-01', plan('2026-11-01')[6]), false);
  assert.equal(isMasterReadinessRequired(settings, '2026-10-21', { ...base[2], kind: 'recovery', exercises: [] }), false);
  const yellow = plan('2026-10-21', { readiness: [{ date: '2026-10-21', status: 'yellow' }] });
  assert.ok(!yellow[2].exercises.some(exercise => ['master-drop', 'master-loaded-jump'].includes(exercise.key)));
  assert.ok(masterJumpContacts(yellow[2]).planned < masterJumpContacts(base[2]).planned);
  assert.ok(item(yellow[2], 'hack').sets < item(base[2], 'hack').sets);
  assert.deepEqual(yellow[6], base[6], 'checks are specific to the selected calendar day');
  const red = plan('2026-10-25', { readiness: [{ date: '2026-10-25', status: 'red' }] });
  assert.equal(red[6].kind, 'recovery'); assert.equal(red[6].exercises.length, 0);
  assert.match(red[6].note, /professional assessment/);
  assert.deepEqual(plan('2026-10-25', { readiness: [{ date: '2026-10-25', status: 'green' }] })[6], base[6]);
});

test('Monday yellow readiness removes ballistic shoulder work and reduces demanding pressing', () => {
  const day = plan()[0]; const yellow = applyMasterReadiness(day, 'yellow');
  assert.ok(!yellow.exercises.some(exercise => exercise.key === 'master-spike'));
  assert.equal(item(yellow, 'incline-a').sets, 2);
  assert.equal(item(yellow, 'shoulder-press').sets, 1);
  assert.ok(item(yellow, 'incline-a').targetRpe! <= 7);
  assert.equal(day.exercises.length, 10);
  assert.equal(item(day, 'incline-a').sets, 3);
});

test('resolving phases and readiness never modifies active or completed snapshots or customized base plans', () => {
  const base = createVolleyballMasterPlan(); item(base[6], 'leg-press').name = 'My chosen leg press';
  const active = SessionSchema.parse(createSession(base[2], 2, '2026-10-21', DEFAULT_PROFILE, []));
  const completed = structuredClone(active); completed.status = 'completed'; completed.runningSince = null;
  const before = structuredClone({ base, active, completed });
  resolveMasterProgramPlan(base, { ...settings, readiness: [{ date: '2026-10-25', status: 'red' }] }, '2026-10-25');
  resolveMasterProgramPlan(base, settings, '2026-11-11');
  assert.deepEqual({ base, active, completed }, before);
  assert.equal(resolveMasterProgramPlan(base, settings, '2026-10-25')[6].exercises.find(exercise => exercise.key === 'master-leg-press')!.name, 'My chosen leg press');
});

test('PE and optional easy running are planning cues, not duplicate completed load', () => {
  assert.deepEqual(masterScheduledEvents(settings, '2026-10-22'), []);
  assert.equal(masterScheduledEvents({ ...settings, optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false, easyRun: true } }, '2026-10-22')[0].name, 'Easy 5 km');
  assert.equal(masterScheduledEvents(settings, '2026-10-23')[0].name, 'School PE');
  assert.equal(masterPlannedMinutes(settings, '2026-10-23', 120, [{ name: 'School PE', durationMinutes: 120 }]), 120);
  assert.equal(masterPlannedMinutes(settings, '2026-10-23', 120, []), 240);
  const legacy = createRecommendedMasterPlan({ version: 1, startDate: settings.startDate, matchWeeks: [] });
  assert.equal(legacy[5].name, 'Reactive + Hard Lower B');
  assert.equal(legacy[6].name, 'Recovery');
  assert.equal(createRecommendedMasterPlan(settings)[6].name, 'Heavy Lower B');
});

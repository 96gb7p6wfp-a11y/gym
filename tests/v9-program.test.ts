import assert from 'node:assert/strict';
import test from 'node:test';
import { PlanDaySchema } from '../src/domain.js';
import {
  createRecommendedMasterPlan, createV9VolleyballMasterPlan, isMasterReadinessRequired,
  masterJumpContacts, masterPlannedMinutes, masterScheduledEvents, MasterProgramSettingsSchema,
  resolveMasterProgramPlan, type MasterProgramSettings,
} from '../src/volleyball-master-plan.ts';
import { applyV9Clearance, applyV9Readiness } from '../src/volleyball-v9-plan.ts';
import { findLibraryExercise } from '../src/exercise-library.ts';

const cleared = { impact: 'cleared', heavyLifting: 'cleared' } as const;
const settings: MasterProgramSettings = { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [], clearance: cleared };
const factory = () => createV9VolleyballMasterPlan();
const resolve = (date: string, changes: Partial<MasterProgramSettings> = {}) => resolveMasterProgramPlan(factory(), { ...settings, ...changes }, date);
const dose = (day: ReturnType<typeof factory>[number]) => day.exercises.map(e => [e.name, e.sets, e.target, e.rest, e.perSide]);

test('V9 is a distinct validated revision and every complete recommendation parses without changing older versions', () => {
  assert.equal(MasterProgramSettingsSchema.parse(settings).revision, '9');
  for (const match of [false, true]) {
    const plan = createV9VolleyballMasterPlan(match);
    assert.equal(plan.length, 7);
    for (const day of plan) {
      assert.deepEqual(PlanDaySchema.parse(day).exercises, day.exercises);
      assert.equal(day.programRevision, '9');
      assert.ok(day.programSessionId?.startsWith('v9-'));
      for (const exercise of [...day.exercises, ...(day.extraSession?.exercises ?? [])]) {
        assert.equal(findLibraryExercise({ exerciseId: exercise.exerciseId })?.id, exercise.exerciseId,
          `${exercise.name} must retain a valid catalogue identity`);
      }
      if (day.extraSession) PlanDaySchema.parse(day.extraSession);
    }
  }
  assert.deepEqual(createRecommendedMasterPlan(settings), factory());
  assert.equal(createRecommendedMasterPlan({ ...settings, revision: '13.1' })[5].name, 'Lower Strength B');
  assert.equal(createRecommendedMasterPlan({ ...settings, revision: '8.1' })[5].name, 'Recovery / Optional Mobility');
  assert.equal(createRecommendedMasterPlan({ ...settings, revision: '8.1' })[6].name, 'Heavy Lower B');
});

test('the normal week has four substantial gym days rather than the old supplementary Saturday', () => {
  const plan = factory();
  assert.deepEqual(plan.map((day, index) => day.kind === 'strength' ? index : -1).filter(index => index >= 0), [0, 2, 3, 5]);
  assert.deepEqual(plan.filter(day => day.kind === 'strength').map(day => day.durationRange), ['85–100 min', '100–120 min', '85–105 min', '85–105 min']);
  assert.ok(plan.filter(day => day.kind === 'strength').every(day => day.exercises.length >= 11));
});

test('Monday contains all eleven exact working prescriptions, moderate cuff holds and no optional arm omission', () => {
  assert.deepEqual(dose(factory()[0]), [
    ['Medicine Ball Spike Slam', 4, '3 reps', 90, false],
    ['Pull-ups / Assisted Pull-ups', 3, '5–8 reps', 180, false],
    ['Incline Machine Press', 3, '6–10 reps', 180, false],
    ['Chest-Supported Row', 3, '8–12 reps', 120, false],
    ['Single-Arm DB Shoulder Press', 2, '6–8 reps', 90, true],
    ['Cable Lateral Raise', 3, '12–20 reps', 75, false],
    ['Reverse Pec Deck', 2, '12–20 reps', 75, false],
    ['Cable External-Rotation Isometric', 2, '20 sec', 60, true],
    ['Cable Crunch', 3, '10–15 reps', 60, false],
    ['Dumbbell Biceps Curl', 2, '8–12 reps', 60, false],
    ['Triceps Pushdown', 2, '10–15 reps', 60, false],
  ]);
  const plan = factory()[0];
  assert.equal(plan.exercises[0].defaultKg, 2);
  assert.match(plan.exercises[0].cue!, /Two-handed overhead/);
  assert.equal(plan.exercises[4].targetRir, 2);
  assert.equal(plan.exercises[7].mode, 'timed');
  assert.equal(plan.exercises[7].targetRpe, 6);
  assert.ok(plan.exercises.every(e => !e.optionalWork));
  assert.ok((plan.warmup?.length ?? 99) <= 6);
  assert.deepEqual(resolve('2026-11-02', { optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false } })[0].exercises, plan.exercises);
});

test('Tuesday has real volleyball plus an optional low-impact four-drill technique routine', () => {
  const day = factory()[1];
  assert.equal(day.kind, 'sport');
  assert.equal(day.startTime, '20:00');
  assert.equal(day.exercises[0].mode, 'timed');
  assert.deepEqual(day.extraSession?.exercises.map(e => [e.name, e.sets, e.target]), [
    ['Three-Step L-R-L Rhythm', 3, '3 reps'], ['Penultimate-Step + Plant Rehearsal', 3, '2 reps'],
    ['Arm-Swing Timing Drill', 2, '5 reps'], ['Full Approach Rehearsal', 3, '1 rep'],
  ]);
  assert.ok(day.extraSession!.exercises.every(e => !e.jumpContactsPerRep));
  assert.match(day.extraSession!.note, /no maximal indoor jumps/i);
  assert.equal(masterJumpContacts(day.extraSession!).completed, 0);
});

test('Wednesday has four distinct sections, correct acceleration distances and exactly one three-round complex', () => {
  const day = factory()[2];
  assert.deepEqual([...new Set(day.exercises.map(e => e.section))], [
    'A · Acceleration', 'B · Maximal Jump + Reactive Work', 'C · Heavy Hack Squat + CMJ Complex', 'D · Heavy Strength + Stability',
  ]);
  assert.deepEqual(day.exercises.slice(0, 2).map(e => [e.sets, e.prescribedDistanceM, e.quantityUnit, e.mode]), [[2, 5, 'm', 'bodyweight'], [2, 10, 'm', 'bodyweight']]);
  assert.ok(day.exercises.slice(0, 2).every(e => /deceleration distance/.test(e.cue!)));
  const hack = day.exercises.filter(e => e.name === 'Hack Squat');
  assert.equal(hack.length, 1);
  assert.equal(hack[0].sets, 3);
  assert.equal(hack[0].targetRir, 2);
  assert.equal(hack[0].rest, 240);
  const index = day.exercises.indexOf(hack[0]);
  assert.equal(day.exercises[index + 1].name, 'Countermovement Jump');
  assert.equal(day.exercises[index + 1].sets, 3);
  assert.equal(day.exercises[index + 1].rest, 180);
  assert.equal(hack[0].group, 'A1 · Complex pair');
  assert.equal(day.exercises[index + 1].group, 'A2 · Complex pair');
  assert.deepEqual(day.exercises.slice(-5).map(e => [e.name, e.sets, e.target, e.mode]), [
    ['Romanian Deadlift', 3, '5–7 reps', 'weight'], ['Bulgarian Split Squat', 3, '6 reps', 'weight'],
    ['Seated Calf Raise', 3, '8–12 reps', 'weight'], ['Pallof Press Isometric Hold', 2, '20 sec', 'timed'],
    ['DB Suitcase Carry / Static Hold', 2, '30 sec', 'timed'],
  ]);
  assert.equal(day.exercises.at(-1)?.quantityUnit, undefined);
});

test('Wednesday programs exactly 24 additional main jump contacts, never completed contacts or sprint times', () => {
  const day = factory()[2];
  assert.deepEqual(day.exercises.filter(e => e.jumpContactsPerRep).map(e => [e.name, e.sets, e.target]), [
    ['Maximal Three-Step Approach Jump', 4, '2 reps'], ['Low Drop Jump, 15–20 cm', 2, '2 reps'],
    ['Light Dumbbell Squat Jump', 2, '3 reps'], ['Countermovement Jump', 3, '2 reps'],
  ]);
  assert.deepEqual(masterJumpContacts(day), { planned: 24, completed: 0 });
  assert.equal(day.exercises.find(e => e.name === 'Light Dumbbell Squat Jump')?.defaultKg, undefined);
  const session = { exercises: day.exercises.map(e => ({ jumpContactsPerRep: e.jumpContactsPerRep,
    logs: [{ done: e.name === 'Maximal Three-Step Approach Jump', reps: 2 }] })) };
  assert.deepEqual(masterJumpContacts(day, session), { planned: 24, completed: 2 });
});

test('Thursday separates two agility drills and all eleven prescribed upper-body entries', () => {
  const day = factory()[3];
  assert.deepEqual(day.exercises.slice(0, 2).map(e => [e.name, e.sets, e.target, e.perSide]), [
    ['Lateral Shuffle → Plant → Accelerate', 3, '2 reps', true], ['Split-Step Reaction Drill', 3, '4 reactions', false],
  ]);
  assert.deepEqual(day.exercises.slice(2).map(e => [e.name, e.sets, e.target]), [
    ['Medicine-Ball Rotational Wall Throw', 3, '3 reps'], ['Lat Pulldown', 3, '8–10 reps'],
    ['Chest-Supported Row', 3, '8–12 reps'], ['Low-Incline Machine Press', 3, '8–12 reps'],
    ['Cable Lateral Raise', 3, '12–20 reps'], ['Reverse Pec Deck', 2, '12–20 reps'],
    ['Cable External Rotation', 2, '12–15 reps'], ['Push-Up Plus', 2, '10–12 reps'],
    ['Cable Crunch', 3, '10–15 reps'], ['Hammer Curl', 2, '10–15 reps'], ['Triceps Pushdown', 2, '10–15 reps'],
  ]);
  assert.ok(day.exercises.every(e => !e.optionalWork));
  assert.match(day.exercises[0].cue!, /never.*gym machines/i);
  assert.match(day.exercises[1].cue!, /unpredictable/);
});

test('Friday is PE plus volleyball, not recovery or a manufactured gym completion', () => {
  const day = factory()[4];
  assert.equal(day.kind, 'sport');
  assert.match(day.name, /School PE/);
  assert.equal(day.exercises.length, 1);
  assert.equal(day.exercises[0].mode, 'timed');
  assert.equal(masterScheduledEvents(settings, '2026-11-06')[0].name, 'School PE');
  assert.match(masterScheduledEvents(settings, '2026-11-06')[0].detail, /record actual activities/);
  assert.doesNotMatch(masterScheduledEvents(settings, '2026-11-06')[0].detail, /high jump|shot put/);
  assert.equal(masterPlannedMinutes(settings, '2026-11-06', 120, []), 240);
  assert.equal(masterPlannedMinutes(settings, '2026-11-06', 120, [{ name: 'PE', durationMinutes: 120 }]), 120);
  assert.deepEqual(masterScheduledEvents({ ...settings, optional: { mondayArms: false, thursdayArms: false, tuesdayPogos: false, easyRun: true } }, '2026-11-05'), []);
});

test('normal Green Saturday resolves exactly the complete eleven-item V9 Lower B in order', () => {
  const day = resolve('2026-11-07', { readiness: [{ date: '2026-11-07', status: 'green' }] })[5];
  assert.equal(day.name, 'Lower B — Full Strength');
  assert.equal(day.programSessionId, 'v9-lower-b');
  assert.equal(day.subtitle, 'Speed + Lower-Body Strength');
  assert.deepEqual(dose(day), [
    ['10 m Acceleration', 4, '10 m', 90, false], ['Split-Squat Jump', 2, '3 reps', 120, true],
    ['Leg Press', 3, '5–8 reps', 180, false], ['Smith Machine Bulgarian Split Squat', 3, '6–8 reps', 120, true],
    ['Hip Thrust Machine', 3, '6–8 reps', 120, false], ['Leg Curl', 3, '8–12 reps', 90, false],
    ['Standing Calf Raise', 3, '6–10 reps', 90, false], ['Standing Calf Isometric Hold', 2, '30 sec', 90, false],
    ['Tibialis Raise', 2, '15–20 reps', 60, false], ['Copenhagen Plank', 2, '20–30 sec', 60, true],
    ['Cable Crunch', 2, '10–15 reps', 60, false],
  ]);
  assert.equal(masterJumpContacts(day).planned, 12, 'three per leg means six contacts per set');
});

test('a confirmed Sunday match selects a separate short primer and actual-duration match, even with unknown start time', () => {
  const plan = resolve('2026-11-07', { matchWeeks: [1] });
  assert.equal(plan[5].programSessionId, 'v9-match-primer');
  assert.equal(plan[5].name, 'Pre-Match Primer');
  assert.equal(plan[5].durationRange, '10–15 min');
  assert.deepEqual(plan[5].warmup, []);
  assert.equal(plan[5].exercises.filter(e => !e.optionalWork).length, 4);
  assert.ok(plan[5].exercises.every(e => e.mode !== 'weight' && !e.jumpContactsPerRep));
  assert.equal(plan[6].programSessionId, 'v9-match');
  assert.equal(plan[6].kind, 'sport');
  assert.equal(plan[6].startTime, undefined);
  assert.equal(plan[6].exercises[0].mode, 'timed');
  assert.match(plan[6].exercises[0].target, /actual/);
  const withTime = resolve('2026-11-07', { matchWeeks: [1], matchTimes: [{ week: 1, startTime: '16:30' }] });
  assert.equal(withTime[6].startTime, '16:30');
});

test('a saved match time alone never confirms a match, and changes use the selected actual week', () => {
  assert.equal(resolve('2026-11-07', { matchTimes: [{ week: 1, startTime: '16:30' }] })[5].programSessionId, 'v9-lower-b');
  assert.equal(resolve('2026-11-14', { matchWeeks: [1] })[5].programSessionId, 'v9-lower-b');
  assert.equal(resolve('2026-11-14', { matchWeeks: [2] })[5].programSessionId, 'v9-match-primer');
  assert.equal(resolve('2026-11-14', { matchWeeks: [2] })[6].startTime, undefined);
  assert.equal(resolve('2026-11-08')[6].programSessionId, 'v9-recovery');
});

test('Saturday branching uses template identity and cannot confuse a renamed heavy workout with a primer', () => {
  const heavy = { ...factory()[5], name: 'Pre-Match Primer' };
  const wrongWeekend = [heavy, factory()[6]];
  const matched = resolveMasterProgramPlan(factory(), { ...settings, matchWeeks: [1] }, '2026-11-07', wrongWeekend);
  assert.equal(matched[5].programSessionId, 'v9-match-primer');
  assert.ok(matched[5].exercises.every(e => e.mode !== 'weight'));
  const badBase = factory();
  badBase[5] = { ...createV9VolleyballMasterPlan(true)[5], name: 'Lower B — Full Strength' };
  assert.equal(resolveMasterProgramPlan(badBase, settings, '2026-11-07')[5].exercises.length, 11);
  const unsafePrimer = createV9VolleyballMasterPlan(true)[5];
  unsafePrimer.exercises.push(factory()[5].exercises[2]);
  const safe = resolveMasterProgramPlan(factory(), { ...settings, matchWeeks: [1] }, '2026-11-07', [unsafePrimer, createV9VolleyballMasterPlan(true)[6]])[5];
  assert.ok(safe.exercises.every(e => e.mode !== 'weight'), 'matching identity alone cannot permit a heavy primer');
});

test('an explicitly older weekly recommendation cannot leave a five-exercise Saturday under active V9', () => {
  const legacy = createRecommendedMasterPlan({ ...settings, revision: '13.1' });
  const before = structuredClone(legacy);
  assert.equal(legacy[5].exercises.length, 5, 'reproduce the old supplementary Lower B');
  const resolved = resolveMasterProgramPlan(legacy, settings, '2026-11-07');
  assert.equal(resolved[5].programSessionId, 'v9-lower-b');
  assert.equal(resolved[5].name, 'Lower B — Full Strength');
  assert.equal(resolved[5].exercises.length, 11);
  assert.match(resolved[5].note, /older 13\.1 weekly recommendation remains saved/);
  assert.deepEqual(legacy, before, 'resolution never deletes the older saved prescription');
  assert.deepEqual(resolved[2].exercises, factory()[2].exercises);
});

test('an explicit V9 weekly customization and an unlabelled personal workout remain separate from obsolete recommendations', () => {
  const customized = factory();
  customized[5] = { ...customized[5], name: 'My reviewed lower session', exercises: customized[5].exercises.slice(2, 5),
    customizedForProgram: '9' };
  const before = structuredClone(customized);
  const resolved = resolveMasterProgramPlan(customized, settings, '2026-11-07');
  assert.equal(resolved[5].name, 'My reviewed lower session');
  assert.equal(resolved[5].exercises.length, 3);
  assert.equal(resolved[5].customizedForProgram, '9');
  assert.deepEqual(customized, before);
  const { programRevision: _revision, programSessionId: _id, ...personal } = customized[0];
  const unlabelled = { ...personal, name: 'My own upper session', exercises: personal.exercises.slice(1, 3) };
  customized[0] = unlabelled;
  assert.deepEqual(resolveMasterProgramPlan(customized, settings, '2026-11-02')[0], unlabelled);
});

test('old-version weekend templates cannot turn a confirmed V9 match into heavy Lower B', () => {
  const legacy = createRecommendedMasterPlan({ ...settings, revision: '13.1' });
  const oldWeekend = createRecommendedMasterPlan({ ...settings, revision: '13.1' }, true).slice(5);
  const before = structuredClone({ legacy, oldWeekend });
  const resolved = resolveMasterProgramPlan(legacy, { ...settings, matchWeeks: [1], matchTimes: [{ week: 1, startTime: '15:45' }] }, '2026-11-07', oldWeekend);
  assert.equal(resolved[5].programSessionId, 'v9-match-primer');
  assert.equal(resolved[5].exercises.filter(item => !item.optionalWork).length, 4);
  assert.equal(resolved[6].programSessionId, 'v9-match');
  assert.equal(resolved[6].startTime, '15:45');
  assert.deepEqual({ legacy, oldWeekend }, before);
});

test('Green retains the base dose; Yellow and Red are explicitly modified without rewriting the full recommendation', () => {
  const base = factory()[5], before = structuredClone(base);
  assert.equal(applyV9Readiness(base, 'green'), base);
  const yellow = applyV9Readiness(base, 'yellow');
  assert.match(yellow.name, /Modified/);
  assert.match(yellow.note, /Yellow/);
  assert.ok(yellow.exercises.every(e => !e.jumpContactsPerRep && e.quantityUnit !== 'm'));
  assert.equal(yellow.exercises.find(e => e.name === 'Leg Press')?.sets, 2);
  const red = applyV9Readiness(base, 'red');
  assert.equal(red.kind, 'recovery');
  assert.match(red.name, /Modified/);
  assert.equal(red.exercises.length, 0);
  assert.equal(red.programSessionId, 'v9-lower-b');
  assert.deepEqual(base, before);
});

test('unknown or restricted impact omits high-impact work without reducing cleared heavy strength to easy sets', () => {
  for (const impact of ['unknown', 'restricted'] as const) {
    const day = resolve('2026-11-04', { clearance: { impact, heavyLifting: 'cleared' } })[2];
    assert.equal(day.exercises.some(e => e.jumpContactsPerRep || e.quantityUnit === 'm'), false);
    assert.equal(day.exercises.find(e => e.name === 'Hack Squat')?.sets, 3);
    assert.equal(day.exercises.find(e => e.name === 'Romanian Deadlift')?.targetRpe, 8);
    assert.ok(day.exercises.every(e => !/Complex pair/.test(e.group)));
    assert.match(day.note, /recorded guidance/);
  }
});

test('unknown heavy guidance remains easy preparation, but the full base and its twenty-four contacts remain intact', () => {
  const base = factory()[2], before = structuredClone(base);
  const guarded = applyV9Clearance(base);
  assert.match(guarded.name, /Preparation/);
  assert.ok(guarded.exercises.every(e => e.sets <= 2 && e.targetRpe === 5 && e.preparationOnly));
  assert.ok(guarded.exercises.every(e => !e.jumpContactsPerRep && e.quantityUnit !== 'm'));
  assert.deepEqual(base, before);
  assert.equal(masterJumpContacts(base).planned, 24);
  const onlyImpact = applyV9Clearance(base, { impact: 'cleared', heavyLifting: 'unknown' });
  assert.ok(onlyImpact.exercises.some(e => e.name === 'Countermovement Jump'));
  assert.ok(!onlyImpact.exercises.some(e => e.name === 'Light Dumbbell Squat Jump'));
  assert.ok(onlyImpact.exercises.every(e => !/Complex pair/.test(e.group)), 'easy preparation and unequal jump sets are not a full strength-power complex');
});

test('week four and eight reduce demanding work explicitly rather than overwriting the base plan', () => {
  const base = factory(), before = structuredClone(base);
  const deload = resolveMasterProgramPlan(base, settings, '2026-11-25');
  const evaluation = resolveMasterProgramPlan(base, settings, '2026-12-23');
  assert.match(deload[2].name, /Deload/);
  assert.ok(masterJumpContacts(deload[2]).planned < 24);
  assert.equal(deload[2].exercises.find(e => e.name === 'Hack Squat')?.sets, 2);
  assert.match(evaluation[2].name, /Evaluation/);
  assert.ok(evaluation[2].exercises.every(e => !/Complex pair/.test(e.group)));
  assert.equal(evaluation[2].exercises.filter(e => e.name === 'Hack Squat').length, 1);
  assert.equal(evaluation[2].exercises.some(e => /Drop Jump|Dumbbell Squat Jump/.test(e.name)), false);
  assert.deepEqual(base, before);
});

test('six-week evaluation is optional and neither adds contacts nor restarts the cycle', () => {
  const plan = resolve('2026-12-09');
  assert.match(plan[2].note, /Optional six-week performance check/);
  assert.deepEqual(plan[2].exercises, factory()[2].exercises);
  assert.equal(masterJumpContacts(plan[2]).planned, 24);
});

test('date readiness remains available after the block; old reschedule flags never move or duplicate V9 Lower B', () => {
  const after = resolve('2027-01-02', { readiness: [{ date: '2027-01-02', status: 'yellow' }] });
  assert.match(after[5].name, /Modified/);
  assert.equal(isMasterReadinessRequired(settings, '2027-01-02', factory()[5]), true);
  assert.equal(isMasterReadinessRequired(settings, '2026-11-04', factory()[2]), true);
  assert.equal(isMasterReadinessRequired({ ...settings, matchWeeks: [1] }, '2026-11-07', createV9VolleyballMasterPlan(true)[5]), false);
  const moved = resolve('2026-11-07', { rescheduledLowerDates: ['2026-11-07'] });
  assert.equal(moved[5].programSessionId, 'v9-lower-b');
  assert.equal(moved[5].exercises.length, 11);
  assert.equal(moved[6].kind, 'recovery');
});

test('fresh factories and resolutions never mutate saved recommendations, match variants or personal guidance', () => {
  const base = factory(), weekend = createV9VolleyballMasterPlan(true).slice(5);
  const preferences: MasterProgramSettings = { ...settings, matchWeeks: [1], readiness: [{ date: '2026-11-04', status: 'yellow' }] };
  const before = structuredClone({ base, weekend, preferences });
  resolveMasterProgramPlan(base, preferences, '2026-11-04', weekend);
  assert.deepEqual({ base, weekend, preferences }, before);
  base[5].exercises[0].sets = 1;
  assert.equal(factory()[5].exercises[0].sets, 4);
});

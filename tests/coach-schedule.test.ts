import assert from 'node:assert/strict';
import test from 'node:test';
import { ProfileSchema, DEFAULT_PROFILE } from '../src/domain.js';
import {
  MasterProgramSettingsSchema, createV9VolleyballMasterPlan, resolveMasterProgramPlan, resolveV9PlanningBase,
  isMasterReadinessRequired, type MasterProgramSettings,
} from '../src/volleyball-master-plan.ts';
import {
  CalendarMatchSchema, DailyReadinessSchema, TrainingPhaseSchema, getCalendarMatch, sundayForDate,
  migrateLegacyMatchSchedule, saveCalendarMatch, getDailyReadiness, getCoachReadinessStatus, getCoachPhase,
} from '../src/coach-schedule.ts';

const cleared = { impact: 'cleared', heavyLifting: 'cleared' } as const;
const settings: MasterProgramSettings = { version: 1, revision: '9', startDate: '2026-10-12', matchWeeks: [], clearance: cleared };
const saturday = '2026-11-07';
const sunday = '2026-11-08';
const factory = () => createV9VolleyballMasterPlan();
const sets = (day: ReturnType<typeof factory>[number]) => day.exercises.filter(row => !row.optionalWork).reduce((total, row) => total + row.sets, 0);
const resolve = (changes: Partial<MasterProgramSettings> = {}, date = saturday) => resolveMasterProgramPlan(factory(), { ...settings, ...changes }, date);

test('coach fields are additive and old profiles remain unchanged when parsed or read', () => {
  const original = structuredClone(settings);
  assert.deepEqual(MasterProgramSettingsSchema.parse(settings), settings);
  const profile = ProfileSchema.parse({ ...DEFAULT_PROFILE, masterProgram: settings });
  assert.equal(profile.masterProgram?.calendarMatches, undefined);
  assert.equal(profile.masterProgram?.dailyReadiness, undefined);
  assert.equal(profile.masterProgram?.periodizationMode, undefined);
  resolveMasterProgramPlan(factory(), settings, saturday);
  assert.deepEqual(settings, original);
});

test('normal non-match Week 4 Saturday has all eleven exercises and 29 sets by default', () => {
  const day = resolve()[5];
  assert.equal(day.name, 'Lower B — Full Strength');
  assert.equal(day.exercises.length, 11);
  assert.equal(sets(day), 29);
  assert.equal(day.durationRange, '85–105 min');
  assert.doesNotMatch(day.note, /Week 4: recovery\/deload/);
  assert.equal(getCoachPhase(settings, saturday).source, 'default');
  assert.equal(getCoachPhase(settings, saturday).phase, 'normal');
});

test('screenshot reduction requires clearance, while an old Week 4 alone cannot create Easy Preparation', () => {
  const oldDose = resolve({ periodizationMode: 'legacy-cycle', clearance: { impact: 'unknown', heavyLifting: 'unknown' } })[5];
  assert.equal(oldDose.name, 'Modified — Easy Preparation');
  assert.equal(oldDose.exercises.length, 9);
  assert.equal(sets(oldDose), 17);
  assert.notEqual(oldDose.durationRange, '85–105 min', 'modified work now receives a reduced estimate');
  assert.match(oldDose.durationRange!, /^≈ /);
  const noAutomaticPhase = resolve({ clearance: { impact: 'unknown', heavyLifting: 'unknown' } })[5];
  assert.equal(noAutomaticPhase.exercises.length, 9);
  assert.equal(sets(noAutomaticPhase), 18);
  assert.equal(noAutomaticPhase.name, 'Modified — Easy Preparation');
  const phaseOnly = resolve({ periodizationMode: 'legacy-cycle' })[5];
  assert.match(phaseOnly.name, /Deload/);
  assert.equal(phaseOnly.exercises.length, 11);
  assert.notEqual(phaseOnly.name, 'Modified — Easy Preparation');
});

test('Great and Normal retain every working prescription and never add volume', () => {
  for (const feeling of ['great', 'normal'] as const) {
    const day = resolve({ dailyReadiness: [{ date: saturday, feeling }] })[5];
    assert.deepEqual(day, factory()[5]);
    assert.equal(sets(day), 29);
    assert.equal(day.exercises.find(exercise => exercise.name === 'Leg Press')?.targetRir, 2);
  }
});

test('Tired makes specific visible reductions, updates duration, and never edits the base', () => {
  const base = factory(), before = structuredClone(base);
  const adapted = resolveMasterProgramPlan(base, { ...settings, dailyReadiness: [{ date: saturday, feeling: 'tired' }] }, saturday)[5];
  assert.match(adapted.name, /Modified/);
  assert.ok(adapted.exercises.every(exercise => !exercise.jumpContactsPerRep && exercise.quantityUnit !== 'm'));
  assert.equal(adapted.exercises.find(exercise => exercise.name === 'Leg Press')?.sets, 2);
  assert.equal(adapted.exercises.find(exercise => exercise.name === 'Leg Press')?.targetRir, 3);
  assert.match(adapted.durationRange!, /^≈ /);
  assert.ok(adapted.minutes < base[5].minutes);
  assert.deepEqual(base, before);
});

test('Poor recommends recovery without encouraging heavy or high-impact work', () => {
  const adapted = resolve({ dailyReadiness: [{ date: saturday, feeling: 'poor' }] })[5];
  assert.equal(adapted.kind, 'recovery');
  assert.match(adapted.name, /Recovery/);
  assert.equal(adapted.exercises.length, 0);
  assert.notEqual(adapted.durationRange, '85–105 min');
});

test('Great cannot override unknown or restricted medical guidance', () => {
  for (const status of ['unknown', 'restricted'] as const) {
    const guidance = { impact: status, heavyLifting: status };
    const original = structuredClone(guidance);
    const day = resolve({ clearance: guidance, dailyReadiness: [{ date: saturday, feeling: 'great' }] })[5];
    assert.equal(day.name, 'Modified — Easy Preparation');
    assert.ok(day.exercises.every(exercise => !exercise.jumpContactsPerRep && exercise.quantityUnit !== 'm'));
    assert.ok(day.exercises.every(exercise => exercise.preparationOnly && exercise.targetRpe === 5 && exercise.sets <= 2));
    assert.deepEqual(guidance, original);
  }
});

test('readiness is unknown without a new response; legacy questionnaires and another date do not stand in for today', () => {
  const preferences: MasterProgramSettings = { ...settings,
    readiness: [{ date: saturday, status: 'red' }], dailyReadiness: [{ date: '2026-11-06', feeling: 'poor' }] };
  const before = structuredClone(preferences);
  assert.equal(getDailyReadiness(preferences, saturday), undefined);
  assert.equal(getCoachReadinessStatus(preferences, saturday), undefined);
  assert.equal(resolveMasterProgramPlan(factory(), preferences, saturday)[5].name, 'Lower B — Full Strength');
  assert.equal(isMasterReadinessRequired(preferences, saturday, factory()[5]), false);
  assert.deepEqual(preferences, before, 'old readiness remains available for history and recovery');
});

test('a Sunday date switches only that Saturday and removing it restores the full dose', () => {
  const scheduled = saveCalendarMatch(settings, { date: sunday, scheduled: true, opponent: 'QA opponent', location: 'QA hall', notes: 'Bring shoes' });
  const week = resolveMasterProgramPlan(factory(), scheduled, saturday);
  assert.equal(week[5].programSessionId, 'v9-match-primer');
  assert.equal(week[6].programSessionId, 'v9-match');
  assert.equal(week[6].startTime, undefined);
  assert.equal(resolveMasterProgramPlan(factory(), scheduled, '2026-11-14')[5].programSessionId, 'v9-lower-b');
  const off = saveCalendarMatch(scheduled, { ...getCalendarMatch(scheduled, sunday), scheduled: false });
  assert.equal(resolveMasterProgramPlan(factory(), off, saturday)[5].programSessionId, 'v9-lower-b');
  assert.equal(resolveMasterProgramPlan(factory(), off, saturday)[6].programSessionId, 'v9-recovery');
  assert.equal(getCalendarMatch(off, sunday).opponent, 'QA opponent', 'optional notes survive switching a date off');
});

test('optional match time and metadata can be explicitly cleared without inventing replacements', () => {
  const withDetails = saveCalendarMatch(settings, { date: sunday, scheduled: true, startTime: '16:00',
    opponent: 'QA opponent', location: 'QA location', notes: 'QA notes' });
  const cleared = saveCalendarMatch(withDetails, { date: sunday, scheduled: true });
  assert.deepEqual(getCalendarMatch(cleared, sunday), { date: sunday, scheduled: true });
  assert.equal(resolveMasterProgramPlan(factory(), cleared, saturday)[6].startTime, undefined);
  assert.equal(getCalendarMatch(withDetails, sunday).startTime, '16:00', 'the previous settings object was not mutated');
});

test('legacy confirmed match indices map to original actual dates and keep unknown times unset', () => {
  const old: MasterProgramSettings = { ...settings, startDate: '2026-03-16', matchWeeks: [2, 4], matchTimes: [{ week: 4, startTime: '17:30' }] };
  const before = structuredClone(old);
  const migrated = migrateLegacyMatchSchedule(old);
  assert.deepEqual(migrated.calendarMatches, [
    { date: '2026-03-29', scheduled: true }, { date: '2026-04-12', scheduled: true, startTime: '17:30' },
  ]);
  assert.deepEqual(migrated.matchWeeks, [2, 4]);
  assert.deepEqual(migrated.matchTimes, old.matchTimes);
  assert.deepEqual(old, before);
  assert.equal(getCalendarMatch(old, '2026-11-08').scheduled, false);
  assert.equal(resolveMasterProgramPlan(factory(), migrated, saturday)[5].programSessionId, 'v9-lower-b');
  assert.deepEqual(migrateLegacyMatchSchedule(migrated), migrated);
});

test('an explicit date schedule and its off entries override old indices without reactivation', () => {
  const old = { ...settings, matchWeeks: [4] };
  assert.equal(getCalendarMatch(old, sunday).scheduled, true);
  assert.equal(getCalendarMatch({ ...old, calendarMatches: [] }, sunday).scheduled, false);
  const off = saveCalendarMatch(old, { date: sunday, scheduled: false });
  assert.equal(getCalendarMatch(off, sunday).scheduled, false);
  const movedCycle = { ...off, startDate: '2027-02-01' };
  assert.equal(getCalendarMatch(movedCycle, '2027-02-28').scheduled, false, 'changing a legacy start date cannot project its index into a new match');
  assert.deepEqual(movedCycle.matchWeeks, [4]);
});

test('match scheduling works beyond eight weeks and times alone never schedule a match', () => {
  const far = saveCalendarMatch(settings, { date: '2027-02-07', scheduled: true, startTime: '14:15' });
  assert.equal(resolveMasterProgramPlan(factory(), far, '2027-02-06')[5].programSessionId, 'v9-match-primer');
  assert.equal(resolveMasterProgramPlan(factory(), far, '2027-02-07')[6].startTime, '14:15');
  assert.equal(far.startDate, settings.startDate);
  const timeOnly = saveCalendarMatch(settings, { date: sunday, scheduled: false, startTime: '18:30' });
  assert.equal(resolveMasterProgramPlan(factory(), timeOnly, saturday)[5].programSessionId, 'v9-lower-b');
});

test('Sunday calendar arithmetic survives Berlin DST transitions, leap days and year boundaries', () => {
  assert.equal(sundayForDate('2026-03-28'), '2026-03-29');
  assert.equal(sundayForDate('2026-03-29'), '2026-03-29');
  assert.equal(sundayForDate('2026-10-24'), '2026-10-25');
  assert.equal(sundayForDate('2026-10-25'), '2026-10-25');
  assert.equal(migrateLegacyMatchSchedule({ ...settings, startDate: '2026-10-19', matchWeeks: [1] }).calendarMatches?.[0].date, '2026-10-25');
  assert.equal(sundayForDate('2028-02-29'), '2028-03-05');
  assert.equal(sundayForDate('2026-12-31'), '2027-01-03');
  assert.throws(() => sundayForDate('2026-02-30'));
});

test('manual phase decisions use actual intervals with the last accepted decision taking priority', () => {
  const phases: MasterProgramSettings = { ...settings, trainingPhases: [
    { startDate: '2026-11-02', endDate: '2026-11-08', phase: 'deload' },
    { startDate: saturday, endDate: saturday, phase: 'normal' },
  ] };
  assert.equal(getCoachPhase(phases, '2026-11-04').phase, 'deload');
  assert.equal(getCoachPhase(phases, saturday).phase, 'normal');
  assert.equal(getCoachPhase(phases, '2026-11-14').phase, 'normal');
  const week = resolveMasterProgramPlan(factory(), phases, saturday);
  assert.match(week[2].name, /Deload/);
  assert.equal(week[5].name, 'Lower B — Full Strength');
  assert.equal(sets(week[5]), 29);
  assert.equal(phases.trainingPhases?.length, 2);
});

test('full planning references retain eleven entries under Poor readiness and active restrictions', () => {
  const preferences: MasterProgramSettings = { ...settings, clearance: { impact: 'restricted', heavyLifting: 'restricted' },
    dailyReadiness: [{ date: saturday, feeling: 'poor' }], trainingPhases: [{ startDate: saturday, endDate: saturday, phase: 'deload' }] };
  const base = factory();
  const reference = resolveV9PlanningBase(base, preferences, saturday);
  assert.deepEqual(reference[5], base[5]);
  assert.equal(sets(reference[5]), 29);
  assert.equal(resolveMasterProgramPlan(base, preferences, saturday)[5].kind, 'recovery');
  const customized = factory();
  customized[0] = { ...customized[0], name: 'My deliberate upper session', exercises: customized[0].exercises.slice(1, 4), customizedForProgram: '9' };
  assert.deepEqual(resolveV9PlanningBase(customized, settings, saturday)[0], customized[0]);
});

test('invalid dates, duplicate day responses, malformed times and reversed phase intervals are rejected', () => {
  assert.equal(CalendarMatchSchema.safeParse({ date: saturday, scheduled: true }).success, false);
  assert.equal(CalendarMatchSchema.safeParse({ date: sunday, scheduled: true, startTime: '24:30' }).success, false);
  assert.equal(DailyReadinessSchema.safeParse({ date: saturday, feeling: 'measured-ready' }).success, false);
  assert.equal(TrainingPhaseSchema.safeParse({ startDate: sunday, endDate: saturday, phase: 'deload' }).success, false);
  assert.equal(MasterProgramSettingsSchema.safeParse({ ...settings, calendarMatches: [
    { date: sunday, scheduled: true }, { date: sunday, scheduled: false },
  ] }).success, false);
  assert.equal(MasterProgramSettingsSchema.safeParse({ ...settings, dailyReadiness: [
    { date: saturday, feeling: 'great' }, { date: saturday, feeling: 'poor' },
  ] }).success, false);
});

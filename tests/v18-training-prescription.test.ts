import assert from 'node:assert/strict';
import test from 'node:test';
import { createVolleyballMasterPlan, resolveMasterProgramPlan, applyTrainingGuidance, type MasterProgramSettings } from '../src/volleyball-master-plan.ts';
import { compareWorkoutPrescriptions, getWorkoutPrescription } from '../src/training-prescription.ts';
import type { TrainingGuidance } from '../src/training-guidance.ts';

const cleared: TrainingGuidance = { impact: 'cleared', heavyLifting: 'cleared' };
const settings: MasterProgramSettings = { version: 1, revision: '13.1', startDate: '2026-10-19', matchWeeks: [], clearance: cleared };
const base = createVolleyballMasterPlan();
const getWednesday = (options: MasterProgramSettings = settings, date = '2026-10-21') => resolveMasterProgramPlan(base, options, date)[2];
const codes = (value: ReturnType<typeof getWorkoutPrescription>) => value.reasons.map(reason => reason.code);
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.freeze(value); for (const item of Object.values(value)) freeze(item); }
  return value;
};

test('a full cleared Wednesday describes its actual challenging strength dose without adding volume', () => {
  const plan = getWednesday(), before = structuredClone(plan);
  const view = getWorkoutPrescription({ plan: freeze(plan), originalPlan: freeze(structuredClone(base[2])), settings, date: '2026-10-21' });
  assert.equal(plan.exercises.find(item => item.key === 'master-hack')?.sets, 4);
  assert.equal(view.difficulty, 'demanding');
  assert.match(view.objective, /power/);
  assert.match(view.intensity, /RPE 8/);
  assert.match(view.intensity, /No automatic training to failure/);
  assert.equal(view.duration, '70–85 min');
  assert.equal(view.changes.length, 0);
  assert.equal(view.workingSets, plan.exercises.reduce((sum, item) => sum + item.sets, 0));
  assert.equal(view.readiness, 'unrecorded');
  assert.match(view.missingContext.join(' '), /not treated as zero/);
  assert.deepEqual(plan, before);
});

test('unconfirmed lifting explains two-set RPE5 preparation and scales the inherited full-session time honestly', () => {
  const options = { ...settings, clearance: undefined }, plan = getWednesday(options);
  const view = getWorkoutPrescription({ plan, originalPlan: base[2], settings: options, date: '2026-10-21' });
  assert.equal(view.label, 'Preparation');
  assert.equal(view.difficulty, 'light');
  assert.ok(codes(view).includes('clearance-lifting-unknown'));
  assert.ok(codes(view).includes('clearance-impact-unknown'));
  assert.match(view.reasons.find(reason => reason.code === 'clearance-lifting-unknown')!.detail, /at most two easy sets, RPE 5/);
  assert.equal(view.durationEstimated, true);
  assert.match(view.duration, /estimate/);
  assert.notEqual(view.duration, base[2].durationRange);
  const hack = view.changes.find(change => change.key === 'master-hack')!;
  assert.match(hack.before, /4 × 4–6 reps/);
  assert.match(hack.after, /2 × 4–6 reps/);
  assert.match(hack.after, /planned 0 kg/);
  assert.match(hack.after, /RPE 5/);
  assert.ok(view.changes.some(change => change.key === 'master-cmj' && change.kind === 'removed'));
});

test('impact-only restriction does not claim that full allowed strength has become preparation', () => {
  const options: MasterProgramSettings = { ...settings, clearance: { impact: 'restricted', heavyLifting: 'cleared' } };
  const plan = getWednesday(options), view = getWorkoutPrescription({ plan, originalPlan: base[2], settings: options, date: '2026-10-21' });
  assert.ok(codes(view).includes('clearance-impact-restricted'));
  assert.equal(codes(view).some(code => code.startsWith('clearance-lifting-')), false);
  assert.equal(view.difficulty, 'demanding');
  assert.equal(plan.exercises.find(item => item.key === 'master-hack')?.sets, 4);
});

test('allowed bodyweight power remains distinct from restricted heavy strength preparation', () => {
  const options: MasterProgramSettings = { ...settings, clearance: { impact: 'cleared', heavyLifting: 'restricted' } };
  const view = getWorkoutPrescription({ plan: getWednesday(options), originalPlan: base[2], settings: options, date: '2026-10-21' });
  assert.equal(view.label, 'Power + preparation');
  assert.equal(view.difficulty, 'moderate');
  assert.ok(codes(view).includes('clearance-lifting-restricted'));
  assert.equal(codes(view).some(code => code.startsWith('clearance-impact-')), false);
  assert.match(view.intensity, /full prescribed rest/);
});

test('yellow, deload and retest reductions are independently explained from recorded dates', () => {
  const yellow: MasterProgramSettings = { ...settings, readiness: [{ date: '2026-10-21', status: 'yellow' }] };
  const scenarios = [
    { options: yellow, date: '2026-10-21', reason: 'readiness-yellow', hackSets: 3 },
    { options: settings, date: '2026-11-11', reason: 'deload', hackSets: 3 },
    { options: settings, date: '2026-12-09', reason: 'retest', hackSets: 2 },
  ];
  for (const scenario of scenarios) {
    const plan = getWednesday(scenario.options, scenario.date);
    const view = getWorkoutPrescription({ plan, originalPlan: base[2], settings: scenario.options, date: scenario.date });
    assert.ok(codes(view).includes(scenario.reason));
    assert.equal(plan.exercises.find(item => item.key === 'master-hack')?.sets, scenario.hackSets);
    assert.equal(view.difficulty, 'light');
    assert.equal(codes(view).some(code => code.startsWith('clearance-lifting-')), false);
  }
});

test('a snapshot is not retrospectively assigned current clearance, readiness, deload or base changes', () => {
  const snapshot = structuredClone(base[2]);
  const now: MasterProgramSettings = { ...settings, startDate: '2026-09-28', clearance: { impact: 'restricted', heavyLifting: 'restricted' },
    readiness: [{ date: '2026-10-21', status: 'red' }] };
  const differentBase = { ...structuredClone(base[2]), exercises: [] };
  const view = getWorkoutPrescription({ plan: snapshot, originalPlan: differentBase, settings: now, guidance: now.clearance, date: '2026-10-21', source: 'snapshot' });
  assert.deepEqual(codes(view), ['saved-snapshot']);
  assert.equal(view.difficulty, 'demanding');
  assert.equal(view.readiness, 'unrecorded');
  assert.equal(view.changes.length, 0);
  assert.equal(view.duration, snapshot.durationRange);
  assert.equal(view.missingContext.length, 0);
});

test('an older preparation snapshot is labeled honestly without guessing its original reduction cause', () => {
  const snapshot = getWednesday({ ...settings, clearance: undefined });
  const view = getWorkoutPrescription({ plan: snapshot, settings, date: '2026-10-21', source: 'snapshot' });
  assert.deepEqual(codes(view), ['saved-snapshot', 'saved-preparation']);
  assert.match(view.reasons[1].detail, /cannot establish why/);
  assert.equal(view.label, 'Preparation');
  assert.equal(view.duration, 'Short preparation · time varies');
});

test('explicit guidance on a plain custom week is explained without fabricating a master version', () => {
  const { programRevision: _revision, ...plain } = structuredClone(base[2]);
  const guidance: TrainingGuidance = { impact: 'restricted', heavyLifting: 'unknown' };
  const plan = applyTrainingGuidance(plain, guidance);
  const view = getWorkoutPrescription({ plan, originalPlan: plain, guidance, date: '2026-10-21', source: 'today-edit' });
  assert.ok(codes(view).includes('clearance-lifting-unknown'));
  assert.ok(codes(view).includes('clearance-impact-restricted'));
  assert.ok(codes(view).includes('today-edit'));
  assert.equal(plan.programRevision, undefined);
  assert.equal(view.sourceLabel, 'Your workout for this date');
});

test('match preparation and a user-moved lower session explain the schedule without creating debt', () => {
  const match: MasterProgramSettings = { ...settings, matchWeeks: [1] };
  const primer = resolveMasterProgramPlan(base, match, '2026-10-24')[5];
  const view = getWorkoutPrescription({ plan: primer, settings: match, date: '2026-10-24' });
  assert.match(view.reasons.find(reason => reason.code === 'match-week')!.detail, /no catch-up/);
  const moved: MasterProgramSettings = { ...settings, rescheduledLowerDates: ['2026-10-24'] };
  const sunday = resolveMasterProgramPlan(base, moved, '2026-10-25')[6];
  assert.ok(codes(getWorkoutPrescription({ plan: sunday, settings: moved, date: '2026-10-25' })).includes('moved-session'));
  const recovery = getWorkoutPrescription({ plan: base[6], settings, date: '2026-10-25' });
  assert.equal(recovery.difficulty, 'light');
  assert.match(recovery.progression, /do not create training debt/);
});

test('out-of-block readiness is not reported as an applied adjustment', () => {
  const after: MasterProgramSettings = { ...settings, readiness: [{ date: '2026-12-16', status: 'red' }] };
  const view = getWorkoutPrescription({ plan: base[2], settings: after, date: '2026-12-16' });
  assert.equal(view.readiness, 'unrecorded');
  assert.equal(view.difficulty, 'demanding');
  assert.equal(codes(view).includes('readiness-red'), false);
});

test('before/after differences retain optionality, equipment, planned load and actual logging configuration', () => {
  const original = structuredClone(base[2]);
  const next = structuredClone(original);
  Object.assign(next.exercises[1], { defaultKg: 0, equipmentLabel: 'New Hack machine', optionalWork: true });
  Object.assign(next.exercises[2], { mode: 'bodyweight', name: 'Custom bodyweight hinge' });
  next.exercises.pop();
  const changes = compareWorkoutPrescriptions(original, next);
  const machine = changes.find(change => change.key === 'master-hack')!;
  assert.match(machine.after, /planned 0 kg/);
  assert.match(machine.after, /New Hack machine/);
  assert.match(machine.after, /optional/);
  const configuration = changes.find(change => change.key === 'master-rdl')!;
  assert.match(configuration.before, /weight and reps/);
  assert.match(configuration.after, /bodyweight reps/);
  assert.ok(changes.some(change => change.kind === 'removed' && change.key === 'master-pallof'));
});

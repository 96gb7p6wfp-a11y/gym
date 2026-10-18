import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { getDailyMotivation, getProgressTakeaway } from '../src/coaching-summary.ts';
import { getPerformanceSummary, type PerformanceSummary } from '../src/performance-insights.ts';
import type { JumpEntry } from '../src/performance-data.ts';
import type { ReportSession } from '../src/weekly-report.ts';

const TODAY = '2026-10-18';
const jump = (date: string, cm: number, measurement: JumpEntry['measurement'] = 'height', type: JumpEntry['type'] = 'approach'): JumpEntry => ({ id: crypto.randomUUID(), date, type, measurement, cm, notes: '' });
const weight = (date: string, kg: number) => ({ date, payload: { kind: 'weight', kg, notes: '' } });
function session(date: string, loads: { name: string; kg: number; reps?: number }[]): ReportSession {
  const started = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []));
  started.runningSince = null;
  started.elapsedMs = 45 * 60_000;
  started.startedAt = new Date(`${date}T12:00:00Z`).getTime();
  const saved = SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + started.elapsedMs));
  const exercise = saved.exercises[0];
  saved.exercises = loads.map((load, index) => ({ ...exercise, key: `movement-${index}`, name: load.name, group: 'Strength', mode: 'weight', measurement: undefined, target: '6–8', sets: 3,
    logs: exercise.logs.slice(0, 3).map((log, set) => ({ ...log, id: `${date}-${index}-${set}`, done: true, kg: load.kg, reps: load.reps ?? 8, rir: 2 })) }));
  return SessionSchema.parse(saved);
}
const strength = (before: number[], after: number[]) => [
  session('2026-10-01', before.map((kg, index) => ({ name: ['Hack Squat', 'Chest-Supported Row', 'Incline Machine Press', 'Standing Calf Raise'][index], kg }))),
  session('2026-10-15', after.map((kg, index) => ({ name: ['Hack Squat', 'Chest-Supported Row', 'Incline Machine Press', 'Standing Calf Raise'][index], kg }))),
];
const weightWeeks = (first: number, second: number) => [
  ...['2026-10-05', '2026-10-07', '2026-10-09'].map(date => weight(date, first)),
  ...['2026-10-12', '2026-10-14', '2026-10-16'].map(date => weight(date, second)),
];
const recordedJumps = (first: number, second: number) => ({ jumps: [jump('2026-10-01', first), jump('2026-10-17', second)], readiness: [] });
const copy = (summary: PerformanceSummary) => {
  const result = getProgressTakeaway(summary);
  return `${result.observation} ${result.nextStep}`;
};

test('empty and profile-only records give an honest baseline without an overall improvement verdict', () => {
  const summary = getPerformanceSummary({ sessions: [], bodyWeight: 64, today: TODAY });
  assert.deepEqual(getProgressTakeaway(summary), {
    basis: 'baseline', observation: 'Your baseline starts here.',
    nextStep: 'Log a jump height, then repeat the same test.',
  });
  assert.doesNotMatch(copy(summary), /improv|stronger|recovered|\d+%/i);
});

test('one calf-raise gain is limited evidence, not the overall progress headline', () => {
  const sessions = [
    session('2026-10-01', [{ name: 'Standing Calf Raise', kg: 40 }]),
    session('2026-10-15', [{ name: 'Standing Calf Raise', kg: 48 }]),
  ];
  const summary = getPerformanceSummary({ sessions, today: TODAY });
  const takeaway = getProgressTakeaway(summary);
  assert.equal(takeaway.basis, 'baseline');
  assert.equal(takeaway.observation, 'You’ve logged 2 gym sessions, with one lifting gain; overall trends are still forming.');
  assert.equal(takeaway.nextStep, 'Track several key lifts and log an approach jump next.');
  assert.doesNotMatch(copy(summary), /Calf|8 kg|overall strength|strength is improving|performance is improving/i);
});

test('planned-day consistency provides real participation context without a fabricated fitness percentage', () => {
  const sessions = strength([70], [72.5]);
  const summary = getPerformanceSummary({ sessions, plan: DEFAULT_PROFILE.plan, today: TODAY });
  assert.notEqual(summary.consistencyPercent, null);
  assert.match(getProgressTakeaway(summary).observation, new RegExp(`${summary.consistencyPercent}% of planned gym days`));
  assert.doesNotMatch(copy(summary), /fitness|recovery score|stronger by/i);
});

test('lifting recorded within recovery sessions is acknowledged without inventing gym attendance', () => {
  const sessions = strength([40], [42.5]).map(saved => ({ ...saved, name: 'Recovery', kind: 'recovery' as const }));
  const summary = getPerformanceSummary({ sessions, today: TODAY });
  assert.equal(summary.gymSessions, 0);
  assert.match(getProgressTakeaway(summary).observation, /one lifting gain.*overall trends are still forming/);
  assert.doesNotMatch(copy(summary), /gym sessions|baseline starts here|strength is improving/);
});

test('broad gains summarize comparable movements while acknowledging unmeasured jump progress', () => {
  const summary = getPerformanceSummary({ sessions: strength([70, 40, 40], [72.5, 42.5, 42.5]), today: TODAY });
  assert.equal(getProgressTakeaway(summary).observation, 'Loads are rising across 3 tracked movements; jump progress is still unmeasured.');
  assert.equal(getProgressTakeaway(summary).nextStep, 'Log an approach jump next and keep training consistent.');
  assert.doesNotMatch(copy(summary), /Hack Squat|Chest-Supported Row|Incline Machine Press|\d+%/);
});

test('one outlier does not hide mixed progress or a broad decline', () => {
  const mixed = getPerformanceSummary({ sessions: strength([70, 40, 40], [80, 40, 35]), today: TODAY });
  assert.match(getProgressTakeaway(mixed).observation, /tracked lifts show mixed progress/);
  assert.doesNotMatch(copy(mixed), /Loads are rising|strength is improving/);
  const declining = getPerformanceSummary({ sessions: strength([70, 40, 40], [65, 35, 42.5]), today: TODAY });
  assert.match(getProgressTakeaway(declining).observation, /Loads are lower across 2 of 3 tracked movements/);
  assert.match(getProgressTakeaway(declining).nextStep, /controlled.*after recovery/);
  assert.doesNotMatch(getProgressTakeaway(declining).nextStep, /add|increase/);
});

test('majority gains show the denominator rather than pretending every tracked movement improved', () => {
  const summary = getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 35]), today: TODAY });
  assert.match(getProgressTakeaway(summary).observation, /rising across 2 of 3 tracked movements/);
});

test('copied names and unmatched rep counts cannot manufacture broad strength progress', () => {
  const same = ['Standing Calf Raise', 'Standing Calf Raise', ' Standing  Calf Raise '];
  const duplicated = getPerformanceSummary({ sessions: [
    session('2026-10-01', same.map(name => ({ name, kg: 40 }))),
    session('2026-10-15', same.map(name => ({ name, kg: 48 }))),
  ], today: TODAY });
  assert.equal(getProgressTakeaway(duplicated).basis, 'baseline');
  assert.match(getProgressTakeaway(duplicated).observation, /one lifting gain/);
  assert.doesNotMatch(copy(duplicated), /3 tracked movements|strength is improving/);
  const mismatched = getPerformanceSummary({ sessions: [
    session('2026-10-01', ['Hack Squat', 'Chest-Supported Row', 'Incline Machine Press'].map(name => ({ name, kg: 40, reps: 8 }))),
    session('2026-10-15', ['Hack Squat', 'Chest-Supported Row', 'Incline Machine Press'].map(name => ({ name, kg: 50, reps: 5 }))),
  ], today: TODAY });
  assert.equal(getProgressTakeaway(mismatched).basis, 'baseline');
  assert.doesNotMatch(copy(mismatched), /gain|rising|improv/);
});

test('jump-only gains remain positive while making the broader evidence limit clear', () => {
  const summary = getPerformanceSummary({ sessions: [], today: TODAY, performance: recordedJumps(65, 67.5) });
  assert.equal(getProgressTakeaway(summary).observation, 'Approach jump is up 2.5 cm; broader strength trends are still forming.');
  assert.equal(getProgressTakeaway(summary).nextStep, 'Keep training consistent and compare your key lifts next.');
});

test('jump and broad lifting gains are recognized together without an invented global improvement percentage', () => {
  const summary = getPerformanceSummary({ sessions: strength([70, 40, 40], [72.5, 42.5, 42.5]), today: TODAY, performance: recordedJumps(65, 67.5) });
  assert.equal(getProgressTakeaway(summary).observation, 'Approach jump is up 2.5 cm and tracked lifting loads are rising.');
  assert.doesNotMatch(copy(summary), /\d+%|unmeasured|still forming/);
});

test('touch and height protocols remain distinct and a flat approach result is not replaced by a better standing result', () => {
  const touch = getPerformanceSummary({ sessions: [], today: TODAY,
    performance: { jumps: [jump('2026-10-01', 315, 'touch'), jump('2026-10-17', 317.5, 'touch')], readiness: [] } });
  assert.match(getProgressTakeaway(touch).observation, /^Approach touch is up 2.5 cm/);
  assert.doesNotMatch(getProgressTakeaway(touch).observation, /jump is up/);
  const differentProtocols = getPerformanceSummary({ sessions: [], today: TODAY,
    performance: { jumps: [jump('2026-10-01', 65), jump('2026-10-17', 65), jump('2026-10-01', 50, 'height', 'standing'), jump('2026-10-17', 60, 'height', 'standing')], readiness: [] } });
  assert.match(getProgressTakeaway(differentProtocols).observation, /^Approach jump is steady/);
  assert.doesNotMatch(copy(differentProtocols), /10 cm|jump is up/);
});

test('declining jump performance takes priority over rising weight and lifting loads', () => {
  const stronger = getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 45]), today: TODAY, performance: recordedJumps(70, 65), nutritionRecords: weightWeeks(64, 64.5) });
  assert.equal(getProgressTakeaway(stronger).observation, 'Lifting loads are rising, but approach jump is down 5 cm.');
  assert.match(getProgressTakeaway(stronger).nextStep, /Retest under similar conditions/);
  assert.doesNotMatch(copy(stronger), /overtrained|injur|fatigue caused|increase load/);
  const heavier = getPerformanceSummary({ sessions: [], today: TODAY, performance: recordedJumps(70, 65), nutritionRecords: weightWeeks(64, 64.5) });
  assert.equal(getProgressTakeaway(heavier).observation, 'Weekly-average weight is rising, but approach jump is down 5 cm.');
});

test('recorded low readiness is considered before chasing otherwise improving performance', () => {
  const summary = getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 45]), today: TODAY, performance: {
    ...recordedJumps(65, 68), readiness: [{ id: crypto.randomUUID(), date: TODAY, energy: 'low', soreness: 'low' }],
  } });
  const takeaway = getProgressTakeaway(summary);
  assert.equal(takeaway.basis, 'load');
  assert.match(takeaway.observation, /jump is up 3 cm.*check-in suggests an easier day/);
  assert.match(takeaway.nextStep, /leave extra leg work out/);
  assert.doesNotMatch(copy(summary), /overtrained|recovery score|increase load/);
});

test('an increase in recorded work moderates an overall positive trend without claiming measured fatigue', () => {
  const loads = [70, 40, 40];
  const sessions = [
    session('2026-10-05', loads.map((kg, index) => ({ name: `Movement ${index}`, kg }))),
    session('2026-10-07', loads.map((kg, index) => ({ name: `Movement ${index}`, kg }))),
    session('2026-10-12', loads.map((kg, index) => ({ name: `Movement ${index}`, kg: kg + 20 }))),
    session('2026-10-14', loads.map((kg, index) => ({ name: `Movement ${index}`, kg: kg + 20 }))),
  ];
  const summary = getPerformanceSummary({ sessions, today: TODAY });
  assert.equal(summary.load.level, 'higher');
  assert.match(getProgressTakeaway(summary).observation, /Loads are rising.*training work also needs attention/);
  assert.match(getProgressTakeaway(summary).nextStep, /skip extra leg volume/);
  assert.doesNotMatch(copy(summary), /fatigued|overtrained|fully recovered/);
});

test('weekly weight and broad lifting progress are connected without reacting to individual weigh-ins', () => {
  const summary = getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 45]), today: TODAY, nutritionRecords: weightWeeks(64, 64.5) });
  assert.equal(getProgressTakeaway(summary).observation, 'Loads are rising across 3 tracked movements; weekly-average weight is up 0.5 kg.');
  const sparse = getPerformanceSummary({ sessions: [], nutritionRecords: [weight('2026-10-01', 64), weight('2026-10-15', 65)], today: TODAY });
  assert.equal(getProgressTakeaway(sparse).basis, 'baseline');
  assert.doesNotMatch(copy(sparse), /weight is up|1 kg/);
});

test('three adequately sampled stable weeks justify optional fueling advice without changing targets', () => {
  const nutritionRecords = ['2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09'].map(date => weight(date, 64));
  const before = JSON.stringify(nutritionRecords);
  const summary = getPerformanceSummary({ sessions: [], nutritionRecords, today: TODAY });
  assert.match(getProgressTakeaway(summary).observation, /weekly-average weight has been stable for 3 weeks/i);
  assert.match(getProgressTakeaway(summary).nextStep, /^Consider \+100–150 kcal\/day/);
  assert.equal(JSON.stringify(nutritionRecords), before);
});

test('old or single jump tests never supply a recent improvement or a made-up whole-picture verdict', () => {
  const summary = getPerformanceSummary({ sessions: [], today: TODAY, performance: {
    jumps: [jump('2026-08-01', 65), jump('2026-10-17', 68)], readiness: [],
  } });
  assert.equal(getProgressTakeaway(summary).basis, 'baseline');
  assert.match(getProgressTakeaway(summary).observation, /recent comparison is still missing/);
  assert.doesNotMatch(copy(summary), /up 3 cm|improving|stronger|recovered/);
});

test('overall summaries stay short, limited to two sentences, and leave source records untouched', () => {
  const summaries = [
    getPerformanceSummary({ sessions: [], today: TODAY }),
    getPerformanceSummary({ sessions: strength([70], [75]), plan: DEFAULT_PROFILE.plan, today: TODAY }),
    getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 45]), today: TODAY }),
    getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 40, 35]), today: TODAY }),
    getPerformanceSummary({ sessions: strength([70, 40, 40], [65, 35, 35]), today: TODAY }),
    getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 45]), today: TODAY, performance: recordedJumps(65, 67.5) }),
    getPerformanceSummary({ sessions: strength([70, 40, 40], [75, 45, 45]), today: TODAY, performance: recordedJumps(70, 65), nutritionRecords: weightWeeks(64, 64.5) }),
  ];
  const sentences = new Intl.Segmenter('en', { granularity: 'sentence' });
  for (const summary of summaries) {
    const before = JSON.stringify(summary);
    const result = copy(summary);
    assert.ok(result.split(/\s+/).length <= 40, result);
    assert.equal([...sentences.segment(result)].length, 2, result);
    assert.equal(JSON.stringify(summary), before);
  }
});

test('quiet daily encouragement remains available without encouraging extra training demands', () => {
  assert.match(getDailyMotivation({ kind: 'recovery' }), /Easy movement.*fresher legs/);
  assert.match(getDailyMotivation({ kind: 'sport' }), /next play/);
  assert.equal(getDailyMotivation({ kind: 'strength', active: true }), 'One clean set at a time.');
  assert.match(getDailyMotivation({ kind: 'strength', completed: true }), /Recovery is part/);
  for (const kind of ['strength', 'sport', 'recovery'] as const) assert.doesNotMatch(getDailyMotivation({ kind }), /failure|extra sets|no pain|push through/i);
});

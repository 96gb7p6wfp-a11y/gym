import assert from 'node:assert/strict';
import test from 'node:test';
import { createReachJumpEntries, JumpEntrySchema, type JumpEntry } from '../src/performance-data.ts';
import { getApproachAdvantage, getPerformanceSummary } from '../src/performance-insights.ts';
import { getTrainingExposureSummary, type TrainingExposure } from '../src/training-exposure.ts';

const today = '2026-11-03';
const pair = (date = today, standing = 300, approach = 310, conditions = 'Same court and shoes') =>
  createReachJumpEntries({ date, standingReachCm: 235, standingTouchCm: standing, approachTouchCm: approach, conditions });

test('Approach Advantage compares a measured pair, retaining the test date and percentage denominator', () => {
  const jumps = pair();
  const snapshot = JSON.stringify(jumps);
  assert.equal(jumps[0].testId, jumps[1].testId);
  assert.ok(jumps[0].testId);
  const result = getApproachAdvantage(jumps, today);
  assert.deepEqual(result.latest, { date: today, standingCm: 65, approachCm: 75, advantageCm: 10,
    advantagePercent: 15.4, standingId: jumps[0].id, approachId: jumps[1].id,
    standingReachCm: 235, conditions: 'Same court and shoes' });
  assert.equal(result.change30Days, null);
  assert.equal(JSON.stringify(jumps), snapshot);
});

test('negative and zero differences are reported honestly, never clamped to a benefit', () => {
  assert.equal(getApproachAdvantage(pair(today, 310, 300), today).latest?.advantageCm, -10);
  assert.equal(getApproachAdvantage(pair(today, 310, 310), today).latest?.advantagePercent, 0);
});

test('Approach Advantage does not pair different tests, dates, reaches, estimates, or absolute touches', () => {
  const valid = pair();
  const incompatible: JumpEntry[][] = [
    [valid[0], pair()[1]],
    [valid[0], { ...valid[1], date: '2026-11-02' }],
    [valid[0], { ...valid[1], standingReachCm: 236, cm: 74 }],
    [valid[0], { ...valid[1], source: 'video-estimate' }],
    [valid[0], { ...valid[1], conditions: 'Different court' }],
    valid.map(entry => ({ ...entry, date: '2026-11-04' })),
    valid.map(entry => ({ id: entry.id, date: entry.date, type: entry.type, measurement: 'touch', cm: entry.touchCm!, notes: '' })),
    valid.map(entry => ({ id: entry.id, date: entry.date, type: entry.type, measurement: 'height', cm: entry.cm, notes: '' })),
  ];
  for (const jumps of incompatible) assert.equal(getApproachAdvantage(jumps, today).latest, null);
});

test('unambiguous legacy reach pairs work without adding pairing IDs or reclassifying old records', () => {
  const legacy = pair().map(({ testId, ...entry }) => entry);
  const snapshot = JSON.stringify(legacy);
  assert.equal(getApproachAdvantage(legacy, today).latest?.advantageCm, 10);
  assert.equal(JSON.stringify(legacy), snapshot);
  assert.equal(JumpEntrySchema.parse(legacy[0]).testId, undefined);
  assert.equal(getApproachAdvantage([...legacy, { ...legacy[0], id: crypto.randomUUID(), cm: 64, touchCm: 299 }], today).latest, null);
});

test('multiple same-day pairs do not select a favorable test; 30-day changes require comparable recorded setups', () => {
  assert.equal(getApproachAdvantage([...pair(), ...pair(today, 300, 320)], today).latest, null);
  const earlier = pair('2026-10-20', 300, 306);
  const later = pair(today, 302, 312);
  assert.equal(getApproachAdvantage([...earlier, ...later], today).change30Days, 4);
  assert.equal(getApproachAdvantage([...earlier, ...pair(today, 302, 312, 'Outdoor court')], today).change30Days, null);
  assert.equal(getApproachAdvantage([...pair('2026-09-20'), ...later], today).change30Days, null);
});

const session = (id: string, exposure?: TrainingExposure) => ({ id, date: today, name: 'Volleyball',
  kind: 'sport', status: 'completed', deletedAt: null, trainingExposure: exposure, exercises: [] });
const activity = (id: string, exposure?: TrainingExposure) => ({ version: 1,
  activity: { id, date: today, name: 'School PE', deletedAt: null as number | null, trainingExposure: exposure } });
const summary = (sessions: ReturnType<typeof session>[], activities: ReturnType<typeof activity>[] = []) =>
  getTrainingExposureSummary({ sessions, activities, startDate: today, endDate: today });

test('counts without a source remain unclassified; zero counted contacts are distinct from no count', () => {
  const sessions = [session('counted', { hardJumpContacts: 12, contactSource: 'recorded' }),
    session('estimate', { hardJumpContacts: 20, contactSource: 'estimate' }),
    session('legacy', { hardJumpContacts: 15 }), session('zero', { hardJumpContacts: 0, contactSource: 'recorded' }), session('unknown')];
  const snapshot = JSON.stringify(sessions);
  const result = summary(sessions);
  assert.equal(result.recordedVolleyballContacts, 12);
  assert.equal(result.estimatedSportContacts, 20);
  assert.equal(result.unclassifiedSportContacts, 15);
  assert.equal(result.unmeasuredSportSessions, 1);
  assert.equal(JSON.stringify(sessions), snapshot);
});

test('explicit other sports count, with duplicates, active and deleted records excluded', () => {
  const counted = session('same-record', { hardJumpContacts: 12, contactSource: 'recorded' });
  const result = summary([counted, counted, { ...session('active', { hardJumpContacts: 50, contactSource: 'recorded' }), status: 'active' }], [
    activity('same-record', { hardJumpContacts: 12, contactSource: 'recorded' }),
    activity('basketball', { sport: 'other', hardJumpContacts: 8, contactSource: 'recorded' }),
    { ...activity('deleted', { hardJumpContacts: 30, contactSource: 'recorded' }), activity: { ...activity('deleted').activity, deletedAt: 1 } },
  ]);
  assert.equal(result.recordedVolleyballContacts, 12);
  assert.equal(result.recordedPeContacts, 0);
  assert.equal(result.recordedOtherContacts, 8);
  assert.equal(result.volleyballSessions, 1);
});


test('performance insights describe a fresh paired test without claiming transfer or inventing one', () => {
  const measured = pair();
  const result = getPerformanceSummary({ sessions: [], today, performance: { jumps: measured, readiness: [] } });
  assert.ok(result.insights.some(insight => insight.includes('Approach Advantage: +10 cm') && insight.includes(today)));
  assert.ok(result.insights.some(insight => insight.includes('not a training effect')));
  const estimated = measured.map(entry => ({ ...entry, source: 'video-estimate' as const }));
  assert.equal(getPerformanceSummary({ sessions: [], today, performance: { jumps: estimated, readiness: [] } }).insights.some(insight => insight.includes('Approach Advantage')), false);
});

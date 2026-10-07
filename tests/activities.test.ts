import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVITY_TYPES, ExtraActivitySchema, estimateActivity } from '../src/activities.ts';
import type { ExtraActivity } from '../src/activities.ts';

function activity(changes: Partial<ExtraActivity> = {}): ExtraActivity {
  return {
    id: 'extra-run',
    date: '2026-10-07',
    type: 'run',
    name: 'Evening run',
    durationMinutes: 30,
    distanceKm: 5,
    intensity: 'moderate',
    bodyWeightKg: 80,
    watchCalories: null,
    notes: '',
    createdAt: 1_791_374_400_000,
    deletedAt: null,
    ...changes,
  };
}

test('five-kilometre running uses the stored weight and a distance-based active-energy estimate', () => {
  const estimate = estimateActivity(activity());
  assert.equal(estimate.calories, 400);
  assert.equal(estimate.met, null);
  assert.match(estimate.method, /level, continuous running/);
  assert.match(estimate.source, /ACSM/);
  assert.equal(estimateActivity(activity({ durationMinutes: 50, intensity: 'easy' })).calories, 400);
  assert.equal(estimateActivity(activity({ distanceKm: 5.25, bodyWeightKg: 75 })).calories, 394);
});

test('running without distance uses duration and intensity with resting energy removed', () => {
  const estimate = estimateActivity(activity({ distanceKm: null }));
  assert.equal(estimate.met, 8.3);
  assert.equal(estimate.calories, 307);
  assert.notEqual(estimate.calories, Math.round(8.3 * 3.5 * 80 / 200 * 30));
  assert.match(estimate.method, /1 resting MET/);
  assert.equal(estimateActivity(activity({ distanceKm: null, intensity: 'easy' })).calories, 210);
  assert.equal(estimateActivity(activity({ distanceKm: null, intensity: 'hard' })).calories, 420);
});

test('cycling effort selects the stated net-MET model rather than the running distance shortcut', () => {
  const bike = activity({ type: 'cycle', name: 'Bike ride', durationMinutes: 60, distanceKm: 20 });
  const moderate = estimateActivity(bike);
  assert.equal(moderate.met, 6.8);
  assert.equal(moderate.calories, 487);
  assert.equal(estimateActivity({ ...bike, distanceKm: null }).calories, moderate.calories);
  assert.equal(estimateActivity({ ...bike, intensity: 'easy' }).calories, 252);
  assert.equal(estimateActivity({ ...bike, intensity: 'hard' }).calories, 756);
});

test('walking, swimming and other activities use distinct effort assumptions', () => {
  for (const [type, intensity, met] of [
    ['walk', 'easy', 2.8], ['walk', 'moderate', 3.8], ['walk', 'hard', 4.8],
    ['swim', 'easy', 5.8], ['swim', 'moderate', 8], ['swim', 'hard', 9.8],
    ['other', 'easy', 3], ['other', 'moderate', 5], ['other', 'hard', 8],
  ] as const) {
    const estimate = estimateActivity(activity({ type, intensity, distanceKm: null }));
    assert.equal(estimate.met, met);
    assert.equal(estimate.calories, Math.round((met - 1) * 3.5 * 80 / 200 * 30));
    assert.match(estimate.source, /https:\/\/pacompendium.com\//);
  }
  assert.match(estimateActivity(activity({ type: 'other' })).method, /broad effort assumption/);
  assert.deepEqual(ACTIVITY_TYPES.map(({ value }) => value), ['run', 'cycle', 'walk', 'swim', 'other']);
});

test('a watch entry overrides all estimates, including a legitimate zero reading', () => {
  for (const watchCalories of [0, 175, 175.5, 20_000]) {
    const estimate = estimateActivity(activity({ watchCalories }));
    assert.equal(estimate.calories, watchCalories);
    assert.equal(estimate.met, null);
    assert.match(estimate.method, /Watch-reported active calories/);
  }
});

test('logged body weight remains an independent snapshot and the calculation does not mutate the log', () => {
  const profile = { bodyWeightKg: 80 };
  const saved = activity({ bodyWeightKg: profile.bodyWeightKg });
  const snapshot = structuredClone(saved);
  profile.bodyWeightKg = 65;
  assert.equal(estimateActivity(saved).calories, 400);
  assert.deepEqual(saved, snapshot);
  assert.equal(estimateActivity(activity({ bodyWeightKg: profile.bodyWeightKg })).calories, 325);
});

test('calendar dates reject nonexistent days and accept leap days without time-zone conversion', () => {
  for (const date of ['2024-02-29', '2026-10-07', '2026-12-31']) {
    assert.equal(ExtraActivitySchema.safeParse(activity({ date })).success, true, date);
  }
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '2026-1-07', '2026-10-07T00:00:00Z']) {
    assert.equal(ExtraActivitySchema.safeParse(activity({ date })).success, false, date);
  }
});

test('validation requires all fields, trims the activity name and supports soft deletion', () => {
  const parsed = ExtraActivitySchema.parse(activity({ name: '  Evening run  ', deletedAt: 1_791_374_500_000 }));
  assert.equal(parsed.name, 'Evening run');
  assert.equal(parsed.deletedAt, 1_791_374_500_000);
  const complete = activity();
  for (const key of Object.keys(complete)) {
    const incomplete: Record<string, unknown> = { ...complete };
    delete incomplete[key];
    assert.equal(ExtraActivitySchema.safeParse(incomplete).success, false, key);
  }
});

test('validation rejects out-of-bounds numbers, nonfinite values and invalid activity fields', () => {
  for (const changes of [
    { id: '' }, { id: 'a'.repeat(101) }, { name: '   ' }, { name: 'a'.repeat(101) },
    { type: 'volleyball' }, { intensity: 'maximum' }, { notes: 'a'.repeat(1_001) },
    { durationMinutes: 0 }, { durationMinutes: 601 }, { durationMinutes: NaN }, { durationMinutes: Infinity },
    { distanceKm: 0 }, { distanceKm: -1 }, { distanceKm: 301 }, { distanceKm: Infinity },
    { bodyWeightKg: 19 }, { bodyWeightKg: 401 }, { bodyWeightKg: NaN },
    { watchCalories: -1 }, { watchCalories: 20_001 }, { watchCalories: Infinity },
    { createdAt: 0 }, { createdAt: -1 }, { createdAt: Infinity },
    { deletedAt: 0 }, { deletedAt: -1 }, { deletedAt: NaN },
  ]) {
    assert.equal(ExtraActivitySchema.safeParse({ ...activity(), ...changes }).success, false, JSON.stringify(changes));
  }
  assert.equal(ExtraActivitySchema.safeParse(activity({ durationMinutes: 1, distanceKm: 300, bodyWeightKg: 20, watchCalories: 0 })).success, true);
  assert.equal(ExtraActivitySchema.safeParse(activity({ durationMinutes: 600, distanceKm: null, bodyWeightKg: 400, watchCalories: 20_000 })).success, true);
});

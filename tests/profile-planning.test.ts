import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';

test('new profile uses the confirmed personal details and recurring Berlin volleyball times', () => {
  const profile = ProfileSchema.parse(DEFAULT_PROFILE);
  assert.equal(profile.bodyWeight, 64);
  assert.deepEqual(profile.nutrition, { age: 18, heightCm: 180, sex: 'male', activityFactor: 1.65, surplusKcal: 200 });
  assert.deepEqual(profile.volleyballSchedule, { days: [1, 4], startTime: '20:00', endTime: '22:00', timeZone: 'Europe/Berlin' });
});

test('old profiles keep their weight and missing optional fields while invalid new planning fields fail', () => {
  const { nutrition, volleyballSchedule, ...oldProfile } = structuredClone(DEFAULT_PROFILE);
  oldProfile.bodyWeight = 61;
  assert.deepEqual(ProfileSchema.parse(oldProfile), oldProfile);
  const invalid = [
    { nutrition: { ...nutrition, age: 17 } },
    { nutrition: { ...nutrition, heightCm: Number.NaN } },
    { volleyballSchedule: { ...volleyballSchedule, days: [1, 1] } },
    { volleyballSchedule: { ...volleyballSchedule, startTime: '24:00' } },
    { volleyballSchedule: { ...volleyballSchedule, endTime: '19:00' } },
  ];
  for (const fields of invalid) assert.equal(ProfileSchema.safeParse({ ...oldProfile, ...fields }).success, false);
});

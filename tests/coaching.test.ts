import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExtraActivity } from '../src/activities.ts';
import { getDailyGuidance, getShortRoutine, type DailyGuidanceInput } from '../src/coaching.ts';

function activity(overrides: Partial<ExtraActivity> = {}): ExtraActivity {
  return {
    id: 'extra-run', date: '2026-10-07', type: 'run', name: '5 km run',
    durationMinutes: 30, distanceKm: 5, intensity: 'easy', bodyWeightKg: 80,
    watchCalories: null, notes: '', createdAt: 1, deletedAt: null,
    ...overrides,
  };
}

function guidance(overrides: Partial<DailyGuidanceInput> = {}) {
  return getDailyGuidance({
    date: '2026-10-07', bodyWeightKg: 80, plannedKind: 'strength',
    plannedName: 'Upper Power + Muscle', extraActivities: [],
    completedTrainingMinutes: 0, ...overrides,
  });
}

test('an optional easy run has useful intensity and progression guidance, without changing the plan', () => {
  const input: DailyGuidanceInput = {
    date: '2026-10-07', bodyWeightKg: 80, plannedKind: 'strength',
    plannedName: 'Upper Power + Muscle', extraActivities: [activity()],
    completedTrainingMinutes: 0,
  };
  const original = structuredClone(input);
  const result = getDailyGuidance(input);
  assert.equal(result.training.length, 3);
  assert.equal(result.nutrition.length, 3);
  assert.match(result.training[0], /20–40 minutes/);
  assert.match(result.training[1], /extra 30 minutes/);
  assert.match(result.training[2], /speak in full sentences/);
  assert.deepEqual(input, original);
});

test('hard running around lower strength and jumps receives a specific load warning', () => {
  for (const plannedName of ['Lower Strength', 'Main Jump + Complex Lower', 'Jump Technique Primer']) {
    const result = guidance({ plannedName, extraActivities: [activity({ intensity: 'hard' })] });
    assert.match(result.training[0], /hard run or ride/);
    assert.match(result.training[0], /lower-body or jump/);
    assert.match(result.training[0], /separate day when recovered/);
  }
});

test('easy cardio beside a lower-body workout stays easy and avoids intervals', () => {
  const result = guidance({ plannedName: 'Lower Strength', extraActivities: [activity()] });
  assert.match(result.training[0], /Keep extra cardio easy/);
  assert.match(result.training[0], /avoid a hard 5 km run/);
});

test('volleyball guidance limits optional cardio and allows separation between sessions', () => {
  const result = guidance({
    plannedKind: 'sport', plannedName: 'Volleyball',
    extraActivities: [activity({ type: 'cycle', distanceKm: 8 })],
  });
  assert.match(result.training[0], /20–30 minutes of easy cycling or walking/);
  assert.match(result.training[0], /several hours between sessions/);
  assert.match(result.training[0], /avoid another hard leg session/);
});

test('an unlogged recovery day does not pressure the user to add cardio', () => {
  const result = guidance({ plannedKind: 'recovery', plannedName: 'Recovery' });
  assert.match(result.training[0], /Preserve your recovery day/);
  assert.match(result.training[1], /do not need to add an activity/);
  assert.match(result.nutrition[1], /240–400 g\/day \(3–5 g\/kg\)/);
});

test('a hard ride added to a recovery day is treated as load rather than rest', () => {
  const result = guidance({
    plannedKind: 'recovery', plannedName: 'Recovery',
    extraActivities: [activity({ type: 'cycle', intensity: 'hard', durationMinutes: 75 })],
  });
  assert.match(result.training[0], /adds training load to a recovery day/);
  assert.match(result.training[0], /Keep the rest of today restful/);
});

test('short easy cardio does not require gels while a hard long session gets a fueling range', () => {
  const short = guidance({ extraActivities: [activity()] });
  assert.match(short.nutrition[2], /usually need no gels/);
  assert.doesNotMatch(short.nutrition[2], /30–60 g/);
  const long = guidance({ extraActivities: [activity({ intensity: 'hard', durationMinutes: 90 })] });
  assert.match(long.nutrition[2], /30–60 g carbohydrate\/hour/);
  assert.match(long.nutrition[2], /Drink to thirst/);
  const easyLong = guidance({ extraActivities: [activity({ durationMinutes: 90 })] });
  assert.doesNotMatch(easyLong.nutrition[2], /30–60 g/);
});

test('ninety combined minutes strengthen recovery advice and use a moderate carbohydrate range', () => {
  const result = guidance({ completedTrainingMinutes: 60, extraActivities: [activity()] });
  assert.match(result.training[1], /90 minutes of combined activity/);
  assert.match(result.training[1], /Skip another hard session/);
  assert.match(result.nutrition[1], /400–560 g\/day \(5–7 g\/kg\)/);
  assert.match(result.nutrition[1], /prioritize a carbohydrate-rich recovery meal/);
  assert.match(result.nutrition[1], /saved targets stay unchanged/);
  assert.doesNotMatch(guidance({ completedTrainingMinutes: 59, extraActivities: [activity()] }).nutrition[1], /prioritize a carbohydrate-rich/);
});

test('scheduled training informs fueling before logging without claiming the workout is complete', () => {
  for (const [plannedName, plannedTrainingMinutes] of [['Lower Strength', 65], ['Volleyball', 120]] as const) {
    const result = guidance({ plannedName, plannedTrainingMinutes });
    assert.match(result.nutrition[1], /400–560 g\/day \(5–7 g\/kg\)/);
    assert.match(result.nutrition[1], /a planned day with around an hour or more of training/);
    assert.doesNotMatch(result.training.join(' '), /You have logged/);
  }
});

test('recovery templates do not force higher fueling and planned time does not duplicate recorded time', () => {
  const recovery = guidance({ plannedKind: 'recovery', plannedName: 'Recovery', plannedTrainingMinutes: 120 });
  assert.match(recovery.nutrition[1], /240–400 g\/day \(3–5 g\/kg\)/);
  assert.doesNotMatch(recovery.nutrition[1], /planned day with around an hour/);
  const partiallyLogged = guidance({
    plannedTrainingMinutes: 40, completedTrainingMinutes: 35,
    extraActivities: [activity({ durationMinutes: 10 })],
  });
  assert.match(partiallyLogged.nutrition[1], /240–400 g\/day/);
  assert.doesNotMatch(partiallyLogged.training.join(' '), /You have logged/);
  assert.match(guidance({ plannedTrainingMinutes: Number.NaN }).nutrition[1], /240–400 g\/day/);
});

test('deleted activities and other dates cannot inflate today’s load or fueling advice', () => {
  const result = guidance({ extraActivities: [
    activity({ deletedAt: 2, intensity: 'hard', durationMinutes: 120 }),
    activity({ id: 'tomorrow', date: '2026-10-08', intensity: 'hard', durationMinutes: 120 }),
  ] });
  assert.match(result.nutrition[1], /240–400 g\/day/);
  assert.doesNotMatch(result.training.join(' '), /combined activity|hard run or ride/);
  assert.doesNotMatch(result.nutrition[2], /30–60 g/);
});

test('protein recommendations scale with body weight and remain rounded general ranges', () => {
  assert.match(guidance().nutrition[0], /112–160 g\/day \(1\.4–2\.0 g\/kg\)/);
  assert.match(guidance({ bodyWeightKg: 62.5 }).nutrition[0], /88–125 g\/day/);
  assert.match(guidance().nutrition[0], /20–40 g protein/);
  const unknownWeight = guidance({ bodyWeightKg: Number.NaN });
  assert.match(unknownWeight.nutrition[0], /1\.4–2\.0 g\/kg\/day/);
  assert.doesNotMatch(unknownWeight.nutrition.join(' '), /NaN|undefined/);
});

test('sources expose public references and callers cannot mutate the shared source list', () => {
  const first = guidance();
  assert.ok(first.sources.some((source) => /ISSN/.test(source.label)));
  assert.ok(first.sources.some((source) => /ACSM/.test(source.label)));
  assert.ok(first.sources.every((source) => /^https:\/\//.test(source.url)));
  first.sources[0].url = 'https://example.test';
  assert.notEqual(guidance().sources[0].url, first.sources[0].url);
});

test('short pre/post reminders give simple food, hydration and recovery steps before logging', () => {
  const input: DailyGuidanceInput = { date: '2026-10-07', bodyWeightKg: 80,
    plannedKind: 'strength', plannedName: 'Lower Strength', plannedTrainingMinutes: 65,
    extraActivities: [], completedTrainingMinutes: 0 };
  const before = structuredClone(input);
  const routine = getShortRoutine(input);
  assert.match(routine.before, /1–3 h before.*oats.*banana.*Drink to thirst/);
  assert.match(routine.after, /Cool down.*rice.*tofu.*20–40 g protein.*sleep/);
  assert.ok(routine.before.length <= 180 && routine.after.length <= 180);
  assert.deepEqual(input, before);
});

test('recovery reminders stay simple and switch when actual hard activity is added', () => {
  const input: DailyGuidanceInput = { date: '2026-10-07', bodyWeightKg: 80,
    plannedKind: 'recovery', plannedName: 'Recovery', plannedTrainingMinutes: 120,
    extraActivities: [], completedTrainingMinutes: 0 };
  assert.match(getShortRoutine(input).before, /No special workout snack/);
  assert.match(getShortRoutine(input).after, /Optional easy walking.*7–9 hours/);
  assert.match(getShortRoutine({ ...input, extraActivities: [activity({ type: 'cycle', intensity: 'hard', durationMinutes: 90 })] }).before, /30–60 g carbs\/hour/);
  assert.doesNotMatch(getShortRoutine({ ...input, extraActivities: [activity({ deletedAt: 2, intensity: 'hard' }), activity({ date: '2026-10-08', intensity: 'hard' })] }).before, /30–60/);
});

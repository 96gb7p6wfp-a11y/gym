import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateNutritionGoal, PERSONAL_NUTRITION_START, simpleFoodGuidance, validateNutritionGoalInput } from '../src/nutrition-goals.ts';

test('confirmed personal inputs give a transparent adult weight-gain starting estimate', () => {
  const input = structuredClone(PERSONAL_NUTRITION_START);
  assert.deepEqual(calculateNutritionGoal(input), {
    bmr: 1680, maintenanceKcal: 2772, calories: 3000, protein: 128, fat: 80, carbs: 442,
    proteinRange: [102, 141],
  });
  assert.deepEqual(input, PERSONAL_NUTRITION_START);
});

test('macros reconcile with calorie targets without adding logged exercise calories', () => {
  for (const bodyWeightKg of [50, 64, 85, 110]) {
    const result = calculateNutritionGoal({ ...PERSONAL_NUTRITION_START, bodyWeightKg });
    assert.ok(Math.abs(result.protein * 4 + result.carbs * 4 + result.fat * 9 - result.calories) <= 2);
    assert.ok(result.fat * 9 / result.calories >= 0.2);
    assert.ok(result.fat * 9 / result.calories <= 0.3);
    assert.ok(result.protein >= result.proteinRange[0] && result.protein <= result.proteinRange[1]);
  }
});

test('activity and surplus are editable assumptions, and equation options change maintenance', () => {
  const baseline = calculateNutritionGoal(PERSONAL_NUTRITION_START);
  assert.equal(calculateNutritionGoal({ ...PERSONAL_NUTRITION_START, surplusKcal: 0 }).calories, 2800);
  assert.ok(calculateNutritionGoal({ ...PERSONAL_NUTRITION_START, activityFactor: 1.4 }).calories < baseline.calories);
  assert.equal(calculateNutritionGoal({ ...PERSONAL_NUTRITION_START, sex: 'female' }).bmr, 1514);
});

test('invalid or non-adult inputs never yield apparently usable targets', () => {
  for (const changed of [{ age: 17 }, { age: 18.5 }, { age: Number.NaN }, { heightCm: 0 }, { bodyWeightKg: Number.POSITIVE_INFINITY }, { activityFactor: 0 }, { surplusKcal: 1000 }]) {
    assert.throws(() => calculateNutritionGoal({ ...PERSONAL_NUTRITION_START, ...changed }));
  }
});

test('an unspecified equation can be saved without inventing a precise calorie target', () => {
  const input = { ...PERSONAL_NUTRITION_START, sex: 'unspecified' as const };
  assert.doesNotThrow(() => validateNutritionGoalInput(input));
  assert.throws(() => calculateNutritionGoal(input), /set your targets manually/);
});

test('Tuesday and Friday receive short late-volleyball meal timing on the selected date', () => {
  for (const date of ['2026-10-06', '2026-10-09']) {
    const result = simpleFoodGuidance(date);
    assert.match(result.before, /20:00–22:00/);
    assert.match(result.before, /18:00–19:00/);
    assert.match(result.after, /After 22:00/);
    assert.ok(result.before.length < 180 && result.after.length < 180);
  }
  assert.match(simpleFoodGuidance('2026-10-08').before, /For a gym day/);
  assert.throws(() => simpleFoodGuidance('2026-02-30'));
});

test('custom volleyball days and timing update meal guidance rather than keeping old hours', () => {
  const schedule = { days: [2], startTime: '18:30', endTime: '20:30', timeZone: 'Europe/Berlin' };
  const custom = simpleFoodGuidance('2026-10-07', schedule);
  assert.match(custom.before, /18:30–20:30/);
  assert.match(custom.before, /16:30–17:30/);
  assert.match(custom.after, /After 20:30/);
  assert.doesNotMatch(simpleFoodGuidance('2026-10-06', schedule).before, /Volleyball/);
});

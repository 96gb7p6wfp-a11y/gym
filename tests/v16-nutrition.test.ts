import assert from 'node:assert/strict';
import test from 'node:test';
import { MealSchema, DEFAULT_PROFILE, sumNutrients } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { parseQuickMeal, scaleFood, macroCompleteness, hasPartialNutrition } from '../src/quick-nutrition.ts';

const quick = (extra = {}) => parseQuickMeal({ name: '', calories: '250', protein: '20', quantity: '1', ...extra });

test('quick nutrition stores unknown carbs/fat as null, never invented zero', () => {
  const meal = quick();
  assert.equal(meal.name, 'Quick meal');
  assert.deepEqual(meal.foods[0], { name: 'Quick meal', portion: 'portion', calories: 250, protein: 20, carbs: null, fat: null });
  assert.equal(hasPartialNutrition(meal.foods), true);
  assert.equal(macroCompleteness(meal.foods, 'carbs'), 'unknown');
  const explicitZero = quick({ carbs: '0', fat: '0' });
  assert.equal(hasPartialNutrition(explicitZero.foods), false);
  assert.equal(macroCompleteness(explicitZero.foods, 'fat'), 'complete');
});

test('quantity supports decimal comma and scales only known amounts', () => {
  const meal = quick({ name: 'Yogurt', calories: '125,5', protein: '12,5', carbs: '5', quantity: '1,5', favorite: true });
  assert.equal(meal.foods[0].calories, 188.25);
  assert.equal(meal.foods[0].protein, 18.75);
  assert.equal(meal.foods[0].carbs, 7.5);
  assert.equal(meal.foods[0].fat, null);
  assert.equal(meal.favorite, true);
  const original = structuredClone(meal.foods[0]);
  const scaled = scaleFood(original, 2);
  assert.equal(scaled.protein, 37.5);
  assert.equal(scaled.fat, null);
  assert.deepEqual(original, meal.foods[0]);
});

test('blank, malformed, negative and impossible amounts are rejected before saving', () => {
  for (const extra of [
    { calories: '' }, { protein: '' }, { calories: '-5' }, { protein: 'NaN' },
    { carbs: 'incomplete' }, { fat: '20001' }, { calories: '20.5.5' },
    { quantity: '0' }, { quantity: '21' }, { quantity: '1,2,3' },
    { calories: '20000', quantity: '2' },
  ]) assert.throws(() => quick(extra));
});

test('recorded macro subtotals distinguish partial data while preserving legacy totals', () => {
  const complete = { name: 'Rice', portion: 'Bowl', calories: 200, protein: 5, carbs: 40, fat: 2 };
  const foods = [complete, quick().foods[0]];
  assert.deepEqual(sumNutrients(foods), { calories: 450, protein: 25, carbs: 40, fat: 2 });
  assert.equal(macroCompleteness(foods, 'carbs'), 'partial');
  assert.equal(macroCompleteness([complete], 'fat'), 'complete');
  assert.equal(MealSchema.safeParse(quick()).success, true);
});

test('partial nutrition and favorites round-trip through version-one backup without replacing legacy data', async () => {
  const data = new Map<string, string>();
  const port = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
  const client = createLocalClient(port);
  await client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 });
  const meal = quick({ name: 'Lunch', favorite: true });
  await client.request('/api/nutrition', { id: 'meal', date: '2026-11-03', payload: meal, expectedVersion: 0 });
  const before = JSON.parse(data.get(STORAGE_KEY)!);
  const backup = client.exportBackup();
  client.importBackup(backup);
  const after = JSON.parse(data.get(STORAGE_KEY)!);
  assert.deepEqual(after.profile, before.profile);
  assert.deepEqual(after.sessions, before.sessions);
  assert.deepEqual(after.nutrition, before.nutrition);
  assert.equal(after.nutrition[0].payload.foods[0].fat, null);
  assert.equal(after.nutrition[0].payload.favorite, true);
});

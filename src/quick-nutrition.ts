import { MealSchema } from './domain.js';

export interface NutritionFood {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number | null;
  fat: number | null;
}

export interface QuickMealInput {
  name: string;
  calories: string;
  protein: string;
  carbs?: string;
  fat?: string;
  quantity?: string;
  favorite?: boolean;
}

function amount(raw: string | undefined, optional = false): number | null {
  const value = (raw ?? '').trim();
  if (!value) {
    if (optional) return null;
    throw new Error('Enter calories and protein. Use 0 only when you know the amount is zero.');
  }
  if (!/^\d+(?:[.,]\d+)?$/.test(value)) throw new Error('Enter a valid amount, such as 250 or 12.5.');
  const parsed = Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20000) throw new Error('Nutrition amounts must be between 0 and 20,000.');
  return parsed;
}

/** Scale only recorded amounts. Unknown macros stay unknown. */
export function scaleFood<T extends NutritionFood>(food: T, factor: number): T {
  if (!Number.isFinite(factor) || factor <= 0 || factor > 20) throw new Error('Choose a quantity above 0 and up to 20 portions.');
  const scaled = { ...food };
  for (const key of ['calories', 'protein', 'carbs', 'fat'] as const) {
    const value = food[key];
    const result = value == null ? null : Math.round(value * factor * 100) / 100;
    if (result != null && (!Number.isFinite(result) || result > 20000)) throw new Error('This quantity exceeds the maximum nutrition amount.');
    Object.assign(scaled, { [key]: result });
  }
  scaled.portion = factor === 1 ? food.portion : `${factor} × ${food.portion || 'portion'}`.slice(0, 100);
  return scaled;
}

/** Partial means some food amounts are unknown; zero remains a known amount. */
export function macroCompleteness(foods: readonly NutritionFood[], key: 'carbs' | 'fat'): 'complete' | 'partial' | 'unknown' {
  const known = foods.filter(food => typeof food[key] === 'number' && Number.isFinite(food[key])).length;
  return known === foods.length ? 'complete' : known === 0 ? 'unknown' : 'partial';
}

export function hasPartialNutrition(foods: readonly NutritionFood[]): boolean {
  return macroCompleteness(foods, 'carbs') !== 'complete' || macroCompleteness(foods, 'fat') !== 'complete';
}

/** Calories and protein are explicit; blank carbohydrate/fat entries are null. */
export function parseQuickMeal(input: QuickMealInput) {
  const rawQuantity = (input.quantity ?? '1').trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(rawQuantity)) throw new Error('Enter a quantity above 0 and up to 20 portions.');
  const quantity = Number(rawQuantity);
  const name = input.name.trim() || 'Quick meal';
  const food: NutritionFood = {
    name, portion: 'portion', calories: amount(input.calories)!, protein: amount(input.protein)!,
    carbs: amount(input.carbs, true), fat: amount(input.fat, true),
  };
  const result = MealSchema.safeParse({
    kind: 'meal', name, foods: [scaleFood(food, quantity)], source: 'manual', notes: '', assumptions: '', confidence: null,
    ...(input.favorite ? { favorite: true } : {}),
  });
  if (!result.success) throw new Error('Check the meal name and nutrition amounts.');
  return result.data;
}

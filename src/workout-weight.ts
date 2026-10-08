export const MAX_WORKOUT_WEIGHT_KG = 2_000;

export function isValidWorkoutWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= 0 && value <= MAX_WORKOUT_WEIGHT_KG;
}

/** Parse a decimal keyboard's dot or comma without clamping or reusing old data. */
export function parseWorkoutWeight(raw: string): { value: number | null; valid: boolean } {
  const text = raw.trim();
  if (text === '') return { value: null, valid: true };
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return { value: null, valid: false };
  const value = Number(text.replace(',', '.'));
  return isValidWorkoutWeight(value)
    ? { value, valid: true }
    : { value: null, valid: false };
}

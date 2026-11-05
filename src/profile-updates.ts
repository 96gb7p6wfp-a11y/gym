function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  }
  if (!object(left) || !object(right)) return false;
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys.every(key => equal(left[key], right[key]));
}

/**
 * Apply only deliberate changes from a view's original model to the latest
 * saved model. Unrelated preferences changed while awaiting a save stay put.
 * Arrays are intentional replacements, never merged by index or exercise name.
 */
export function rebaseObjectChanges<T>(base: T, current: T, desired: T): T {
  if (equal(base, desired)) return structuredClone(current);
  if (!object(base) || !object(current) || !object(desired)) return structuredClone(desired);
  const result: Record<string, unknown> = structuredClone(current);
  for (const key of new Set([...Object.keys(base), ...Object.keys(desired)])) {
    if (equal(base[key], desired[key])) continue;
    if (desired[key] === undefined) delete result[key];
    else result[key] = rebaseObjectChanges(base[key], current[key], desired[key]);
  }
  return result as T;
}

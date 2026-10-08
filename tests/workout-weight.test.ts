import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidWorkoutWeight, parseWorkoutWeight } from '../src/workout-weight.ts';

test('accepts fractional weights from dot and comma keyboards without rounding', () => {
  for (const [raw, value] of [['12.5', 12.5], ['12,5', 12.5], ['12.25', 12.25], ['0', 0], ['.5', 0.5], [',5', 0.5], [' 12,5 ', 12.5], ['2000', 2000]] as const) {
    assert.deepEqual(parseWorkoutWeight(raw), { value, valid: true });
  }
});

test('keeps blank weight distinct from zero and accepts a decimal separator mid-entry', () => {
  assert.deepEqual(parseWorkoutWeight(''), { value: null, valid: true });
  assert.deepEqual(parseWorkoutWeight(' '), { value: null, valid: true });
  assert.deepEqual(parseWorkoutWeight('12.'), { value: 12, valid: true });
  assert.deepEqual(parseWorkoutWeight('12,'), { value: 12, valid: true });
});

test('rejects impossible or ambiguous weights instead of clamping or interpreting them as zero', () => {
  for (const raw of ['-1', '2000.1', 'Infinity', 'NaN', '1e2', '12kg', '12,5.0', '.', ',', '1 2']) {
    assert.deepEqual(parseWorkoutWeight(raw), { value: null, valid: false }, raw);
  }
  // A comma is a decimal separator, not a thousands separator.
  assert.deepEqual(parseWorkoutWeight('1,000'), { value: 1, valid: true });
  for (const value of [NaN, Infinity, -1, 2001, '12.5', null]) assert.equal(isValidWorkoutWeight(value), false);
});

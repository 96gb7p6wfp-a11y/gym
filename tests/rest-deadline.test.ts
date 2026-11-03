import test from 'node:test';
import assert from 'node:assert/strict';
import { REST_DEADLINE_KEY, readRestDeadline, saveRestDeadline } from '../src/rest-deadline.ts';

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } };
}

test('rest deadline and adjustments survive reload without touching workout data', () => {
  const port = storage();
  port.values.set('setline.gym.v1', 'existing workouts');
  saveRestDeadline(port, 90_000);
  assert.equal(readRestDeadline(port, 10_000), 90_000);
  saveRestDeadline(port, 105_000);
  assert.equal(readRestDeadline(port, 80_000), 105_000);
  saveRestDeadline(port, null);
  assert.equal(readRestDeadline(port, 100_000), null);
  assert.equal(port.values.get('setline.gym.v1'), 'existing workouts');
});

test('recently expired deadlines remain available for silent recovery; malformed/stale ones do not', () => {
  const port = storage();
  saveRestDeadline(port, 90_000);
  assert.equal(readRestDeadline(port, 100_000), 90_000);
  for (const value of ['null', '"90000"', '{}', 'invalid', '1.5', '0', '1e20']) {
    port.values.set(REST_DEADLINE_KEY, value);
    assert.equal(readRestDeadline(port, 200_000_000), null);
  }
  assert.equal(port.values.has(REST_DEADLINE_KEY), false);
});

test('restricted session storage leaves the live timer usable and does not throw', () => {
  const port = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('denied'); } };
  assert.equal(readRestDeadline(port), null);
  assert.doesNotThrow(() => saveRestDeadline(port, Date.now() + 90_000));
  assert.doesNotThrow(() => saveRestDeadline(port, null));
});

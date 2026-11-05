import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, createSession } from '../src/domain.js';
import { rebaseObjectChanges } from '../src/profile-updates.ts';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';

test('a stale settings view changes only its selected fields and preserves newer preferences', () => {
  const base = { appearance: 'system', rest: 90, sound: true, nested: { height: 181, goal: 'power' } };
  const latest = { ...base, appearance: 'dark', rest: 120, nested: { ...base.nested, height: 182 } };
  const desired = { ...base, sound: false };
  assert.deepEqual(rebaseObjectChanges(base, latest, desired), { ...latest, sound: false });
});

test('pending match edits retain newly saved guidance and readiness instead of restoring old flags', () => {
  const base = { matchWeeks: [2], clearance: { impact: 'cleared', heavyLifting: 'cleared' }, readiness: [] as string[] };
  const latest = { ...base, clearance: { impact: 'restricted', heavyLifting: 'cleared' }, readiness: ['yellow'] };
  const desired = { ...base, matchWeeks: [2, 4] };
  assert.deepEqual(rebaseObjectChanges(base, latest, desired), { ...latest, matchWeeks: [2, 4] });
});

test('explicit removals and array changes remain intentional while untouched newer arrays survive', () => {
  const base: { program?: { revision: string }; dates: number[]; plan: { name: string; sets: number }[] } = {
    program: { revision: '8.1' }, dates: [1], plan: [{ name: 'Saved', sets: 3 }],
  };
  const latest = { ...base, dates: [1, 2] };
  const desired = { ...base, program: undefined, plan: [{ name: 'Edited', sets: 4 }] };
  assert.deepEqual(rebaseObjectChanges<typeof base>(base, latest, desired), {
    dates: [1, 2], plan: [{ name: 'Edited', sets: 4 }],
  });
});

test('absent and undefined older options do not remove a setting added after the view opened', () => {
  const base: { option?: string; value: number } = { option: undefined, value: 1 };
  const latest = { option: 'retained', value: 1 };
  assert.deepEqual(rebaseObjectChanges(base, latest, { value: 2 }), { option: 'retained', value: 2 });
});

test('rebasing keeps all source models immutable and returns detached data', () => {
  const base = { plan: [{ sets: 3 }], name: 'Original' };
  const latest = { plan: [{ sets: 4 }], name: 'Original' };
  const desired = { ...base, name: 'Edited' };
  const before = structuredClone([base, latest, desired]);
  const result = rebaseObjectChanges(base, latest, desired);
  result.plan[0].sets = 9;
  assert.deepEqual([base, latest, desired], before);
});

test('sequential local saves from an old profile preserve both settings and all workout data', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  const client = createLocalClient(storage);
  const base = ProfileSchema.parse(DEFAULT_PROFILE);
  const session = createSession(base.plan[0], 0, '2026-11-05', base, []);
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'profile', profile: { ...base, appearance: 'dark' }, expectedVersion: 0 });
  const latest = await client.request('/api/tracker');
  const updated = rebaseObjectChanges(base, ProfileSchema.parse(latest.profile), { ...base, restSeconds: 120 });
  await client.request('/api/tracker', { action: 'profile', profile: updated, expectedVersion: latest.profileVersion });
  const saved = JSON.parse(values.get(STORAGE_KEY)!);
  assert.equal(saved.profile.appearance, 'dark');
  assert.equal(saved.profile.restSeconds, 120);
  assert.equal(saved.profileVersion, 2);
  assert.deepEqual(saved.sessions[0].session, session);
});

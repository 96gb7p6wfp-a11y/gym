import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';

class MemoryStorage {
  values = new Map<string, string>();
  failReads = false;
  failWrites = false;
  getItem(key: string) {
    if (this.failReads) throw new Error('Storage access denied');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Quota exceeded');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

function fixture() {
  const storage = new MemoryStorage();
  return { storage, client: createLocalClient(storage) };
}
function profile() { return structuredClone(DEFAULT_PROFILE); }
function workout(day = 0, date = '2026-10-07') {
  return createSession(DEFAULT_PROFILE.plan[day], day, date, DEFAULT_PROFILE, []);
}
const meal = {
  kind: 'meal', name: 'Lunch', source: 'manual', notes: 'After training',
  assumptions: '', confidence: null,
  foods: [{ name: 'Rice and chicken', portion: '1 bowl', calories: 650, protein: 45, carbs: 75, fat: 18 }],
};

test('training preferences and plan changes survive a new client without sharing mutable objects', async () => {
  const { storage, client } = fixture();
  const changed = profile();
  changed.bodyWeight = 74;
  changed.restSeconds = 120;
  changed.plan[0].exercises[0].name = 'Personal medicine-ball drill';
  assert.deepEqual(await client.request('/api/tracker', { action: 'profile', profile: changed, expectedVersion: 0 }), { version: 1 });
  changed.bodyWeight = 90;
  const fresh = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(fresh.profile, { ...changed, bodyWeight: 74 });
  assert.equal(fresh.profileVersion, 1);
  (fresh.profile as typeof changed).bodyWeight = 88;
  assert.equal(((await client.request('/api/tracker')).profile as typeof changed).bodyWeight, 74);
});

test('profile optimistic versions prevent stale tabs from overwriting a later save', async () => {
  const { storage, client } = fixture();
  const secondTab = createLocalClient(storage);
  const stale = await secondTab.request('/api/tracker');
  const changed = { ...profile(), bodyWeight: 72 };
  await client.request('/api/tracker', { action: 'profile', profile: changed, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  await assert.rejects(secondTab.request('/api/tracker', {
    action: 'profile', profile: { ...profile(), bodyWeight: 80 }, expectedVersion: stale.profileVersion,
  }), /another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('invalid profiles are rejected without changing already saved workouts or preferences', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'session', session: workout(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const badProfiles = [
    { ...profile(), bodyWeight: -1 },
    { ...profile(), restSeconds: 0 },
    { ...profile(), plan: profile().plan.slice(0, 6) },
    (() => {
      const duplicate = profile();
      duplicate.plan[0].exercises.push(structuredClone(duplicate.plan[0].exercises[0]));
      return duplicate;
    })(),
  ];
  for (const invalid of badProfiles) {
    await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: invalid, expectedVersion: 0 }), /valid training plan/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('a workout can be resumed, completed, deleted and restored with its recorded sets intact', async () => {
  const { storage, client } = fixture();
  const session = workout();
  session.notes = 'Felt strong';
  Object.assign(session.exercises[0].logs[0], { kg: 8, reps: 4, rir: 2, done: true });
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  const resumed = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(resumed.sessions, [{ session, version: 1 }]);
  const completed = stopSessionTimers(session, 'completed', session.startedAt + 600_000);
  assert.deepEqual(await client.request('/api/tracker', { action: 'session', session: completed, expectedVersion: 1 }), { version: 2 });
  const deleted = { ...completed, status: 'deleted', deletedAt: session.startedAt + 700_000 };
  await client.request('/api/tracker', { action: 'session', session: deleted, expectedVersion: 2 });
  assert.equal((JSON.parse(client.exportBackup()).data.sessions[0].session).status, 'deleted');
  const restored = { ...deleted, status: 'completed', deletedAt: null };
  await client.request('/api/tracker', { action: 'session', session: restored, expectedVersion: 3 });
  const finalState = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(finalState.sessions, [{ session: restored, version: 4 }]);
});

test('session optimistic versions reject stale changes without losing recorded sets', async () => {
  const { storage, client } = fixture();
  const session = workout();
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  const secondTab = createLocalClient(storage);
  const firstUpdate = { ...session, notes: 'Latest notes' };
  await client.request('/api/tracker', { action: 'session', session: firstUpdate, expectedVersion: 1 });
  const saved = storage.getItem(STORAGE_KEY);
  await assert.rejects(secondTab.request('/api/tracker', {
    action: 'session', session: { ...session, notes: 'Stale notes' }, expectedVersion: 1,
  }), /another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('only one active workout is allowed, and finishing it permits starting the next', async () => {
  const { storage, client } = fixture();
  const first = workout();
  const next = workout(1, '2026-10-08');
  await client.request('/api/tracker', { action: 'session', session: first, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker', { action: 'session', session: next, expectedVersion: 0 }), /active workout/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  await client.request('/api/tracker', { action: 'session', session: stopSessionTimers(first, 'completed', first.startedAt + 60_000), expectedVersion: 1 });
  await client.request('/api/tracker', { action: 'session', session: next, expectedVersion: 0 });
  const records = (await createLocalClient(storage).request('/api/tracker')).sessions as Array<{ session: { status: string } }>;
  assert.equal(records.filter((entry) => entry.session.status === 'active').length, 1);
  assert.equal(records.length, 2);
});

test('invalid workout values and invalid completed timers never overwrite a saved workout', async () => {
  const { storage, client } = fixture();
  const session = workout();
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const invalid = structuredClone(session);
  Object.assign(invalid.exercises[0].logs[0], { kg: 30, reps: 0, done: true });
  const variants = [invalid, { ...session, date: '2026-02-30' }, { ...session, status: 'completed', finishedAt: session.startedAt + 1000 }];
  for (const variant of variants) {
    await assert.rejects(client.request('/api/tracker', { action: 'session', session: variant, expectedVersion: 1 }), /valid workout values/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('manual meals, weight and targets persist across reloads and preserve versioned edits', async () => {
  const { storage, client } = fixture();
  const targets = { kind: 'targets', calories: 2400, protein: 120, carbs: 300, fat: 70, goalWeight: 65 };
  const records = [
    { id: 'lunch', date: '2026-10-07', payload: meal },
    { id: 'weigh-in', date: '2026-10-07', payload: { kind: 'weight', kg: 61.5 } },
    { id: 'targets', date: '2026-10-07', payload: targets },
  ];
  for (const record of records) assert.deepEqual(await client.request('/api/nutrition', { ...record, expectedVersion: 0 }), { version: 1 });
  const revisedMeal = { ...meal, name: 'Late lunch' };
  await createLocalClient(storage).request('/api/nutrition', { ...records[0], payload: revisedMeal, expectedVersion: 1 });
  const fresh = await createLocalClient(storage).request('/api/nutrition');
  assert.equal(fresh.photoAnalysisReady, false);
  assert.deepEqual(fresh.records, [
    { ...records[0], payload: revisedMeal, version: 2 },
    { ...records[2], version: 1 },
    { ...records[1], version: 1 },
  ]);
  const saved = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/nutrition', { ...records[0], expectedVersion: 1 }), /another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('nutrition rejects impossible dates, empty meals and invalid amounts without replacing data', async () => {
  const { storage, client } = fixture();
  await client.request('/api/nutrition', { id: 'lunch', date: '2026-10-07', payload: meal, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const invalidPayloads = [
    { kind: 'weight', kg: 500 },
    { ...meal, foods: [] },
    { ...meal, foods: [{ ...meal.foods[0], calories: -10 }] },
    { ...meal, foods: [{ ...meal.foods[0], protein: Number.NaN }] },
    { kind: 'targets', calories: 2400, protein: null, carbs: null, fat: null, goalWeight: 0 },
  ];
  for (const payload of invalidPayloads) {
    await assert.rejects(client.request('/api/nutrition', { id: 'lunch', date: '2026-10-07', payload, expectedVersion: 1 }), /valid nutrition/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
  await assert.rejects(client.request('/api/nutrition', { id: 'lunch', date: '2026-02-29', payload: meal, expectedVersion: 1 }), /record is invalid/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('backup export and import preserve workouts, plan changes and nutrition on a fresh device', async () => {
  const { client } = fixture();
  const changed = { ...profile(), bodyWeight: 68 };
  const session = stopSessionTimers(workout(), 'completed', Date.now() + 90_000);
  await client.request('/api/tracker', { action: 'profile', profile: changed, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  await client.request('/api/nutrition', { id: 'meal-one', date: '2026-10-07', payload: meal, expectedVersion: 0 });
  const restoredStorage = new MemoryStorage();
  createLocalClient(restoredStorage).importBackup(client.exportBackup());
  const restored = createLocalClient(restoredStorage);
  assert.deepEqual(await restored.request('/api/tracker'), await client.request('/api/tracker'));
  assert.deepEqual(await restored.request('/api/nutrition'), await client.request('/api/nutrition'));
  assert.deepEqual(await restored.request('/api/tracker', { action: 'profile', profile: { ...changed, bodyWeight: 69 }, expectedVersion: 1 }), { version: 2 });
});

test('malformed, unsupported and invalid backup files leave existing data untouched', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'session', session: workout(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const backup = JSON.parse(client.exportBackup());
  const corruptProfile = structuredClone(backup);
  corruptProfile.data.profile.bodyWeight = -1;
  const corruptSession = structuredClone(backup);
  corruptSession.data.sessions[0].session.exercises[0].logs[0].reps = -1;
  const duplicateRecords = structuredClone(backup);
  duplicateRecords.data.sessions.push(duplicateRecords.data.sessions[0]);
  for (const text of [
    '{broken', JSON.stringify({ ...backup, version: 2 }),
    JSON.stringify(corruptProfile), JSON.stringify(corruptSession), JSON.stringify(duplicateRecords),
  ]) {
    assert.throws(() => client.importBackup(text));
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('an oversized backup is rejected before any existing records are replaced', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'session', session: workout(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.importBackup(' '.repeat(10 * 1024 * 1024 + 1)), /smaller than 10 MB/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('restoring a backup cannot introduce competing active workouts', async () => {
  const { storage, client } = fixture();
  const existing = workout();
  await client.request('/api/tracker', { action: 'session', session: existing, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const backup = JSON.parse(client.exportBackup());
  backup.data.sessions.push({ session: workout(1, '2026-10-08'), version: 1 });
  assert.throws(() => client.importBackup(JSON.stringify(backup)), /active workout/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('a failed storage write does not report success or discard the previously saved version', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'profile', profile: profile(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  storage.failWrites = true;
  await assert.rejects(client.request('/api/tracker', {
    action: 'profile', profile: { ...profile(), bodyWeight: 85 }, expectedVersion: 1,
  }), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.throws(() => client.importBackup(client.exportBackup()), /could not be saved/);
  storage.failWrites = false;
  assert.equal((await client.request('/api/tracker')).profileVersion, 1);
});

test('unavailable storage produces an actionable error instead of an empty training history', async () => {
  const { storage, client } = fixture();
  storage.failReads = true;
  await assert.rejects(client.request('/api/tracker'), /storage is unavailable/);
  await assert.rejects(client.request('/api/nutrition'), /storage is unavailable/);
  assert.throws(() => client.exportBackup(), /storage is unavailable/);
});

test('corrupted saved JSON remains available for recovery and is never silently reset', async () => {
  const { storage, client } = fixture();
  const corrupt = '{"saved workouts": incomplete';
  storage.setItem(STORAGE_KEY, corrupt);
  await assert.rejects(client.request('/api/tracker'), /Saved data could not be read/);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: profile(), expectedVersion: 0 }), /Saved data could not be read/);
  assert.throws(() => client.exportBackup(), /Saved data could not be read/);
  assert.equal(JSON.parse(client.exportRecovery()).raw, corrupt);
  assert.equal(storage.getItem(STORAGE_KEY), corrupt);
  const freshBackup = createLocalClient(new MemoryStorage()).exportBackup();
  client.importBackup(freshBackup);
  assert.deepEqual((await client.request('/api/tracker')).sessions, []);
});

test('reset removes Setline data while preserving unrelated browser storage', async () => {
  const { storage, client } = fixture();
  storage.setItem('another-app', 'keep this value');
  await client.request('/api/tracker', { action: 'session', session: workout(), expectedVersion: 0 });
  client.reset();
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem('another-app'), 'keep this value');
  assert.deepEqual((await createLocalClient(storage).request('/api/tracker')).sessions, []);
});

test('unsupported operations and photo analysis remain local and leave saved data unchanged', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'session', session: workout(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = (() => { networkCalls++; throw new Error('Network must not be used'); }) as typeof fetch;
  try {
    await assert.rejects(client.request('/api/nutrition/analyze', { photo: 'image' }), /unavailable in this offline app/);
    await assert.rejects(client.request('https://old-host/api/tracker'), /Unknown local data operation/);
    await assert.rejects(client.request('/api/tracker', { action: 'eraseEverything' }), /Unknown workout data operation/);
    assert.equal(networkCalls, 0);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  } finally { globalThis.fetch = originalFetch; }
});

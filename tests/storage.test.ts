import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import type { ActivityRecord } from '../src/activities.ts';

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
function extraActivity(id = 'extra-run') {
  return {
    id, date: '2026-10-07', type: 'run', name: 'Evening 5 km',
    durationMinutes: 30, distanceKm: 5, intensity: 'moderate', bodyWeightKg: 68,
    watchCalories: null, notes: 'Easy extra run', createdAt: 1_791_378_000_000, deletedAt: null as number | null,
  };
}
function importedActivity(id = 'imported-run', startedAt?: string) {
  return {
    ...extraActivity(id),
    importSource: {
      provider: 'strava', format: 'fit', externalId: `strava-${id}`,
      ...(startedAt ? { startedAt } : {}), originalCalories: 430,
      fingerprint: `activity-${id}`,
    },
  };
}
class CountingMemoryStorage extends MemoryStorage {
  writes = 0;
  override setItem(key: string, value: string) {
    this.writes++;
    super.setItem(key, value);
  }
}

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

test('extra activities save, edit, delete and restore independently of the daily workout and nutrition', async () => {
  const { storage, client } = fixture();
  const changed = { ...profile(), bodyWeight: 68 };
  const session = workout();
  await client.request('/api/tracker', { action: 'profile', profile: changed, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  await client.request('/api/nutrition', { id: 'meal-one', date: '2026-10-07', payload: meal, expectedVersion: 0 });
  const activity = extraActivity();
  assert.deepEqual(await client.request('/api/tracker', { action: 'activity', activity, expectedVersion: 0 }), { version: 1 });
  activity.notes = 'This unsaved change must not leak';
  const firstReload = await createLocalClient(storage).request('/api/tracker');
  const original = extraActivity();
  assert.deepEqual(firstReload.activities, [{ activity: original, version: 1 }]);
  const edited = { ...original, durationMinutes: 34, watchCalories: 290 };
  await client.request('/api/tracker', { action: 'activity', activity: edited, expectedVersion: 1 });
  const deleted = { ...edited, deletedAt: original.createdAt + 60_000 };
  await client.request('/api/tracker', { action: 'activity', activity: deleted, expectedVersion: 2 });
  assert.deepEqual((await createLocalClient(storage).request('/api/tracker')).activities, [{ activity: deleted, version: 3 }]);
  const restored = { ...deleted, deletedAt: null };
  await client.request('/api/tracker', { action: 'activity', activity: restored, expectedVersion: 3 });
  const final = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(final.activities, [{ activity: restored, version: 4 }]);
  assert.deepEqual(final.profile, changed);
  assert.equal(final.profileVersion, 1);
  assert.deepEqual(final.sessions, [{ session, version: 1 }]);
  assert.deepEqual((await client.request('/api/nutrition')).records, [{ id: 'meal-one', date: '2026-10-07', payload: meal, version: 1 }]);
});

test('activity optimistic versions reject stale edits and deletes without losing newer data', async () => {
  const { storage, client } = fixture();
  const activity = extraActivity();
  await client.request('/api/tracker', { action: 'activity', activity, expectedVersion: 0 });
  const secondTab = createLocalClient(storage);
  await client.request('/api/tracker', { action: 'activity', activity: { ...activity, durationMinutes: 35 }, expectedVersion: 1 });
  const saved = storage.getItem(STORAGE_KEY);
  for (const stale of [{ ...activity, notes: 'Stale' }, { ...activity, deletedAt: activity.createdAt + 60_000 }]) {
    await assert.rejects(secondTab.request('/api/tracker', { action: 'activity', activity: stale, expectedVersion: 1 }), /another tab/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('invalid extra activities never overwrite the saved activity or other records', async () => {
  const { storage, client } = fixture();
  const activity = extraActivity();
  await client.request('/api/tracker', { action: 'activity', activity, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  for (const invalid of [
    { ...activity, date: '2026-02-30' }, { ...activity, type: 'unknown' },
    { ...activity, durationMinutes: -1 }, { ...activity, distanceKm: -5 },
    { ...activity, bodyWeightKg: 0 }, { ...activity, watchCalories: -100 },
    { ...activity, intensity: 'maximum' }, { ...activity, createdAt: Number.NaN },
  ]) {
    await assert.rejects(client.request('/api/tracker', { action: 'activity', activity: invalid, expectedVersion: 1 }), /valid extra activity/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('version-1 backups preserve activity records and versions including soft-deleted entries', async () => {
  const { client } = fixture();
  const activity = extraActivity();
  const deleted = { ...extraActivity('deleted-cycle'), type: 'cycle', distanceKm: 15, deletedAt: activity.createdAt + 60_000 };
  await client.request('/api/tracker', { action: 'activity', activity, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'activity', activity: deleted, expectedVersion: 0 });
  const backup = client.exportBackup();
  assert.equal(JSON.parse(backup).version, 1);
  const restored = createLocalClient(new MemoryStorage());
  restored.importBackup(backup);
  assert.deepEqual(await restored.request('/api/tracker'), await client.request('/api/tracker'));
  assert.deepEqual(await restored.request('/api/tracker', { action: 'activity', activity: { ...activity, notes: 'Restored on another device' }, expectedVersion: 1 }), { version: 2 });
});

test('legacy saved state and backups migrate absent activities without losing previous records', async () => {
  const { storage, client } = fixture();
  const session = workout();
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  await client.request('/api/nutrition', { id: 'lunch', date: '2026-10-07', payload: meal, expectedVersion: 0 });
  const legacy = JSON.parse(client.exportBackup());
  delete legacy.data.activities;
  storage.setItem(STORAGE_KEY, JSON.stringify(legacy.data));
  const reloaded = createLocalClient(storage);
  assert.deepEqual((await reloaded.request('/api/tracker')).activities, []);
  assert.deepEqual((await reloaded.request('/api/tracker')).sessions, [{ session, version: 1 }]);
  assert.deepEqual((await reloaded.request('/api/nutrition')).records, legacy.data.nutrition);
  const otherDevice = createLocalClient(new MemoryStorage());
  otherDevice.importBackup(JSON.stringify(legacy));
  assert.deepEqual((await otherDevice.request('/api/tracker')).activities, []);
  assert.deepEqual(await otherDevice.request('/api/nutrition'), await reloaded.request('/api/nutrition'));
  await reloaded.request('/api/tracker', { action: 'activity', activity: extraActivity(), expectedVersion: 0 });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).schemaVersion, 1);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).activities.length, 1);
  assert.deepEqual((await reloaded.request('/api/tracker')).sessions, [{ session, version: 1 }]);
});

test('present invalid activity fields, duplicates and oversized activity backups reject atomically', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'activity', activity: extraActivity(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const backup = JSON.parse(client.exportBackup());
  for (const activities of [
    null, {}, 'invalid',
    [{ activity: { ...extraActivity(), durationMinutes: -1 }, version: 1 }],
    [{ activity: extraActivity(), version: -1 }],
    [backup.data.activities[0], backup.data.activities[0]],
    Array.from({ length: 5001 }, (_, index) => ({ activity: extraActivity(`entry-${index}`), version: 1 })),
  ]) {
    const invalid = { ...backup, data: { ...backup.data, activities } };
    assert.throws(() => client.importBackup(JSON.stringify(invalid)));
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...backup.data, activities: null }));
  const corrupt = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker'), /Saved data could not be read/);
  await assert.rejects(client.request('/api/tracker', { action: 'activity', activity: extraActivity('new'), expectedVersion: 0 }), /Saved data could not be read/);
  assert.equal(storage.getItem(STORAGE_KEY), corrupt);
});

test('activity quota failures preserve the last saved version and allow a later retry', async () => {
  const { storage, client } = fixture();
  const activity = extraActivity();
  await client.request('/api/tracker', { action: 'activity', activity, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  storage.failWrites = true;
  await assert.rejects(client.request('/api/tracker', { action: 'activity', activity: { ...activity, durationMinutes: 32 }, expectedVersion: 1 }), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.deepEqual((await client.request('/api/tracker')).activities, [{ activity, version: 1 }]);
  storage.failWrites = false;
  assert.deepEqual(await client.request('/api/tracker', { action: 'activity', activity: { ...activity, durationMinutes: 32 }, expectedVersion: 1 }), { version: 2 });
});

test('activity import saves the whole batch in one write and preserves unrelated local records', async () => {
  const storage = new CountingMemoryStorage();
  const client = createLocalClient(storage);
  const changed = { ...profile(), bodyWeight: 72 };
  const session = workout();
  const existingActivity = extraActivity('manual-walk');
  await client.request('/api/tracker', { action: 'profile', profile: changed, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  await client.request('/api/nutrition', { id: 'import-day-lunch', date: '2026-10-07', payload: meal, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'activity', activity: existingActivity, expectedVersion: 0 });
  const writesBeforeImport = storage.writes;
  const first = importedActivity('first');
  const second = { ...importedActivity('second'), type: 'cycle', name: 'Afternoon ride', distanceKm: 16 };
  const result = await client.request('/api/tracker', { action: 'activity-batch', activities: [first, second] });
  assert.equal(storage.writes, writesBeforeImport + 1);
  assert.deepEqual(result, { activities: [{ activity: first, version: 1 }, { activity: second, version: 1 }] });
  first.notes = 'Unsaved input mutation';
  (result.activities as Array<{ activity: ReturnType<typeof importedActivity> }>)[0].activity.importSource.fingerprint = 'Unsaved response mutation';
  const reloaded = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(reloaded.activities, [
    { activity: importedActivity('first'), version: 1 },
    { activity: second, version: 1 },
    { activity: existingActivity, version: 1 },
  ]);
  assert.deepEqual(reloaded.profile, changed);
  assert.equal(reloaded.profileVersion, 1);
  assert.deepEqual(reloaded.sessions, [{ session, version: 1 }]);
  assert.deepEqual((await client.request('/api/nutrition')).records, [{ id: 'import-day-lunch', date: '2026-10-07', payload: meal, version: 1 }]);
});

test('invalid import cardinality or a later invalid activity never writes part of a batch', async () => {
  const storage = new CountingMemoryStorage();
  const client = createLocalClient(storage);
  await client.request('/api/tracker', { action: 'activity', activity: extraActivity(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const writes = storage.writes;
  for (const activities of [undefined, null, {}, [], Array.from({ length: 501 }, (_, index) => importedActivity(`many-${index}`))]) {
    await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities }), /1 and 500/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
    assert.equal(storage.writes, writes);
  }
  for (const invalid of [
    { ...importedActivity('invalid'), date: '2026-02-30' },
    { ...importedActivity('invalid'), durationMinutes: Number.NaN },
    { ...importedActivity('invalid'), distanceKm: -3 },
  ]) {
    await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity('valid-first'), invalid] }), /Review valid activity/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
    assert.equal(storage.writes, writes);
  }
});

test('a 500-activity import is supported and all returned versions start at one', async () => {
  const storage = new CountingMemoryStorage();
  const client = createLocalClient(storage);
  const activities = Array.from({ length: 500 }, (_, index) => importedActivity(`max-${index}`));
  const result = await client.request('/api/tracker', { action: 'activity-batch', activities });
  assert.equal(storage.writes, 1);
  assert.deepEqual(result.activities, activities.map((activity) => ({ activity, version: 1 })));
  assert.deepEqual((await createLocalClient(storage).request('/api/tracker')).activities, result.activities);
});

test('import rejects duplicate activity IDs against existing data and within the batch', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'activity', activity: extraActivity('saved-id'), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  for (const activities of [
    [importedActivity('valid-first'), importedActivity('saved-id')],
    [importedActivity('same-id'), { ...importedActivity('other-id'), id: 'same-id' }],
  ]) {
    await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities }), /already saved/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('source fingerprints prevent duplicate imports across files, providers and soft-deleted records', async () => {
  const { storage, client } = fixture();
  const deleted = { ...importedActivity('deleted-source'), deletedAt: 1_791_378_060_000 };
  await client.request('/api/tracker', { action: 'activity', activity: deleted, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const fromAnotherFile = importedActivity('different-file');
  fromAnotherFile.importSource = { ...fromAnotherFile.importSource, provider: 'adidas', format: 'gpx', fingerprint: deleted.importSource.fingerprint };
  const repeatedInBatch = importedActivity('batch-second');
  repeatedInBatch.importSource = { ...repeatedInBatch.importSource, fingerprint: importedActivity('batch-first').importSource.fingerprint };
  for (const activities of [[importedActivity('unique-first'), fromAnotherFile], [importedActivity('batch-first'), repeatedInBatch]]) {
    await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities }), /already saved/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
  assert.deepEqual((await client.request('/api/tracker')).activities, [{ activity: deleted, version: 1 }]);
});

test('external IDs prevent repeat imports for their provider but may overlap between providers', async () => {
  const { storage, client } = fixture();
  const existing = importedActivity('saved-source');
  await client.request('/api/tracker', { action: 'activity-batch', activities: [existing] });
  const saved = storage.getItem(STORAGE_KEY);
  const repeat = importedActivity('changed-fingerprint');
  repeat.importSource.externalId = existing.importSource.externalId;
  const firstInBatch = importedActivity('first-in-batch');
  const secondInBatch = importedActivity('second-in-batch');
  secondInBatch.importSource.externalId = firstInBatch.importSource.externalId;
  for (const activities of [[importedActivity('valid-first'), repeat], [firstInBatch, secondInBatch]]) {
    await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities }), /already saved/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
  const otherProvider = { ...repeat, importSource: { ...repeat.importSource, provider: 'adidas' } };
  assert.deepEqual(await client.request('/api/tracker', { action: 'activity-batch', activities: [otherProvider] }), {
    activities: [{ activity: otherProvider, version: 1 }],
  });
});

test('import start instants block differently timed re-exports while distinct seconds and types remain valid', async () => {
  const { storage, client } = fixture();
  const deleted = {
    ...importedActivity('original-fit', '2026-10-07T17:30:00.500+02:00'),
    deletedAt: 1_791_378_060_000,
  };
  await client.request('/api/tracker', { action: 'activity-batch', activities: [deleted] });
  const saved = storage.getItem(STORAGE_KEY);
  const fromOtherTab = createLocalClient(storage);
  const reexported = {
    ...importedActivity('reexport-gpx', '2026-10-07T15:30:00.900Z'),
    durationMinutes: 37,
    importSource: { ...importedActivity('reexport-gpx', '2026-10-07T15:30:00.900Z').importSource, format: 'gpx', provider: 'adidas' },
  };
  await assert.rejects(fromOtherTab.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity('valid-first'), reexported] }), /already saved/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  const firstInBatch = importedActivity('same-start-first', '2026-10-07T16:00:00Z');
  const secondInBatch = {
    ...importedActivity('same-start-second', '2026-10-07T18:00:00+02:00'),
    durationMinutes: 45,
  };
  await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities: [firstInBatch, secondInBatch] }), /already saved/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  const distinctSecond = importedActivity('different-second', '2026-10-07T15:30:01Z');
  const distinctType = { ...importedActivity('same-instant-bike', '2026-10-07T15:30:00Z'), type: 'cycle' };
  const result = await client.request('/api/tracker', { action: 'activity-batch', activities: [distinctSecond, distinctType] });
  assert.deepEqual(result.activities, [{ activity: distinctSecond, version: 1 }, { activity: distinctType, version: 1 }]);
  assert.equal(((await client.request('/api/tracker')).activities as ActivityRecord[]).length, 3);
});

test('an import cannot exceed the 5,000-record capacity or partially fill remaining space', async () => {
  const storage = new CountingMemoryStorage();
  const client = createLocalClient(storage);
  const backup = JSON.parse(client.exportBackup());
  backup.data.activities = Array.from({ length: 4999 }, (_, index) => ({ activity: extraActivity(`existing-${index}`), version: 1 }));
  client.importBackup(JSON.stringify(backup));
  const saved = storage.getItem(STORAGE_KEY);
  const writes = storage.writes;
  await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity('last-one'), importedActivity('over-limit')] }), /Too many extra activities/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.equal(storage.writes, writes);
  await client.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity('last-one')] });
  assert.equal(((await client.request('/api/tracker')).activities as ActivityRecord[]).length, 5000);
  const full = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity('over-limit')] }), /Too many extra activities/);
  assert.equal(storage.getItem(STORAGE_KEY), full);
});

test('import quota failure leaves every existing record intact and the same batch can be retried', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'activity', activity: extraActivity(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const activities = [importedActivity('retry-first'), importedActivity('retry-second')];
  storage.failWrites = true;
  await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities }), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.deepEqual((await client.request('/api/tracker')).activities, [{ activity: extraActivity(), version: 1 }]);
  storage.failWrites = false;
  assert.deepEqual(await client.request('/api/tracker', { action: 'activity-batch', activities }), {
    activities: activities.map((activity) => ({ activity, version: 1 })),
  });
});

test('import provenance survives edits, version-1 backups and duplicate checking on a fresh device', async () => {
  const { client } = fixture();
  const original = importedActivity('imported-run', '2026-10-07T17:30:00+02:00');
  original.importSource.originalCalories = 0;
  await client.request('/api/tracker', { action: 'activity-batch', activities: [original] });
  const edited = { ...original, name: 'Corrected exported run', durationMinutes: 32, watchCalories: 310, notes: 'Changed after import' };
  await client.request('/api/tracker', { action: 'activity', activity: edited, expectedVersion: 1 });
  const restored = createLocalClient(new MemoryStorage());
  restored.importBackup(client.exportBackup());
  assert.deepEqual((await restored.request('/api/tracker')).activities, [{ activity: edited, version: 2 }]);
  const reimport = importedActivity('new-import-id');
  reimport.importSource.fingerprint = original.importSource.fingerprint;
  await assert.rejects(restored.request('/api/tracker', { action: 'activity-batch', activities: [reimport] }), /already saved/);
  assert.deepEqual((await restored.request('/api/tracker')).activities, [{ activity: edited, version: 2 }]);
});

test('invalid import provenance is rejected before storage or backup replacement', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'activity', activity: extraActivity(), expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const backup = JSON.parse(client.exportBackup());
  const source = importedActivity().importSource;
  for (const importSource of [
    { ...source, provider: 'unknown' }, { ...source, format: 'exe' },
    { ...source, fingerprint: '' }, { ...source, externalId: '' },
    { ...source, startedAt: 'not-a-date' }, { ...source, originalCalories: -1 },
    { ...source, originalCalories: Number.POSITIVE_INFINITY },
  ]) {
    const invalid = { ...importedActivity(), importSource };
    await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity('valid-first'), invalid] }), /Review valid activity/);
    const corruptBackup = { ...backup, data: { ...backup.data, activities: [{ activity: invalid, version: 1 }] } };
    assert.throws(() => client.importBackup(JSON.stringify(corruptBackup)), /saved extra activity/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('an activity import never overwrites unreadable existing local data', async () => {
  const { storage, client } = fixture();
  storage.setItem(STORAGE_KEY, '{unreadable');
  await assert.rejects(client.request('/api/tracker', { action: 'activity-batch', activities: [importedActivity()] }), /Saved data could not be read/);
  assert.equal(storage.getItem(STORAGE_KEY), '{unreadable');
});

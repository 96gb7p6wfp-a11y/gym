import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, createSession } from '../src/domain.js';
import { createLocalClient, PRE_RESTORE_KEY, previewBackup, STORAGE_KEY } from '../src/storage.ts';

class MemoryStorage {
  values = new Map<string, string>();
  failKey: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('Quota exceeded');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

async function populated() {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const session = createSession(DEFAULT_PROFILE.plan[0], 0, '2026-11-02', DEFAULT_PROFILE, []);
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  return { storage, client };
}

test('preview validates every record without writing or replacing current records', async () => {
  const { storage, client } = await populated();
  const before = [...storage.values];
  const backup = client.exportBackup();
  assert.deepEqual(previewBackup(backup), {
    exportedAt: JSON.parse(backup).exportedAt,
    workouts: 1, activeWorkouts: 1, mealsAndWeights: 0, activities: 0,
    reminders: JSON.parse(backup).data.reminders.items.length, jumpMeasurements: 0, readinessCheckIns: 0,
  });
  const invalid = JSON.parse(backup);
  invalid.data.sessions[0].session.date = 'invalid';
  assert.throws(() => previewBackup(JSON.stringify(invalid)), /saved workout/);
  assert.deepEqual([...storage.values], before);
});

test('a restore keeps exact prior bytes and an exportable backup across a fresh client', async () => {
  const { storage, client } = await populated();
  const oldRaw = storage.getItem(STORAGE_KEY);
  const oldData = JSON.parse(client.exportBackup()).data;
  const incoming = JSON.parse(createLocalClient(new MemoryStorage()).exportBackup());
  incoming.data.profile.bodyWeight = 81;
  client.importBackup(JSON.stringify(incoming));
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, oldRaw);
  const fresh = createLocalClient(storage);
  assert.equal((await fresh.request('/api/tracker')).sessions instanceof Array, true);
  assert.deepEqual(JSON.parse(fresh.exportBackup()).data, incoming.data);
  const copy = fresh.previousRestoreCopy()!;
  assert.equal(copy.recovery, false);
  assert.deepEqual(JSON.parse(copy.text).data, oldData);
  const other = createLocalClient(new MemoryStorage());
  other.importBackup(copy.text);
  assert.deepEqual(await other.request('/api/tracker'), await clientFrom(oldRaw!).request('/api/tracker'));
});

function clientFrom(raw: string) {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, raw);
  return createLocalClient(storage);
}

test('invalid backups never alter current data or a previous safety copy', async () => {
  const { storage, client } = await populated();
  client.importBackup(client.exportBackup());
  const before = [...storage.values];
  for (const invalid of ['{', JSON.stringify({ app: 'Other', version: 1 }), ' '.repeat(10 * 1024 * 1024 + 1)]) {
    assert.throws(() => client.importBackup(invalid));
    assert.deepEqual([...storage.values], before);
  }
});

test('failure to save either safety copy or incoming state preserves current records', async () => {
  for (const key of [PRE_RESTORE_KEY, STORAGE_KEY]) {
    const { storage, client } = await populated();
    const current = storage.getItem(STORAGE_KEY);
    storage.failKey = key;
    assert.throws(() => client.importBackup(createLocalClient(new MemoryStorage()).exportBackup()), /could not be saved/);
    assert.equal(storage.getItem(STORAGE_KEY), current);
    storage.failKey = null;
    client.importBackup(createLocalClient(new MemoryStorage()).exportBackup());
    assert.equal(JSON.parse(client.previousRestoreCopy()!.text).data.sessions.length, 1);
  }
});

test('restoring over unreadable local records preserves a raw recovery copy', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '{broken record');
  const client = createLocalClient(storage);
  client.importBackup(createLocalClient(new MemoryStorage()).exportBackup());
  const copy = client.previousRestoreCopy()!;
  assert.equal(copy.recovery, true);
  assert.equal(JSON.parse(copy.text).raw, '{broken record');
  assert.equal(JSON.parse(client.exportBackup()).data.sessions.length, 0);
});

test('explicit reset removes the safety copy too and leaves unrelated keys alone', async () => {
  const { storage, client } = await populated();
  client.importBackup(client.exportBackup());
  storage.setItem('other-app', 'keep');
  client.reset();
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
  assert.equal(storage.getItem('other-app'), 'keep');
});

test('a failed second restore also retains the previous successful safety copy', async () => {
  const { storage, client } = await populated();
  client.importBackup(createLocalClient(new MemoryStorage()).exportBackup());
  const saved = storage.getItem(STORAGE_KEY);
  const priorCopy = storage.getItem(PRE_RESTORE_KEY);
  storage.failKey = STORAGE_KEY;
  assert.throws(() => client.importBackup(client.exportBackup()), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), priorCopy);
});

test('a stale tab cannot overwrite an older restored profile with a colliding record version', async () => {
  const { storage, client } = await populated();
  await client.request('/api/tracker', { action: 'profile', profile: { ...DEFAULT_PROFILE, bodyWeight: 72 }, expectedVersion: 0 });
  const oldBackup = client.exportBackup();
  const staleTab = createLocalClient(storage);
  const stale = await staleTab.request('/api/tracker');
  client.importBackup(oldBackup);
  const restored = storage.getItem(STORAGE_KEY);
  await assert.rejects(staleTab.request('/api/tracker', { action: 'profile', profile: { ...DEFAULT_PROFILE, bodyWeight: 99 }, expectedVersion: stale.profileVersion }), /restored in another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), restored);
  // A read does not quietly authorize an old UI to write over restored data.
  await staleTab.request('/api/tracker');
  await assert.rejects(staleTab.request('/api/tracker', { action: 'profile', profile: { ...DEFAULT_PROFILE, bodyWeight: 99 }, expectedVersion: stale.profileVersion }), /restored in another tab/);
  const reloadedTab = createLocalClient(storage);
  await reloadedTab.request('/api/tracker', { action: 'profile', profile: { ...DEFAULT_PROFILE, bodyWeight: 74 }, expectedVersion: stale.profileVersion });
  assert.equal(JSON.parse(reloadedTab.exportBackup()).data.profile.bodyWeight, 74);
  assert.equal(JSON.parse(reloadedTab.exportBackup()).data.restoreGeneration, undefined, 'device-local generation stays out of portable backups');
});

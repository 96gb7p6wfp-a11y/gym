import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createNewProfile } from '../src/onboarding.ts';
import { createLocalClient, PRE_RESTORE_KEY, STORAGE_KEY } from '../src/storage.ts';

class MemoryStorage {
  values = new Map<string, string>();
  writes: string[] = [];
  failKey: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (key === this.failKey) throw new Error('Quota exceeded');
    this.writes.push(key); this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

function fixture(profileVersion = 4) {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), bodyWeight: 68.5,
    appearance: 'dark', restSeconds: 105, trainingGuidance: { impact: 'restricted', heavyLifting: 'unknown' } });
  profile.sessionDrafts = [{ date: '2026-11-05', slot: 'main', customized: true,
    plan: { ...structuredClone(profile.plan[2]), name: 'My reduced date edit' } }];
  const completed = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed'));
  Object.assign(completed.exercises[0].logs[0], { kg: 8.5, reps: 4, rir: 2, done: true,
    inputSources: { kg: 'manual', reps: 'manual' } });
  const active = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-11-02', profile, []));
  active.runningSince = null;
  Object.assign(active.exercises[0].logs[0], { kg: 7.5, reps: 4, rir: 3 });
  const state = { schemaVersion: 1, profile, profileVersion, sessions: [
    { session: completed, version: 3 }, { session: active, version: 2 },
  ], nutrition: [{ id: 'existing-weight', date: '2026-11-01', version: 1, payload: { kind: 'weight', kg: 68.2 } }],
    // These compatible raw fields are not owned by the profile editor.
    compatibleStoreMetadata: { source: 'kept' } };
  const storage = new MemoryStorage();
  const raw = JSON.stringify(state, null, 2) + '\n';
  storage.values.set(STORAGE_KEY, raw);
  return { storage, state, raw, client: createLocalClient(storage) };
}

function desired(state: ReturnType<typeof fixture>['state']) {
  const next = structuredClone(state.profile);
  next.sessionDrafts = [];
  return next;
}

test('a reviewed profile checkpoint first saves exact prior bytes and changes no historical or active records', async () => {
  const { storage, state, raw, client } = fixture();
  const profile = desired(state), before = structuredClone(profile);
  const result = await client.request('/api/tracker', { action: 'profile', profile,
    expectedVersion: state.profileVersion, checkpoint: true });
  assert.deepEqual(result, { version: 5 });
  assert.deepEqual(storage.writes, [PRE_RESTORE_KEY, STORAGE_KEY]);
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.deepEqual(saved, { ...state, profile, profileVersion: 5 });
  assert.deepEqual(profile, before);
  assert.equal(Object.hasOwn(saved, 'activities'), false);
  assert.equal(Object.hasOwn(saved, 'reminders'), false);
  assert.equal(Object.hasOwn(saved, 'performance'), false);
  assert.equal(Object.hasOwn(saved, 'restoreGeneration'), false);
});

test('a checkpoint failure to save the safety copy leaves the complete current store and prior fallback intact', async () => {
  const { storage, state, raw, client } = fixture();
  const previous = JSON.stringify({ savedAt: '2026-10-01T00:00:00Z', raw: 'older fallback' });
  storage.values.set(PRE_RESTORE_KEY, previous);
  storage.failKey = PRE_RESTORE_KEY;
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true }), /safety copy could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), previous);
  assert.deepEqual(storage.writes, []);
});

for (const hasPrevious of [true, false]) {
  test(`a failed main write restores the ${hasPrevious ? 'existing' : 'absent'} safety-copy slot and permits a later retry`, async () => {
    const { storage, state, raw, client } = fixture();
    const prior = hasPrevious ? JSON.stringify({ savedAt: '2026-10-01T00:00:00Z', raw: 'older fallback' }) : null;
    if (prior !== null) storage.values.set(PRE_RESTORE_KEY, prior);
    storage.failKey = STORAGE_KEY;
    await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true }), /could not be saved/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(storage.getItem(PRE_RESTORE_KEY), prior);
    storage.failKey = null;
    await client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true });
    assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).profileVersion, 5);
  });
}

test('stale versions and invalid desired profiles never replace the current store or its checkpoint', async () => {
  const { storage, state, raw, client } = fixture();
  const previous = JSON.stringify({ savedAt: '2026-10-01T00:00:00Z', raw: 'older fallback' });
  storage.values.set(PRE_RESTORE_KEY, previous);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 3, checkpoint: true }), /another tab/);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: { ...desired(state), bodyWeight: -1 }, expectedVersion: 4, checkpoint: true }), /valid training plan/);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: 'true' }), /valid recovery checkpoint/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), previous);
  assert.deepEqual(storage.writes, []);
});

test('data changed between checkpoint review and the safety-copy transaction is not overwritten', async () => {
  const { storage, state } = fixture();
  const incoming = JSON.stringify({ ...state, profileVersion: 5, profile: { ...state.profile, appearance: 'light' } });
  let reads = 0;
  const client = createLocalClient({
    getItem(key: string) {
      if (key === STORAGE_KEY && ++reads === 3) storage.values.set(STORAGE_KEY, incoming);
      return storage.getItem(key);
    },
    setItem: (key, value) => storage.setItem(key, value),
    removeItem: key => storage.removeItem(key),
  });
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true }), /changed before this operation/);
  assert.equal(storage.getItem(STORAGE_KEY), incoming);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
  assert.deepEqual(storage.writes, []);
});

test('critical profile saves preserve untouched raw record metadata after validating all known record fields', async () => {
  const { storage, state, client } = fixture();
  const rawState = { ...state, sessions: state.sessions.map(record => ({ ...record, compatibleRecordMetadata: 'retained' })) };
  const raw = JSON.stringify(rawState, null, 3);
  storage.values.set(STORAGE_KEY, raw);
  await client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.deepEqual(saved.sessions, rawState.sessions);
  assert.deepEqual(saved.nutrition, rawState.nutrition);
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
});

test('profile checkpoint accepts a saved version-zero legacy installation and does not reset its lease', async () => {
  const { storage, state, raw, client } = fixture(0);
  await client.request('/api/tracker');
  await client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 0, checkpoint: true });
  await client.request('/api/tracker', { action: 'profile', profile: { ...desired(state), restSeconds: 120 }, expectedVersion: 1 });
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.equal(saved.profileVersion, 2);
  assert.equal(saved.profile.restSeconds, 120);
  assert.deepEqual(saved.sessions, state.sessions);
});

test('checkpoint preserves an existing restore generation and every session version', async () => {
  const { storage, state, client } = fixture();
  const generation = crypto.randomUUID();
  const generated = { ...state, restoreGeneration: generation };
  storage.values.set(STORAGE_KEY, JSON.stringify(generated));
  await client.request('/api/tracker');
  await client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.equal(saved.restoreGeneration, generation);
  assert.deepEqual(saved.sessions, state.sessions);
  await client.request('/api/tracker', { action: 'session', session: state.sessions[1].session, expectedVersion: 2 });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).restoreGeneration, generation);
});

test('another tab restoring the same profile version blocks a checkpoint before any new backup write', async () => {
  const { storage, state, client } = fixture();
  await client.request('/api/tracker');
  createLocalClient(storage).importBackup(JSON.stringify({ app: 'Setline', version: 1, data: state }));
  const raw = storage.getItem(STORAGE_KEY), copy = storage.getItem(PRE_RESTORE_KEY);
  storage.writes = [];
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true }), /restored in another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), copy);
  assert.deepEqual(storage.writes, []);
});

test('missing or malformed persisted data never becomes a default profile through checkpoint', async () => {
  const first = fixture();
  await first.client.request('/api/tracker');
  first.storage.removeItem(STORAGE_KEY);
  await assert.rejects(first.client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0, checkpoint: true }), /disappeared/);
  assert.equal(first.storage.getItem(STORAGE_KEY), null);
  assert.equal(first.storage.getItem(PRE_RESTORE_KEY), null);
  const second = fixture(); second.storage.values.set(STORAGE_KEY, '{unreadable');
  await assert.rejects(second.client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0, checkpoint: true }), /could not be read/);
  assert.equal(second.storage.getItem(STORAGE_KEY), '{unreadable');
  assert.equal(second.storage.getItem(PRE_RESTORE_KEY), null);
});

test('the exact checkpoint can be exported and restored through the existing version-one backup workflow', async () => {
  const { state, client } = fixture();
  await client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4, checkpoint: true });
  const fallback = client.previousRestoreCopy()!;
  assert.equal(fallback.recovery, false);
  const incoming = JSON.parse(fallback.text);
  assert.equal(incoming.app, 'Setline'); assert.equal(incoming.version, 1);
  const destination = createLocalClient(new MemoryStorage());
  destination.importBackup(fallback.text);
  const restored = await destination.request('/api/tracker');
  assert.deepEqual(restored.profile, state.profile);
  assert.deepEqual(restored.sessions, state.sessions);
  assert.deepEqual((await destination.request('/api/nutrition')).records, state.nutrition);
});

test('ordinary profile saves do not read, write or replace a previous safety copy', async () => {
  const { storage, state, client } = fixture();
  const prior = JSON.stringify({ savedAt: '2026-10-01T00:00:00Z', raw: 'older fallback' });
  storage.values.set(PRE_RESTORE_KEY, prior); storage.failKey = PRE_RESTORE_KEY;
  await client.request('/api/tracker', { action: 'profile', profile: desired(state), expectedVersion: 4 });
  assert.equal(storage.getItem(PRE_RESTORE_KEY), prior);
  assert.deepEqual(storage.writes, [STORAGE_KEY]);
});

test('an explicit first save with checkpoint does not fabricate a nonexistent earlier installation', async () => {
  const storage = new MemoryStorage(), neutral = createNewProfile();
  const client = createLocalClient(storage, neutral);
  await client.request('/api/tracker');
  await client.request('/api/tracker', { action: 'profile', profile: { ...neutral, restSeconds: 120 }, expectedVersion: 0, checkpoint: true });
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).profile.bodyWeight, null);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).profile.restSeconds, 120);
});

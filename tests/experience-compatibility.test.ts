import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { defaultReminderState } from '../src/reminders.ts';

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function completedSession(date = '2026-10-19') {
  const session = createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []);
  Object.assign(session.exercises[0].logs[0], { kg: 12.5, reps: 8, done: true });
  return stopSessionTimers(session, 'completed', session.startedAt + 600_000);
}

function fixture() {
  const storage = new MemoryStorage();
  const session = completedSession();
  const original = {
    schemaVersion: 1,
    profile: ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), timerSoundEnabled: true }),
    profileVersion: 4,
    sessions: [{ session, version: 7 }],
    nutrition: [{ id: 'existing-weight', date: '2026-10-19', payload: { kind: 'weight', kg: 64.3 }, version: 3 }],
    activities: [{ version: 2, activity: {
      id: 'existing-ride', date: '2026-10-19', type: 'cycle', name: 'Easy ride', durationMinutes: 30,
      distanceKm: 8.5, intensity: 'easy', bodyWeightKg: 64, watchCalories: 180, notes: '',
      createdAt: session.startedAt, deletedAt: null,
    } }],
    reminders: defaultReminderState(),
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-10-19', type: 'approach', measurement: 'height', cm: 80, notes: '' }], readiness: [] },
    performanceVersion: 2,
  };
  storage.setItem(STORAGE_KEY, JSON.stringify(original));
  storage.writes = 0;
  return { storage, original, client: createLocalClient(storage) };
}

test('legacy audio and preparation records load and export without adding the new optional fields or writes', async () => {
  const { client, storage, original } = fixture();
  const raw = storage.getItem(STORAGE_KEY);
  const tracker = await client.request('/api/tracker');
  const profile = tracker.profile as Record<string, unknown>;
  const sessions = tracker.sessions as { session: Record<string, unknown>; version: number }[];
  assert.equal(Object.hasOwn(profile, 'timerSoundVolume'), false);
  assert.equal(Object.hasOwn(sessions[0].session, 'warmupStatus'), false);
  assert.equal(Object.hasOwn(sessions[0].session, 'warmupCompletedAt'), false);
  assert.deepEqual(sessions, original.sessions);
  assert.deepEqual(JSON.parse(client.exportBackup()).data, original);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('timer volume boundaries persist and round-trip without changing plans, history or other health records', async () => {
  const { client, storage, original } = fixture();
  let expectedVersion = original.profileVersion;
  for (const timerSoundVolume of [0, 0.05, 0.85, 1]) {
    const profile = { ...structuredClone(original.profile), timerSoundVolume };
    assert.equal(ProfileSchema.safeParse(profile).success, true);
    const saved = await client.request('/api/tracker', { action: 'profile', profile, expectedVersion });
    expectedVersion = saved.version as number;
    const current = JSON.parse(storage.getItem(STORAGE_KEY)!);
    assert.deepEqual(current, { ...original, profile, profileVersion: expectedVersion });
    const restoredStorage = new MemoryStorage();
    const restored = createLocalClient(restoredStorage);
    restored.importBackup(client.exportBackup());
    const afterRestore = await restored.request('/api/tracker');
    assert.equal((afterRestore.profile as typeof profile).timerSoundVolume, timerSoundVolume);
    assert.deepEqual(afterRestore.sessions, original.sessions);
    assert.deepEqual(JSON.parse(restored.exportBackup()).data, current);
  }
});

test('invalid timer volumes reject atomically instead of replacing or resetting stored user data', async () => {
  const { client, storage, original } = fixture();
  const raw = storage.getItem(STORAGE_KEY);
  for (const timerSoundVolume of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY, '0.85', null]) {
    const profile = { ...original.profile, timerSoundVolume };
    assert.equal(ProfileSchema.safeParse(profile).success, false);
    await assert.rejects(client.request('/api/tracker', { action: 'profile', profile, expectedVersion: original.profileVersion }), /valid training plan/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    const backup = JSON.parse(client.exportBackup());
    backup.data.profile = profile;
    assert.throws(() => client.importBackup(JSON.stringify(backup)), /saved training plan/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
  assert.equal(storage.writes, 0);
});

test('quick-prep provenance round-trips while unchecked detailed steps stay unchecked and skipped prep gains no completion time', async () => {
  const { client, original } = fixture();
  const recorded: Record<string, unknown>[] = [];
  for (const warmupStatus of ['prepared', 'elsewhere', 'not-recorded'] as const) {
    const session = completedSession('2026-10-20');
    const warmup = [
      { key: 'quick', name: 'Shoulder Circles', target: '30 sec', cue: 'Stay comfortable.', done: warmupStatus === 'prepared' },
      { key: 'detail', name: 'Saved additional preparation', target: 'As needed', cue: 'Keep this exact saved cue.', done: false },
    ];
    const entry = { ...session, warmup, warmupStatus, warmupOverride: warmupStatus === 'elsewhere',
      ...(warmupStatus === 'not-recorded' ? {} : { warmupCompletedAt: session.startedAt }) };
    assert.equal(SessionSchema.safeParse(entry).success, true);
    await client.request('/api/tracker', { action: 'session', session: entry, expectedVersion: 0 });
    recorded.unshift({ session: entry, version: 1 });
  }
  const restoredStorage = new MemoryStorage();
  const restored = createLocalClient(restoredStorage);
  restored.importBackup(client.exportBackup());
  const saved = await restored.request('/api/tracker');
  assert.deepEqual(saved.sessions, [...recorded, ...original.sessions]);
  assert.deepEqual((saved.profile as typeof original.profile).plan, original.profile.plan);
  const notRecorded = (saved.sessions as { session: Record<string, unknown> }[]).find(record => record.session.warmupStatus === 'not-recorded')!.session;
  assert.equal(Object.hasOwn(notRecorded, 'warmupCompletedAt'), false);
  assert.equal(notRecorded.warmupOverride, false);
  assert.ok((notRecorded.warmup as { done: boolean }[]).every(step => !step.done));
});

test('unrecognized preparation status rejects without changing previous workouts or backup data', async () => {
  const { client, storage } = fixture();
  const raw = storage.getItem(STORAGE_KEY);
  for (const warmupStatus of ['skipped', 'done', true, null, 1]) {
    const session = { ...completedSession(), warmupStatus };
    assert.equal(SessionSchema.safeParse(session).success, false);
    await assert.rejects(client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 }), /valid workout values/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    const backup = JSON.parse(client.exportBackup());
    backup.data.sessions.push({ session, version: 1 });
    assert.throws(() => client.importBackup(JSON.stringify(backup)), /saved workout/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
  assert.equal(storage.writes, 0);
});

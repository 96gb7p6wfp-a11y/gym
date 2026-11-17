import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createLocalClient, PRE_RESTORE_KEY, STORAGE_KEY } from '../src/storage.ts';
import { defaultReminderState, type ReminderState } from '../src/reminders.ts';

class MemoryStorage {
  values = new Map<string, string>();
  denied = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.denied && key === STORAGE_KEY) throw new Error('Isolated quota failure');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

function fixture(history = 1) {
  const storage = new MemoryStorage();
  const profile = structuredClone(DEFAULT_PROFILE);
  const movement = profile.plan.flatMap(day => day.exercises).find(exercise => exercise.name === 'Machine Chest Press')!;
  const plan = { ...profile.plan[0], exercises: [{ ...movement, sets: 3, defaultKg: 60 }] };
  const active = SessionSchema.parse(createSession(plan, 0, '2026-11-16', profile, []));
  active.exercises[0].logs[0].reps = 8;
  const sessions = Array.from({ length: history }, () => ({
    session: SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-11-09', profile, []), 'completed')),
    version: 2,
  }));
  const state = { schemaVersion: 1, profile, profileVersion: 3,
    sessions: [{ session: active, version: 1 }, ...sessions], nutrition: [], activities: [], reminders: defaultReminderState() };
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
  const client = createLocalClient(storage);
  const read = () => client.requestSync('/api/tracker') as unknown as typeof state;
  return { storage, client, state, active, read };
}

test('synchronous acknowledgements are durable before return and async callers retain rejection behavior', async () => {
  const { storage, client, active } = fixture();
  const changed = structuredClone(active);
  Object.assign(changed.exercises[0].logs[0], { kg: 62.5, reps: 7, done: true });
  assert.deepEqual(client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 }), { version: 2 });
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).sessions[0].session.exercises[0].logs[0].done, true);
  assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 }), /another tab/);
  await assert.rejects(client.request('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 }), /another tab/);
});

test('cached validated data never leaks through mutable response or payload objects', () => {
  const { storage, client, read, active } = fixture();
  const before = storage.getItem(STORAGE_KEY);
  const result = read();
  result.profile.plan[0].name = 'Mutated response only';
  result.sessions[0].session.exercises[0].logs[0].kg = 999;
  const reminder = client.requestSync('/api/reminders') as unknown as ReminderState;
  reminder.items[0].reminder.name = 'Mutated returned reminder';
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.equal(read().sessions[0].session.exercises[0].logs[0].kg, 60);
  assert.notEqual(read().profile.plan[0].name, 'Mutated response only');
  assert.notEqual((client.requestSync('/api/reminders') as unknown as ReminderState).items[0].reminder.name, 'Mutated returned reminder');
  const input = structuredClone(active);
  client.requestSync('/api/tracker', { action: 'session', session: input, expectedVersion: 1 });
  input.exercises[0].logs[0].kg = 777;
  assert.equal(read().sessions[0].session.exercises[0].logs[0].kg, 60);
});

test('a rejected write never publishes phantom versions or records into the validated cache', () => {
  const { storage, client, active, read } = fixture();
  read();
  const before = storage.getItem(STORAGE_KEY);
  const changed = structuredClone(active);
  changed.exercises[0].logs[0].kg = 65;
  storage.denied = true;
  assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 }), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
  assert.equal(read().sessions[0].version, 1);
  assert.equal(read().sessions[0].session.exercises[0].logs[0].kg, 60);
  storage.denied = false;
  assert.deepEqual(client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 }), { version: 2 });
  assert.equal(read().sessions[0].session.exercises[0].logs[0].kg, 65);
});

test('failed reminder item and entry writes leave cached nested containers unchanged', () => {
  const { storage, client } = fixture();
  const before = client.requestSync('/api/reminders') as unknown as ReminderState;
  storage.denied = true;
  assert.throws(() => client.requestSync('/api/reminders', { action: 'reminder',
    reminder: { ...before.items[0].reminder, name: 'Uncommitted name' }, expectedVersion: 0 }), /could not be saved/);
  assert.deepEqual(client.requestSync('/api/reminders'), before);
  assert.throws(() => client.requestSync('/api/reminders', { action: 'entry', expectedVersion: 0,
    entry: { id: 'zinc:2026-11-16', reminderId: 'zinc', date: '2026-11-16', status: 'later', takenAt: null, updatedAt: 10 } }), /could not be saved/);
  assert.deepEqual(client.requestSync('/api/reminders'), before);
});

test('exact external changes invalidate cached state and keep optimistic version and restore fences', () => {
  const { storage, client, active, read } = fixture();
  read();
  const second = createLocalClient(storage);
  const changed = structuredClone(active);
  changed.exercises[0].logs[0].kg = 70;
  second.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 });
  assert.equal(read().sessions[0].session.exercises[0].logs[0].kg, 70);
  assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: active, expectedVersion: 1 }), /another tab/);
  second.importBackup(second.exportBackup());
  assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 2 }), /restored in another tab/);
});

test('corruption and disappearance never fall back to cached records or a default profile', () => {
  const { storage, client, active, read } = fixture();
  read();
  storage.setItem(STORAGE_KEY, '{invalid');
  assert.throws(read, /could not be read/);
  assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: active, expectedVersion: 1 }), /could not be read/);
  assert.equal(storage.getItem(STORAGE_KEY), '{invalid');
  storage.removeItem(STORAGE_KEY);
  assert.throws(read, /disappeared/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('checkpoint and restore preserve safety bytes and revalidate compatible unknown legacy metadata', () => {
  const { storage, client, state, read } = fixture();
  const raw = { ...state, sessions: state.sessions.map(row => ({ ...row,
    session: { ...row.session, legacyCompatibleNote: 'retain exact checkpoint bytes' } })) };
  storage.setItem(STORAGE_KEY, JSON.stringify(raw));
  read();
  const before = storage.getItem(STORAGE_KEY);
  client.requestSync('/api/tracker', { action: 'profile', expectedVersion: 3, checkpoint: true,
    profile: { ...state.profile, restSeconds: 105 } });
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, before);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)!).sessions[0].session.legacyCompatibleNote, 'retain exact checkpoint bytes');
  assert.equal((read().sessions[0].session as unknown as { legacyCompatibleNote?: string }).legacyCompatibleNote, undefined);
  const imported = fixture().client.exportBackup();
  client.importBackup(imported);
  assert.equal(read().profile.restSeconds, state.profile.restSeconds);
  assert.ok(JSON.parse(storage.getItem(STORAGE_KEY)!).restoreGeneration);
});

test('ordinary edits validate the changed workout instead of reparsing every unchanged historical workout', () => {
  const { client, active, read } = fixture(50);
  const original = SessionSchema.safeParse;
  let validations = 0;
  SessionSchema.safeParse = ((...args: Parameters<typeof original>) => {
    validations += 1;
    return original.apply(SessionSchema, args);
  }) as typeof original;
  try {
    read();
    assert.equal(validations, 51, 'first read validates the entire existing history');
    validations = 0;
    const changed = structuredClone(active);
    changed.exercises[0].logs[0].kg = 67.5;
    client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 });
    assert.equal(validations, 1, 'the submitted changed record is still validated');
    read();
    assert.equal(validations, 1, 'an unchanged exact byte sequence can reuse its validated view');
  } finally { SessionSchema.safeParse = original; }
});

for (const phase of ['validation', 'serialization'] as const) {
  test(`a different window saving during ${phase} rejects the stale whole-store write without losing either record`, () => {
    const { storage, client, active, read, state } = fixture();
    read();
    const second = createLocalClient(storage);
    let interleaved = false;
    let latest: string | null = null;
    const saveOtherRecord = () => {
      interleaved = true;
      second.requestSync('/api/nutrition', { id: 'other-window-weight', date: '2026-11-16',
        payload: { kind: 'weight', kg: 64 }, expectedVersion: 0 });
      latest = storage.getItem(STORAGE_KEY);
    };
    const parse = SessionSchema.safeParse;
    const stringify = JSON.stringify;
    if (phase === 'validation') {
      SessionSchema.safeParse = ((...args: Parameters<typeof parse>) => {
        const result = parse.apply(SessionSchema, args);
        if (!interleaved) saveOtherRecord();
        return result;
      }) as typeof parse;
    } else {
      JSON.stringify = ((...args: Parameters<typeof stringify>) => {
        if (!interleaved && args[0]?.schemaVersion === 1) saveOtherRecord();
        return stringify(...args);
      }) as typeof stringify;
    }
    const changed = structuredClone(active);
    changed.exercises[0].logs[0].kg = 82.5;
    try {
      assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: changed, expectedVersion: 1 }), /changed in another window/);
    } finally {
      SessionSchema.safeParse = parse;
      JSON.stringify = stringify;
    }
    assert.equal(interleaved, true);
    assert.equal(storage.getItem(STORAGE_KEY), latest, 'no automatic retry overwrites the other writer');
    const after = JSON.parse(storage.getItem(STORAGE_KEY)!);
    assert.equal(after.nutrition.length, 1);
    assert.equal(after.sessions[0].session.exercises[0].logs[0].kg, 60);
    assert.equal(read().sessions[0].session.exercises[0].logs[0].kg, 60, 'rejected cached candidates are not published');
    assert.equal(after.sessions[0].version, 1);
    assert.deepEqual(after.sessions.slice(1), state.sessions.slice(1));
    assert.deepEqual(after.profile, state.profile);
  });
}

test('an initially absent store cannot overwrite another installation created during serialization', () => {
  const { active } = fixture();
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const second = createLocalClient(storage);
  const stringify = JSON.stringify;
  let interleaved = false;
  let latest: string | null = null;
  JSON.stringify = ((...args: Parameters<typeof stringify>) => {
    if (!interleaved && args[0]?.schemaVersion === 1) {
      interleaved = true;
      second.requestSync('/api/tracker', { action: 'profile',
        profile: { ...structuredClone(DEFAULT_PROFILE), restSeconds: 135 }, expectedVersion: 0 });
      latest = storage.getItem(STORAGE_KEY);
    }
    return stringify(...args);
  }) as typeof stringify;
  try {
    assert.throws(() => client.requestSync('/api/tracker', { action: 'session', session: active, expectedVersion: 0 }), /changed in another window/);
  } finally { JSON.stringify = stringify; }
  assert.equal(storage.getItem(STORAGE_KEY), latest);
  const after = JSON.parse(latest!);
  assert.equal(after.profile.restSeconds, 135);
  assert.deepEqual(after.sessions, []);
});

test('a concurrent save during safety-copy creation aborts the primary checkpoint and restores the prior fallback', () => {
  const { storage, state } = fixture();
  const fallback = JSON.stringify({ savedAt: '2026-11-01T10:00:00Z', raw: 'prior fallback bytes' });
  storage.setItem(PRE_RESTORE_KEY, fallback);
  const second = createLocalClient(storage);
  let interleaved = false;
  let latest: string | null = null;
  const client = createLocalClient({
    getItem: key => storage.getItem(key),
    removeItem: key => storage.removeItem(key),
    setItem: (key, value) => {
      storage.setItem(key, value);
      if (key === PRE_RESTORE_KEY && !interleaved) {
        interleaved = true;
        second.requestSync('/api/nutrition', { id: 'during-checkpoint-weight', date: '2026-11-16',
          payload: { kind: 'weight', kg: 64.5 }, expectedVersion: 0 });
        latest = storage.getItem(STORAGE_KEY);
      }
    },
  });
  assert.throws(() => client.requestSync('/api/tracker', { action: 'profile', checkpoint: true,
    profile: { ...state.profile, restSeconds: 150 }, expectedVersion: 3 }), /changed in another window/);
  assert.equal(storage.getItem(STORAGE_KEY), latest);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), fallback);
  const after = client.requestSync('/api/tracker');
  assert.deepEqual(after.profile, state.profile);
  assert.equal(after.profileVersion, 3);
  assert.deepEqual(after.sessions, state.sessions);
});

test('a rejected checkpoint never rolls back a newer safety copy owned by another operation', () => {
  const { storage, state } = fixture();
  const second = createLocalClient(storage);
  const newerFallback = JSON.stringify({ savedAt: '2026-11-16T12:00:01Z', raw: 'newer operation recovery bytes' });
  let interleaved = false;
  const client = createLocalClient({
    getItem: key => storage.getItem(key),
    removeItem: key => storage.removeItem(key),
    setItem: (key, value) => {
      storage.setItem(key, value);
      if (key === PRE_RESTORE_KEY && !interleaved) {
        interleaved = true;
        second.requestSync('/api/nutrition', { id: 'newer-operation-weight', date: '2026-11-16',
          payload: { kind: 'weight', kg: 65 }, expectedVersion: 0 });
        storage.setItem(PRE_RESTORE_KEY, newerFallback);
      }
    },
  });
  assert.throws(() => client.requestSync('/api/tracker', { action: 'profile', checkpoint: true,
    profile: { ...state.profile, restSeconds: 150 }, expectedVersion: 3 }), /changed in another window/);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), newerFallback);
  assert.deepEqual(client.requestSync('/api/tracker').profile, state.profile);
});

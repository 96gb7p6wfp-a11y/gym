import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { defaultReminderState } from '../src/reminders.ts';
import { findSessionDraft, putSessionDraft, resetDraftPreparation, resolveSessionDraft, warmupReady, type SessionDraft } from '../src/workout-drafts.ts';

class MemoryStorage {
  values = new Map<string, string>();
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const step = (done = false) => ({ key: 'individual-prep', name: 'Arm Circles', target: '8 each way', cue: 'Move smoothly without pain.', done });
function draft(date = '2026-10-22', slot: SessionDraft['slot'] = 'main'): SessionDraft {
  return { date, slot, plan: { ...structuredClone(DEFAULT_PROFILE.plan[0]), warmup: [step()] }, warmupOverride: false };
}
function fixture() {
  const storage = new MemoryStorage();
  return { storage, client: createLocalClient(storage) };
}

test('date-specific drafts distinguish main and extra sessions without changing reusable plans', () => {
  const recommended = structuredClone(DEFAULT_PROFILE.plan);
  const main = draft();
  const extra = draft(main.date, 'extra');
  extra.plan.name = 'My technique primer';
  const tomorrow = draft('2026-10-23');
  const drafts = putSessionDraft(putSessionDraft(undefined, main), extra);
  const replaced = putSessionDraft(drafts, { ...main, plan: { ...main.plan, name: 'Today only' } });
  assert.equal(replaced.length, 2);
  assert.equal(findSessionDraft(replaced, main.date, 'main')?.plan.name, 'Today only');
  assert.equal(findSessionDraft(replaced, main.date, 'extra')?.plan.name, 'My technique primer');
  assert.equal(findSessionDraft(replaced, tomorrow.date, 'main'), undefined);
  assert.equal(findSessionDraft(undefined, main.date, 'main'), undefined);
  assert.equal(findSessionDraft(drafts, main.date, 'main')?.plan.name, main.plan.name);
  assert.deepEqual(DEFAULT_PROFILE.plan, recommended);
  extra.plan.exercises[0].sets = 20;
  assert.notEqual(findSessionDraft(replaced, main.date, 'extra')?.plan.exercises[0].sets, 20);
});

test('main-workout readiness requires every warm-up step or an explicit override', () => {
  assert.equal(warmupReady([]), false);
  assert.equal(warmupReady([step()]), false);
  assert.equal(warmupReady([step(true), { ...step(), key: 'second-step' }]), false);
  assert.equal(warmupReady([step(true)]), true);
  assert.equal(warmupReady([step()], true), true);
  assert.equal(warmupReady([], true), true);
});

test('preparation-only drafts follow weekly edits while intentional date changes stay independent', () => {
  const original = draft();
  original.customized = false;
  original.plan.warmup = [step(true)];
  const recommended = structuredClone(original.plan);
  recommended.warmup = [step(false)];
  assert.equal(resolveSessionDraft(original, recommended).warmup?.[0].done, true);
  const reorderedKeys = { ...recommended, exercises: recommended.exercises.map(exercise => Object.fromEntries(Object.entries(exercise).reverse()) as typeof exercise) };
  assert.equal(resolveSessionDraft(original, reorderedKeys).warmup?.[0].done, true);
  const editedWeek = { ...recommended, name: 'Updated weekly workout', exercises: recommended.exercises.slice(1) };
  assert.equal(resolveSessionDraft(original, editedWeek), editedWeek);
  assert.equal(resolveSessionDraft({ ...original, customized: true }, editedWeek), original.plan);
  assert.equal(resolveSessionDraft(undefined, editedWeek), editedWeek);
});

test('starting a session can reset next-session preparation without altering completed preparation or prescriptions', () => {
  const original = draft();
  original.warmupOverride = true;
  original.readiness = 'yellow';
  original.plan.warmup = [step(true)];
  original.plan.exercises[0].defaultKg = 12.5;
  const reset = resetDraftPreparation(original);
  assert.equal(original.warmupOverride, true);
  assert.equal(original.plan.warmup[0].done, true);
  assert.equal(reset.warmupOverride, false);
  assert.equal(reset.readiness, 'yellow');
  assert.equal(reset.plan.warmup?.[0].done, false);
  assert.deepEqual(reset.plan.exercises, original.plan.exercises);
  assert.equal(reset.plan.exercises[0].defaultKg, 12.5);
});

test('reading a legacy version-1 store never writes or invents warm-up, draft or audio preference fields', async () => {
  const { storage, client } = fixture();
  const historical = stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0], 0, '2026-10-19', DEFAULT_PROFILE, []), 'completed');
  const legacy = JSON.stringify({ schemaVersion: 1, profile: DEFAULT_PROFILE, profileVersion: 3, sessions: [{ session: historical, version: 2 }], nutrition: [] });
  storage.setItem(STORAGE_KEY, legacy);
  storage.writes = 0;
  const read = await client.request('/api/tracker');
  const profile = read.profile as Record<string, unknown>;
  const sessions = read.sessions as { session: Record<string, unknown>; version: number }[];
  assert.equal(Object.hasOwn(profile, 'sessionDrafts'), false);
  assert.equal(Object.hasOwn(profile, 'timerSoundEnabled'), false);
  assert.equal(Object.hasOwn(sessions[0].session, 'warmupCompletedAt'), false);
  assert.equal(Object.hasOwn(sessions[0].session, 'warmupOverride'), false);
  assert.deepEqual(sessions, [{ session: historical, version: 2 }]);
  client.exportBackup();
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(STORAGE_KEY), legacy);
});

test('planned edits and checked preparation persist independently of sessions and preserve other collections', async () => {
  const { storage, client } = fixture();
  const history = stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0], 0, '2026-10-19', DEFAULT_PROFILE, []), 'completed');
  const nutrition = [{ id: 'weight-existing', date: '2026-10-21', payload: { kind: 'weight', kg: 64.3 }, version: 2 }];
  const reminders = defaultReminderState();
  const base = { schemaVersion: 1, profile: DEFAULT_PROFILE, profileVersion: 0, sessions: [{ session: history, version: 1 }], nutrition, activities: [], reminders, performance: { jumps: [], readiness: [] }, performanceVersion: 0 };
  storage.setItem(STORAGE_KEY, JSON.stringify(base));
  const planned = draft();
  planned.plan.name = 'My upper session';
  planned.plan.exercises[0].defaultKg = 12.5;
  planned.plan.warmup = [step(true), { ...step(), key: 'not-yet-complete' }];
  const profile = { ...structuredClone(DEFAULT_PROFILE), sessionDrafts: [planned], timerSoundEnabled: false };
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 });
  const fresh = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(fresh.profile, profile);
  assert.deepEqual(fresh.sessions, base.sessions);
  assert.deepEqual((JSON.parse(storage.getItem(STORAGE_KEY)!) as typeof base).nutrition, nutrition);
  assert.deepEqual((JSON.parse(storage.getItem(STORAGE_KEY)!) as typeof base).reminders, reminders);
  assert.deepEqual(profile.plan, DEFAULT_PROFILE.plan);
  assert.equal(findSessionDraft(profile.sessionDrafts, planned.date, planned.slot)?.plan.warmup?.[0].done, true);
});

test('backup and restore retain draft edits, timer preference and warm-up provenance alongside logged sets', async () => {
  const { client } = fixture();
  const planned = draft();
  planned.plan.warmup = [step(true)];
  planned.readiness = 'green';
  const profile = { ...structuredClone(DEFAULT_PROFILE), sessionDrafts: [planned], timerSoundEnabled: true };
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 });
  const active = createSession(planned.plan, 3, planned.date, profile, []);
  Object.assign(active.exercises[0].logs[0], { kg: 12.5, reps: 4, done: true });
  const completed = { ...stopSessionTimers(active, 'completed', active.startedAt + 600_000), warmup: planned.plan.warmup, warmupOverride: false, warmupCompletedAt: active.startedAt };
  await client.request('/api/tracker', { action: 'session', session: completed, expectedVersion: 0 });
  const backup = client.exportBackup();
  const other = fixture();
  other.client.importBackup(backup);
  const restored = await other.client.request('/api/tracker');
  assert.deepEqual(restored.profile, profile);
  assert.deepEqual(restored.sessions, [{ session: completed, version: 1 }]);
  assert.deepEqual(JSON.parse(other.client.exportBackup()).data, JSON.parse(backup).data);
});

test('malformed draft data cannot silently replace stored plans or history', async () => {
  const { storage, client } = fixture();
  await client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const duplicate = draft();
  const duplicateExercise = draft();
  duplicateExercise.plan.exercises.push(structuredClone(duplicateExercise.plan.exercises[0]));
  const invalidProfiles = [
    { ...DEFAULT_PROFILE, sessionDrafts: null },
    { ...DEFAULT_PROFILE, sessionDrafts: [{ ...draft(), date: '2026-02-30' }] },
    { ...DEFAULT_PROFILE, sessionDrafts: [{ ...draft(), slot: 'weekly' }] },
    { ...DEFAULT_PROFILE, sessionDrafts: [duplicate, structuredClone(duplicate)] },
    { ...DEFAULT_PROFILE, sessionDrafts: [duplicateExercise] },
    { ...DEFAULT_PROFILE, timerSoundEnabled: 'yes' },
    { ...DEFAULT_PROFILE, sessionDrafts: [{ ...draft(), warmupOverride: 'yes' }] },
    { ...DEFAULT_PROFILE, sessionDrafts: [{ ...draft(), readiness: 'great' }] },
  ];
  for (const profile of invalidProfiles) {
    assert.equal(ProfileSchema.safeParse(profile).success, false);
    await assert.rejects(client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 1 }), /valid training plan/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
    const backup = JSON.parse(client.exportBackup());
    backup.data.profile = profile;
    assert.throws(() => client.importBackup(JSON.stringify(backup)), /saved training plan/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('warm-up provenance is optional for historical sessions but validates when supplied', () => {
  const session = createSession(DEFAULT_PROFILE.plan[0], 0, '2026-10-19', DEFAULT_PROFILE, []);
  assert.deepEqual(SessionSchema.parse(session), session);
  assert.equal(SessionSchema.safeParse({ ...session, warmupCompletedAt: -1 }).success, false);
  assert.equal(SessionSchema.safeParse({ ...session, warmupOverride: 'yes' }).success, false);
  assert.equal(SessionSchema.safeParse({ ...session, warmupOverride: true, warmupCompletedAt: session.startedAt }).success, true);
});

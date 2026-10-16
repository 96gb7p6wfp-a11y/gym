import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { JumpEntrySchema, PerformanceDataSchema, type JumpEntry } from '../src/performance-data.ts';
import {
  addSessionExercise, removeSessionExercise, replaceSessionExercise, moveSessionExercise,
  adjustSessionSets, addPlanExercise, movePlanExercise, removePlanExercise, resetRecommendedPlan,
  type PlanDay, type PlanExercise,
} from '../src/workout-customization.ts';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
const exercise = (): PlanExercise => ({
  key: 'back-squat', exerciseId: 'back-squat', name: 'Back Squat', group: 'Quads',
  sets: 3, target: '6–8 reps', mode: 'weight', rest: 120, perSide: false,
  cue: 'Strong concentric.', defaultKg: 12.5, targetRpe: 7.5,
});
const session = () => SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[6], 6, '2026-10-11', DEFAULT_PROFILE, []));
const jump = (changes: Partial<JumpEntry> = {}): JumpEntry => ({
  id: crypto.randomUUID(), date: '2026-10-15', type: 'approach', measurement: 'height',
  cm: 64.5, notes: 'Same surface and shoes.', ...changes,
});

test('legacy profiles remain byte-compatible for absent customization and performance fields', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  await client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 });
  const before = storage.getItem(STORAGE_KEY);
  assert.deepEqual(await client.request('/api/performance'), { jumps: [], readiness: [], version: 0 });
  assert.equal(storage.getItem(STORAGE_KEY), before);
  const backup = JSON.parse(client.exportBackup());
  assert.equal(Object.hasOwn(backup.data, 'performance'), false);
  assert.equal(Object.hasOwn(backup.data, 'performanceVersion'), false);
  assert.equal(Object.hasOwn(backup.data.profile, 'appearance'), false);
  assert.equal(Object.hasOwn(backup.data.profile, 'customWorkouts'), false);
});

test('custom templates, decimal defaults and appearance round-trip through v1 backup without changing recommended plan', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const custom = {
    id: crypto.randomUUID(), name: 'Extra Upper', kind: 'strength', goal: 'hypertrophy',
    minutes: 35, note: 'Optional, keep some reps in reserve.', exercises: [exercise()],
  };
  const profile = { ...structuredClone(DEFAULT_PROFILE), customWorkouts: [custom], appearance: 'dark' };
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 });
  const fresh = createLocalClient(new MemoryStorage());
  fresh.importBackup(client.exportBackup());
  assert.deepEqual((await fresh.request('/api/tracker')).profile, profile);
  assert.deepEqual(DEFAULT_PROFILE.plan, profile.plan);
  for (const invalid of [
    { ...profile, appearance: 'neon' },
    { ...profile, customWorkouts: [custom, custom] },
    { ...profile, customWorkouts: [{ ...custom, id: 'bad-id' }] },
    { ...profile, customWorkouts: [{ ...custom, exercises: [{ ...exercise(), defaultKg: -1 }] }] },
    { ...profile, customWorkouts: [{ ...custom, exercises: [{ ...exercise(), targetRpe: 11 }] }] },
    { ...profile, customWorkouts: [{ ...custom, goal: 'random' }] },
  ]) {
    const before = storage.getItem(STORAGE_KEY);
    await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: invalid, expectedVersion: 1 }), /valid training plan/);
    assert.equal(storage.getItem(STORAGE_KEY), before);
  }
});

test('custom session keeps goal and decimal defaults but prioritizes real history without changing the template', () => {
  const plan: PlanDay = { name: 'Squat', kind: 'strength', goal: 'strength', minutes: 30, note: '', exercises: [exercise()] };
  const original = structuredClone(plan);
  const first = createSession(plan, 0, '2026-10-12', DEFAULT_PROFILE, []);
  assert.equal(first.goal, 'strength');
  assert.equal(first.exercises[0].logs[0].kg, 12.5);
  Object.assign(first.exercises[0].logs[0], { kg: 17.5, reps: 8, done: true });
  const completed = stopSessionTimers(first, 'completed', first.startedAt + 60000);
  const next = createSession(plan, 0, '2026-10-15', DEFAULT_PROFILE, [completed]);
  assert.equal(next.exercises[0].logs[0].kg, 17.5);
  assert.equal(next.exercises[0].logs[1].kg, 12.5);
  assert.equal(next.exercises[0].logs[0].done, false);
  assert.equal(next.exercises[0].targetRpe, 7.5);
  assert.deepEqual(plan, original);
  assert.equal(SessionSchema.safeParse(next).success, true);
});

test('daily additions use independent instance keys and canonical history survives a new instance', () => {
  const original = session();
  const before = structuredClone(original);
  const first = addSessionExercise(original, exercise());
  const added = first.exercises.at(-1)!;
  assert.equal(added.exerciseId, 'back-squat');
  assert.notEqual(added.key, 'back-squat');
  const second = addSessionExercise(first, exercise());
  assert.notEqual(added.key, second.exercises.at(-1)!.key);
  assert.notEqual(added.logs[0].id, second.exercises.at(-1)!.logs[0].id);
  Object.assign(added.logs[0], { kg: 25, reps: 8, done: true });
  const completed = stopSessionTimers(first, 'completed', first.startedAt + 60000);
  const plan = { name: 'Again', kind: 'strength', minutes: 30, note: '', exercises: [{ ...exercise(), key: 'another-instance' }] };
  const next = createSession(plan, 0, '2026-10-15', DEFAULT_PROFILE, [completed]);
  assert.equal(next.exercises[0].logs[0].kg, 25);
  assert.deepEqual(original, before);
  assert.equal(SessionSchema.safeParse(second).success, true);
});

test('removing remaining sets retains every completed record and unlinks both complex partners', () => {
  const original = session();
  const first = original.exercises.find((item) => /A1.*Complex pair/i.test(item.group))!;
  const partner = original.exercises.find((item) => /A2.*Complex pair/i.test(item.group))!;
  assert.ok(first && partner);
  Object.assign(first.logs[0], { kg: 40, reps: 3, done: true });
  const before = structuredClone(original);
  const updated = removeSessionExercise(original, first.key);
  const preserved = updated.exercises.find((item) => item.key === first.key)!;
  assert.deepEqual(preserved.logs, [first.logs[0]]);
  assert.equal(preserved.sets, 1);
  assert.equal(updated.exercises.find((item) => item.key === partner.key)!.group, 'Training');
  assert.equal(preserved.group, 'Training');
  assert.deepEqual(original, before);
  assert.equal(SessionSchema.safeParse(updated).success, true);
});

test('replacing a partially logged movement preserves original history and creates only fresh remaining sets', () => {
  const original = session();
  const first = original.exercises[0];
  Object.assign(first.logs[0], { kg: 5, reps: 3, done: true });
  const before = structuredClone(original);
  const updated = replaceSessionExercise(original, first.key, { ...exercise(), defaultKg: null });
  assert.equal(updated.exercises.length, original.exercises.length + 1);
  assert.deepEqual(updated.exercises[0].logs, [first.logs[0]]);
  const replacement = updated.exercises[1];
  assert.equal(replacement.name, 'Back Squat');
  assert.equal(replacement.logs.length, first.logs.length - 1);
  assert.ok(replacement.logs.every((log) => log.kg === null && log.reps === null && !log.done));
  assert.notEqual(replacement.key, first.key);
  assert.deepEqual(original, before);
  assert.equal(SessionSchema.safeParse(updated).success, true);
  const fullyDone = { ...updated, exercises: [updated.exercises[0]] };
  assert.equal(removeSessionExercise(fullyDone, first.key), fullyDone);
  assert.throws(() => replaceSessionExercise(fullyDone, first.key, exercise()), /All sets are recorded/);
});

test('remove empty exercise and move logged exercise preserve values and never change a weekly template', () => {
  const original = session();
  const first = original.exercises.find((item) => /A1.*Complex pair/i.test(item.group))!;
  const partner = original.exercises.find((item) => /A2.*Complex pair/i.test(item.group))!;
  Object.assign(first.logs[0], { kg: 5, reps: 3, done: true });
  const removed = removeSessionExercise(original, partner.key);
  assert.equal(removed.exercises.length, original.exercises.length - 1);
  const moved = moveSessionExercise(removed, first.key, removed.exercises.length - 1);
  assert.deepEqual(moved.exercises.at(-1)!.logs, first.logs);
  assert.equal(moved.exercises.at(-1)!.group, 'Training');
  assert.throws(() => moveSessionExercise(original, first.key, -1), /position/);
  assert.equal(SessionSchema.safeParse(moved).success, true);
});

test('reducing sets protects completed records and cancels a removed timer association', () => {
  const original = addSessionExercise(session(), { ...exercise(), mode: 'timed' });
  const last = original.exercises.at(-1)!;
  last.runningSince = 1000;
  last.timerSetId = last.logs[2].id;
  const updated = adjustSessionSets(original, last.key, 2, 6000);
  const timed = updated.exercises.at(-1)!;
  assert.equal(timed.logs.length, 2);
  assert.equal(timed.timerSetId, null);
  assert.equal(timed.runningSince, null);
  assert.equal(timed.elapsedMs, 5000);
  assert.equal(last.logs.length, 3);
  Object.assign(last.logs[2], { done: true, seconds: 20 });
  assert.throws(() => adjustSessionSets(original, last.key, 2), /recorded sets/);
  assert.throws(() => adjustSessionSets(original, last.key, 0), /between 1 and 20/);
  assert.equal(SessionSchema.safeParse(updated).success, true);
});

test('plan editing preserves the Tuesday primer and restoring defaults preserves preferences and custom workouts', () => {
  const plan = structuredClone(DEFAULT_PROFILE.plan[1]);
  const added = addPlanExercise(plan, exercise());
  const key = added.exercises.at(-1)!.key;
  const moved = movePlanExercise(added, key, 0);
  assert.equal(moved.exercises[0].key, key);
  const removed = removePlanExercise(moved, key);
  assert.deepEqual(removed, plan);
  const profile = {
    ...structuredClone(DEFAULT_PROFILE), appearance: 'dark', customWorkouts: [],
    volleyballSchedule: { ...DEFAULT_PROFILE.volleyballSchedule, startTime: '19:30', endTime: '21:30' },
  };
  profile.plan[0].name = 'Changed';
  const reset = resetRecommendedPlan(profile);
  assert.equal(reset.plan[0].name, DEFAULT_PROFILE.plan[0].name);
  assert.match(reset.plan[1].note, /19:30–21:30/);
  assert.deepEqual(reset.volleyballSchedule, profile.volleyballSchedule);
  assert.equal(reset.appearance, 'dark');
  assert.equal(profile.plan[0].name, 'Changed');
  assert.equal(ProfileSchema.safeParse(reset).success, true);
});

test('jump height and highest touch remain distinct and invalid measurements are rejected', () => {
  assert.equal(JumpEntrySchema.safeParse(jump()).success, true);
  assert.equal(JumpEntrySchema.safeParse(jump({ measurement: 'touch', cm: 294 })).success, true);
  for (const changes of [{ cm: 0 }, { cm: -1 }, { cm: Infinity }, { cm: 1001 }, { date: '2026-02-30' }, { id: 'bad' }]) {
    assert.equal(JumpEntrySchema.safeParse(jump(changes)).success, false);
  }
  const measured = jump();
  assert.equal(PerformanceDataSchema.safeParse({ jumps: [measured, measured], readiness: [] }).success, false);
});

test('performance save is optimistic, keeps unrelated data, and round-trips versions through backup', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  await client.request('/api/tracker', { action: 'profile', profile: { ...DEFAULT_PROFILE, appearance: 'dark' }, expectedVersion: 0 });
  const tracker = await client.request('/api/tracker');
  const measured = jump();
  const readiness = { id: crypto.randomUUID(), date: measured.date, energy: 'normal', soreness: 'low' };
  assert.deepEqual(await client.request('/api/performance', { action: 'save', expectedVersion: 0, jumps: [measured], readiness: [readiness] }), { version: 1 });
  const saved = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 0, jumps: [], readiness: [] }), /another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.deepEqual(await client.request('/api/tracker'), tracker);
  const restored = createLocalClient(new MemoryStorage());
  restored.importBackup(client.exportBackup());
  assert.deepEqual(await restored.request('/api/performance'), { jumps: [measured], readiness: [readiness], version: 1 });
  assert.deepEqual(await restored.request('/api/performance', { action: 'save', expectedVersion: 1, jumps: [], readiness: [readiness] }), { version: 2 });
});

test('invalid performance saves and malformed backup fields never overwrite saved data', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const measured = jump();
  await client.request('/api/performance', { action: 'save', expectedVersion: 0, jumps: [measured], readiness: [] });
  const saved = storage.getItem(STORAGE_KEY);
  for (const body of [
    { jumps: [jump({ cm: -1 })], readiness: [] },
    { jumps: [measured, measured], readiness: [] },
    { jumps: [] },
    { jumps: [], readiness: [{ id: crypto.randomUUID(), date: measured.date, energy: 'unknown', soreness: 'low' }] },
  ]) {
    await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 1, ...body }), /valid jump/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
  const backup = JSON.parse(client.exportBackup());
  for (const fields of [
    { performance: null }, { performanceVersion: -1 }, { performanceVersion: undefined },
    { performance: { jumps: null, readiness: [] } },
  ]) {
    assert.throws(() => client.importBackup(JSON.stringify({ ...backup, data: { ...backup.data, ...fields } })), /performance records/);
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('a renamed, retyped or remeasured movement cannot inherit another movement’s working load', () => {
  const plan = structuredClone(DEFAULT_PROFILE.plan[0]);
  const old = stopSessionTimers(createSession(plan, 0, '2026-10-05', DEFAULT_PROFILE, []), 'completed');
  old.exercises[0].logs[0] = { ...old.exercises[0].logs[0], kg: 80, reps: 8, done: true };
  for (const patch of [{ name: 'A different movement' }, { mode: 'bodyweight' as const }, { measurement: 'height' as const }]) {
    const changed = structuredClone(plan);
    Object.assign(changed.exercises[0], patch);
    const next = createSession(changed, 0, '2026-10-12', DEFAULT_PROFILE, [old]);
    assert.equal(next.exercises[0].logs[0].kg, null);
    assert.equal(next.exercises[0].logs[0].reps, null);
  }
});


test('planned session time is a stable optional snapshot, separate from recorded elapsed time', () => {
  const source = { ...structuredClone(DEFAULT_PROFILE.plan[0]), minutes: 35 };
  const session = createSession(source, 0, '2026-10-12', DEFAULT_PROFILE, []);
  source.minutes = 90;
  assert.equal(session.plannedMinutes, 35);
  assert.equal(SessionSchema.parse(session).plannedMinutes, 35);
  assert.equal(session.elapsedMs, 0);
  const { plannedMinutes: _planned, ...legacy } = session;
  assert.equal(SessionSchema.parse(legacy).plannedMinutes, undefined);
});

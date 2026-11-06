import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { PerformanceDataSchema, ReadinessEntrySchema, SprintEntrySchema, type PerformanceData, type SprintEntry } from '../src/performance-data.ts';
import { comparableSprintEntries, sprintProgress, sprintProtocolKey } from '../src/sprint-performance.ts';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';

const DATE = '2026-11-06';
const effort = (options: Partial<SprintEntry> = {}) => SprintEntrySchema.parse({
  id: crypto.randomUUID(), date: DATE, distanceM: 5, seconds: 1.25, timingMethod: 'electronic',
  protocol: 'Standing start; first movement to torso crossing finish', conditions: 'Court A; same shoes', ...options,
});

class MemoryStorage {
  values = new Map<string, string>();
  fail = false;
  writes = 0;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error('Quota exceeded'); this.writes++; this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function fixture() {
  const storage = new MemoryStorage();
  const history = stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0], 0, '2026-11-02', DEFAULT_PROFILE, []), 'completed');
  const active = createSession(DEFAULT_PROFILE.plan[2], 2, '2026-11-04', DEFAULT_PROFILE, []);
  const readiness = [{ id: crypto.randomUUID(), date: DATE, energy: 'normal' as const, soreness: 'moderate' as const,
    joints: { knee: 'comfortable' as const, achilles: 'sore' as const } }];
  const data: PerformanceData = { jumps: [{ id: crypto.randomUUID(), date: DATE, type: 'approach', measurement: 'height', cm: 68, notes: 'Retained measured test' }],
    readiness, sprints: [effort()] };
  const state = { schemaVersion: 1, profile: structuredClone(DEFAULT_PROFILE), profileVersion: 5,
    sessions: [{ session: history, version: 3 }, { session: active, version: 2 }],
    nutrition: [{ id: 'retained-food', date: DATE, version: 1, payload: { kind: 'weight', kg: 70 } }],
    activities: [], reminders: { items: [], entries: [] }, performance: data, performanceVersion: 4 };
  storage.values.set(STORAGE_KEY, JSON.stringify(state));
  return { storage, state, data, client: createLocalClient(storage) };
}

test('old performance objects and backups gain no sprint or joint defaults during validation', () => {
  const data = { jumps: [], readiness: [{ id: crypto.randomUUID(), date: DATE, energy: 'normal', soreness: 'low' }] };
  const parsed = PerformanceDataSchema.parse(data);
  assert.deepEqual(parsed, data);
  assert.equal(Object.hasOwn(parsed, 'sprints'), false);
  assert.equal(Object.hasOwn(parsed.readiness[0], 'joints'), false);
});

test('measured sprint schema retains distance, actual timing method, protocol and optional notes', () => {
  const entry = effort({ distanceM: 10, seconds: 1.853, timingMethod: 'video', notes: 'Frame-counted start and torso finish' });
  assert.equal(entry.seconds, 1.853);
  assert.equal(entry.timingMethod, 'video');
  assert.equal(entry.distanceM, 10);
  assert.equal(entry.notes, 'Frame-counted start and torso finish');
});

test('invalid sprint values, invented method and missing protocol fail validation', () => {
  const valid = effort();
  for (const patch of [{ seconds: 0 }, { seconds: -1 }, { seconds: Number.NaN }, { seconds: Infinity }, { seconds: 121 },
    { distanceM: 20 }, { timingMethod: 'estimated' }, { protocol: '' }, { protocol: '   ' }, { date: '2026-02-30' }]) {
    assert.equal(SprintEntrySchema.safeParse({ ...valid, ...patch }).success, false);
  }
  assert.equal(PerformanceDataSchema.safeParse({ jumps: [], readiness: [], sprints: [valid, valid] }).success, false);
});

test('sprint comparisons separate distance, start protocol, timing method and missing or different conditions', () => {
  const selected = effort();
  const same = effort({ protocol: '  STANDING  start; first movement to torso crossing finish ', conditions: ' Court A; SAME SHOES ' });
  const entries = [selected, same, effort({ distanceM: 10 }), effort({ timingMethod: 'manual' }), effort({ timingMethod: 'video' }),
    effort({ protocol: 'Flying start; gates measure last five metres' }), effort({ conditions: 'Outdoor track; different shoes' }),
    effort({ conditions: undefined }), effort({ date: '2026-11-07', seconds: .9 })];
  assert.equal(sprintProtocolKey(selected), sprintProtocolKey(same));
  assert.deepEqual(new Set(comparableSprintEntries(entries, selected, DATE).map(entry => entry.id)), new Set([selected.id, same.id]));
  assert.equal(entries.length, 9);
});

test('daily best uses actual attempts and change needs distinct comparable test dates', () => {
  const first = effort({ date: '2026-10-09', seconds: 1.4 });
  const firstBetter = effort({ date: '2026-10-09', seconds: 1.3 });
  const latest = effort({ seconds: 1.2 });
  const slowerSameDate = effort({ seconds: 1.5 });
  const source = [slowerSameDate, first, latest, firstBetter];
  const original = structuredClone(source);
  const progress = sprintProgress(source, latest, DATE);
  assert.equal(progress.attempts, 4);
  assert.deepEqual(progress.points.map(entry => [entry.date, entry.seconds]), [['2026-10-09', 1.3], [DATE, 1.2]]);
  assert.equal(progress.changeSeconds, .1);
  assert.equal(progress.best?.id, latest.id);
  assert.equal(progress.latest?.id, latest.id);
  assert.deepEqual(source, original);
  assert.equal(sprintProgress([latest, slowerSameDate], latest, DATE).changeSeconds, null);
});

test('slower measured results and empty or future-only series never invent improvement', () => {
  const previous = effort({ date: '2026-10-09', seconds: 1.1 });
  const latest = effort({ seconds: 1.3 });
  assert.equal(sprintProgress([previous, latest], latest, DATE).changeSeconds, -.2);
  assert.equal(sprintProgress([], latest, DATE).best, null);
  const future = effort({ date: '2026-12-01' });
  assert.deepEqual(sprintProgress([future], future, DATE), { points: [], attempts: 0, best: null, latest: null, changeSeconds: null });
});

test('joint observations are optional, explicit and never silently replaced by comfortable', () => {
  const legacy = { id: crypto.randomUUID(), date: DATE, energy: 'low', soreness: 'high' };
  assert.deepEqual(ReadinessEntrySchema.parse(legacy), legacy);
  assert.deepEqual(ReadinessEntrySchema.parse({ ...legacy, joints: { shoulder: 'pain' } }).joints, { shoulder: 'pain' });
  assert.equal(ReadinessEntrySchema.safeParse({ ...legacy, joints: { knee: 'cleared' } }).success, false);
});

test('legacy jump/readiness saves preserve sprint results and joint observations they do not own', async () => {
  const { client, data, storage, state } = fixture();
  const incoming = data.readiness.map(({ joints: _joints, ...entry }) => ({ ...entry, energy: 'high' }));
  await client.request('/api/performance', { action: 'save', expectedVersion: 4, jumps: data.jumps, readiness: incoming });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.deepEqual(saved.performance.sprints, data.sprints);
  assert.deepEqual(saved.performance.readiness[0].joints, data.readiness[0].joints);
  assert.equal(saved.performance.readiness[0].energy, 'high');
  for (const field of ['profile', 'profileVersion', 'sessions', 'nutrition', 'activities', 'reminders']) {
    assert.deepEqual(saved[field], state[field as keyof typeof state]);
  }
  assert.equal(saved.performanceVersion, 5);
});

test('an explicit empty sprint array removes only selected sprint results, and an explicit empty joints object clears observations', async () => {
  const { client, data, storage } = fixture();
  await client.request('/api/performance', { action: 'save', expectedVersion: 4, jumps: data.jumps,
    readiness: data.readiness.map(entry => ({ ...entry, joints: {} })), sprints: [] });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.deepEqual(saved.performance.sprints, []);
  assert.deepEqual(saved.performance.jumps, data.jumps);
  assert.deepEqual(saved.performance.readiness[0].joints, {});
});

test('undefined optional fields from an older caller preserve measured sprints and joint observations', async () => {
  const { client, data, storage } = fixture();
  await client.request('/api/performance', { action: 'save', expectedVersion: 4, jumps: data.jumps,
    readiness: data.readiness.map(entry => ({ ...entry, energy: 'high', joints: undefined })), sprints: undefined });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.deepEqual(saved.performance.sprints, data.sprints);
  assert.deepEqual(saved.performance.readiness[0].joints, data.readiness[0].joints);
  assert.equal(saved.performance.readiness[0].energy, 'high');
});

test('null optional performance fields remain invalid rather than erasing known results', async () => {
  const { client, data, storage } = fixture();
  const before = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 4, jumps: data.jumps,
    readiness: data.readiness, sprints: null }), /valid jump or sprint/);
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 4, jumps: data.jumps,
    readiness: data.readiness.map(entry => ({ ...entry, joints: null })) }), /valid jump or sprint/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('invalid sprint data cannot partially replace valid jump, readiness or workout records', async () => {
  const { client, data, storage } = fixture();
  const before = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 4, jumps: [], readiness: [],
    sprints: [{ ...data.sprints![0], seconds: 0 }] }), /valid jump or sprint/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('version-one backup roundtrip includes measured sprints and keeps all previous records', async () => {
  const { client, data, storage } = fixture();
  const backup = JSON.parse(client.exportBackup());
  assert.equal(backup.version, 1);
  assert.deepEqual(backup.data.performance, data);
  const targetStorage = new MemoryStorage();
  const target = createLocalClient(targetStorage);
  target.importBackup(JSON.stringify(backup));
  const saved = JSON.parse(targetStorage.getItem(STORAGE_KEY)!);
  assert.deepEqual(saved.performance, data);
  for (const key of ['profile', 'sessions', 'nutrition', 'activities', 'reminders']) assert.deepEqual(saved[key], backup.data[key]);
  const performance = await target.request('/api/performance');
  assert.deepEqual(performance, { ...data, version: 4 });
  assert.equal(storage.writes, 0);
});

test('old backups without performance or sprint fields remain importable without synthetic results', () => {
  const { client, data } = fixture();
  const backup = JSON.parse(client.exportBackup());
  delete backup.data.performance.sprints;
  const targetStorage = new MemoryStorage(), target = createLocalClient(targetStorage);
  target.importBackup(JSON.stringify(backup));
  assert.deepEqual(JSON.parse(targetStorage.getItem(STORAGE_KEY)!).performance, { jumps: data.jumps, readiness: data.readiness });
  delete backup.data.performance; delete backup.data.performanceVersion;
  target.importBackup(JSON.stringify(backup));
  assert.equal(Object.hasOwn(JSON.parse(targetStorage.getItem(STORAGE_KEY)!), 'performance'), false);
});

test('stale saves and quota errors retain sprint records with the original version', async () => {
  const { client, data, storage } = fixture();
  const before = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 3, ...data }), /another tab/);
  storage.fail = true;
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 4, ...data }), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

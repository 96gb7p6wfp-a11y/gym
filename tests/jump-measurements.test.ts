import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { createReachJumpEntries, JumpEntrySchema, PerformanceDataSchema, type JumpEntry } from '../src/performance-data.ts';
import { getJumpSummaries, getPerformanceSummary } from '../src/performance-insights.ts';

const legacy = (overrides: Partial<JumpEntry> = {}): JumpEntry => ({
  id: crypto.randomUUID(), date: '2026-10-01', type: 'approach', measurement: 'height', cm: 80, notes: '', ...overrides,
});
class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

test('reach-and-touch calculation retains each setup and separates standing and approach jumps', () => {
  const input = { date: '2026-10-22', standingReachCm: 235.2, standingTouchCm: 310.4, approachTouchCm: 317.7, notes: 'Wall and tape; best of three.' };
  const entries = createReachJumpEntries(input);
  assert.deepEqual(entries.map(({ type, cm }) => ({ type, cm })), [{ type: 'standing', cm: 75.2 }, { type: 'approach', cm: 82.5 }]);
  assert.notEqual(entries[0].id, entries[1].id);
  assert.ok(entries.every(entry => entry.source === 'measured' && entry.measurement === 'height' && entry.standingReachCm === 235.2 && entry.notes === input.notes));
  assert.deepEqual(entries.map(entry => entry.touchCm), [310.4, 317.7]);
  const snapshot = structuredClone(entries);
  createReachJumpEntries({ ...input, standingReachCm: 236 });
  assert.deepEqual(entries, snapshot, 'a later reach measurement cannot recalculate earlier tests');
});

test('an athlete may record just one jump type but invalid or incomplete tests cannot save', () => {
  assert.equal(createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, approachTouchCm: 317 }).length, 1);
  assert.equal(createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, standingTouchCm: 310 })[0].type, 'standing');
  for (const patch of [
    {}, { standingTouchCm: 235 }, { approachTouchCm: 200 }, { approachTouchCm: NaN },
    { approachTouchCm: Infinity }, { standingReachCm: 0, approachTouchCm: 317 },
    { date: '2026-02-30', approachTouchCm: 317 },
  ]) assert.throws(() => createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, ...patch }));
});

test('reach metadata is validated together and must match the saved jump height', () => {
  const valid = createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, approachTouchCm: 317 })[0];
  for (const patch of [
    { standingReachCm: undefined }, { touchCm: undefined }, { cm: 317 },
    { measurement: 'touch' }, { touchCm: 230 }, { source: 'confirmed-ai' },
  ]) assert.equal(JumpEntrySchema.safeParse({ ...valid, ...patch }).success, false);
  assert.equal(JumpEntrySchema.safeParse({ ...valid, source: 'video-estimate' }).success, true);
});

test('old height, touch and block records remain exactly compatible without invented metadata', () => {
  const old = [legacy(), legacy({ type: 'standing', cm: 75 }), legacy({ type: 'block', measurement: 'touch', cm: 305 })];
  assert.deepEqual(PerformanceDataSchema.parse({ jumps: old, readiness: [] }), { jumps: old, readiness: [] });
  assert.ok(old.every(entry => !Object.hasOwn(entry, 'source') && !Object.hasOwn(entry, 'standingReachCm')));
  const summaries = getJumpSummaries([], old, '2026-10-22');
  assert.equal(summaries.length, 3);
  assert.equal(summaries.find(summary => summary.type === 'approach')!.best, 80);
});

test('video estimates remain stored but never inflate measured charts, PRs or improvement insights', () => {
  const measured = legacy();
  const estimate = createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, approachTouchCm: 335, source: 'video-estimate' })[0];
  const summary = getPerformanceSummary({ sessions: [], today: '2026-10-22', performance: { jumps: [measured, estimate], readiness: [] } });
  assert.equal(summary.jumps.length, 1);
  assert.equal(summary.jumps[0].current, 80);
  assert.equal(summary.jumps[0].best, 80);
  assert.equal(summary.jumps[0].change30Days, null);
  assert.equal(summary.records.find(record => record.kind === 'height')!.value, 80);
  assert.equal(summary.records.some(record => record.isNew), false);
  assert.equal(summary.insights.some(insight => /jump is up/.test(insight)), false);
  assert.deepEqual(getPerformanceSummary({ sessions: [], today: '2026-10-22', performance: { jumps: [estimate], readiness: [] } }).jumps, []);
});

test('measured standing and approach improvements compare only the same jump type and units', () => {
  const first = createReachJumpEntries({ date: '2026-10-01', standingReachCm: 235, standingTouchCm: 310, approachTouchCm: 315 });
  const second = createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, standingTouchCm: 311, approachTouchCm: 318 });
  const touch = legacy({ date: '2026-10-22', measurement: 'touch', cm: 330 });
  const summaries = getJumpSummaries([], [...first, ...second, touch], '2026-10-22');
  assert.equal(summaries.find(summary => summary.type === 'standing' && summary.measurement === 'height')!.change30Days, 1);
  assert.equal(summaries.find(summary => summary.type === 'approach' && summary.measurement === 'height')!.change30Days, 3);
  assert.equal(summaries.find(summary => summary.measurement === 'touch')!.current, 330);
});

test('v1 backups round-trip old records plus reach metadata and estimates without changing unrelated data', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  await client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 });
  const trackerBefore = await client.request('/api/tracker');
  const jumps = [legacy(), ...createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, standingTouchCm: 310, approachTouchCm: 317 }),
    ...createReachJumpEntries({ date: '2026-10-22', standingReachCm: 235, approachTouchCm: 320, source: 'video-estimate', notes: 'Slow-motion estimate.' })];
  await client.request('/api/performance', { action: 'save', expectedVersion: 0, jumps, readiness: [] });
  assert.deepEqual(await client.request('/api/tracker'), trackerBefore);
  const restored = createLocalClient(new MemoryStorage());
  restored.importBackup(client.exportBackup());
  assert.deepEqual(await restored.request('/api/performance'), { version: 1, jumps, readiness: [] });
  assert.deepEqual(await restored.request('/api/tracker'), trackerBefore);
  const before = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/performance', { action: 'save', expectedVersion: 1,
    jumps: [...jumps, { ...jumps[1], id: crypto.randomUUID(), cm: 999 }], readiness: [] }));
  assert.equal(storage.getItem(STORAGE_KEY), before, 'an inconsistent new measurement cannot damage the saved store');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { defaultReminderState, reminderEntryId, type Reminder, type ReminderState } from '../src/reminders.ts';

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrites) throw new Error('Quota exceeded'); this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}
function fixture() { const storage = new MemoryStorage(); return { storage, client: createLocalClient(storage) }; }
function entry(date = '2026-10-08', status = 'taken', reminderId = 'zinc') {
  return { id: reminderEntryId(reminderId, date), reminderId, date, status, takenAt: status === 'taken' ? 10 : null, updatedAt: 10 };
}
async function state(client: ReturnType<typeof createLocalClient>) { return await client.request('/api/reminders') as unknown as ReminderState; }

test('old version-1 backups migrate absent reminders without losing workouts or nutrition', async () => {
  const { client } = fixture();
  const backup = JSON.parse(client.exportBackup());
  delete backup.data.reminders;
  const restored = fixture();
  restored.client.importBackup(JSON.stringify(backup));
  assert.deepEqual(await state(restored.client), defaultReminderState());
  assert.deepEqual(await restored.client.request('/api/tracker'), await client.request('/api/tracker'));
  assert.deepEqual(await restored.client.request('/api/nutrition'), await client.request('/api/nutrition'));
});

test('saving a meal never marks supplements taken; daily taken history persists and separates dates', async () => {
  const { client, storage } = fixture();
  await client.request('/api/nutrition', { id: 'lunch', date: '2026-10-08', expectedVersion: 0, payload: { kind: 'meal', name: 'Lunch', foods: [{ name: 'Rice', portion: 'Bowl', calories: 300, protein: 5, carbs: 65, fat: 1 }], source: 'manual', notes: '', assumptions: '', confidence: null } });
  assert.equal((await state(client)).entries.length, 0);
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 });
  await client.request('/api/reminders', { action: 'entry', entry: entry('2026-10-09'), expectedVersion: 0 });
  assert.equal((await state(createLocalClient(storage))).entries.length, 2);
  const saved = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 1 }), /already marked taken/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});

test('Later and Undo update one daily entry; stale tabs cannot duplicate or overwrite a dose record', async () => {
  const { client, storage } = fixture();
  const other = createLocalClient(storage);
  await client.request('/api/reminders', { action: 'entry', entry: entry('2026-10-08', 'later'), expectedVersion: 0 });
  await assert.rejects(other.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 }), /another tab/);
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 1 });
  await client.request('/api/reminders', { action: 'entry', entry: entry('2026-10-08', 'pending'), expectedVersion: 2 });
  let saved = await state(client);
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.entries[0].entry.takenAt, null);
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 3 });
  saved = await state(client);
  assert.equal(saved.entries.length, 1);
  assert.equal(saved.entries[0].version, 4);
});

test('unconfirmed, paused and unknown products cannot be marked taken; prescription instructions are editable with version checks', async () => {
  const { client } = fixture();
  for (const id of ['vitamin-d-k2', 'magnesium', 'omega-3', 'unknown']) {
    await assert.rejects(client.request('/api/reminders', { action: 'entry', entry: entry('2026-10-08', 'taken', id), expectedVersion: 0 }), /Confirm|no longer exists/);
  }
  const zinc = (await state(client)).items.find((item) => item.reminder.id === 'zinc')!.reminder;
  await client.request('/api/reminders', { action: 'reminder', reminder: { ...zinc, enabled: false }, expectedVersion: 0 });
  await assert.rejects(client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 }), /Confirm/);
  const medicine: Reminder = { id: 'medicine', name: 'My prescribed medicine', kind: 'medicine', instructions: 'Follow my recorded prescription.', timing: 'instructions', time: null, schedule: 'instructions-only', enabled: true, confirmed: false };
  await client.request('/api/reminders', { action: 'reminder', reminder: medicine, expectedVersion: 0 });
  await assert.rejects(client.request('/api/reminders', { action: 'reminder', reminder: { ...medicine, name: 'Stale edit' }, expectedVersion: 0 }), /another tab/);
  assert.equal((await state(client)).items[0].reminder.timing, 'instructions');
});

test('backups preserve reminder instructions and history; reset clears history without carrying taken flags to defaults', async () => {
  const { client } = fixture();
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 });
  const other = fixture();
  other.client.importBackup(client.exportBackup());
  assert.deepEqual(await state(other.client), await state(client));
  const mutable = await state(other.client);
  mutable.items[0].reminder.name = 'Local mutation';
  assert.notEqual((await state(other.client)).items[0].reminder.name, 'Local mutation');
  other.client.reset();
  assert.deepEqual(await state(other.client), defaultReminderState());
});

test('present malformed reminder backup fields never migrate away or overwrite good data', async () => {
  const { client, storage } = fixture();
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 });
  const original = storage.getItem(STORAGE_KEY);
  const backup = JSON.parse(client.exportBackup());
  const duplicate = structuredClone(backup.data.reminders);
  duplicate.entries.push(duplicate.entries[0]);
  const orphan = structuredClone(backup.data.reminders);
  orphan.entries[0].entry.reminderId = 'unknown';
  orphan.entries[0].entry.id = 'unknown:2026-10-08';
  for (const reminders of [null, [], {}, { items: null, entries: [] }, duplicate, orphan]) {
    assert.throws(() => client.importBackup(JSON.stringify({ ...backup, data: { ...backup.data, reminders } })), /reminder/);
    assert.equal(storage.getItem(STORAGE_KEY), original);
  }
});

test('quota failure and invalid dates keep every existing reminder and nutrition record intact', async () => {
  const { client, storage } = fixture();
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 });
  const original = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/reminders', { action: 'entry', entry: entry('2026-02-30'), expectedVersion: 0 }), /valid reminder date/);
  assert.equal(storage.getItem(STORAGE_KEY), original);
  storage.failWrites = true;
  await assert.rejects(client.request('/api/reminders', { action: 'entry', entry: entry('2026-10-09'), expectedVersion: 0 }), /could not be saved/);
  assert.equal(storage.getItem(STORAGE_KEY), original);
  assert.equal((await state(client)).entries.length, 1);
});

test('dose text and food timing round-trip in backups while old instructions and taken history stay unchanged', async () => {
  const { client } = fixture();
  const old = await state(client);
  await client.request('/api/reminders', { action: 'entry', entry: entry(), expectedVersion: 0 });
  const medicine: Reminder = {
    id: 'prescribed', name: 'My medicine', kind: 'medicine', instructions: 'Use exactly as prescribed.',
    dosageText: 'Dose from my prescription', foodRelation: 'after', timing: 'time', time: '22:30',
    schedule: 'once-daily', enabled: true, confirmed: true,
  };
  await client.request('/api/reminders', { action: 'reminder', reminder: medicine, expectedVersion: 0 });
  const restored = fixture();
  restored.client.importBackup(client.exportBackup());
  const saved = await state(restored.client);
  assert.deepEqual(saved.items.find(({ reminder }) => reminder.id === 'prescribed')!.reminder, medicine);
  assert.deepEqual(saved.items.filter(({ reminder }) => reminder.id !== 'prescribed'), old.items);
  assert.deepEqual(saved.entries, (await state(client)).entries);
  assert.equal(saved.entries[0].entry.status, 'taken');
  assert.equal(Object.hasOwn(saved.items.find(({ reminder }) => reminder.id === 'zinc')!.reminder, 'dosageText'), false);
});

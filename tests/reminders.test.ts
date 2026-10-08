import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultReminderState, isTrackable, mealReminders, ReminderEntrySchema, ReminderSchema, reminderEntryId, reminderStatus, timeReminders, timingLabel } from '../src/reminders.ts';

test('only the user-confirmed zinc dose is trackable; unverified product strengths are not daily prescriptions', () => {
  const state = defaultReminderState();
  assert.equal(state.items.length, 4);
  assert.deepEqual(state.items.filter(({ reminder }) => isTrackable(reminder)).map(({ reminder }) => reminder.id), ['zinc']);
  const zinc = state.items.find(({ reminder }) => reminder.id === 'zinc')!.reminder;
  assert.match(zinc.instructions, /15 mg zinc, 100 mg histidine and 19 mg cysteine/);
  const vitamin = state.items.find(({ reminder }) => reminder.id === 'vitamin-d-k2')!.reminder;
  assert.equal(vitamin.schedule, 'instructions-only');
  assert.match(vitamin.instructions, /2,500 IU D3 \(62.5 µg\)/);
  const magnesium = state.items.find(({ reminder }) => reminder.id === 'magnesium')!.reminder;
  assert.equal(magnesium.confirmed, false);
  assert.equal(magnesium.time, null);
  assert.match(magnesium.instructions, /Confirm elemental magnesium/);
  assert.match(magnesium.instructions, /bedtime is not proven better/);
});

test('meal cues do not mutate taken history and skip paused, unconfirmed, deferred and already-taken reminders', () => {
  const state = defaultReminderState();
  const date = '2026-10-08';
  assert.deepEqual(mealReminders(state, date).map((item) => item.id), ['zinc']);
  assert.equal(state.entries.length, 0);
  state.entries.push({ entry: { id: reminderEntryId('zinc', date), reminderId: 'zinc', date, status: 'later', takenAt: null, updatedAt: 20 }, version: 1 });
  assert.equal(mealReminders(state, date).length, 0);
  assert.equal(mealReminders(state, '2026-10-09').length, 1);
  state.entries[0].entry = { ...state.entries[0].entry, status: 'taken', takenAt: 20 };
  assert.equal(mealReminders(state, date).length, 0);
  state.items[0].reminder.enabled = false;
  assert.equal(mealReminders(state, '2026-10-09').length, 0);
});

test('reminder entries have one key per real calendar date and only taken entries can have a taken time', () => {
  const entry = { id: 'zinc:2026-10-08', reminderId: 'zinc', date: '2026-10-08', status: 'taken', takenAt: 10, updatedAt: 12 };
  assert.equal(ReminderEntrySchema.safeParse(entry).success, true);
  for (const bad of [
    { ...entry, id: 'zinc:2026-10-09' },
    { ...entry, date: '2026-02-30', id: 'zinc:2026-02-30' },
    { ...entry, takenAt: null },
    { ...entry, status: 'pending' },
    { ...entry, takenAt: 13 },
    { ...entry, updatedAt: Number.NaN },
  ]) assert.equal(ReminderEntrySchema.safeParse(bad).success, false);
});

test('custom medicine instructions do not assume a meal or once-daily frequency', () => {
  const reminder = { id: 'medicine', name: 'Prescription', kind: 'medicine', instructions: 'Use exactly as prescribed.', schedule: 'instructions-only', timing: 'instructions', time: null, enabled: true, confirmed: false };
  assert.equal(ReminderSchema.safeParse(reminder).success, true);
  assert.equal(isTrackable(ReminderSchema.parse(reminder)), false);
  assert.equal(ReminderSchema.safeParse({ ...reminder, confirmed: true }).success, false);
  assert.equal(ReminderSchema.safeParse({ ...reminder, schedule: 'once-daily', confirmed: true, timing: 'time', time: '22:30' }).success, true);
  assert.equal(ReminderSchema.safeParse({ ...reminder, timing: 'time' }).success, false);
  assert.equal(ReminderSchema.safeParse({ ...reminder, timing: 'time', time: '25:00' }).success, false);
});

test('each default state is independent and status and evening timing stay tied to the selected date', () => {
  const first = defaultReminderState();
  first.items[0].reminder.name = 'Edited';
  assert.equal(defaultReminderState().items[0].reminder.name, 'Mivolis zinc');
  assert.equal(reminderStatus(first, 'zinc', '2026-10-08'), 'pending');
  assert.equal(timingLabel(first.items.find(({ reminder }) => reminder.id === 'magnesium')!.reminder), 'With your evening meal');
});

test('foreground time cues use Berlin civil time and skip other dates, deferred entries and unchecked instructions', () => {
  const state = defaultReminderState();
  const zinc = state.items[0].reminder;
  zinc.timing = 'time';
  zinc.time = '22:30';
  assert.equal(timeReminders(state, '2026-10-08', new Date('2026-10-08T20:29:00Z')).length, 0);
  assert.deepEqual(timeReminders(state, '2026-10-08', new Date('2026-10-08T20:30:00Z')).map((item) => item.id), ['zinc']);
  assert.equal(timeReminders(state, '2026-10-07', new Date('2026-10-08T20:30:00Z')).length, 0);
  assert.equal(timeReminders(state, '2026-10-08', new Date('2026-10-08T23:30:00Z')).length, 0);
  state.entries.push({ entry: { id: 'zinc:2026-10-08', reminderId: 'zinc', date: '2026-10-08', status: 'later', takenAt: null, updatedAt: 10 }, version: 1 });
  assert.equal(timeReminders(state, '2026-10-08', new Date('2026-10-08T20:30:00Z')).length, 0);
  state.entries = [];
  zinc.confirmed = false;
  assert.equal(timeReminders(state, '2026-10-08', new Date('2026-10-08T20:30:00Z')).length, 0);
});

test('optional dose and food timing preserve old records and never confirm a schedule', () => {
  const old = defaultReminderState().items[0].reminder;
  assert.deepEqual(ReminderSchema.parse(old), old);
  assert.equal(Object.hasOwn(ReminderSchema.parse(old), 'foodRelation'), false);
  assert.equal(Object.hasOwn(ReminderSchema.parse(old), 'dosageText'), false);
  const recorded = ReminderSchema.parse({ ...old, dosageText: '  15 mg as labelled  ', foodRelation: 'after', confirmed: false });
  assert.equal(recorded.dosageText, '15 mg as labelled');
  assert.equal(recorded.confirmed, false);
  assert.equal(isTrackable(recorded), false);
  assert.equal(timingLabel(recorded), 'After a meal');
  assert.equal(ReminderSchema.safeParse({ ...old, foodRelation: 'anytime' }).success, false);
  assert.equal(ReminderSchema.safeParse({ ...old, dosageText: 'x'.repeat(161) }).success, false);
});

test('food instructions can accompany a chosen clock while meal and time cues keep their distinct schedules', () => {
  const state = defaultReminderState();
  const zinc = state.items[0].reminder;
  zinc.foodRelation = 'before';
  assert.equal(timingLabel(zinc), 'Before a meal');
  assert.deepEqual(mealReminders(state, '2026-10-08').map((item) => item.id), ['zinc']);
  zinc.timing = 'evening';
  zinc.foodRelation = 'after';
  assert.equal(timingLabel(zinc), 'After your evening meal');
  zinc.timing = 'time';
  zinc.time = '22:30';
  assert.equal(timingLabel(zinc), 'At 22:30 · after food');
  assert.equal(mealReminders(state, '2026-10-08').length, 0);
  assert.deepEqual(timeReminders(state, '2026-10-08', new Date('2026-10-08T20:30:00Z')).map((item) => item.id), ['zinc']);
  assert.equal(state.entries.length, 0);
});

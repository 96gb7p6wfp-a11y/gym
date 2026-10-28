import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { upgradeMasterProgram, restorePreviousMasterProgram } from '../src/master-program-upgrade.ts';
import { createVolleyballMasterPlan, getMasterProgramWeek } from '../src/volleyball-master-plan.ts';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { defaultReminderState } from '../src/reminders.ts';

function personalProgram() {
  const plan = structuredClone(DEFAULT_PROFILE.plan);
  plan[0].name = 'My edited upper session';
  plan[0].exercises[0].sets = 2;
  return ProfileSchema.parse({
    ...structuredClone(DEFAULT_PROFILE), plan,
    masterProgram: { version: 1, startDate: '2026-10-05', matchWeeks: [3, 6],
      readiness: [{ date: '2026-10-28', status: 'yellow' }] },
    masterMatchWeekend: structuredClone(plan.slice(5)),
    preMasterPlan: structuredClone(DEFAULT_PROFILE.plan),
    appearance: 'dark', timerSoundVolume: 0.35, timerSoundEnabled: true,
    customWorkouts: [{ ...structuredClone(plan[0]), id: crypto.randomUUID() }],
    sessionDrafts: [
      { date: '2026-11-01', slot: 'main', plan: { ...structuredClone(plan[0]), name: 'My Sunday variation' }, customized: true },
      { date: '2026-10-28', slot: 'main', plan: structuredClone(plan[2]), customized: false },
      // Drafts predating customized retain intentional edits by default.
      { date: '2026-11-02', slot: 'main', plan: { ...structuredClone(plan[0]), name: 'Older personal draft' } },
    ],
  });
}

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('upgrade is explicit, retains the running cycle and saves the exact personal prescription', () => {
  const before = personalProgram();
  const untouched = structuredClone(before);
  const next = upgradeMasterProgram(before, 1000);
  assert.deepEqual(before, untouched, 'reviewing or constructing an upgrade cannot mutate the current profile');
  assert.equal(next.masterProgram!.revision, '8.1');
  assert.equal(next.masterProgram!.startDate, before.masterProgram!.startDate);
  assert.deepEqual(next.masterProgram!.matchWeeks, before.masterProgram!.matchWeeks);
  assert.deepEqual(next.masterProgram!.readiness, before.masterProgram!.readiness);
  assert.equal(getMasterProgramWeek(next.masterProgram!.startDate, '2026-10-28'), 4);
  assert.deepEqual(next.plan, createVolleyballMasterPlan());
  assert.deepEqual(next.masterMatchWeekend, createVolleyballMasterPlan(true).slice(5));
  assert.deepEqual(next.masterProgramBackup, {
    savedAt: 1000, plan: before.plan, masterProgram: before.masterProgram,
    masterMatchWeekend: before.masterMatchWeekend, preMasterPlan: before.preMasterPlan,
    sessionDrafts: before.sessionDrafts,
  });
  assert.deepEqual(next.preMasterPlan, before.preMasterPlan);
  assert.deepEqual(next.sessionDrafts, before.sessionDrafts!.filter(draft => draft.customized !== false));
  for (const field of ['customWorkouts', 'appearance', 'bodyWeight', 'nutrition', 'volleyballSchedule', 'timerSoundEnabled', 'timerSoundVolume'] as const) {
    assert.deepEqual(next[field], before[field]);
  }
  assert.deepEqual(upgradeMasterProgram(next, 2000), next, 'repeated upgrade cannot erase the original backup');
  assert.throws(() => upgradeMasterProgram(ProfileSchema.parse(DEFAULT_PROFILE)), /Activate/);
});

test('restoring the previous program keeps newer user edits and unrelated preferences', () => {
  const before = personalProgram();
  const updated = upgradeMasterProgram(before, 1000);
  updated.bodyWeight = 65;
  updated.timerSoundVolume = 0.7;
  updated.sessionDrafts!.push({ date: '2026-11-04', slot: 'main', customized: true,
    plan: { ...structuredClone(updated.plan[2]), name: 'New equipment substitution' } });
  updated.sessionDrafts![0].plan.name = 'Latest Sunday edit';
  const restored = restorePreviousMasterProgram(updated);
  assert.deepEqual(restored.plan, before.plan);
  assert.deepEqual(restored.masterProgram, before.masterProgram);
  assert.deepEqual(restored.masterMatchWeekend, before.masterMatchWeekend);
  assert.deepEqual(restored.preMasterPlan, before.preMasterPlan);
  assert.equal(restored.masterProgramBackup, undefined);
  assert.equal(restored.sessionDrafts!.find(draft => draft.date === '2026-11-01')!.plan.name, 'Latest Sunday edit');
  assert.equal(restored.sessionDrafts!.find(draft => draft.date === '2026-11-04')!.plan.name, 'New equipment substitution');
  assert.equal(restored.bodyWeight, 65);
  assert.equal(restored.timerSoundVolume, 0.7);
  assert.deepEqual(restored.customWorkouts, before.customWorkouts);
  assert.throws(() => restorePreviousMasterProgram(before), /no previous program/);
});

test('optional prescriptions stay out of default sessions and explicit additions retain metadata', () => {
  const base = structuredClone(DEFAULT_PROFILE.plan[0]);
  const optional = { ...structuredClone(base.exercises[0]), key: 'optional-jump', optionalWork: true,
    benefit: 'Controlled single-leg takeoff', jumpContactsPerRep: 2 };
  const plan = { ...base, programRevision: '8.1' as const, durationRange: '75–90 min', exercises: [...base.exercises, optional] };
  const session = SessionSchema.parse(createSession(plan, 0, '2026-10-28', DEFAULT_PROFILE, []));
  assert.equal(session.exercises.length, base.exercises.length);
  assert.equal(session.exercises.some(exercise => exercise.key === optional.key), false);
  assert.equal(session.programRevision, '8.1');
  assert.equal(session.durationRange, '75–90 min');
  const enabled = SessionSchema.parse(createSession({ ...plan, exercises: [{ ...optional, optionalWork: false }] }, 0, '2026-10-28', DEFAULT_PROFILE, []));
  assert.equal(enabled.exercises.length, 1);
  assert.equal(enabled.exercises[0].logs.length, optional.sets);
  assert.equal(enabled.exercises[0].benefit, optional.benefit);
  assert.equal(enabled.exercises[0].jumpContactsPerRep, 2);
});

test('legacy stores load without inventing an upgrade or changing active and historical snapshots', async () => {
  const profile = personalProgram();
  const active = SessionSchema.parse(createSession(profile.plan[2], 2, '2026-10-28', profile, []));
  const completed = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed'));
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 7,
    sessions: [{ session: active, version: 2 }, { session: completed, version: 4 }],
    nutrition: [{ id: 'weight', date: '2026-10-27', version: 3, payload: { kind: 'weight', kg: 64.3 } }],
    activities: [{ version: 1, activity: {
      id: 'imported-cycle', date: '2026-10-27', type: 'cycle', name: 'Cycling', durationMinutes: 25,
      distanceKm: 6, intensity: 'easy', bodyWeightKg: 64, watchCalories: null, notes: '',
      createdAt: 1000, deletedAt: null, importSource: { provider: 'strava', format: 'csv', fingerprint: 'same-import' },
    } }],
    reminders: defaultReminderState(),
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-10-27', type: 'standing', measurement: 'height', cm: 75, notes: '' }], readiness: [] },
    performanceVersion: 2,
  }));
  const client = createLocalClient(storage);
  const originalRaw = storage.getItem(STORAGE_KEY);
  await client.request('/api/tracker');
  assert.equal(storage.getItem(STORAGE_KEY), originalRaw, 'opening an old program is read-only');
  const original = JSON.parse(originalRaw!);
  const upgraded = upgradeMasterProgram(profile, 2000);
  await client.request('/api/tracker', { action: 'profile', profile: upgraded, expectedVersion: 7 });
  const changed = JSON.parse(storage.getItem(STORAGE_KEY)!);
  for (const field of ['sessions', 'nutrition', 'activities', 'reminders', 'performance', 'performanceVersion']) {
    assert.deepEqual(changed[field], original[field], `${field} must remain unchanged`);
  }
  const fresh = createLocalClient(new MemoryStorage());
  fresh.importBackup(client.exportBackup());
  assert.deepEqual((await fresh.request('/api/tracker')).profile, upgraded);
  assert.deepEqual((await fresh.request('/api/tracker')).sessions, original.sessions);
  await fresh.request('/api/tracker', { action: 'profile', profile: restorePreviousMasterProgram(upgraded), expectedVersion: 8 });
  assert.deepEqual((await fresh.request('/api/tracker')).sessions, original.sessions);
  assert.deepEqual(ProfileSchema.parse((await fresh.request('/api/tracker')).profile).plan, profile.plan);
  const legacyImport = createLocalClient(new MemoryStorage());
  legacyImport.importBackup(JSON.stringify({ app: 'Setline', version: 1, exportedAt: new Date().toISOString(), data: original }));
  assert.equal(ProfileSchema.parse((await legacyImport.request('/api/tracker')).profile).masterProgram?.revision, undefined);
});

test('malformed program backups reject atomically instead of discarding personal data', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const profile = upgradeMasterProgram(personalProgram(), 2000);
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 });
  const raw = storage.getItem(STORAGE_KEY);
  const backup = JSON.parse(client.exportBackup());
  backup.data.profile.masterProgramBackup.plan.pop();
  assert.throws(() => client.importBackup(JSON.stringify(backup)), /training plan/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  const invalid = structuredClone(profile);
  invalid.masterProgramBackup!.masterProgram!.matchWeeks = [9];
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: invalid, expectedVersion: 1 }), /valid training plan/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('a known match start time is optional, validated and preserved in session and backup snapshots', async () => {
  const plan = { ...structuredClone(DEFAULT_PROFILE.plan[1]), startTime: '15:30' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    customWorkouts: [{ ...plan, id: crypto.randomUUID() }] });
  const session = SessionSchema.parse(createSession(plan, 6, '2026-11-01', profile, []));
  assert.equal(session.startTime, '15:30');
  assert.equal(SessionSchema.safeParse({ ...session, startTime: '25:00' }).success, false);
  assert.equal(ProfileSchema.safeParse({ ...profile, customWorkouts: [{ ...profile.customWorkouts![0], startTime: '12:75' }] }).success, false);
  const withoutTime = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[1], 6, '2026-11-01', profile, []));
  assert.equal(Object.hasOwn(withoutTime, 'startTime'), false, 'an unknown match time is never invented');
  const client = createLocalClient(new MemoryStorage());
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'session', session, expectedVersion: 0 });
  const restored = createLocalClient(new MemoryStorage());
  restored.importBackup(client.exportBackup());
  const tracker = await restored.request('/api/tracker');
  assert.equal(ProfileSchema.parse(tracker.profile).customWorkouts![0].startTime, '15:30');
  assert.equal(SessionSchema.parse((tracker.sessions as { session: unknown }[])[0].session).startTime, '15:30');
});

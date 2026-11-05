import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createNewProfile } from '../src/onboarding.ts';
import { defaultReminderState } from '../src/reminders.ts';
import { recoverSetupProfile } from '../src/setup-recovery.ts';
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

const guidance = { impact: 'restricted' as const, heavyLifting: 'unknown' as const, note: 'Current user-reported guidance' };
function profile() {
  const current = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), bodyWeight: 68.5, restSeconds: 105,
    appearance: 'dark', timerSoundEnabled: false, timerSoundVolume: 0.3,
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [1], clearance: guidance },
    trainingPreferences: { goal: 'performance', experience: 'advanced', daysPerWeek: 4, location: 'gym', equipment: ['machines', 'dumbbells'], sport: 'Volleyball' },
  });
  current.plan[0].name = 'My current upper session';
  current.customWorkouts = [{ ...structuredClone(current.plan[0]), id: crypto.randomUUID(), name: 'My saved template' }];
  current.sessionDrafts = [{ date: '2026-11-06', slot: 'main', customized: true, plan: { ...structuredClone(current.plan[0]), name: 'My Friday edit' } }];
  current.masterProgramBackup = { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan) };
  return current;
}

function state(active = false) {
  const current = profile();
  const historical = SessionSchema.parse(stopSessionTimers(createSession(current.plan[0], 0, '2026-10-26', current, []), 'completed'));
  historical.exercises[0].logs[0] = { ...historical.exercises[0].logs[0], kg: 8.5, reps: 4, rir: 2, done: true,
    inputSources: { kg: 'manual', reps: 'manual' } };
  const sessions = [{ session: historical, version: 3 }];
  if (active) {
    const ongoing = SessionSchema.parse(createSession(current.plan[0], 0, '2026-11-02', current, []));
    ongoing.runningSince = null;
    ongoing.exercises[0].logs[0] = { ...ongoing.exercises[0].logs[0], kg: 7.5, reps: 4, rir: 3 };
    sessions.push({ session: ongoing, version: 2 });
  }
  return { schemaVersion: 1 as const, profile: current, profileVersion: 4, sessions,
    nutrition: [{ id: 'current-weight', date: '2026-11-01', version: 2, payload: { kind: 'weight', kg: 68.2 } }],
    activities: [{ version: 1, activity: { id: 'current-walk', date: '2026-11-01', type: 'walk', name: 'My walk',
      durationMinutes: 20, distanceKm: 1, intensity: 'easy', bodyWeightKg: 68.5, watchCalories: null,
      notes: '', createdAt: 1793520000000, deletedAt: null } }],
    reminders: defaultReminderState(), performanceVersion: 2,
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-10-30', type: 'approach', measurement: 'height', cm: 78, notes: 'Current test' }], readiness: [] } };
}
function fixture(active = false) {
  const storage = new MemoryStorage();
  const current = state(active);
  storage.setItem(STORAGE_KEY, JSON.stringify(current, null, 2));
  storage.writes = [];
  return { storage, current, client: createLocalClient(storage) };
}
function backup() {
  const source = state();
  source.profile.bodyWeight = 72;
  source.profile.restSeconds = 135;
  source.profile.appearance = 'light';
  source.profile.plan[0].name = 'Recovered upper session';
  source.profile.plan[0].exercises[0].sets = 2;
  source.profile.masterProgram!.matchWeeks = [2];
  source.profile.masterProgram!.clearance = { impact: 'cleared', heavyLifting: 'cleared', note: 'Backup guidance must not apply' };
  return JSON.stringify({ app: 'Setline', version: 1, exportedAt: '2026-11-02T10:00:00Z', data: source });
}
const saved = (storage: MemoryStorage) => JSON.parse(storage.getItem(STORAGE_KEY)!);
const keptRecords = (value: ReturnType<typeof state>) => ({ sessions: value.sessions, nutrition: value.nutrition,
  activities: value.activities, performance: value.performance, performanceVersion: value.performanceVersion, reminders: value.reminders });

test('legacy hydration is read-only and a disappeared store cannot be recreated from defaults', async () => {
  const { storage, client } = fixture();
  const raw = storage.getItem(STORAGE_KEY);
  await client.request('/api/tracker');
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.writes.length, 0);
  storage.removeItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 }), /disappeared/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(storage.writes.length, 0);
});

test('an unreadable existing blob also blocks later default initialization after its disappearance', async () => {
  const storage = new MemoryStorage(); storage.setItem(STORAGE_KEY, '{invalid existing data');
  const client = createLocalClient(storage);
  await assert.rejects(client.request('/api/tracker'), /could not be read/);
  storage.removeItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 }), /disappeared/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('only a genuinely absent installation may initialize; a stale empty tab cannot overwrite another tab’s version-zero profile', async () => {
  const storage = new MemoryStorage();
  const stale = createLocalClient(storage, createNewProfile());
  const initial = await stale.request('/api/tracker');
  assert.equal((initial.profile as ReturnType<typeof createNewProfile>).bodyWeight, null);
  assert.equal(storage.getItem(STORAGE_KEY), null);
  const creator = createLocalClient(storage, profile());
  const workout = createSession(profile().plan[0], 0, '2026-11-02', profile(), []);
  await creator.request('/api/tracker', { action: 'session', session: workout, expectedVersion: 0 });
  const raw = storage.getItem(STORAGE_KEY);
  await assert.rejects(stale.request('/api/tracker', { action: 'profile', profile: initial.profile, expectedVersion: 0 }), /created in another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  await stale.request('/api/tracker');
  await assert.rejects(stale.request('/api/tracker', { action: 'profile', profile: initial.profile, expectedVersion: 0 }), /created in another tab/);
  const fresh = createLocalClient(storage);
  await fresh.request('/api/tracker', { action: 'profile', profile: { ...profile(), appearance: 'light' }, expectedVersion: 0 });
  assert.equal(saved(storage).profile.bodyWeight, 68.5);
});

test('a fresh client can save its own neutral setup and continue editing it', async () => {
  const storage = new MemoryStorage(); const neutral = createNewProfile();
  const client = createLocalClient(storage, neutral);
  await client.request('/api/tracker');
  await client.request('/api/tracker', { action: 'profile', profile: neutral, expectedVersion: 0 });
  await client.request('/api/tracker', { action: 'profile', profile: { ...neutral, restSeconds: 120 }, expectedVersion: 1 });
  assert.equal(saved(storage).profile.restSeconds, 120);
  assert.equal(saved(storage).profile.bodyWeight, null);
});

test('starting a new session cannot reopen or overwrite a finished workout, while editing its completed values remains supported', async () => {
  const { client, storage, current } = fixture();
  const record = current.sessions[0];
  const active = { ...record.session, status: 'active', finishedAt: null, runningSince: null };
  const raw = storage.getItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker', { action: 'session', session: active, expectedVersion: record.version }), /cannot be reopened/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  const corrected = structuredClone(record.session); corrected.exercises[0].logs[0].kg = 9;
  await client.request('/api/tracker', { action: 'session', session: corrected, expectedVersion: record.version });
  assert.equal(saved(storage).sessions[0].session.status, 'completed');
  assert.equal(saved(storage).sessions[0].session.exercises[0].logs[0].kg, 9);
});

test('settings recovery is review-only until confirmation, preserves every current record, and creates an exact fallback first', async () => {
  const { storage, client, current } = fixture(true);
  const raw = storage.getItem(STORAGE_KEY);
  const preview = client.previewSetupRecovery(backup(), 'settings');
  assert.ok(preview.changes.some(change => change.field === 'bodyWeight' && change.before === '68.5 kg' && change.after === '72 kg'));
  assert.equal(preview.preserved.activeWorkouts, 1);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
  assert.equal(storage.writes.length, 0);
  client.applySetupRecovery(preview.token);
  const after = saved(storage);
  assert.equal(after.profile.bodyWeight, 72); assert.equal(after.profile.restSeconds, 135);
  assert.equal(after.profile.appearance, 'light');
  assert.deepEqual(after.profile.plan, current.profile.plan);
  assert.deepEqual(after.profile.masterProgram, current.profile.masterProgram);
  assert.deepEqual(after.profile.customWorkouts, current.profile.customWorkouts);
  assert.deepEqual(keptRecords(after), keptRecords(current));
  assert.equal(after.profileVersion, current.profileVersion + 1);
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
  assert.deepEqual(storage.writes, [PRE_RESTORE_KEY, STORAGE_KEY]);
  assert.deepEqual((await createLocalClient(storage).request('/api/tracker')).profile, after.profile);
});

test('training recovery keeps personal preferences, date edits, templates, archives and current guidance even when the backup claims clearance', () => {
  const { storage, client, current } = fixture();
  const preview = client.previewSetupRecovery(backup(), 'training');
  client.applySetupRecovery(preview.token);
  const after = saved(storage);
  assert.equal(after.profile.plan[0].name, 'Recovered upper session');
  assert.deepEqual(after.profile.masterProgram.matchWeeks, [2]);
  assert.deepEqual(after.profile.trainingGuidance, guidance);
  assert.deepEqual(after.profile.masterProgram.clearance, guidance);
  const { plan: _oldPlan, masterProgram: _oldProgram, ...oldPreferences } = current.profile;
  const { plan: _newPlan, masterProgram: _newProgram, trainingGuidance: _copiedGuidance, ...newPreferences } = after.profile;
  assert.deepEqual(newPreferences, oldPreferences);
  assert.deepEqual(keptRecords(after), keptRecords(current));
});

test('plain weekly recovery retains current explicit guidance independently from the removed master program', () => {
  const current = profile();
  const source = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), bodyWeight: 80 });
  const recovered = recoverSetupProfile(current, source, 'training');
  assert.equal(recovered.masterProgram, undefined);
  assert.deepEqual(recovered.trainingGuidance, guidance);
  assert.equal(recovered.bodyWeight, current.bodyWeight);
  const explicit = { impact: 'unknown' as const, heavyLifting: 'restricted' as const };
  assert.deepEqual(recoverSetupProfile({ ...current, trainingGuidance: explicit }, source, 'training').trainingGuidance, explicit);
});

test('missing optional settings in an older backup keep current values rather than installing defaults', () => {
  const current = profile();
  const older = structuredClone(DEFAULT_PROFILE);
  delete (older as { timerSoundVolume?: number }).timerSoundVolume;
  delete (older as { appearance?: string }).appearance;
  const recovered = recoverSetupProfile(current, older, 'settings');
  assert.equal(recovered.timerSoundVolume, 0.3);
  assert.equal(recovered.appearance, 'dark');
  assert.deepEqual(recovered.masterProgram, current.masterProgram);
});

test('active sessions block training recovery at review and if one starts after review', async () => {
  const active = fixture(true);
  const raw = active.storage.getItem(STORAGE_KEY);
  assert.throws(() => active.client.previewSetupRecovery(backup(), 'training'), /Finish your active workout/);
  assert.equal(active.storage.getItem(STORAGE_KEY), raw);
  const { client, storage } = fixture();
  const preview = client.previewSetupRecovery(backup(), 'training');
  await client.request('/api/tracker', { action: 'session', session: createSession(profile().plan[0], 0, '2026-11-02', profile(), []), expectedVersion: 0 });
  const newer = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.applySetupRecovery(preview.token), /Finish your active workout/);
  assert.equal(storage.getItem(STORAGE_KEY), newer);
});

test('a newer profile save invalidates a preview, including when only its version changes', async () => {
  const { client, storage, current } = fixture();
  const preview = client.previewSetupRecovery(backup(), 'settings');
  await client.request('/api/tracker', { action: 'profile', profile: current.profile, expectedVersion: current.profileVersion });
  const raw = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.applySetupRecovery(preview.token), /setup changed/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
});

test('a changed profile without an incremented version also invalidates its recovery lease', () => {
  const { client, storage } = fixture();
  const preview = client.previewSetupRecovery(backup(), 'settings');
  const latest = saved(storage); latest.profile.appearance = 'system'; storage.setItem(STORAGE_KEY, JSON.stringify(latest));
  const raw = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.applySetupRecovery(preview.token), /setup changed/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('records saved after review are read again and retained by confirmation', async () => {
  const { client, storage } = fixture();
  const preview = client.previewSetupRecovery(backup(), 'settings');
  await client.request('/api/nutrition', { id: 'new-weight', date: '2026-11-02', payload: { kind: 'weight', kg: 68.7 }, expectedVersion: 0 });
  const recent = storage.getItem(STORAGE_KEY);
  const nutrition = saved(storage).nutrition;
  client.applySetupRecovery(preview.token);
  assert.deepEqual(saved(storage).nutrition, nutrition);
  assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, recent);
});

test('another restore invalidates a pending review and stale tabs cannot write after recovery', async () => {
  const { client, storage, current } = fixture();
  await client.request('/api/tracker');
  const stale = createLocalClient(storage); await stale.request('/api/tracker');
  const reviewed = client.previewSetupRecovery(backup(), 'settings');
  client.applySetupRecovery(reviewed.token);
  const raw = storage.getItem(STORAGE_KEY);
  await assert.rejects(stale.request('/api/tracker', { action: 'profile', profile: current.profile, expectedVersion: current.profileVersion }), /restored in another tab/);
  await stale.request('/api/tracker');
  await assert.rejects(stale.request('/api/tracker', { action: 'profile', profile: current.profile, expectedVersion: current.profileVersion }), /restored in another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  const nextPreview = client.previewSetupRecovery(backup(), 'training');
  createLocalClient(storage).importBackup(client.exportBackup());
  const restored = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.applySetupRecovery(nextPreview.token), /restored in another tab/);
  assert.equal(storage.getItem(STORAGE_KEY), restored);
});

test('invalid backup fields and invalid untouched current records never write a partial recovery', () => {
  const { client, storage } = fixture();
  const raw = storage.getItem(STORAGE_KEY);
  const malformed = JSON.parse(backup()); malformed.data.sessions[0].session.date = 'invalid';
  for (const text of ['{', JSON.stringify({ app: 'Other', version: 1 }), JSON.stringify(malformed)]) {
    assert.throws(() => client.previewSetupRecovery(text, 'settings'));
    assert.equal(storage.getItem(STORAGE_KEY), raw); assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
  }
  const broken = saved(storage); broken.sessions[0].session.exercises[0].logs[0].kg = -1;
  storage.setItem(STORAGE_KEY, JSON.stringify(broken));
  const invalidRaw = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.previewSetupRecovery(backup(), 'settings'), /saved workout/);
  assert.throws(() => client.previewSetupRecovery(backup(), 'training'), /saved workout/);
  assert.equal(storage.getItem(STORAGE_KEY), invalidRaw);
});

test('selected invalid settings or a broken weekly plan can be repaired without touching valid history', () => {
  for (const scope of ['settings', 'training'] as const) {
    const { storage, client, current } = fixture();
    const broken = structuredClone(current);
    if (scope === 'settings') broken.profile.bodyWeight = -1;
    else broken.profile.plan = [];
    const raw = JSON.stringify(broken); storage.setItem(STORAGE_KEY, raw);
    const preview = client.previewSetupRecovery(backup(), scope);
    client.applySetupRecovery(preview.token);
    assert.deepEqual(keptRecords(saved(storage)), keptRecords(current));
    assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
    assert.equal(client.previousRestoreCopy()!.recovery, true);
  }
});

test('an invalid unselected part cannot be repaired accidentally from backup defaults', () => {
  const { client, storage } = fixture();
  const broken = saved(storage); broken.profile.plan = []; storage.setItem(STORAGE_KEY, JSON.stringify(broken));
  const raw = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.previewSetupRecovery(backup(), 'settings'), /untouched part/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('failed safety or main writes preserve exact current bytes and the previous fallback; retries remain possible', () => {
  for (const failKey of [PRE_RESTORE_KEY, STORAGE_KEY]) {
    const { client, storage } = fixture();
    storage.setItem(PRE_RESTORE_KEY, 'older fallback bytes');
    const raw = storage.getItem(STORAGE_KEY);
    const preview = client.previewSetupRecovery(backup(), 'settings');
    storage.failKey = failKey;
    assert.throws(() => client.applySetupRecovery(preview.token), /could not be saved/);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(storage.getItem(PRE_RESTORE_KEY), 'older fallback bytes');
    storage.failKey = null;
    client.applySetupRecovery(preview.token);
    assert.equal(saved(storage).profile.bodyWeight, 72);
    assert.equal(JSON.parse(storage.getItem(PRE_RESTORE_KEY)!).raw, raw);
  }
});

test('review tokens are single-use and a new review invalidates the earlier token', () => {
  const { client, storage } = fixture();
  const first = client.previewSetupRecovery(backup(), 'settings');
  const second = client.previewSetupRecovery(backup(), 'settings');
  assert.throws(() => client.applySetupRecovery(first.token), /Review the backup again/);
  client.applySetupRecovery(second.token);
  const raw = storage.getItem(STORAGE_KEY);
  assert.throws(() => client.applySetupRecovery(second.token), /Review the backup again/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('matching recovery is a true no-op with no version increment or safety-slot write', () => {
  const { client, storage } = fixture();
  const text = client.exportBackup();
  const raw = storage.getItem(STORAGE_KEY); storage.writes = [];
  const preview = client.previewSetupRecovery(text, 'settings');
  assert.deepEqual(preview.changes, []);
  client.applySetupRecovery(preview.token);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.deepEqual(storage.writes, []);
});

test('cancelled reviews release their token and cannot be applied by a stale callback', () => {
  const { client, storage } = fixture();
  const raw = storage.getItem(STORAGE_KEY);
  const review = client.previewSetupRecovery(backup(), 'settings');
  client.cancelSetupRecovery(review.token);
  assert.throws(() => client.applySetupRecovery(review.token), /Review the backup again/);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(storage.getItem(PRE_RESTORE_KEY), null);
});

test('targeted recovery preserves optional absences and compatible raw record metadata rather than rewriting unrelated history', () => {
  const { client, storage } = fixture();
  const current = saved(storage);
  delete current.reminders; delete current.activities;
  current.sessions[0].session.compatibleLegacyNote = 'Keep historical source metadata';
  storage.setItem(STORAGE_KEY, JSON.stringify(current));
  const preview = client.previewSetupRecovery(backup(), 'settings');
  client.applySetupRecovery(preview.token);
  const after = saved(storage);
  assert.equal(Object.hasOwn(after, 'reminders'), false); assert.equal(Object.hasOwn(after, 'activities'), false);
  assert.deepEqual(after.sessions, current.sessions);
});

test('a successful review also establishes an existing installation for later disappearance protection', async () => {
  const { client, storage } = fixture();
  client.previewSetupRecovery(backup(), 'settings');
  storage.removeItem(STORAGE_KEY);
  await assert.rejects(client.request('/api/tracker', { action: 'profile', profile: DEFAULT_PROFILE, expectedVersion: 0 }), /disappeared/);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('legacy backups remain importable and device-local recovery markers stay out of portable exports', () => {
  const { client, storage } = fixture();
  const legacy = JSON.parse(backup()); delete legacy.data.reminders; delete legacy.data.activities;
  delete legacy.data.performance; delete legacy.data.performanceVersion;
  client.importBackup(JSON.stringify(legacy));
  const exported = JSON.parse(client.exportBackup());
  assert.equal(exported.version, 1); assert.equal(exported.data.schemaVersion, 1);
  assert.equal(exported.data.restoreGeneration, undefined);
  assert.equal(exported.data.profile.bodyWeight, 72);
  assert.ok(storage.getItem(PRE_RESTORE_KEY));
});

for (const scope of ['settings', 'training'] as const) {
  for (const mutation of ['new-records', 'profile', 'restore-generation'] as const) {
    test(`${scope} recovery rejects ${mutation} written between validation and transaction without touching the newer data or prior safety copy`, () => {
      const { storage, current } = fixture();
      const previousSafetyCopy = JSON.stringify({ savedAt: '2026-10-01T10:00:00Z', raw: 'Previous fallback bytes' });
      storage.values.set(PRE_RESTORE_KEY, previousSafetyCopy);
      const newer: ReturnType<typeof state> & { restoreGeneration?: string } = structuredClone(current);
      if (mutation === 'new-records') {
        newer.sessions.push({ session: { ...structuredClone(current.sessions[0].session), id: crypto.randomUUID(), name: 'Newly recorded session' }, version: 1 });
        newer.nutrition.push({ id: 'newer-weight', date: '2026-11-02', version: 1, payload: { kind: 'weight', kg: 69 } });
      } else if (mutation === 'profile') {
        newer.profile.bodyWeight = 69;
        newer.profileVersion += 1;
      } else newer.restoreGeneration = crypto.randomUUID();
      const newerRaw = JSON.stringify(newer, null, 3);
      let armed = false, reads = 0;
      const client = createLocalClient({
        getItem(key: string) {
          // First read validates the exact current state. Simulate another tab
          // writing just before the safety transaction's independent main read.
          if (armed && key === STORAGE_KEY && ++reads === 2) storage.values.set(STORAGE_KEY, newerRaw);
          return storage.getItem(key);
        },
        setItem: (key, value) => storage.setItem(key, value),
        removeItem: key => storage.removeItem(key),
      });
      const review = client.previewSetupRecovery(backup(), scope);
      storage.writes = [];
      armed = true;
      assert.throws(() => client.applySetupRecovery(review.token), /changed before this operation/);
      assert.equal(reads, 2);
      assert.equal(storage.getItem(STORAGE_KEY), newerRaw);
      assert.equal(storage.getItem(PRE_RESTORE_KEY), previousSafetyCopy);
      assert.deepEqual(storage.writes, []);
    });
  }
}

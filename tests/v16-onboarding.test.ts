import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, getCalories } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import { createNewProfile, createStarterPlan, DEFAULT_TRAINING_PREFERENCES, presentationMode, TrainingPreferencesSchema } from '../src/onboarding.ts';
import { resetRecommendedPlan } from '../src/workout-customization.ts';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('a genuinely fresh profile contains no inherited athlete measurements, plan, schedule or goals', () => {
  const profile = ProfileSchema.parse(createNewProfile());
  assert.equal(profile.bodyWeight, null);
  assert.equal(profile.nutrition, undefined);
  assert.equal(profile.volleyballSchedule, undefined);
  assert.equal(profile.masterProgram, undefined);
  assert.equal(profile.presentationMode, 'simple');
  assert.deepEqual(profile.onboarding, { version: 16, status: 'pending', installation: 'new' });
  assert.equal(profile.plan.length, 7);
  assert.ok(profile.plan.every(day => day.exercises.length === 0));
  const next = createNewProfile(); next.plan[0].name = 'Changed';
  assert.equal(createNewProfile().plan[0].name, 'Choose your workout');
  assert.equal(DEFAULT_PROFILE.bodyWeight, 64);
  // Legacy V16 drafts/backups predate the optional installation marker.
  assert.deepEqual(ProfileSchema.parse({ ...profile, onboarding: { version: 16, status: 'completed' } }).onboarding, { version: 16, status: 'completed' });
  assert.equal(ProfileSchema.safeParse({ ...profile, onboarding: { version: 16, status: 'completed', installation: 'unknown' } }).success, false);
});

test('beginner three-day starting plan is modest and uses only the selected setup', () => {
  const plan = createStarterPlan({ ...DEFAULT_TRAINING_PREFERENCES, location: 'home', equipment: ['bodyweight'] });
  ProfileSchema.parse({ ...createNewProfile(), plan });
  const strength = plan.filter(day => day.kind === 'strength');
  assert.equal(strength.length, 3);
  assert.ok(strength.every(day => day.exercises.every(exercise => exercise.sets === 2 && exercise.target === '8–12 reps')));
  assert.ok(strength.every(day => day.exercises.every(exercise => exercise.mode === 'bodyweight' && exercise.defaultKg === undefined)));
  assert.ok(plan.every(day => !day.programRevision && !day.exercises.some(exercise => exercise.jumpContactsPerRep || exercise.measurement)));
  assert.ok(!plan.some(day => day.exercises.some(exercise => /volleyball|machine|barbell|dumbbell|jump|pogo/i.test(exercise.name))));
});

test('all experience levels, goals, equipment choices and frequencies produce valid independent starter plans', () => {
  for (const experience of ['beginner', 'intermediate', 'advanced'] as const) {
    for (const goal of ['fitness', 'muscle', 'strength', 'performance', 'own'] as const) {
      for (const equipment of [['bodyweight'], ['machines'], ['dumbbells'], ['bands'], ['barbell']] as const) {
        for (let daysPerWeek = 1; daysPerWeek <= 6; daysPerWeek++) {
          const preferences = { ...DEFAULT_TRAINING_PREFERENCES, goal, experience, daysPerWeek, equipment: [...equipment] };
          const plan = createStarterPlan(preferences);
          ProfileSchema.parse({ ...createNewProfile(), plan, trainingPreferences: preferences });
          const strength = plan.filter(day => day.kind === 'strength' && day.exercises.length);
          assert.equal(strength.length, goal === 'own' ? 0 : experience === 'beginner' ? Math.min(3, daysPerWeek) : daysPerWeek);
          assert.equal(new Set(plan.flatMap(day => day.exercises.map(exercise => exercise.key))).size, plan.flatMap(day => day.exercises).length);
          assert.ok(!plan.some(day => day.programRevision || day.exercises.some(exercise => exercise.defaultKg != null)));
          if (goal === 'own') assert.ok(plan.every(day => !day.exercises.length));
        }
      }
    }
  }
});

test('onboarding validates preferences instead of accepting missing equipment or arbitrary personalized values', () => {
  for (const patch of [{ equipment: [] }, { equipment: ['machines', 'machines'] }, { daysPerWeek: 7 }, { experience: 'pro' }, { sport: 'x'.repeat(41) }]) {
    assert.equal(TrainingPreferencesSchema.safeParse({ ...DEFAULT_TRAINING_PREFERENCES, ...patch }).success, false);
  }
  assert.equal(TrainingPreferencesSchema.parse({ ...DEFAULT_TRAINING_PREFERENCES, sport: '  Volleyball  ' }).sport, 'Volleyball');
});

test('existing profile data and active workouts ignore the neutral default and are never rewritten on read', async () => {
  const storage = new MemoryStorage();
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.bodyWeight = 71;
  const session = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-11-02', profile, []));
  const raw = JSON.stringify({ schemaVersion: 1, profile, profileVersion: 8, sessions: [{ session, version: 4 }], nutrition: [], activities: [] });
  storage.setItem(STORAGE_KEY, raw);
  const result = await createLocalClient(storage).request('/api/tracker', undefined, createNewProfile());
  assert.deepEqual(result.profile, profile);
  assert.deepEqual(result.sessions, [{ session, version: 4 }]);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  assert.equal(presentationMode(profile), 'athlete');
});

test('neutral startup only applies to absent storage; corrupt or unavailable storage cannot reset it', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  assert.deepEqual((await client.request('/api/tracker', undefined, createNewProfile())).profile, createNewProfile());
  assert.equal(storage.getItem(STORAGE_KEY), null);
  storage.setItem(STORAGE_KEY, '{broken');
  await assert.rejects(client.request('/api/tracker', undefined, createNewProfile()), /Saved data could not be read/);
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
  const unavailable = createLocalClient({ getItem() { throw new Error('Denied'); }, setItem() { throw new Error('No write'); }, removeItem() {} });
  await assert.rejects(unavailable.request('/api/tracker', undefined, createNewProfile()), /storage is unavailable/);
});

test('new profile and onboarding status survive backup round-trip without adding inferred body weight', async () => {
  const storage = new MemoryStorage(); const client = createLocalClient(storage);
  const profile = { ...createNewProfile(), plan: createStarterPlan(DEFAULT_TRAINING_PREFERENCES),
    trainingPreferences: structuredClone(DEFAULT_TRAINING_PREFERENCES), onboarding: { version: 16 as const, status: 'skipped' as const } };
  await client.request('/api/tracker', { action: 'profile', profile, expectedVersion: 0 }, createNewProfile());
  const target = createLocalClient(new MemoryStorage()); target.importBackup(client.exportBackup());
  assert.deepEqual((await target.request('/api/tracker')).profile, profile);
  const session = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-11-02', profile, []));
  assert.equal(session.bodyWeight, null);
  assert.equal(getCalories(session), null);
});

test('mode changes preserve plans and active session data; recommendation reset uses the selected preferences', async () => {
  const storage = new MemoryStorage(); const client = createLocalClient(storage);
  const profile = { ...DEFAULT_PROFILE, trainingPreferences: { ...DEFAULT_TRAINING_PREFERENCES, location: 'home' as const, equipment: ['bodyweight' as const] } };
  const active = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-11-02', profile, []));
  storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 2, sessions: [{ session: active, version: 1 }], nutrition: [], activities: [] }));
  await client.request('/api/tracker', { action: 'profile', profile: { ...profile, presentationMode: 'simple' }, expectedVersion: 2 });
  const result = await client.request('/api/tracker');
  assert.deepEqual(result.profile, { ...profile, presentationMode: 'simple' });
  assert.deepEqual(result.sessions, [{ session: active, version: 1 }]);
  const reset = resetRecommendedPlan(profile);
  assert.deepEqual(reset.plan, createStarterPlan(profile.trainingPreferences));
  assert.deepEqual(reset.trainingPreferences, profile.trainingPreferences);
  assert.equal(reset.bodyWeight, profile.bodyWeight);
  assert.deepEqual(profile.plan, DEFAULT_PROFILE.plan);
});


test('an unknown fresh body weight never becomes a zero calorie estimate or a made-up measurement', () => {
  const profile = ProfileSchema.parse(createNewProfile());
  const session = SessionSchema.parse(createSession(createStarterPlan(DEFAULT_TRAINING_PREFERENCES)[0], 0, '2026-11-02', profile, []));
  assert.equal(session.bodyWeight, null);
  assert.equal(getCalories(session), null);
  assert.equal(getCalories({ ...session, watchCalories: 123 }), 123);
  assert.equal(session.bodyWeight, null);
});

import { createNewProfile } from './onboarding.ts';
import { DEFAULT_PROFILE, NutritionPayloadSchema, ProfileSchema, SessionSchema } from './domain.js';
import { PerformanceDataSchema, emptyPerformance, type PerformanceData } from './performance-data.ts';
import { ExtraActivitySchema, type ActivityRecord } from './activities.ts';
import { defaultReminderState, isTrackable, ReminderSchema, ReminderEntrySchema, type ReminderState, type ReminderRecord, type ReminderEntryRecord } from './reminders.ts';
import { recoverSetupProfile, recoveredPlanDetails, setupRecoveryChanges, type SetupRecoveryChange, type SetupRecoveryScope } from './setup-recovery.ts';

export const STORAGE_KEY = 'setline.gym.v1';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const PRE_RESTORE_KEY = 'setline.gym.pre-restore.v1';

export interface BackupPreview {
  exportedAt: string | null;
  workouts: number;
  activeWorkouts: number;
  mealsAndWeights: number;
  activities: number;
  reminders: number;
  jumpMeasurements: number;
  readinessCheckIns: number;
}

export interface SetupRecoveryPreview {
  token: string;
  scope: SetupRecoveryScope;
  exportedAt: string | null;
  changes: SetupRecoveryChange[];
  plan: ReturnType<typeof recoveredPlanDetails>;
  preserved: { workouts: number; activeWorkouts: number; nutrition: number; activities: number; jumpMeasurements: number; reminders: number };
}

function parseBackup(text: string) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
  let backup: unknown;
  try { backup = JSON.parse(text); }
  catch { throw new Error('This file is not valid JSON. Choose a Setline backup.'); }
  if (!object(backup) || backup.app !== 'Setline' || backup.version !== 1) throw new Error('Choose a supported Setline backup.');
  return {
    data: parseState(backup.data),
    exportedAt: typeof backup.exportedAt === 'string' && Number.isFinite(Date.parse(backup.exportedAt)) ? backup.exportedAt : null,
  };
}

/** Validate every record before showing a restore action; this never writes. */
export function previewBackup(text: string): BackupPreview {
  const { data, exportedAt } = parseBackup(text);
  return { exportedAt, workouts: data.sessions.length,
    activeWorkouts: data.sessions.filter(({ session }) => session.status === 'active').length,
    mealsAndWeights: data.nutrition.length, activities: data.activities.length,
    reminders: data.reminders.items.length, jumpMeasurements: data.performance?.jumps.length ?? 0,
    readinessCheckIns: data.performance?.readiness.length ?? 0 };
}

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type RecordValue = Record<string, unknown>;
type SessionRecord = { session: RecordValue; version: number };
type NutritionRecord = { id: string; date: string; payload: unknown; version: number };
interface LocalState {
  schemaVersion: 1;
  restoreGeneration?: string;
  profile: unknown;
  profileVersion: number;
  sessions: SessionRecord[];
  nutrition: NutritionRecord[];
  activities: ActivityRecord[];
  reminders: ReminderState;
  performance?: PerformanceData;
  performanceVersion?: number;
}

function object(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function version(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function profileFingerprint(value: unknown): string {
  // A normal record write can normalize object key order without changing a
  // preference. Array order remains significant for schedules and exercises.
  return JSON.stringify(value, (_key, nested) => object(nested)
    ? Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right))) : nested);
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function parseNutrition(value: unknown): NutritionRecord {
  if (!object(value) || typeof value.id !== 'string' || !value.id || value.id.length > 100 || !validDate(value.date) || !version(value.version)) {
    throw new Error('This nutrition record is invalid.');
  }
  const result = NutritionPayloadSchema.safeParse(value.payload);
  if (!result.success) throw new Error('Enter valid nutrition amounts before saving.');
  return { id: value.id, date: value.date, payload: result.data, version: value.version };
}
function parseActivity(value: unknown): ActivityRecord {
  if (!object(value) || !version(value.version)) throw new Error('A saved extra activity is invalid.');
  const result = ExtraActivitySchema.safeParse(value.activity);
  if (!result.success) throw new Error('A saved extra activity is invalid.');
  return { activity: result.data, version: value.version };
}
function parseReminders(value: unknown): ReminderState {
  if (!object(value) || !Array.isArray(value.items) || !Array.isArray(value.entries) || value.items.length > 200 || value.entries.length > 20000) throw new Error('The saved reminders are invalid.');
  const items = value.items.map((item): ReminderRecord => {
    if (!object(item) || !version(item.version)) throw new Error('A saved reminder is invalid.');
    const parsed = ReminderSchema.safeParse(item.reminder);
    if (!parsed.success) throw new Error('A saved reminder is invalid.');
    return { reminder: parsed.data, version: item.version };
  });
  const entries = value.entries.map((item): ReminderEntryRecord => {
    if (!object(item) || !version(item.version)) throw new Error('A saved reminder entry is invalid.');
    const parsed = ReminderEntrySchema.safeParse(item.entry);
    if (!parsed.success) throw new Error('A saved reminder entry is invalid.');
    return { entry: parsed.data, version: item.version };
  });
  const ids = new Set(items.map(({ reminder }) => reminder.id));
  if (ids.size !== items.length || new Set(entries.map(({ entry }) => entry.id)).size !== entries.length || entries.some(({ entry }) => !ids.has(entry.reminderId))) throw new Error('The saved reminders contain duplicate or unknown records.');
  return { items, entries };
}
function parseState(value: unknown): LocalState {
  if (object(value) && Object.hasOwn(value, 'restoreGeneration') && (typeof value.restoreGeneration !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.restoreGeneration))) {
    throw new Error('The saved restore identifier is invalid.');
  }
  if (!object(value) || value.schemaVersion !== 1 || !version(value.profileVersion) || !Array.isArray(value.sessions) || !Array.isArray(value.nutrition)) {
    throw new Error('This is not a supported Setline backup.');
  }
  // Older version-1 backups and saved data predate extra activities. Only an
  // absent field migrates to an empty list; a present invalid field must fail.
  const rawActivities = Object.hasOwn(value, 'activities') ? value.activities : [];
  if (!Array.isArray(rawActivities)) throw new Error('The saved extra activities are invalid.');
  if (value.sessions.length > 5000 || value.nutrition.length > 10000 || rawActivities.length > 5000) throw new Error('This backup contains too many records.');
  const profile = ProfileSchema.safeParse(value.profile);
  if (!profile.success) throw new Error('The saved training plan is invalid.');
  const sessions = value.sessions.map((entry): SessionRecord => {
    if (!object(entry) || !version(entry.version)) throw new Error('A saved workout is invalid.');
    const session = SessionSchema.safeParse(entry.session);
    if (!session.success) throw new Error('A saved workout is invalid.');
    return { session: session.data, version: entry.version };
  });
  const nutrition = value.nutrition.map(parseNutrition);
  const activities = rawActivities.map(parseActivity);
  // Only absent fields migrate. Present malformed reminder data must not be
  // silently replaced, either on startup or while importing a backup.
  const reminders = Object.hasOwn(value, 'reminders') ? parseReminders(value.reminders) : defaultReminderState();
  if (sessions.filter((entry) => entry.session.status === 'active').length > 1) {
    throw new Error('The backup contains more than one active workout.');
  }
  if (new Set(sessions.map((entry) => entry.session.id)).size !== sessions.length || new Set(nutrition.map((entry) => entry.id)).size !== nutrition.length || new Set(activities.map((entry) => entry.activity.id)).size !== activities.length) {
    throw new Error('The backup contains duplicate records.');
  }
  // New performance data is optional: reading a legacy backup must not invent
  // records or materialize fields. Present invalid data always rejects atomically.
  let performance: PerformanceData | undefined;
  if (Object.hasOwn(value, 'performance') || Object.hasOwn(value, 'performanceVersion')) {
    const parsed = PerformanceDataSchema.safeParse(value.performance);
    if (!parsed.success || !version(value.performanceVersion)) throw new Error('The saved performance records are invalid.');
    performance = parsed.data;
  }
  return {
    schemaVersion: 1, ...(typeof value.restoreGeneration === 'string' ? { restoreGeneration: value.restoreGeneration } : {}), profile: profile.data, profileVersion: value.profileVersion,
    sessions, nutrition, activities, reminders,
    ...(performance ? { performance, performanceVersion: value.performanceVersion as number } : {}),
  };
}

/** The reference's request contract, implemented entirely in this device's storage. */
export function createLocalClient(storage: StoragePort, initialProfile: unknown = DEFAULT_PROFILE) {
  // Each tab keeps the generation it first read. A restore replaces the marker
  // atomically with the state, so an older tab cannot save same-version records
  // over the restored data. Reloading creates a client for the new generation.
  let observedGeneration: string | null | undefined;
  let observedExistingStore = false;
  let observedAbsentStore = false;
  let externalInitialization = false;
  const setupReviews = new Map<string, { scope: SetupRecoveryScope; text: string; profile: string; profileVersion: number; generation: string | null }>();
  function read(defaultProfile: unknown = initialProfile): LocalState {
    let raw: string | null;
    try { raw = storage.getItem(STORAGE_KEY); }
    catch { throw new Error('Device storage is unavailable. Allow site storage in your browser, then retry.'); }
    if (raw === null) {
      if (observedExistingStore) throw new Error('Saved data disappeared from this app address while it was open. Reload and review recovery options before saving; existing settings will not be replaced with defaults.');
      observedAbsentStore = true;
      observedGeneration ??= null;
      return { schemaVersion: 1, profile: clone(ProfileSchema.parse(defaultProfile)), profileVersion: 0, sessions: [], nutrition: [], activities: [], reminders: (defaultProfile as { onboarding?: unknown })?.onboarding ? { items: [], entries: [] } : defaultReminderState() };
    }
    // Presence matters even when validation fails: unreadable personal records
    // must never turn into permission to write a default profile later.
    if (observedAbsentStore && !observedExistingStore) externalInitialization = true;
    observedExistingStore = true;
    try {
      const state = parseState(JSON.parse(raw));
      if (observedGeneration === undefined) observedGeneration = state.restoreGeneration ?? null;
      return state;
    }
    catch { throw new Error('Saved data could not be read. Restore a valid Setline backup in Settings, or export a recovery copy before resetting.'); }
  }
  function write(state: LocalState) {
    const serialized = JSON.stringify(state);
    try { storage.setItem(STORAGE_KEY, serialized); observedExistingStore = true; }
    catch { throw new Error('Your data could not be saved. Device storage may be full or unavailable. Export a backup and free some space, then retry.'); }
  }
  function assertVersion(expected: unknown, actual: number) {
    if (!version(expected) || expected !== actual) throw new Error('This record changed in another tab. Reload the app before editing it again.');
  }

  async function request(path: string, payload?: unknown, defaultProfile: unknown = initialProfile): Promise<RecordValue> {
    if (path === '/api/nutrition/analyze') throw new Error('Automatic photo analysis is unavailable in this offline app. Add foods and nutrition amounts manually.');
    if (path !== '/api/tracker' && path !== '/api/nutrition' && path !== '/api/reminders' && path !== '/api/performance') throw new Error('Unknown local data operation.');
    const state = read(defaultProfile);
    if (payload === undefined) {
      if (path === '/api/performance') return clone({ ...(state.performance ?? emptyPerformance()), version: state.performanceVersion ?? 0 });
      return path === '/api/reminders' ? clone(state.reminders) as unknown as RecordValue : path === '/api/tracker'
        ? clone({ profile: state.profile, profileVersion: state.profileVersion, sessions: state.sessions, activities: state.activities })
        : clone({ records: state.nutrition, photoAnalysisReady: false });
    }
    if (externalInitialization) throw new Error('Setline data was created in another tab while this installation was open. Reload before saving so its settings are not replaced with defaults.');
    if ((state.restoreGeneration ?? null) !== observedGeneration) throw new Error('Local data was restored in another tab. Reload the app before saving changes.');
    if (!object(payload)) throw new Error('The data to save is invalid.');
    let nextVersion: number;
    if (path === '/api/performance' && payload.action === 'save') {
      assertVersion(payload.expectedVersion, state.performanceVersion ?? 0);
      const parsed = PerformanceDataSchema.safeParse({ jumps: payload.jumps, readiness: payload.readiness });
      if (!parsed.success) throw new Error('Enter valid jump measurements and readiness check-ins before saving.');
      nextVersion = (state.performanceVersion ?? 0) + 1;
      state.performance = parsed.data;
      state.performanceVersion = nextVersion;
    } else if (path === '/api/reminders' && payload.action === 'reminder') {
      const parsed = ReminderSchema.safeParse(payload.reminder);
      if (!parsed.success) throw new Error('Enter valid reminder instructions and a confirmed schedule.');
      const reminder = parsed.data;
      const existing = state.reminders.items.find((item) => item.reminder.id === reminder.id);
      assertVersion(payload.expectedVersion, existing?.version ?? 0);
      if (!existing && state.reminders.items.length >= 200) throw new Error('Too many reminders are saved. Edit or pause an existing reminder.');
      nextVersion = (existing?.version ?? 0) + 1;
      state.reminders.items = [{ reminder, version: nextVersion }, ...state.reminders.items.filter((item) => item.reminder.id !== reminder.id)];
    } else if (path === '/api/reminders' && payload.action === 'entry') {
      const parsed = ReminderEntrySchema.safeParse(payload.entry);
      if (!parsed.success) throw new Error('Enter a valid reminder date and status.');
      const entry = parsed.data;
      const item = state.reminders.items.find((item) => item.reminder.id === entry.reminderId);
      if (!item) throw new Error('This reminder no longer exists. Reload the app.');
      if (entry.status === 'taken' && !isTrackable(item.reminder)) throw new Error('Confirm the label or prescription and once-daily schedule before recording this reminder.');
      const existing = state.reminders.entries.find((item) => item.entry.id === entry.id);
      assertVersion(payload.expectedVersion, existing?.version ?? 0);
      if (entry.status === 'taken' && existing?.entry.status === 'taken') throw new Error('This reminder is already marked taken for this date. Undo it before correcting the record.');
      if (!existing && state.reminders.entries.length >= 20000) throw new Error('Too many reminder entries are saved. Export a backup before adding more.');
      nextVersion = (existing?.version ?? 0) + 1;
      state.reminders.entries = [{ entry, version: nextVersion }, ...state.reminders.entries.filter((item) => item.entry.id !== entry.id)];
    } else if (path === '/api/tracker' && payload.action === 'profile') {
      assertVersion(payload.expectedVersion, state.profileVersion);
      if (Object.hasOwn(payload, 'checkpoint') && typeof payload.checkpoint !== 'boolean') {
        throw new Error('Choose a valid recovery checkpoint option before saving this profile change.');
      }
      const profile = ProfileSchema.safeParse(payload.profile);
      if (!profile.success) throw new Error('Enter a valid training plan and preferences.');
      nextVersion = state.profileVersion + 1;
      state.profile = profile.data;
      state.profileVersion = nextVersion;
      if (payload.checkpoint === true) {
        const previous = storage.getItem(STORAGE_KEY);
        if (previous === null && observedExistingStore) {
          throw new Error('Saved data disappeared before this change. Reload and review recovery options; no default profile was saved.');
        }
        let checkpointed = state;
        if (previous !== null) {
          // A critical profile change must not normalize historical records or
          // erase compatible metadata that this settings screen does not own.
          const raw: unknown = JSON.parse(previous);
          const current = parseState(raw);
          assertVersion(payload.expectedVersion, current.profileVersion);
          if ((current.restoreGeneration ?? null) !== observedGeneration) {
            throw new Error('Local data was restored in another tab. Reload the app before saving changes.');
          }
          checkpointed = { ...(raw as LocalState), profile: profile.data, profileVersion: nextVersion };
        }
        replaceWithSafetyCopy(checkpointed, { preserveLease: true, expectedPrevious: previous });
        return { version: nextVersion };
      }
    } else if (path === '/api/tracker' && payload.action === 'session') {
      const parsed = SessionSchema.safeParse(payload.session);
      if (!parsed.success) throw new Error('Enter valid workout values before saving.');
      const session = parsed.data;
      const existing = state.sessions.find((entry) => entry.session.id === session.id);
      assertVersion(payload.expectedVersion, existing?.version ?? 0);
      if (existing && existing.session.status !== 'active' && session.status === 'active') {
        throw new Error('A finished workout cannot be reopened as a new active session. Start a new workout; its completed history stays editable.');
      }
      // One active workout at a time, matching the training UI's resume behavior.
      if (session.status === 'active' && state.sessions.some((entry) => entry.session.status === 'active' && entry.session.id !== session.id)) {
        throw new Error('Finish or discard your active workout before starting another one.');
      }
      nextVersion = (existing?.version ?? 0) + 1;
      state.sessions = [{ session, version: nextVersion }, ...state.sessions.filter((entry) => entry.session.id !== session.id)];
    } else if (path === '/api/tracker' && payload.action === 'activity-batch') {
      if (!Array.isArray(payload.activities) || payload.activities.length < 1 || payload.activities.length > 500) {
        throw new Error('Choose between 1 and 500 activities to import.');
      }
      const parsed = payload.activities.map((item) => ExtraActivitySchema.safeParse(item));
      if (parsed.some((item) => !item.success)) throw new Error('Review valid activity dates, durations and distances before importing.');
      const incoming = parsed.map((item) => {
        if (!item.success) throw new Error('An imported activity is invalid.');
        return item.data;
      });
      if (state.activities.length + incoming.length > 5000) throw new Error('Too many extra activities are saved. Export a backup before importing more.');
      const seenIds = new Set(state.activities.map((entry) => entry.activity.id));
      const seenSources = new Set(state.activities.flatMap(({ activity }) => activity.importSource ? [activity.importSource.fingerprint] : []));
      const seenExternalIds = new Set(state.activities.flatMap(({ activity }) => activity.importSource?.externalId ? [`${activity.importSource.provider}:${activity.importSource.externalId}`] : []));
      // Re-exports can differ in moving versus elapsed duration. Match the
      // recorded instant too, using seconds and type so separate activities in
      // the same minute or a multisport session remain distinct.
      const startKey = (activity: ActivityRecord['activity']) => activity.importSource?.startedAt
        ? `${Math.floor(new Date(activity.importSource.startedAt).getTime() / 1000)}:${activity.type}`
        : null;
      const seenStarts = new Set(state.activities.flatMap(({ activity }) => {
        const key = startKey(activity);
        return key ? [key] : [];
      }));
      for (const activity of incoming) {
        const source = activity.importSource;
        const externalId = source?.externalId ? `${source.provider}:${source.externalId}` : null;
        const recordedStart = startKey(activity);
        if (seenIds.has(activity.id) || (source && seenSources.has(source.fingerprint)) || (externalId && seenExternalIds.has(externalId)) || (recordedStart && seenStarts.has(recordedStart))) {
          throw new Error('One of these activities is already saved. Refresh the preview and remove duplicates.');
        }
        seenIds.add(activity.id);
        if (source) seenSources.add(source.fingerprint);
        if (externalId) seenExternalIds.add(externalId);
        if (recordedStart) seenStarts.add(recordedStart);
      }
      const records = incoming.map((activity) => ({ activity, version: 1 }));
      state.activities = [...records, ...state.activities];
      write(state);
      return { activities: clone(records) };
    } else if (path === '/api/tracker' && payload.action === 'activity') {
      const parsed = ExtraActivitySchema.safeParse(payload.activity);
      if (!parsed.success) throw new Error('Enter valid extra activity values before saving.');
      const activity = parsed.data;
      const existing = state.activities.find((entry) => entry.activity.id === activity.id);
      assertVersion(payload.expectedVersion, existing?.version ?? 0);
      if (!existing && state.activities.length >= 5000) throw new Error('Too many extra activities are saved. Export a backup before removing old records.');
      nextVersion = (existing?.version ?? 0) + 1;
      state.activities = [{ activity, version: nextVersion }, ...state.activities.filter((entry) => entry.activity.id !== activity.id)];
    } else if (path === '/api/nutrition') {
      if (typeof payload.id !== 'string') throw new Error('The nutrition record is invalid.');
      const existing = state.nutrition.find((entry) => entry.id === payload.id);
      assertVersion(payload.expectedVersion, existing?.version ?? 0);
      nextVersion = (existing?.version ?? 0) + 1;
      const record = parseNutrition({ ...payload, version: nextVersion });
      state.nutrition = [record, ...state.nutrition.filter((entry) => entry.id !== record.id)];
    } else {
      throw new Error('Unknown workout data operation.');
    }
    write(state);
    return { version: nextVersion };
  }
  function exportBackup() {
    const { restoreGeneration: _localGeneration, ...data } = read();
    return JSON.stringify({ app: 'Setline', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  }
  function replaceWithSafetyCopy(restored: LocalState, options: { preserveLease?: boolean; expectedPrevious?: string | null } = {}) {
    // Save the exact prior bytes, including unreadable records, before replacing
    // anything. A quota failure aborts the restore instead of losing its fallback.
    const previous = storage.getItem(STORAGE_KEY);
    if (options.expectedPrevious !== undefined && previous !== options.expectedPrevious) {
      throw new Error('Your saved data changed before this operation. Review the change again; no records were replaced.');
    }
    const previousSafetyCopy = storage.getItem(PRE_RESTORE_KEY);
    if (previous !== null) {
      try {
        storage.setItem(PRE_RESTORE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), raw: previous }));
      } catch { throw new Error('Your safety copy could not be saved. No records were replaced. Export a recovery copy and free device storage before retrying.'); }
    }
    try { write(restored); }
    catch (error) {
      // Roll back the safety-copy slot too when the main state was not replaced.
      try {
        if (previousSafetyCopy === null) storage.removeItem(PRE_RESTORE_KEY);
        else storage.setItem(PRE_RESTORE_KEY, previousSafetyCopy);
      } catch { /* The current state remains intact; the fallback holds its bytes. */ }
      throw error;
    }
    if (!options.preserveLease) {
      observedGeneration = restored.restoreGeneration ?? null;
      observedAbsentStore = false;
      externalInitialization = false;
    }
  }
  function importBackup(text: string) {
    const { data: restored } = parseBackup(text);
    restored.restoreGeneration = crypto.randomUUID();
    replaceWithSafetyCopy(restored);
  }

  function setupRecoveryState(text: string, scope: SetupRecoveryScope) {
    const { data: backup, exportedAt } = parseBackup(text);
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) throw new Error('No existing setup is saved at this app address. Check the address on your original installation, or use full backup restore to bring its records here.');
    observedExistingStore = true;
    let current: unknown;
    try { current = JSON.parse(raw); } catch { throw new Error('Current records are unreadable. Export a recovery copy before using full backup restore.'); }
    if (!object(current) || current.schemaVersion !== 1 || !version(current.profileVersion)) throw new Error('Current records are not a supported Setline format. Export a recovery copy before using full backup restore.');
    // Repair only selected profile fields, then validate every untouched record.
    // An invalid history or an invalid unselected profile field fails closed.
    const profile = recoverSetupProfile(current.profile, backup.profile, scope);
    const state = parseState({ ...current, profile });
    if (observedGeneration === undefined) observedGeneration = state.restoreGeneration ?? null;
    if (observedGeneration !== undefined && (state.restoreGeneration ?? null) !== observedGeneration) throw new Error('Local data was restored in another tab. Reload the app before recovering settings.');
    if (scope === 'training' && state.sessions.some(({ session }) => session.status === 'active')) throw new Error('Finish your active workout before recovering a training plan. Its saved prescription will not be replaced.');
    return { state, current, profile, exportedAt, raw };
  }

  /** Review only; the token leases this exact profile/version without freezing later workout writes. */
  function previewSetupRecovery(text: string, scope: SetupRecoveryScope): SetupRecoveryPreview {
    const { state, current, profile, exportedAt } = setupRecoveryState(text, scope);
    const token = crypto.randomUUID();
    setupReviews.clear();
    setupReviews.set(token, { scope, text, profile: profileFingerprint(current.profile), profileVersion: state.profileVersion, generation: state.restoreGeneration ?? null });
    return { token, scope, exportedAt, changes: setupRecoveryChanges(current.profile, profile, scope), plan: recoveredPlanDetails(profile),
      preserved: { workouts: state.sessions.length, activeWorkouts: state.sessions.filter(({ session }) => session.status === 'active').length,
        nutrition: state.nutrition.length, activities: state.activities.length, jumpMeasurements: state.performance?.jumps.length ?? 0, reminders: state.reminders.items.length } };
  }

  /** Confirm one reviewed recovery. A safety-copy failure or stale review cannot partially replace data. */
  function applySetupRecovery(token: string) {
    const review = setupReviews.get(token);
    if (!review) throw new Error('Review the backup again before recovering settings.');
    const { state, current, profile, raw } = setupRecoveryState(review.text, review.scope);
    if (state.profileVersion !== review.profileVersion || (state.restoreGeneration ?? null) !== review.generation || profileFingerprint(current.profile) !== review.profile) {
      throw new Error('Your setup changed after this preview. Review the backup again; no settings or records were replaced.');
    }
    if (!setupRecoveryChanges(current.profile, profile, review.scope).length) { setupReviews.delete(token); return; }
    // Validation is strict, but recovery changes the selected profile only.
    // Preserve untouched record bytes/optional absences, including compatible
    // metadata unknown to this screen, instead of normalizing all history.
    replaceWithSafetyCopy({ ...current, profile, profileVersion: state.profileVersion + 1,
      restoreGeneration: crypto.randomUUID() } as LocalState, { expectedPrevious: raw });
    setupReviews.clear();
  }
  function cancelSetupRecovery(token: string) { setupReviews.delete(token); }
  function previousRestoreCopy(): { text: string; recovery: boolean; savedAt: string } | null {
    const text = storage.getItem(PRE_RESTORE_KEY);
    if (text === null) return null;
    let copy: unknown;
    try { copy = JSON.parse(text); } catch { throw new Error('The safety copy could not be read.'); }
    if (!object(copy) || typeof copy.raw !== 'string' || typeof copy.savedAt !== 'string') throw new Error('The safety copy could not be read.');
    try {
      const { restoreGeneration: _localGeneration, ...data } = parseState(JSON.parse(copy.raw));
      return { text: JSON.stringify({ app: 'Setline', version: 1, exportedAt: copy.savedAt, data }, null, 2), recovery: false, savedAt: copy.savedAt };
    } catch {
      return { text: JSON.stringify({ app: 'Setline recovery', exportedAt: copy.savedAt, raw: copy.raw }, null, 2), recovery: true, savedAt: copy.savedAt };
    }
  }
  function exportRecovery() {
    return JSON.stringify({ app: 'Setline recovery', exportedAt: new Date().toISOString(), raw: storage.getItem(STORAGE_KEY) }, null, 2);
  }
  function reset() { storage.removeItem(STORAGE_KEY); storage.removeItem(PRE_RESTORE_KEY); observedGeneration = null; observedExistingStore = false; observedAbsentStore = false; externalInitialization = false; setupReviews.clear(); }
  return { request, exportBackup, importBackup, exportRecovery, previousRestoreCopy, hasPreviousRestoreCopy: () => storage.getItem(PRE_RESTORE_KEY) !== null, previewSetupRecovery, applySetupRecovery, cancelSetupRecovery, reset };
}

let localBrowserClient: ReturnType<typeof createLocalClient> | undefined;
function browserClient() {
  try { return localBrowserClient ??= createLocalClient(window.localStorage, createNewProfile()); }
  catch { throw new Error('Device storage is unavailable. Allow site storage in your browser, then retry.'); }
}
export function requestLocal(path: string, payload?: unknown, defaultProfile?: unknown) {
  return browserClient().request(path, payload, defaultProfile);
}
export function exportBackup() { return browserClient().exportBackup(); }
export function importBackup(text: string) { return browserClient().importBackup(text); }
export function exportRecovery() { return browserClient().exportRecovery(); }
export function previousRestoreCopy() { return browserClient().previousRestoreCopy(); }
export function hasPreviousRestoreCopy() { return browserClient().hasPreviousRestoreCopy(); }
export function resetLocalData() { return browserClient().reset(); }
export function previewSetupRecovery(text: string, scope: SetupRecoveryScope) { return browserClient().previewSetupRecovery(text, scope); }
export function applySetupRecovery(token: string) { return browserClient().applySetupRecovery(token); }
export function cancelSetupRecovery(token: string) { return browserClient().cancelSetupRecovery(token); }

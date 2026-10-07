import { DEFAULT_PROFILE, NutritionPayloadSchema, ProfileSchema, SessionSchema } from './domain.js';
import { ExtraActivitySchema, type ActivityRecord } from './activities.ts';

export const STORAGE_KEY = 'setline.gym.v1';
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type RecordValue = Record<string, unknown>;
type SessionRecord = { session: RecordValue; version: number };
type NutritionRecord = { id: string; date: string; payload: unknown; version: number };
interface LocalState {
  schemaVersion: 1;
  profile: unknown;
  profileVersion: number;
  sessions: SessionRecord[];
  nutrition: NutritionRecord[];
  activities: ActivityRecord[];
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
function parseState(value: unknown): LocalState {
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
  if (sessions.filter((entry) => entry.session.status === 'active').length > 1) {
    throw new Error('The backup contains more than one active workout.');
  }
  if (new Set(sessions.map((entry) => entry.session.id)).size !== sessions.length || new Set(nutrition.map((entry) => entry.id)).size !== nutrition.length || new Set(activities.map((entry) => entry.activity.id)).size !== activities.length) {
    throw new Error('The backup contains duplicate records.');
  }
  return { schemaVersion: 1, profile: profile.data, profileVersion: value.profileVersion, sessions, nutrition, activities };
}

/** The reference's request contract, implemented entirely in this device's storage. */
export function createLocalClient(storage: StoragePort) {
  function read(defaultProfile: unknown = DEFAULT_PROFILE): LocalState {
    let raw: string | null;
    try { raw = storage.getItem(STORAGE_KEY); }
    catch { throw new Error('Device storage is unavailable. Allow site storage in your browser, then retry.'); }
    if (raw === null) return { schemaVersion: 1, profile: clone(ProfileSchema.parse(defaultProfile)), profileVersion: 0, sessions: [], nutrition: [], activities: [] };
    try { return parseState(JSON.parse(raw)); }
    catch { throw new Error('Saved data could not be read. Restore a valid Setline backup in Settings, or export a recovery copy before resetting.'); }
  }
  function write(state: LocalState) {
    const serialized = JSON.stringify(state);
    try { storage.setItem(STORAGE_KEY, serialized); }
    catch { throw new Error('Your data could not be saved. Device storage may be full or unavailable. Export a backup and free some space, then retry.'); }
  }
  function assertVersion(expected: unknown, actual: number) {
    if (!version(expected) || expected !== actual) throw new Error('This record changed in another tab. Reload the app before editing it again.');
  }

  async function request(path: string, payload?: unknown, defaultProfile: unknown = DEFAULT_PROFILE): Promise<RecordValue> {
    if (path === '/api/nutrition/analyze') throw new Error('Automatic photo analysis is unavailable in this offline app. Add foods and nutrition amounts manually.');
    if (path !== '/api/tracker' && path !== '/api/nutrition') throw new Error('Unknown local data operation.');
    const state = read(defaultProfile);
    if (payload === undefined) {
      return path === '/api/tracker'
        ? clone({ profile: state.profile, profileVersion: state.profileVersion, sessions: state.sessions, activities: state.activities })
        : clone({ records: state.nutrition, photoAnalysisReady: false });
    }
    if (!object(payload)) throw new Error('The data to save is invalid.');
    let nextVersion: number;
    if (path === '/api/tracker' && payload.action === 'profile') {
      assertVersion(payload.expectedVersion, state.profileVersion);
      const profile = ProfileSchema.safeParse(payload.profile);
      if (!profile.success) throw new Error('Enter a valid training plan and preferences.');
      nextVersion = state.profileVersion + 1;
      state.profile = profile.data;
      state.profileVersion = nextVersion;
    } else if (path === '/api/tracker' && payload.action === 'session') {
      const parsed = SessionSchema.safeParse(payload.session);
      if (!parsed.success) throw new Error('Enter valid workout values before saving.');
      const session = parsed.data;
      const existing = state.sessions.find((entry) => entry.session.id === session.id);
      assertVersion(payload.expectedVersion, existing?.version ?? 0);
      // One active workout at a time, matching the training UI's resume behavior.
      if (session.status === 'active' && state.sessions.some((entry) => entry.session.status === 'active' && entry.session.id !== session.id)) {
        throw new Error('Finish or discard your active workout before starting another one.');
      }
      nextVersion = (existing?.version ?? 0) + 1;
      state.sessions = [{ session, version: nextVersion }, ...state.sessions.filter((entry) => entry.session.id !== session.id)];
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
    return JSON.stringify({ app: 'Setline', version: 1, exportedAt: new Date().toISOString(), data: read() }, null, 2);
  }
  function importBackup(text: string) {
    if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
    let backup: unknown;
    try { backup = JSON.parse(text); }
    catch { throw new Error('This file is not valid JSON. Choose a Setline backup.'); }
    if (!object(backup) || backup.app !== 'Setline' || backup.version !== 1) throw new Error('Choose a supported Setline backup.');
    const restored = parseState(backup.data);
    write(restored);
  }
  function exportRecovery() {
    return JSON.stringify({ app: 'Setline recovery', exportedAt: new Date().toISOString(), raw: storage.getItem(STORAGE_KEY) }, null, 2);
  }
  function reset() { storage.removeItem(STORAGE_KEY); }
  return { request, exportBackup, importBackup, exportRecovery, reset };
}

function browserClient() {
  try { return createLocalClient(window.localStorage); }
  catch { throw new Error('Device storage is unavailable. Allow site storage in your browser, then retry.'); }
}
export function requestLocal(path: string, payload?: unknown, defaultProfile?: unknown) {
  return browserClient().request(path, payload, defaultProfile);
}
export function exportBackup() { return browserClient().exportBackup(); }
export function importBackup(text: string) { return browserClient().importBackup(text); }
export function exportRecovery() { return browserClient().exportRecovery(); }
export function resetLocalData() { return browserClient().reset(); }

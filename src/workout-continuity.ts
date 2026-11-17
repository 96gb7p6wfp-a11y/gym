import { SessionSchema } from './domain.js';
import { STORAGE_KEY } from './storage.ts';
import type { SetCompletionTarget } from './set-completion';

/** Optional recovery metadata; never a second workout record or portable backup. */
export const WORKOUT_CONTINUITY_KEY = 'setline.workout-continuity.v1';
const OWNER_KEY = 'setline.workout-continuity-owner.v1';
const MAX_AGE = 24 * 60 * 60 * 1000;
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120;
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export interface WorkoutContinuity {
  version: 1;
  sessionId: string;
  startedAt: number;
  restoreGeneration: string | null;
  ownerId: string;
  updatedAt: number;
  deadline: number | null;
  restOwner: SetCompletionTarget | null;
  receipt: SetCompletionTarget | null;
}
export interface WorkoutContinuityInput {
  ownerId: string;
  deadline: number | null;
  restOwner: SetCompletionTarget | null;
  receipt: SetCompletionTarget | null;
}

function activeWorkout(storage: StoragePort) {
  const state: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
  if (!object(state) || state.schemaVersion !== 1 || !Array.isArray(state.sessions)) return null;
  const active = state.sessions.filter(row => object(row) && object(row.session) && row.session.status === 'active');
  if (active.length !== 1) return null;
  const result = SessionSchema.safeParse(active[0].session);
  if (!result.success) return null;
  const generation = state.restoreGeneration;
  if (generation !== undefined && (typeof generation !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(generation))) return null;
  return { session: result.data, restoreGeneration: generation ?? null };
}

function target(value: unknown, session: NonNullable<ReturnType<typeof activeWorkout>>['session']): SetCompletionTarget | null | false {
  if (value === null) return null;
  if (!object(value) || !identifier(value.sessionId) || !identifier(value.exerciseKey) || !identifier(value.setId)
    || value.sessionId !== session.id) return false;
  const exercise = session.exercises.find((item: { key: string }) => item.key === value.exerciseKey);
  if (!exercise?.logs.some((log: { id: string; done: boolean }) => log.id === value.setId && log.done)) return false;
  return { sessionId: value.sessionId, exerciseKey: value.exerciseKey, setId: value.setId };
}

function validDeadline(value: unknown, now: number): value is number | null {
  // Recently elapsed timers are recoverable as silent completion, never a new
  // full countdown. The existing RestAlertTimer suppresses restored alarms.
  return value === null || timestamp(value) && Math.abs(value - now) <= MAX_AGE;
}

/** A refresh retains its tab identity. Independent tabs do not adopt a timer. */
export function getWorkoutContinuityOwner(tabStorage: StoragePort): string | null {
  try {
    const stored = tabStorage.getItem(OWNER_KEY);
    if (identifier(stored)) return stored;
    const id = globalThis.crypto.randomUUID();
    tabStorage.setItem(OWNER_KEY, id);
    return id;
  } catch { return null; }
}

/** Inspect only. A fresh context must explicitly claim this recovery. */
export function readWorkoutContinuity(storage: StoragePort, now = Date.now()): WorkoutContinuity | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(WORKOUT_CONTINUITY_KEY) ?? 'null');
    if (!object(value) || value.version !== 1 || !identifier(value.ownerId)
      || !timestamp(value.updatedAt) || Math.abs(value.updatedAt - now) > MAX_AGE
      || !validDeadline(value.deadline, now)) return null;
    const active = activeWorkout(storage);
    if (!active || value.sessionId !== active.session.id || value.startedAt !== active.session.startedAt
      || value.restoreGeneration !== active.restoreGeneration) return null;
    const restOwner = target(value.restOwner, active.session), receipt = target(value.receipt, active.session);
    if (restOwner === false || receipt === false || value.deadline === null && restOwner !== null) return null;
    if (value.deadline === null && receipt === null) return null;
    return { version: 1, sessionId: active.session.id, startedAt: active.session.startedAt,
      restoreGeneration: active.restoreGeneration, ownerId: value.ownerId, updatedAt: value.updatedAt,
      deadline: value.deadline, restOwner, receipt };
  } catch { return null; }
}

/** Only the owning tab may remove its record; another tab's timer stays intact. */
export function clearWorkoutContinuity(storage: StoragePort, ownerId: string): void {
  try {
    const raw: unknown = JSON.parse(storage.getItem(WORKOUT_CONTINUITY_KEY) ?? 'null');
    if (object(raw) && raw.ownerId === ownerId) storage.removeItem(WORKOUT_CONTINUITY_KEY);
  } catch { /* Optional recovery metadata must never prevent live logging. */ }
}

/** Save after the authoritative session write, not before optimistic completion. */
export function saveWorkoutContinuity(storage: StoragePort, input: WorkoutContinuityInput, now = Date.now()): boolean {
  try {
    if (!identifier(input.ownerId)) return false;
    // The common pre-first-set path needs no second read of a large history.
    if (input.deadline === null && input.receipt === null) {
      clearWorkoutContinuity(storage, input.ownerId);
      return true;
    }
    const active = activeWorkout(storage);
    if (!active) {
      clearWorkoutContinuity(storage, input.ownerId);
      return false;
    }
    if (!validDeadline(input.deadline, now)) return false;
    const restOwner = input.deadline === null ? null : target(input.restOwner, active.session);
    const receipt = target(input.receipt, active.session);
    if (restOwner === false || receipt === false) return false;
    const record: WorkoutContinuity = { version: 1, sessionId: active.session.id,
      startedAt: active.session.startedAt, restoreGeneration: active.restoreGeneration,
      ownerId: input.ownerId, updatedAt: now, deadline: input.deadline, restOwner, receipt };
    storage.setItem(WORKOUT_CONTINUITY_KEY, JSON.stringify(record));
    return true;
  } catch { return false; }
}

/** Explicit ownership transfer; callers stop an older tab's alarm on storage events. */
export function claimWorkoutContinuity(storage: StoragePort, ownerId: string, now = Date.now()): WorkoutContinuity | null {
  const record = readWorkoutContinuity(storage, now);
  if (!record || !identifier(ownerId)) return null;
  if (!saveWorkoutContinuity(storage, { ...record, ownerId }, now)) return null;
  const claimed = readWorkoutContinuity(storage, now);
  return claimed?.ownerId === ownerId ? claimed : null;
}

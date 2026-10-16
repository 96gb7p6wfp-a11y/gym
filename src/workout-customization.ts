import type { z } from 'zod';
import {
  DEFAULT_PROFILE, ExerciseSchema, PlanDaySchema, CustomWorkoutSchema, SessionSchema,
  TrainingGoalSchema, elapsedTime,
} from './domain.js';

export type TrainingGoal = z.infer<typeof TrainingGoalSchema>;
export type PlanExercise = z.infer<typeof ExerciseSchema>;
export type PlanDay = z.infer<typeof PlanDaySchema> & { extraSession?: z.infer<typeof PlanDaySchema> };
export type CustomWorkout = z.infer<typeof CustomWorkoutSchema>;
export type EditableSession = z.infer<typeof SessionSchema>;
export type EditableSessionExercise = EditableSession['exercises'][number];

const copy = <T,>(value: T): T => structuredClone(value);
const pairLabel = (group: string) => /^([a-z])([12])\s*·\s*complex pair$/i.exec(group.trim());

/** Moving, removing or replacing a partner cannot leave a misleading pair label. */
export function clearOrphanedComplexPairs<T extends { group: string }>(exercises: readonly T[]): T[] {
  return exercises.map((exercise, index) => {
    const label = pairLabel(exercise.group);
    if (!label) return exercise;
    const partner = exercises[index + (label[2] === '1' ? 1 : -1)];
    const partnerLabel = partner && pairLabel(partner.group);
    const paired = partnerLabel && partnerLabel[1].toUpperCase() === label[1].toUpperCase()
      && partnerLabel[2] !== label[2];
    return paired ? exercise : { ...exercise, group: 'Training' };
  });
}

function uniqueKey(exercise: PlanExercise): string {
  return `${exercise.key.slice(0, 70)}-${crypto.randomUUID().slice(0, 8)}`;
}
function newLog(exercise: PlanExercise): EditableSessionExercise['logs'][number] {
  return { id: crypto.randomUUID(), kg: exercise.defaultKg ?? null, reps: null, seconds: null, rir: null, done: false };
}

/** A daily addition is an independent snapshot, never a reference into a template. */
export function createSessionExercise(exercise: PlanExercise): EditableSessionExercise {
  const parsed = ExerciseSchema.parse(exercise);
  return {
    ...copy(parsed), key: uniqueKey(parsed), exerciseId: parsed.exerciseId ?? parsed.key,
    logs: Array.from({ length: parsed.sets }, () => newLog(parsed)),
    elapsedMs: 0, runningSince: null,
  };
}
function findExercise(session: EditableSession, key: string): number {
  const index = session.exercises.findIndex((exercise) => exercise.key === key);
  if (index < 0) throw new Error('This exercise is no longer in the workout.');
  return index;
}
function unlinkPair(exercises: EditableSessionExercise[], exercise: EditableSessionExercise) {
  const label = pairLabel(exercise.group);
  if (!label) return exercises;
  return exercises.map((item) => {
    const current = pairLabel(item.group);
    return current && current[1].toUpperCase() === label[1].toUpperCase()
      ? { ...item, group: 'Training' } : item;
  });
}
function recordedOnly(exercise: EditableSessionExercise, now: number): EditableSessionExercise {
  const logs = exercise.logs.filter((log) => log.done);
  return {
    ...exercise, sets: Math.min(20, logs.length), logs,
    elapsedMs: elapsedTime(exercise.elapsedMs, exercise.runningSince, now),
    runningSince: null,
    ...(Object.hasOwn(exercise, 'timerSetId') ? { timerSetId: null } : {}),
  };
}
function updateExercises(session: EditableSession, exercises: EditableSessionExercise[]): EditableSession {
  return { ...session, exercises: clearOrphanedComplexPairs(exercises) };
}

export function addSessionExercise(session: EditableSession, exercise: PlanExercise, afterKey?: string): EditableSession {
  if (session.exercises.length >= 40) throw new Error('A workout can contain up to 40 exercises.');
  const index = afterKey == null ? session.exercises.length : findExercise(session, afterKey) + 1;
  const exercises = [...session.exercises];
  exercises.splice(index, 0, createSessionExercise(exercise));
  return updateExercises(session, exercises);
}
export function removeSessionExercise(session: EditableSession, key: string, now = Date.now()): EditableSession {
  const index = findExercise(session, key);
  const original = session.exercises[index];
  const done = original.logs.filter((log) => log.done).length;
  if (done === original.logs.length) return session;
  const exercises = done > 0
    ? session.exercises.map((exercise, itemIndex) => itemIndex === index ? recordedOnly(original, now) : exercise)
    : session.exercises.filter((_, entryIndex) => entryIndex !== index);
  return updateExercises(session, unlinkPair(exercises, original));
}
export function replaceSessionExercise(session: EditableSession, key: string, replacement: PlanExercise, now = Date.now()): EditableSession {
  const index = findExercise(session, key);
  const original = session.exercises[index];
  const done = original.logs.filter((log) => log.done).length;
  const remaining = original.logs.length - done;
  if (remaining === 0) throw new Error('All sets are recorded. Add another exercise instead.');
  if (done > 0 && session.exercises.length >= 40) throw new Error('Keep recorded sets. This workout already contains 40 exercises.');
  const added = createSessionExercise({ ...replacement, sets: Math.min(20, remaining) });
  // Existing sessions may have up to 30 logs after adding sets mid-workout.
  while (added.logs.length < remaining) added.logs.push(newLog(added));
  const exercises = [...session.exercises];
  exercises.splice(index, 1, ...(done > 0 ? [recordedOnly(original, now), added] : [added]));
  return updateExercises(session, unlinkPair(exercises, original));
}
export function moveSessionExercise(session: EditableSession, key: string, toIndex: number): EditableSession {
  const fromIndex = findExercise(session, key);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= session.exercises.length) throw new Error('Choose a position in this workout.');
  const exercises = [...session.exercises];
  const [exercise] = exercises.splice(fromIndex, 1);
  exercises.splice(toIndex, 0, exercise);
  return updateExercises(session, exercises);
}
export function adjustSessionSets(session: EditableSession, key: string, count: number, now = Date.now()): EditableSession {
  const index = findExercise(session, key);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error('Choose between 1 and 20 sets.');
  const exercise = session.exercises[index];
  if (exercise.logs.slice(count).some((log) => log.done)) throw new Error('Keep recorded sets in your workout to preserve your training history.');
  const logs = exercise.logs.slice(0, count);
  while (logs.length < count) logs.push(newLog(exercise));
  const timerRemoved = exercise.timerSetId != null && !logs.some((log) => log.id === exercise.timerSetId);
  const updated = {
    ...exercise, sets: count, logs,
    ...(timerRemoved ? { timerSetId: null, runningSince: null, elapsedMs: elapsedTime(exercise.elapsedMs, exercise.runningSince, now) } : {}),
  };
  return { ...session, exercises: session.exercises.map((item, itemIndex) => itemIndex === index ? updated : item) };
}

function planIndex(plan: PlanDay, key: string) {
  const index = plan.exercises.findIndex((exercise) => exercise.key === key);
  if (index < 0) throw new Error('This exercise is no longer in the plan.');
  return index;
}
function planWithExercises(plan: PlanDay, exercises: PlanExercise[]): PlanDay {
  return { ...plan, exercises: clearOrphanedComplexPairs(exercises) };
}
export function addPlanExercise(plan: PlanDay, exercise: PlanExercise, afterKey?: string): PlanDay {
  if (plan.exercises.length >= 40) throw new Error('A workout can contain up to 40 exercises.');
  const parsed = ExerciseSchema.parse(exercise);
  const added = { ...copy(parsed), key: uniqueKey(parsed), exerciseId: parsed.exerciseId ?? parsed.key };
  const index = afterKey == null ? plan.exercises.length : planIndex(plan, afterKey) + 1;
  const exercises = [...plan.exercises];
  exercises.splice(index, 0, added);
  return planWithExercises(plan, exercises);
}
export function removePlanExercise(plan: PlanDay, key: string): PlanDay {
  const index = planIndex(plan, key);
  return planWithExercises(plan, plan.exercises.filter((_, itemIndex) => itemIndex !== index));
}
export function replacePlanExercise(plan: PlanDay, key: string, replacement: PlanExercise): PlanDay {
  const index = planIndex(plan, key);
  const parsed = ExerciseSchema.parse(replacement);
  const exercises = [...plan.exercises];
  exercises[index] = { ...copy(parsed), key: uniqueKey(parsed), exerciseId: parsed.exerciseId ?? parsed.key };
  return planWithExercises(plan, exercises);
}
export function movePlanExercise(plan: PlanDay, key: string, toIndex: number): PlanDay {
  const fromIndex = planIndex(plan, key);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= plan.exercises.length) throw new Error('Choose a position in this workout.');
  const exercises = [...plan.exercises];
  const [exercise] = exercises.splice(fromIndex, 1);
  exercises.splice(toIndex, 0, exercise);
  return planWithExercises(plan, exercises);
}

/** Restore recommendations without changing preferences, templates or logged work. */
export function resetRecommendedPlan<T extends { plan: PlanDay[]; volleyballSchedule?: { days: number[]; startTime: string; endTime: string } }>(profile: T): T {
  const schedule = profile.volleyballSchedule ?? DEFAULT_PROFILE.volleyballSchedule;
  const plan = copy(DEFAULT_PROFILE.plan).map((day: PlanDay, index: number) => ({
    ...day,
    ...(day.kind === 'sport' && schedule.days.includes(index)
      ? { note: day.note.replace(/20:00–22:00/g, `${schedule.startTime}–${schedule.endTime}`) }
      : {}),
  }));
  return { ...profile, plan };
}

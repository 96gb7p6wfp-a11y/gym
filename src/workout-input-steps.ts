import { findLibraryExercise } from './exercise-library.ts';

export interface LoadStepExercise {
  key?: string;
  name: string;
  exerciseId?: string;
  equipmentLabel?: string;
  loadIncrementKg?: number;
}

export const LOAD_INCREMENT_OPTIONS = [0.25, 0.5, 1, 1.25, 2, 2.5, 5, 10, 20, 25] as const;

export function validLoadIncrement(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.25 && value <= 25;
}

/** A useful editable starting step, never a claim about a particular machine. */
export function exerciseLoadIncrement(exercise: LoadStepExercise): number {
  if (validLoadIncrement(exercise.loadIncrementKg)) return exercise.loadIncrementKg;
  const movement = findLibraryExercise(exercise);
  const explicit = `${exercise.name} ${exercise.equipmentLabel ?? ''}`;
  const equipment = movement?.equipment.join(' ') ?? '';
  if (/medicine.?ball|med.?ball/i.test(explicit) || /medicine.?ball/i.test(equipment)) return 0.5;
  if (/dumbbell|\bdb\b|cable|kettlebell/i.test(explicit)) return 1;
  if (/barbell|trap.?bar|smith|machine|leg press|hack squat/i.test(explicit)) return 2.5;
  if (/barbell|trap.?bar|smith|machine/i.test(equipment)) return 2.5;
  return 1;
}

/** Preserve quarter-kilo increments and clamp only the deliberate button action. */
export function adjustedWorkoutLoad(current: number | null, direction: -1 | 1, increment: number): number {
  const step = validLoadIncrement(increment) ? increment : 1;
  const value = typeof current === 'number' && Number.isFinite(current) ? current : 0;
  return Math.min(2000, Math.max(0, Math.round((value + direction * step) * 1000) / 1000));
}

export function plannedRepetitions(target: string): number | null {
  if (/sec|min|\bhold\b|\bmetres?\b|\bmeters?\b|\bm\b|\bcm\b/i.test(target)) return null;
  const value = Number(target.match(/\d+/)?.[0]);
  return Number.isInteger(value) && value > 0 && value <= 1000 ? value : null;
}

/** A saved custom prescription is stronger evidence of intent than a generic default. */
export function hasDeliberatePlannedLoad(exercise: { defaultKg?: number | null }, baseline?: { defaultKg?: number | null }, explicit = false): boolean {
  return exercise.defaultKg != null && (explicit || !baseline || exercise.defaultKg !== baseline.defaultKg);
}

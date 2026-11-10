import { findLibraryExercise } from './exercise-library.ts';

/** Configuration shared by session drafts, reuse, charts and progress comparisons. */
export interface PerformanceExerciseReference {
  key: string;
  name: string;
  mode: string;
  measurement?: string;
  exerciseId?: string;
  perSide?: boolean;
  quantityUnit?: string;
  prescribedDistanceM?: number;
  equipmentLabel?: string;
}

/** An absent identity remains unknown; older records never inherit a machine label. */
export function normalizeEquipmentLabel(label?: string): string | null {
  return label?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB') || null;
}

export function exercisePerformanceIdentity(exercise: PerformanceExerciseReference): string {
  const id = exercise.exerciseId ? findLibraryExercise(exercise.exerciseId)?.id ?? exercise.exerciseId : exercise.key;
  let name = exercise.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
  // Only documented factory spelling changes are equivalent. Custom names,
  // incline variants, machine labels and logging configurations stay distinct.
  if (id === 'spike-slam' && ['medicine-ball spike slam', 'medicine ball spike slam', 'two-hand medicine ball overhead slam',
    'two-handed medicine ball overhead slam', 'medicine-ball overhead spike-pattern slam'].includes(name)) name = 'medicine ball spike slam';
  if (id === 'incline-machine-press' && ['incline chest press', 'incline machine press'].includes(name)) name = 'incline machine press';
  return JSON.stringify([id, name,
    exercise.mode, exercise.measurement ?? null, Boolean(exercise.perSide), exercise.quantityUnit ?? null,
    normalizeEquipmentLabel(exercise.equipmentLabel), exercise.prescribedDistanceM ?? null]);
}

export function areComparableExercises(a: PerformanceExerciseReference, b: PerformanceExerciseReference): boolean {
  return exercisePerformanceIdentity(a) === exercisePerformanceIdentity(b);
}

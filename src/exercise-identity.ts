/** Configuration shared by session drafts, reuse, charts and progress comparisons. */
export interface PerformanceExerciseReference {
  key: string;
  name: string;
  mode: string;
  measurement?: string;
  exerciseId?: string;
  perSide?: boolean;
  quantityUnit?: string;
  equipmentLabel?: string;
}

/** An absent identity remains unknown; older records never inherit a machine label. */
export function normalizeEquipmentLabel(label?: string): string | null {
  return label?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB') || null;
}

export function exercisePerformanceIdentity(exercise: PerformanceExerciseReference): string {
  return JSON.stringify([exercise.exerciseId ?? exercise.key, exercise.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB'),
    exercise.mode, exercise.measurement ?? null, Boolean(exercise.perSide), exercise.quantityUnit ?? null,
    normalizeEquipmentLabel(exercise.equipmentLabel)]);
}

export function areComparableExercises(a: PerformanceExerciseReference, b: PerformanceExerciseReference): boolean {
  return exercisePerformanceIdentity(a) === exercisePerformanceIdentity(b);
}

/** Saved logging metadata determines inputs; names never rewrite a prescription. */
export interface ExerciseInputReference {
  mode: 'weight' | 'bodyweight' | 'timed';
  measurement?: 'touch' | 'height' | 'distance';
}
export type ExerciseInputKind = 'duration' | 'measurement' | 'bodyweight' | 'weight';

export function exerciseInputKind(exercise: ExerciseInputReference): ExerciseInputKind {
  if (exercise.mode === 'timed') return 'duration';
  if (exercise.measurement) return 'measurement';
  return exercise.mode === 'bodyweight' ? 'bodyweight' : 'weight';
}

/** Existing additional load must not disappear merely because the layout changes. */
export function hasRecordedLoad(logs: readonly { kg: number | null }[]): boolean {
  return logs.some(log => typeof log.kg === 'number' && Number.isFinite(log.kg) && log.kg > 0);
}

export function measurementInputLabel(exercise: Pick<ExerciseInputReference, 'measurement'>): string {
  return exercise.measurement === 'touch' ? 'Maximum touch' : exercise.measurement === 'height' ? 'Jump height' : exercise.measurement === 'distance' ? 'Distance' : 'Measurement';
}

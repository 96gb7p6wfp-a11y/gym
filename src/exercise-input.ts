/** Saved logging metadata determines inputs; names never rewrite a prescription. */
export interface ExerciseInputReference {
  mode: 'weight' | 'bodyweight' | 'timed';
  measurement?: 'touch' | 'height' | 'distance';
  quantityUnit?: 'm';
}
export type ExerciseInputKind = 'duration' | 'measurement' | 'distance' | 'bodyweight' | 'weight';

export function exerciseInputKind(exercise: ExerciseInputReference): ExerciseInputKind {
  if (exercise.mode === 'timed') return 'duration';
  if (exercise.measurement) return 'measurement';
  if (exercise.mode === 'bodyweight' && exercise.quantityUnit === 'm') return 'distance';
  return exercise.mode === 'bodyweight' ? 'bodyweight' : 'weight';
}

/** Existing additional load must not disappear merely because the layout changes. */
export function hasRecordedLoad(logs: readonly { kg: number | null }[]): boolean {
  return logs.some(log => typeof log.kg === 'number' && Number.isFinite(log.kg) && log.kg > 0);
}

export function measurementInputLabel(exercise: Pick<ExerciseInputReference, 'measurement'>): string {
  return exercise.measurement === 'touch' ? 'Maximum touch' : exercise.measurement === 'height' ? 'Jump height' : exercise.measurement === 'distance' ? 'Distance' : 'Measurement';
}

/** Optional timing must remain unknown rather than becoming a clipped result. */
export function measuredSprintSeconds(raw: string): number | null {
  if (!raw.trim()) return null;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= 86400 ? value : null;
}

/** Short, local workout cues. A logged result never proves technique or a PR. */
export interface CueExercise {
  mode: 'weight' | 'bodyweight' | 'timed';
  category?: string;
  measurement?: 'touch' | 'height' | 'distance';
  quantityUnit?: 'm';
}

export interface CueSet {
  kg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
  measurementCm?: number | null;
}

export function setQualityCue(exercise: CueExercise, easeBack = false): string {
  if (easeBack) return 'Today’s challenge: clean reps, with a little left in reserve.';
  if (exercise.category === 'Mobility' || exercise.category === 'Recovery') {
    return 'Easy range. Steady breathing. No pushing into pain.';
  }
  if (exercise.category === 'Power' || exercise.category === 'Plyometric' || exercise.category === 'Speed' || exercise.measurement) {
    return 'Fast, fresh reps. Stop if height or speed drops.';
  }
  if (exercise.mode === 'timed' || exercise.quantityUnit === 'm') {
    return 'Your challenge: steady breathing, steady position.';
  }
  return 'Your challenge: make the last rep look like the first.';
}

export function completedSetCue({
  exercise, completed, previous, setNumber, totalSets, allDone = false,
  movementDone = false, nextInPair, hasRest = true, easeBack = false, previousMeasurement,
}: {
  exercise: CueExercise;
  completed: CueSet;
  previous?: CueSet;
  previousMeasurement?: CueExercise['measurement'];
  setNumber: number;
  totalSets: number;
  allDone?: boolean;
  movementDone?: boolean;
  nextInPair?: string;
  hasRest?: boolean;
  easeBack?: boolean;
}): string {
  if (allDone) return 'Planned sets logged. Time to recover.';
  if (nextInPair) return hasRest
    ? `Set logged. Take your planned rest, then ${nextInPair}.`
    : `Set logged. Next in your pair: ${nextInPair}.`;
  if (easeBack || (completed.rir != null && completed.rir <= 1)) {
    return 'Set logged. Rest fully; keep the next set controlled.';
  }
  // Compare like-for-like measurements only. No estimated records or claims
  // about effort, technique, readiness or personal bests are inferred.
  if (exercise.measurement && previousMeasurement === exercise.measurement
    && completed.measurementCm != null && previous?.measurementCm != null
    && completed.measurementCm > previous.measurementCm) {
    return exercise.measurement === 'touch'
      ? 'A higher touch logged. Recover before the next jump.'
      : exercise.measurement === 'height'
        ? 'A higher jump logged. Recover before the next jump.'
        : 'More distance logged. Take your planned rest.';
  }
  if (exercise.mode === 'weight' && !exercise.measurement && !exercise.quantityUnit
    && !['Power', 'Plyometric', 'Speed', 'Mobility', 'Recovery'].includes(exercise.category ?? '')
    && previous && completed.kg != null && previous.kg != null
    && completed.reps != null && previous.reps != null) {
    if (completed.kg === previous.kg && completed.reps > previous.reps) {
      return 'More reps at the same load. Take your planned rest.';
    }
    if (completed.kg > previous.kg && completed.reps === previous.reps) {
      return 'More load at the same reps. Take your planned rest.';
    }
  }
  if (movementDone) return 'Movement complete. A fresh start for the next one.';
  return `Set ${setNumber} of ${totalSets} logged. One step at a time.`;
}

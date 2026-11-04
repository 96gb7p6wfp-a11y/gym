export interface SearchableWorkout {
  id: string;
  name: string;
  date: string;
  exercises: readonly { name: string; equipmentLabel?: string }[];
}

const searchable = (value: string) => value.normalize('NFKD').replace(/\p{Diacritic}/gu, '')
  .toLocaleLowerCase('en-GB').replace(/\s+/g, ' ').trim();

/** A transient view index. It never changes the stored workout or its name. */
export function indexWorkoutHistory<Workout extends SearchableWorkout>(workouts: readonly Workout[]) {
  return workouts.map(workout => ({ workout, text: searchable([
    workout.name, workout.date,
    ...workout.exercises.flatMap(exercise => [exercise.name, exercise.equipmentLabel ?? '']),
  ].join(' ')) }));
}

export function filterWorkoutHistory<Workout extends SearchableWorkout>(
  index: readonly { workout: Workout; text: string }[], query: string,
): Workout[] {
  const terms = searchable(query).split(' ').filter(Boolean);
  return index.filter(entry => terms.every(term => entry.text.includes(term))).map(entry => entry.workout);
}

/** Stable ordering: search only narrows the ordering supplied by History. */
export function searchWorkoutHistory<Workout extends SearchableWorkout>(workouts: readonly Workout[], query: string) {
  return filterWorkoutHistory(indexWorkoutHistory(workouts), query);
}

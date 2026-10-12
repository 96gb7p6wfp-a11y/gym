/** Session-shaped inputs keep navigation independent of React and storage. */
export interface TrainingFlowExercise {
  readonly key: string;
  readonly group: string;
  readonly logs: readonly { readonly id: string; readonly done: boolean }[];
}

export interface ComplexPair<T extends TrainingFlowExercise = TrainingFlowExercise> {
  readonly label: string;
  readonly first: T;
  readonly second: T;
  readonly startIndex: number;
}

export interface TrainingStep {
  readonly exerciseKey: string;
  readonly setId: string;
  /** Zero-based index within this movement's logs. */
  readonly setIndex: number;
  /** One-based round, including when the pair has unequal set counts. */
  readonly round: number;
}

function pairLabel(group: string): { label: string; position: string } | null {
  const match = /^([a-z])([12])\s*·\s*complex pair$/i.exec(group.trim());
  return match ? { label: match[1].toUpperCase(), position: match[2] } : null;
}

/** Only adjacent, explicitly labelled A1/A2 (or B1/B2, etc.) form a pair. */
export function findComplexPair<T extends TrainingFlowExercise>(
  exercises: readonly T[], exerciseKey: string,
): ComplexPair<T> | null {
  const selectedIndex = exercises.findIndex((exercise) => exercise.key === exerciseKey);
  if (selectedIndex < 0) return null;
  for (const startIndex of [selectedIndex - 1, selectedIndex]) {
    const first = exercises[startIndex];
    const second = exercises[startIndex + 1];
    if (!first || !second) continue;
    const firstLabel = pairLabel(first.group);
    const secondLabel = pairLabel(second.group);
    if (firstLabel?.position === '1' && secondLabel?.position === '2'
      && firstLabel.label === secondLabel.label) {
      return { label: firstLabel.label, first, second, startIndex };
    }
  }
  return null;
}

function step(exercise: TrainingFlowExercise, setIndex: number): TrainingStep {
  return { exerciseKey: exercise.key, setId: exercise.logs[setIndex].id, setIndex, round: setIndex + 1 };
}

function unfinished(exercise: TrainingFlowExercise): TrainingStep | null {
  const setIndex = exercise.logs.findIndex((log) => !log.done);
  return setIndex < 0 ? null : step(exercise, setIndex);
}

function pairSteps(pair: ComplexPair): TrainingStep[] {
  const steps: TrainingStep[] = [];
  const rounds = Math.max(pair.first.logs.length, pair.second.logs.length);
  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    for (const exercise of [pair.first, pair.second]) {
      if (exercise.logs[roundIndex]) steps.push(step(exercise, roundIndex));
    }
  }
  return steps;
}

function isUnfinishedPairStep(pair: ComplexPair, entry: TrainingStep): boolean {
  const exercise = entry.exerciseKey === pair.first.key ? pair.first : pair.second;
  return !exercise.logs[entry.setIndex].done;
}

/**
 * Resume the earliest unfinished round. Selecting either paired movement focuses
 * the same pair; an optional preferred key otherwise starts there, then wraps.
 */
export function firstUnfinishedStep(
  exercises: readonly TrainingFlowExercise[], preferredExerciseKey?: string,
): TrainingStep | null {
  const preferredIndex = exercises.findIndex((exercise) => exercise.key === preferredExerciseKey);
  const startIndex = preferredIndex < 0 ? 0 : preferredIndex;
  const visitedPairs = new Set<number>();
  for (let offset = 0; offset < exercises.length; offset += 1) {
    const exercise = exercises[(startIndex + offset) % exercises.length];
    const pair = findComplexPair(exercises, exercise.key);
    if (pair) {
      if (visitedPairs.has(pair.startIndex)) continue;
      visitedPairs.add(pair.startIndex);
      const next = pairSteps(pair).find((entry) => isUnfinishedPairStep(pair, entry));
      if (next) return next;
    } else {
      const next = unfinished(exercise);
      if (next) return next;
    }
  }
  return null;
}

/**
 * Advance only once the existing session mutation confirms completion. Paired
 * sets alternate by round; manually selected later rounds wrap to any earlier
 * unfinished pair sets before leaving the pair. Ordinary movements retain their
 * original set-first ordering. No log or prescribed rest duration is changed.
 */
export function nextStepAfterCompletion(
  exercises: readonly TrainingFlowExercise[], completedExerciseKey: string, completedSetId: string,
): TrainingStep | null {
  const exerciseIndex = exercises.findIndex((exercise) => exercise.key === completedExerciseKey);
  const current = exercises[exerciseIndex];
  if (!current?.logs.find((log) => log.id === completedSetId)?.done) return null;

  const pair = findComplexPair(exercises, current.key);
  let nextExerciseIndex = exerciseIndex + 1;
  if (pair) {
    const steps = pairSteps(pair);
    const completedIndex = steps.findIndex((entry) => entry.exerciseKey === current.key && entry.setId === completedSetId);
    const remaining = [...steps.slice(completedIndex + 1), ...steps.slice(0, completedIndex)];
    const next = remaining.find((entry) => isUnfinishedPairStep(pair, entry));
    if (next) return next;
    nextExerciseIndex = pair.startIndex + 2;
  } else {
    const next = unfinished(current);
    if (next) return next;
  }

  return firstUnfinishedStep(exercises, exercises[nextExerciseIndex % exercises.length]?.key);
}

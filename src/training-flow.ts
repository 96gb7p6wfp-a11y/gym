/** Session-shaped inputs keep navigation independent of React and storage. */
export interface TrainingFlowExercise {
  readonly key: string;
  readonly group: string;
  readonly logs: readonly { readonly id: string; readonly done: boolean }[];
  readonly rest?: number;
  readonly superset?: SupersetLink;
}

export interface SupersetLink {
  readonly id: string;
  readonly label: string;
  readonly order: 1 | 2;
  readonly rounds?: number;
  readonly restAfterRound: number;
}

export interface ComplexPair<T extends TrainingFlowExercise = TrainingFlowExercise> {
  readonly label: string;
  readonly first: T;
  readonly second: T;
  readonly startIndex: number;
}

export interface TrainingPair<T extends TrainingFlowExercise = TrainingFlowExercise> extends ComplexPair<T> {
  readonly kind: 'complex' | 'superset';
  readonly endIndex: number;
  readonly pairedRounds: number;
  readonly restAfterRound?: number;
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

/** Explicit metadata allows display order and prescribed pair order to differ. */
export function findTrainingPair<T extends TrainingFlowExercise>(exercises: readonly T[], exerciseKey: string): TrainingPair<T> | null {
  const index = exercises.findIndex(exercise => exercise.key === exerciseKey);
  const selected = exercises[index];
  if (!selected) return null;
  if (selected.superset) {
    const members = exercises.map((exercise, position) => ({ exercise, position }))
      .filter(({ exercise }) => exercise.superset?.id === selected.superset!.id);
    if (members.length !== 2 || Math.abs(members[0].position - members[1].position) !== 1) return null;
    const first = members.find(({ exercise }) => exercise.superset?.order === 1);
    const second = members.find(({ exercise }) => exercise.superset?.order === 2);
    if (!first || !second || first.exercise.superset!.label !== second.exercise.superset!.label
      || first.exercise.superset!.rounds !== second.exercise.superset!.rounds
      || first.exercise.superset!.restAfterRound !== second.exercise.superset!.restAfterRound) return null;
    const available = Math.min(first.exercise.logs.length, second.exercise.logs.length);
    return { kind: 'superset', label: selected.superset.label, first: first.exercise, second: second.exercise,
      startIndex: Math.min(first.position, second.position), endIndex: Math.max(first.position, second.position),
      pairedRounds: Math.min(available, selected.superset.rounds ?? available), restAfterRound: selected.superset.restAfterRound };
  }
  const complex = findComplexPair(exercises, exerciseKey);
  return complex ? { ...complex, kind: 'complex', endIndex: complex.startIndex + 1,
    pairedRounds: Math.max(complex.first.logs.length, complex.second.logs.length) } : null;
}

function step(exercise: TrainingFlowExercise, setIndex: number): TrainingStep {
  return { exerciseKey: exercise.key, setId: exercise.logs[setIndex].id, setIndex, round: setIndex + 1 };
}

function unfinished(exercise: TrainingFlowExercise): TrainingStep | null {
  const setIndex = exercise.logs.findIndex((log) => !log.done);
  return setIndex < 0 ? null : step(exercise, setIndex);
}

function pairSteps(pair: TrainingPair): TrainingStep[] {
  const steps: TrainingStep[] = [];
  const rounds = pair.pairedRounds;
  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    for (const exercise of [pair.first, pair.second]) {
      if (exercise.logs[roundIndex]) steps.push(step(exercise, roundIndex));
    }
  }
  // Prescribed extra sets are standalone work after all complete paired rounds.
  if (pair.kind === 'superset') for (const exercise of [pair.first, pair.second]) {
    for (let index = rounds; index < exercise.logs.length; index++) steps.push(step(exercise, index));
  }
  return steps;
}

function isUnfinishedPairStep(pair: TrainingPair, entry: TrainingStep): boolean {
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
    const pair = findTrainingPair(exercises, exercise.key);
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

  const pair = findTrainingPair(exercises, current.key);
  let nextExerciseIndex = exerciseIndex + 1;
  if (pair) {
    const steps = pairSteps(pair);
    const completedIndex = steps.findIndex((entry) => entry.exerciseKey === current.key && entry.setId === completedSetId);
    const remaining = [...steps.slice(completedIndex + 1), ...steps.slice(0, completedIndex)];
    const next = remaining.find((entry) => isUnfinishedPairStep(pair, entry));
    if (next) return next;
    nextExerciseIndex = pair.endIndex + 1;
  } else {
    const next = unfinished(current);
    if (next) return next;
  }

  return firstUnfinishedStep(exercises, exercises[nextExerciseIndex % exercises.length]?.key);
}

/** A superset transition has no countdown; full-pair and standalone rests remain adjustable. */
export function restAfterCompletedSet(exercises: readonly TrainingFlowExercise[], exerciseKey: string, setId: string): number {
  const current = exercises.find(exercise => exercise.key === exerciseKey);
  const setIndex = current?.logs.findIndex(log => log.id === setId) ?? -1;
  if (!current || setIndex < 0 || !current.logs[setIndex].done) return 0;
  const pair = findTrainingPair(exercises, exerciseKey);
  if (!pair || pair.kind !== 'superset' || setIndex >= pair.pairedRounds) return current.rest ?? 0;
  const partner = current.key === pair.first.key ? pair.second : pair.first;
  if (!partner.logs[setIndex].done) return 0;
  return pair.restAfterRound ?? current.rest ?? 0;
}

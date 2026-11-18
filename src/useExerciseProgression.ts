import { useMemo } from 'react';
import {
  getProgressionRecommendation,
  type ProgressionContext,
  type ProgressionExercise,
  type ProgressionRecommendation,
} from './performance-insights.ts';
import { exerciseLoadIncrement } from './workout-input-steps.ts';
import type { ReportSession } from './weekly-report.ts';

const EMPTY_HISTORY: readonly ReportSession[] = Object.freeze([]);

/** Only prescribed configuration belongs in this key, never current set inputs. */
export function progressionConfigurationKey(exercise: ProgressionExercise | undefined): string {
  if (!exercise) return '';
  const configuration = {
    key: exercise.key, name: exercise.name, group: exercise.group, target: exercise.target,
    mode: exercise.mode, measurement: exercise.measurement, quantityUnit: exercise.quantityUnit,
    targetRpe: exercise.targetRpe, perSide: exercise.perSide, exerciseId: exercise.exerciseId,
    equipmentLabel: exercise.equipmentLabel, preparationOnly: exercise.preparationOnly,
    sets: exercise.sets, targetRir: exercise.targetRir, prescribedDistanceM: exercise.prescribedDistanceM,
    loadIncrementKg: exercise.loadIncrementKg,
  } satisfies Record<keyof ProgressionExercise, unknown>;
  return JSON.stringify(configuration);
}

export function progressionContextKey(context: ProgressionContext): string {
  const configuration = {
    volleyballWithin24Hours: context.volleyballWithin24Hours,
    loadIncrementKg: context.loadIncrementKg,
    lowFatigueSession: context.lowFatigueSession,
    readinessLevel: context.readinessLevel,
    readiness: context.readiness ? { energy: context.readiness.energy, soreness: context.readiness.soreness } : undefined,
  } satisfies Record<keyof ProgressionContext, unknown>;
  return JSON.stringify(configuration);
}

export function useExerciseProgression(exercise: ProgressionExercise, sessions: readonly ReportSession[] | undefined,
  date: string, context?: ProgressionContext): ProgressionRecommendation;
export function useExerciseProgression(exercise: ProgressionExercise | undefined, sessions: readonly ReportSession[] | undefined,
  date: string, context?: ProgressionContext): ProgressionRecommendation | null;
export function useExerciseProgression(exercise: ProgressionExercise | undefined, sessions: readonly ReportSession[] | undefined,
  date: string, context: ProgressionContext = {}): ProgressionRecommendation | null {
  const history = sessions ?? EMPTY_HISTORY;
  const effectiveContext: ProgressionContext = { ...context,
    ...(exercise ? { loadIncrementKg: exerciseLoadIncrement(exercise) } : {}),
    ...(exercise?.preparationOnly ? { lowFatigueSession: true } : {}),
  };
  const configurationKey = progressionConfigurationKey(exercise);
  const contextKey = progressionContextKey(effectiveContext);
  // The parent supplies immutable completed history. Current kg/reps/done edits
  // cannot change this historical recommendation or trigger another full scan.
  return useMemo(() => exercise ? getProgressionRecommendation(exercise, history, date, effectiveContext) : null,
    [configurationKey, contextKey, history, date]);
}

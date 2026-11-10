import type { MasterProgramSettings, MasterReadiness } from './volleyball-master-plan.ts';
import { CoachDateSchema } from './coach-schedule.ts';
import type { PlanDay } from './workout-customization';
import { findLibraryExercise } from './exercise-library.ts';

export type PreWorkoutFeeling = 'normal' | 'tired' | 'poor';
export const preWorkoutReadinessStatus = (feeling: PreWorkoutFeeling): MasterReadiness =>
  feeling === 'normal' ? 'green' : feeling === 'tired' ? 'yellow' : 'red';

/** A proposed response is pure until the explicit Start/Quick warm-up action.
 * The caller persists it only for today's date. Other dates can be previewed or
 * deliberately logged without rewriting the conditions recorded for that date.
 * Medical guidance and every unrelated setting are retained as supplied.
 */
export function withPreWorkoutReadiness<Profile extends { masterProgram?: MasterProgramSettings }>(
  profile: Profile, date: string, feeling: PreWorkoutFeeling,
): Profile {
  CoachDateSchema.parse(date);
  const settings = profile.masterProgram;
  if (!settings || date < settings.startDate) return profile;
  if (settings.revision === '9') {
    if (settings.dailyReadiness?.find(row => row.date === date)?.feeling === feeling) return profile;
    return { ...profile, masterProgram: { ...settings,
      dailyReadiness: [...(settings.dailyReadiness ?? []).filter(row => row.date !== date), { date, feeling }],
    } };
  }
  const status = preWorkoutReadinessStatus(feeling);
  if (settings.readiness?.find(row => row.date === date)?.status === status) return profile;
  return { ...profile, masterProgram: { ...settings,
    readiness: [...(settings.readiness ?? []).filter(row => row.date !== date), { date, status }],
  } };
}

/** New preflight safety applies to all plans, including older generic upper
 * sessions whose historical Red rule only supplied a note. It never edits the
 * saved week. Existing program resolvers handle their own Tired reductions.
 */
export function preWorkoutRecovery(plan: PlanDay): PlanDay {
  if (plan.kind === 'recovery') return plan;
  return { ...plan, name: 'Recovery — Comfortable Movement', kind: 'recovery', goal: 'recovery',
    minutes: 15, durationRange: '10–20 min · optional', exercises: [], warmup: [], cooldown: [],
    note: 'You chose recovery before starting. Comfortable movement or full rest is valid. Stop painful or unstable activity; seek assessment for concerning, persistent or worsening symptoms. No catch-up training is required.',
  };
}

export function reduceUnprogrammedWorkout(plan: PlanDay): PlanDay {
  if (plan.kind !== 'strength') return plan;
  const explosive = (exercise: PlanDay['exercises'][number]) => ['Power', 'Plyometric', 'Speed'].includes(findLibraryExercise(exercise)?.category ?? '')
    || /\b(?:jumps?|hops?|pogo|throws?|slams?|sprints?|agility|shuffle|reaction|bounds?)\b/i.test(exercise.name);
  const exercises = plan.exercises.filter(exercise => !explosive(exercise)).map(exercise => {
    const { superset: _pair, ...unpaired } = exercise;
    return { ...unpaired, sets: exercise.mode === 'weight' && exercise.sets >= 3 ? exercise.sets - 1 : exercise.sets,
      targetRpe: Math.min(exercise.targetRpe ?? 7, 7), targetRir: Math.max(exercise.targetRir ?? 3, 3) };
  });
  if (!exercises.length) return preWorkoutRecovery(plan);
  const originalSets = plan.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const remainingSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const minutes = Math.max(10, Math.round(plan.minutes * remainingSets / Math.max(1, originalSets) / 5) * 5);
  return { ...plan, name: `Lighter — ${plan.name}`.slice(0, 80), exercises, minutes,
    durationRange: `About ${minutes} min · estimate`,
    warmup: plan.warmup?.filter(step => !/jump|pogo|throw|sprint/i.test(step.name)),
    note: `You chose lighter training: explosive work omitted and one set removed from longer weighted exercises. Keep comfortable controlled movement with more reserve. ${plan.note}`.slice(0, 500) };
}

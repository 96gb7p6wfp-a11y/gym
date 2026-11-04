import { z } from 'zod';
import { findLibraryExercise } from './exercise-library.ts';
import type { PlanDay, PlanExercise } from './workout-customization';

export const TrainingPreferencesSchema = z.object({
  goal: z.enum(['muscle', 'strength', 'fitness', 'performance', 'own']),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  daysPerWeek: z.number().int().min(1).max(6),
  location: z.enum(['gym', 'home']),
  equipment: z.array(z.enum(['bodyweight', 'dumbbells', 'bands', 'machines', 'barbell']))
    .min(1).max(5).refine(values => new Set(values).size === values.length, 'Choose each equipment type once.'),
  sport: z.string().trim().min(1).max(40).optional(),
});
export const OnboardingStateSchema = z.object({ version: z.literal(16), status: z.enum(['pending', 'completed', 'skipped']) });
export type TrainingPreferences = z.infer<typeof TrainingPreferencesSchema>;
export type PresentationMode = 'simple' | 'athlete';
export const DEFAULT_TRAINING_PREFERENCES: Readonly<TrainingPreferences> = Object.freeze<TrainingPreferences>({
  goal: 'fitness', experience: 'beginner', daysPerWeek: 3, location: 'gym', equipment: ['bodyweight', 'machines'],
});

/** Missing V16 preferences identify the established presentation, never a new installation. */
export function presentationMode(profile: unknown): PresentationMode {
  return typeof profile === 'object' && profile !== null && 'presentationMode' in profile
    && profile.presentationMode === 'simple' ? 'simple' : 'athlete';
}

function emptyPlan(): PlanDay[] {
  return Array.from({ length: 7 }, () => ({ name: 'Choose your workout', kind: 'strength' as const,
    minutes: 30, note: 'Create your own workout, or choose a starting plan in Training preferences.', exercises: [], warmup: [], cooldown: [] }));
}

/** Only used when the device has no existing Setline data. No athlete details are inferred. */
export function createNewProfile() {
  return { plan: emptyPlan(), bodyWeight: null, restSeconds: 90,
    presentationMode: 'simple' as const, onboarding: { version: 16 as const, status: 'pending' as const } };
}

function movement(name: string, key: string, preferences: TrainingPreferences, extra: Partial<PlanExercise> = {}): PlanExercise {
  const item = findLibraryExercise(name);
  if (!item) throw new Error(`Starting exercise unavailable: ${name}`);
  return { key, exerciseId: item.id, name: item.name, group: item.muscles[0],
    sets: preferences.experience === 'beginner' ? 2 : 3,
    target: item.mode === 'timed' ? '20–30 sec' : '8–12 reps', mode: item.mode,
    rest: 90, perSide: item.perSide, cue: `${item.cues.join(' ')} Start with an easy effort and stop while you could still perform a few clean reps.`, ...extra };
}

const trainingDays: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

/** A modest starting template, never a silent replacement for an existing plan. */
export function createStarterPlan(input: TrainingPreferences): PlanDay[] {
  const preferences = TrainingPreferencesSchema.parse(input);
  if (preferences.goal === 'own') return emptyPlan();
  const equipment = new Set(preferences.equipment);
  const machine = equipment.has('machines');
  const dumbbells = equipment.has('dumbbells');
  const barbell = equipment.has('barbell') && preferences.experience !== 'beginner';
  const squat = machine ? 'Leg Press' : dumbbells ? 'Goblet Squat' : 'Bodyweight Squat';
  const hinge = dumbbells ? 'Dumbbell Romanian Deadlift' : barbell ? 'Romanian Deadlift' : 'Glute Bridge';
  const push = machine ? 'Machine Chest Press' : 'Push-up';
  const pull = machine ? 'Seated Cable Row' : dumbbells ? 'One-arm Dumbbell Row' : equipment.has('bands') ? 'Band Pull-apart' : 'Wall Slide';
  const strengthDays = preferences.experience === 'beginner' ? Math.min(3, preferences.daysPerWeek) : preferences.daysPerWeek;
  const chosenDays = trainingDays[strengthDays];
  const extraDays = preferences.experience === 'beginner' ? [1, 3, 5].slice(0, Math.max(0, preferences.daysPerWeek - 3)) : [];
  let workout = 0;
  return Array.from({ length: 7 }, (_, day): PlanDay => {
    if (!chosenDays.includes(day)) return { name: extraDays.includes(day) ? 'Easy movement' : 'Rest & recover', kind: 'recovery',
      goal: 'recovery', minutes: 20, note: 'Rest is part of training. An easy walk or comfortable mobility is optional.', exercises: [], warmup: [], cooldown: [] };
    workout++;
    const fullBody = strengthDays <= 3;
    const lower = workout % 2 === 0;
    const names = fullBody ? [squat, push, pull, hinge, 'Dead Bug'] : lower ? [squat, hinge, 'Dead Bug'] : [push, pull, 'Dead Bug'];
    const exercises = names.map((name, index) => movement(name, `starter-${day}-${index}`, preferences,
      name === 'Wall Slide' || name === 'Band Pull-apart' ? { mode: 'bodyweight', cue: name === 'Wall Slide'
        ? 'Slide your arms through a comfortable range against a wall. Add a band or dumbbells for a pulling exercise when available.'
        : 'Use a light band. Record the same band setup for comparisons.' }
        : name === 'Push-up' ? { cue: 'Keep your body in a straight line. Use a wall or stable support if floor push-ups are too demanding. Stop while you can still perform clean reps.' } : {}));
    return { name: `${fullBody ? 'Full body' : lower ? 'Lower body' : 'Upper body'} ${fullBody ? workout : Math.ceil(workout / 2)}`,
      kind: 'strength', goal: preferences.goal === 'muscle' ? 'hypertrophy' : preferences.goal === 'strength' ? 'strength' : 'capacity',
      minutes: preferences.experience === 'beginner' ? 35 : 45,
      note: preferences.experience === 'beginner' && preferences.daysPerWeek > 3
        ? 'Start with three strength sessions. Your extra chosen days are easy movement; build up as you become comfortable.'
        : 'A starting point you can edit. Begin comfortably, rest between sets and adjust exercises to your setup.',
      exercises, warmup: [{ key: `starter-warmup-${day}`, name: 'Easy movement & practice', target: '5 min',
        cue: 'Walk or move gently, then rehearse the first exercise with an easy effort.', done: false }],
      cooldown: [{ key: `starter-cooldown-${day}`, name: 'Easy walk', target: '2–3 min', cue: 'Let your breathing settle.', done: false }] };
  });
}

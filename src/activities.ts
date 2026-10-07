import { z } from 'zod';

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Extra activities are dated logs, separate from the recurring training plan. */
export const ExtraActivitySchema = z.object({
  id: z.string().min(1).max(100),
  date: z.string().refine(isCalendarDate, 'Choose a valid calendar date.'),
  type: z.enum(['run', 'cycle', 'walk', 'swim', 'other']),
  name: z.string().trim().min(1).max(100),
  durationMinutes: z.number().finite().min(1).max(600),
  distanceKm: z.number().finite().positive().max(300).nullable(),
  intensity: z.enum(['easy', 'moderate', 'hard']),
  bodyWeightKg: z.number().finite().min(20).max(400),
  watchCalories: z.number().finite().min(0).max(20_000).nullable(),
  notes: z.string().max(1_000),
  createdAt: z.number().finite().positive(),
  deletedAt: z.number().finite().positive().nullable(),
});

export type ExtraActivity = z.infer<typeof ExtraActivitySchema>;
export type ActivityRecord = { activity: ExtraActivity; version: number };

export const ACTIVITY_TYPES: ReadonlyArray<{ value: ExtraActivity['type']; label: string }> = [
  { value: 'run', label: 'Running' },
  { value: 'cycle', label: 'Cycling' },
  { value: 'walk', label: 'Walking' },
  { value: 'swim', label: 'Swimming' },
  { value: 'other', label: 'Other activity' },
];

const MET_BY_EFFORT: Record<ExtraActivity['type'], Record<ExtraActivity['intensity'], number>> = {
  run: { easy: 6, moderate: 8.3, hard: 11 },
  cycle: { easy: 4, moderate: 6.8, hard: 10 },
  walk: { easy: 2.8, moderate: 3.8, hard: 4.8 },
  swim: { easy: 5.8, moderate: 8, hard: 9.8 },
  other: { easy: 3, moderate: 5, hard: 8 },
};

export interface ActivityEstimate {
  calories: number;
  method: string;
  met: number | null;
  source: string;
}

/**
 * Estimate energy above resting expenditure, as the workout log does.
 * Weight is stored on the activity so later profile changes cannot rewrite its estimate.
 * This number does not change nutrition targets or imply an automatic calorie allowance.
 */
export function estimateActivity(activity: ExtraActivity): ActivityEstimate {
  if (activity.watchCalories !== null) {
    return {
      calories: activity.watchCalories,
      method: 'Watch-reported active calories. Use the active-energy value, rather than total calories.',
      met: null,
      source: 'Your manually entered watch reading.',
    };
  }

  if (activity.type === 'run' && activity.distanceKm !== null) {
    return {
      calories: Math.round(activity.bodyWeightKg * activity.distanceKm),
      method: 'Approximate active energy for level, continuous running: 1 kcal × body weight (kg) × distance (km). Hills, terrain and running economy can change the result.',
      met: null,
      source: 'ACSM level-running metabolic equation: the horizontal running cost corresponds to approximately 1 kcal/kg/km above rest.',
    };
  }

  const met = MET_BY_EFFORT[activity.type][activity.intensity];
  return {
    calories: Math.round((met - 1) * 3.5 * activity.bodyWeightKg / 200 * activity.durationMinutes),
    method: `Approximate active energy: (${met} MET − 1 resting MET) × 3.5 × body weight (kg) ÷ 200 × minutes. Effort, terrain and technique can change the result${activity.type === 'other' ? '; other activities use a broad effort assumption' : ''}.`,
    met,
    source: 'Compendium of Physical Activities: activity and effort-based MET assumptions. https://pacompendium.com/',
  };
}

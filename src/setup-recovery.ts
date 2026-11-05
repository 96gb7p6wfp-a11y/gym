import type { z } from 'zod';
import { ProfileSchema } from './domain.js';
import { MasterProgramSettingsSchema } from './volleyball-master-plan.ts';
import { effectiveTrainingGuidance, type TrainingGuidanceProfile } from './training-guidance.ts';

export type SetupRecoveryScope = 'settings' | 'training';
type Profile = z.infer<typeof ProfileSchema>;
type ProfileField = keyof Profile;

const settingsFields = ['bodyWeight', 'restSeconds', 'nutrition', 'volleyballSchedule',
  'appearance', 'presentationMode', 'trainingPreferences', 'timerSoundEnabled', 'timerSoundVolume'] as const;
const trainingFields = ['plan', 'masterProgram', 'masterMatchWeekend', 'preMasterPlan'] as const;
const fieldLabels: Record<string, string> = {
  bodyWeight: 'Body weight', restSeconds: 'Default rest', nutrition: 'Personal nutrition inputs',
  volleyballSchedule: 'Volleyball schedule', appearance: 'Appearance', presentationMode: 'Presentation',
  trainingPreferences: 'Goals, experience & equipment', timerSoundEnabled: 'Rest sound', timerSoundVolume: 'Rest volume',
  plan: 'Weekly plan', masterProgram: 'Program, cycle & match weeks', masterMatchWeekend: 'Match-week weekend',
  preMasterPlan: 'Saved pre-program week',
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Restore only the chosen part of a reviewed backup; missing older settings are not defaults. */
export function recoverSetupProfile(current: unknown, backup: unknown, scope: SetupRecoveryScope): Profile {
  if (scope !== 'settings' && scope !== 'training') throw new Error('Choose settings or training recovery.');
  if (!object(current)) throw new Error('The current profile cannot be read. Export a recovery copy before using full backup restore.');
  const incoming = ProfileSchema.parse(backup);
  const result: Record<string, unknown> = structuredClone(current);
  if (scope === 'settings') {
    // An older backup cannot express new optional settings. Keep those current values.
    for (const field of settingsFields) if (Object.hasOwn(incoming, field)) result[field] = structuredClone(incoming[field]);
  } else {
    const rawGuidance = Object.hasOwn(current, 'trainingGuidance') && current.trainingGuidance !== undefined
      ? current.trainingGuidance : effectiveTrainingGuidance(current as TrainingGuidanceProfile);
    const guidance = MasterProgramSettingsSchema.shape.clearance.safeParse(rawGuidance);
    if (!guidance.success) throw new Error('Current impact and lifting guidance cannot be verified. Export a recovery copy and review that guidance before recovering a plan.');
    for (const field of trainingFields) {
      delete result[field];
      if (Object.hasOwn(incoming, field)) result[field] = structuredClone(incoming[field]);
    }
    if (incoming.masterProgram) {
      const { clearance: _backupGuidance, ...program } = incoming.masterProgram;
      result.masterProgram = { ...program, ...(guidance.data ? { clearance: structuredClone(guidance.data) } : {}) };
    }
    if (guidance.data) result.trainingGuidance = structuredClone(guidance.data);
    // Current date edits, templates and version archive are separate user data.
    // They remain available and explicit date edits may override this recovered week.
  }
  const parsed = ProfileSchema.safeParse(result);
  if (!parsed.success) throw new Error('The untouched part of your current profile is invalid. No settings or records were changed. Export a recovery copy and use a compatible full backup.');
  return parsed.data;
}

export interface SetupRecoveryChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

function valueSummary(field: ProfileField, value: unknown): string {
  if (value === undefined) return 'Not set';
  if (value === null) return 'Not recorded';
  if (field === 'bodyWeight') return `${value} kg`;
  if (field === 'restSeconds') return `${value} seconds`;
  if (field === 'timerSoundEnabled') return value ? 'On' : 'Off';
  if (field === 'timerSoundVolume' && typeof value === 'number') return `${Math.round(value * 100)}%`;
  if (field === 'masterProgram' && object(value)) return `${typeof value.revision === 'string' ? `V${value.revision}` : 'Legacy program'} · starts ${String(value.startDate)} · match weeks ${Array.isArray(value.matchWeeks) && value.matchWeeks.length ? value.matchWeeks.join(', ') : 'none'}`;
  if (Array.isArray(value)) return value.map((day, index) => object(day) ? `${index + 1}. ${String(day.name)} (${Array.isArray(day.exercises) ? day.exercises.length : '?'} exercises)` : String(day)).join('; ');
  if (object(value) && field === 'volleyballSchedule') return `${Array.isArray(value.days) ? value.days.map(day => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][Number(day)]).join(', ') : '?'} · ${String(value.startTime)}–${String(value.endTime)}`;
  if (object(value) && field === 'nutrition') return `${String(value.age)} years · ${String(value.heightCm)} cm · ${String(value.sex)} · activity ${String(value.activityFactor)} · surplus ${String(value.surplusKcal)} kcal`;
  if (object(value) && field === 'trainingPreferences') return `${String(value.goal)} · ${String(value.experience)} · ${String(value.daysPerWeek)} days/week · ${String(value.location)} · ${Array.isArray(value.equipment) ? value.equipment.join(', ') : ''}${value.sport ? ` · ${String(value.sport)}` : ''}`;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : 'Saved configuration';
}

export function setupRecoveryChanges(current: unknown, recovered: Profile, scope: SetupRecoveryScope): SetupRecoveryChange[] {
  if (!object(current)) return [];
  const fields = scope === 'settings' ? settingsFields : trainingFields;
  return fields.filter(field => JSON.stringify(current[field]) !== JSON.stringify(recovered[field]))
    .map(field => ({ field, label: fieldLabels[field], before: valueSummary(field, current[field]), after: valueSummary(field, recovered[field]) }));
}

export function recoveredPlanDetails(profile: Profile) {
  return profile.plan.map((day, index) => ({ day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index],
    name: day.name, exercises: day.exercises.map(exercise => ({ name: exercise.name,
      dose: `${exercise.sets} × ${exercise.target}${exercise.perSide ? ' per side' : ''} · ${exercise.rest} sec rest${exercise.equipmentLabel ? ` · ${exercise.equipmentLabel}` : ''}` })) }));
}

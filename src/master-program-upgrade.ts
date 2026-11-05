import type { z } from 'zod';
import { ProfileSchema } from './domain.js';
import { createRecommendedMasterPlan, createVolleyballMasterPlan } from './volleyball-master-plan.ts';
import { effectiveTrainingGuidance } from './training-guidance.ts';
import type { PlanDay, PlanExercise } from './workout-customization';

type Profile = z.infer<typeof ProfileSchema>;
type Draft = NonNullable<Profile['sessionDrafts']>[number];

export interface MasterProgramUpgradeOptions {
  /** Ambiguous edits block the upgrade until the athlete reviews replacement. */
  weeklyCustomizationPolicy?: 'preserve' | 'recommendations';
}
export interface ProgramCustomizationReview {
  day: number;
  variant: 'regular' | 'match';
  dayName: string;
  message: string;
  exercise?: string;
  fields?: string[];
}
export interface MasterProgramUpgradeReview {
  preserved: ProgramCustomizationReview[];
  needsReview: ProgramCustomizationReview[];
}
const compatibleFields = new Set(['equipmentLabel', 'defaultKg', 'sets', 'target', 'rest', 'targetRpe', 'cue', 'benefit', 'optionalWork']);
const encoded = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);

function sameMovementConfiguration(a: PlanExercise, b: PlanExercise): boolean {
  return a.mode === b.mode && a.measurement === b.measurement && Boolean(a.perSide) === Boolean(b.perSide)
    && a.quantityUnit === b.quantityUnit && (a.exerciseId && b.exerciseId
      ? a.exerciseId === b.exerciseId : a.name.toLocaleLowerCase('en-GB') === b.name.toLocaleLowerCase('en-GB'));
}

/** Three-way comparison distinguishes user edits from changed recommendations. */
function migrateDay(actual: PlanDay, baseline: PlanDay, recommendation: PlanDay, day: number,
  variant: ProgramCustomizationReview['variant'], policy: MasterProgramUpgradeOptions['weeklyCustomizationPolicy'], review: MasterProgramUpgradeReview,
  targetWeek: PlanDay[]): PlanDay {
  if (encoded(actual) === encoded(baseline)) return recommendation;
  let ambiguous = false;
  for (const key of new Set([...Object.keys(actual), ...Object.keys(baseline)])) {
    if (key !== 'exercises' && encoded(actual[key as keyof PlanDay]) !== encoded(baseline[key as keyof PlanDay])) ambiguous = true;
  }
  if (encoded(actual.exercises.map(exercise => exercise.key)) !== encoded(baseline.exercises.map(exercise => exercise.key))) ambiguous = true;
  // These recommendations are new factory-owned objects. A compatible movement
  // can move to a different day (for example Sunday calf work to Saturday)
  // without losing the athlete's equipment or planned-load configuration.
  const next = recommendation;
  for (const exercise of actual.exercises) {
    const original = baseline.exercises.find(item => item.key === exercise.key);
    if (!original) { ambiguous = true; continue; }
    const fields = [...new Set([...Object.keys(exercise), ...Object.keys(original)])]
      .filter(key => encoded(exercise[key as keyof PlanExercise]) !== encoded(original[key as keyof PlanExercise]));
    if (!fields.length) continue;
    const localTarget = next.exercises.find(item => item.key === exercise.key);
    const candidates = targetWeek.flatMap(item => item.exercises).filter(item => item.key === exercise.key
      && sameMovementConfiguration(exercise, item));
    const target = localTarget && sameMovementConfiguration(exercise, localTarget) ? localTarget
      : candidates.length === 1 ? candidates[0] : undefined;
    const portable = target && sameMovementConfiguration(original, exercise) && sameMovementConfiguration(exercise, target);
    const safeFields = portable ? fields.filter(key => compatibleFields.has(key)) : [];
    if (safeFields.length && target) {
      // Own-property absence is meaningful: a user can remove an old default.
      for (const field of safeFields) {
        if (Object.hasOwn(exercise, field)) Object.assign(target, { [field]: exercise[field as keyof PlanExercise] });
        else delete (target as unknown as Record<string, unknown>)[field];
      }
      review.preserved.push({ day, variant, dayName: actual.name, exercise: exercise.name, fields: safeFields,
        message: `${exercise.name}: keep your ${safeFields.map(field => field === 'defaultKg' ? 'planned load' : field === 'equipmentLabel' ? 'equipment label' : field).join(', ')}${!next.exercises.includes(target) ? ` in the new ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][targetWeek.findIndex(item => item.exercises.includes(target))]} session` : ''}.` });
    }
    if (safeFields.length !== fields.length) ambiguous = true;
  }
  if (ambiguous) review.needsReview.push({ day, variant, dayName: actual.name,
    message: `${actual.name}: additions, substitutions, ordering or day-level edits cannot be mapped reliably. Keep your current program, or explicitly use the new recommendation; the old version remains recoverable.` });
  return ambiguous && policy !== 'recommendations' ? structuredClone(actual) : next;
}

function migratedWeeks(current: Profile, options: MasterProgramUpgradeOptions = {}) {
  const review: MasterProgramUpgradeReview = { preserved: [], needsReview: [] };
  const regular = createRecommendedMasterPlan(current.masterProgram);
  const match = createRecommendedMasterPlan(current.masterProgram, true);
  const target = createVolleyballMasterPlan();
  const targetMatch = createVolleyballMasterPlan(true);
  const plan = current.plan.map((day, index) => migrateDay(day, regular[index], target[index], index, 'regular', options.weeklyCustomizationPolicy, review, target));
  const masterMatchWeekend = (current.masterMatchWeekend ?? match.slice(5)).map((day, index) =>
    migrateDay(day, match[index + 5], targetMatch[index + 5], index + 5, 'match', options.weeklyCustomizationPolicy, review, targetMatch));
  return { plan, masterMatchWeekend, review };
}

/** Read-only review; no profile, storage or session is written. */
export function reviewMasterProgramUpgrade(profile: Profile): MasterProgramUpgradeReview {
  const current = ProfileSchema.parse(structuredClone(profile));
  if (!current.masterProgram || current.masterProgram.revision === '13.1') return { preserved: [], needsReview: [] };
  return migratedWeeks(current).review;
}

/** Temporary preparation belongs to its prescription; intentional day edits do not. */
function personalDrafts(drafts: Profile['sessionDrafts']): Draft[] {
  return (drafts ?? []).filter(draft => draft.customized !== false);
}

/**
 * Called only after the athlete reviews and accepts the new prescription.
 * This returns profile fields only: sessions and the rest of the store are never touched.
 */
export function upgradeMasterProgram(profile: Profile, now = Date.now(), options: MasterProgramUpgradeOptions = {}): Profile {
  const current = ProfileSchema.parse(structuredClone(profile));
  if (!current.masterProgram) throw new Error('Activate the master program before upgrading it.');
  if (current.masterProgram.revision === '13.1') return current;
  if (options.weeklyCustomizationPolicy !== undefined && !['preserve', 'recommendations'].includes(options.weeklyCustomizationPolicy)) {
    throw new Error('Review how saved weekly customizations will be handled before upgrading.');
  }

  const backup: NonNullable<Profile['masterProgramBackup']> = {
    savedAt: now,
    plan: structuredClone(current.plan),
    masterProgram: structuredClone(current.masterProgram),
    ...(current.masterMatchWeekend ? { masterMatchWeekend: structuredClone(current.masterMatchWeekend) } : {}),
    ...(current.preMasterPlan ? { preMasterPlan: structuredClone(current.preMasterPlan) } : {}),
    ...(current.sessionDrafts ? { sessionDrafts: structuredClone(current.sessionDrafts) } : {}),
  };
  const { sessionDrafts: _drafts, ...remaining } = current;
  const preserved = personalDrafts(current.sessionDrafts);
  const archive = [...(current.masterProgramArchive ?? []), ...(current.masterProgramBackup ? [current.masterProgramBackup] : [])];
  if (archive.length > 20) throw new Error('Export a backup before adding another saved program version.');
  const migrated = migratedWeeks(current, options);
  if (migrated.review.needsReview.length && options.weeklyCustomizationPolicy !== 'recommendations') {
    throw new Error('Your saved weekly plan has custom sessions that cannot be mapped safely. Review the changes and explicitly choose the V13.1 recommendations, or keep your current program. Nothing was changed.');
  }
  const guidance = effectiveTrainingGuidance(current);
  return ProfileSchema.parse({
    ...remaining,
    plan: migrated.plan,
    masterMatchWeekend: migrated.masterMatchWeekend,
    masterProgram: { ...current.masterProgram, revision: '13.1', ...(guidance ? { clearance: guidance } : {}) },
    masterProgramBackup: backup,
    ...(archive.length ? { masterProgramArchive: archive } : {}),
    ...(current.sessionDrafts ? { sessionDrafts: preserved } : {}),
  });
}

/** Restore the prior weekly prescription while retaining newer deliberate day edits. */
export function restorePreviousMasterProgram(profile: Profile): Profile {
  const current = ProfileSchema.parse(structuredClone(profile));
  const backup = current.masterProgramBackup;
  if (!backup) throw new Error('There is no previous program to restore.');
  const drafts = new Map<string, Draft>();
  for (const draft of [...personalDrafts(backup.sessionDrafts), ...personalDrafts(current.sessionDrafts)]) {
    drafts.set(`${draft.date}:${draft.slot}`, draft);
  }
  const { masterProgramBackup: _backup, masterProgramArchive: _archive, plan: _plan, masterProgram: _program,
    masterMatchWeekend: _weekend, preMasterPlan: _previous, sessionDrafts: _drafts, ...other } = current;
  const archive = [...(current.masterProgramArchive ?? [])];
  const previousBackup = archive.pop();
  const guidance = effectiveTrainingGuidance(current);
  return ProfileSchema.parse({
    ...other,
    ...(guidance ? { trainingGuidance: guidance } : {}),
    plan: backup.plan,
    ...(backup.masterProgram ? { masterProgram: { ...backup.masterProgram, ...(guidance ? { clearance: guidance } : {}) } } : {}),
    ...(backup.masterMatchWeekend ? { masterMatchWeekend: backup.masterMatchWeekend } : {}),
    ...(backup.preMasterPlan ? { preMasterPlan: backup.preMasterPlan } : {}),
    ...(previousBackup ? { masterProgramBackup: previousBackup } : {}),
    ...(archive.length ? { masterProgramArchive: archive } : {}),
    ...(backup.sessionDrafts || current.sessionDrafts ? { sessionDrafts: [...drafts.values()] } : {}),
  });
}

import type { z } from 'zod';
import type { ProfileSchema } from './domain.js';
import type { PlanDay } from './workout-customization';
import type { SessionDraft, SessionSlot } from './workout-drafts';
import { createV9VolleyballMasterPlan } from './volleyball-v9-plan.ts';
import { masterWeekStart, resolveMasterProgramPlan, type MasterProgramSettings } from './volleyball-master-plan.ts';
import { effectiveTrainingGuidance } from './training-guidance.ts';
import { findLibraryExercise } from './exercise-library.ts';
import { getCoachRecords } from './coach-schedule.ts';

type Profile = z.infer<typeof ProfileSchema>;
export type V9ReviewableDraft = SessionDraft & {
  reviewedForProgram?: { revision: '9'; programSessionId: string };
};
export interface V9DraftDisposition {
  kind: 'none' | 'preparation' | 'custom' | 'review-needed' | 'schedule-conflict';
  reason: string;
}
export interface V9UpcomingWorkoutReview {
  key: string;
  date: string;
  slot: SessionSlot;
  name: string;
  disposition: 'preparation-refresh' | 'preparation-preserved' | 'review-required' | 'reviewed-custom' | 'schedule-conflict' | 'active-preserved';
  reason: string;
  currentExerciseCount: number;
  currentWorkingSets: number;
  recommendedName: string | null;
  recommendedExerciseCount: number;
  recommendedWorkingSets: number;
  programSessionId?: string;
  canKeep: boolean;
}
export const v9DraftKey = (draft: Pick<SessionDraft, 'date' | 'slot'>) => `${draft.date}:${draft.slot}`;

export function assertV9Date(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid local date before reviewing upcoming workouts.');
  }
}

/** Known prescription keys distinguish old primer/match snapshots, not their title. */
function legacyPrimer(plan: PlanDay): boolean {
  const keys = new Set(plan.exercises.map(exercise => exercise.key));
  return plan.programRevision === '13.1' && plan.kind === 'strength'
    && keys.has('master-dynamic-mobility') && keys.has('master-joint-mobility')
    && keys.has('master-footwork') && keys.has('master-shoulder-activation');
}
function legacyMatch(plan: PlanDay): boolean {
  return plan.kind === 'sport' && plan.exercises.length === 1
    && plan.exercises[0].key === 'master-match' && plan.exercises[0].mode === 'timed';
}
function safePrimer(plan: PlanDay): boolean {
  const allowed = new Set(['light-dynamic-mobility', 'slow-approach-rhythm', 'band-pull-apart', 'wall-slide', 'walk', 'easy-walk']);
  return plan.exercises.every(exercise => {
    const movement = findLibraryExercise(exercise);
    return exercise.mode !== 'weight' && !exercise.measurement && !exercise.jumpContactsPerRep
      && !exercise.superset && !/complex pair/i.test(exercise.group)
      && (allowed.has(movement?.id ?? exercise.exerciseId ?? '') || ['Recovery', 'Mobility'].includes(movement?.category ?? ''));
  });
}
function safeRecovery(plan: PlanDay): boolean {
  return plan.kind === 'recovery' && plan.exercises.every(exercise => exercise.mode !== 'weight'
    && !exercise.measurement && !exercise.jumpContactsPerRep && !exercise.superset
    && !/complex pair/i.test(exercise.group)
    && ['Recovery', 'Mobility'].includes(findLibraryExercise(exercise)?.category ?? ''));
}
function v9Match(plan: PlanDay): boolean {
  return plan.programSessionId === 'v9-match' && plan.kind === 'sport' && plan.exercises.length === 1
    && plan.exercises[0].key === 'master-v9-match' && plan.exercises[0].mode === 'timed';
}

/**
 * A date edit must be reviewed for the actual V9 session identity. A changed
 * Sunday match selection cannot reuse an approval for the opposite Saturday.
 * This is read-only: quarantined drafts remain recoverable and are never erased.
 */
export function getV9DraftDisposition(draft: V9ReviewableDraft | undefined, recommended: PlanDay, options: { coach?: boolean } = {}): V9DraftDisposition {
  if (!draft) return { kind: 'none', reason: 'Use the saved weekly recommendation.' };
  if (recommended.programRevision !== '9') return { kind: 'custom', reason: 'Use the existing program’s date-edit rules.' };
  if (draft.customized === false) return { kind: 'preparation', reason: 'Preparation checks do not replace a newer training prescription.' };
  const expected = recommended.programSessionId;
  const actual = draft.plan.programSessionId;
  const primer = (actual === 'v9-match-primer' || legacyPrimer(draft.plan)) && safePrimer(draft.plan);
  const match = v9Match(draft.plan) || legacyMatch(draft.plan);
  const conflict = expected === 'v9-lower-b' && primer
    || expected === 'v9-match-primer' && (draft.plan.kind !== 'recovery' && !primer || !safePrimer(draft.plan))
    || expected === 'v9-match' && !match
    || expected === 'v9-recovery' && (match || !safeRecovery(draft.plan))
    || Boolean(actual && expected && actual !== expected);
  if (conflict) return { kind: 'schedule-conflict', reason: 'This saved edit belongs to a different session or match variant. It stays stored; the actual date’s V9 recommendation takes priority.' };
  if (options.coach && draft.reviewedForCoach !== 1) return { kind: 'review-needed', reason: 'This date edit was saved before daily coaching. It stays stored for review; today’s current recommendation is shown until you explicitly keep or replace it.' };
  if (expected && (draft.plan.programRevision === '9' && actual === expected
    || draft.reviewedForProgram?.revision === '9' && draft.reviewedForProgram.programSessionId === expected)) {
    return { kind: 'custom', reason: 'Use the explicitly reviewed custom workout for this date.' };
  }
  return { kind: 'review-needed', reason: 'An older date-specific edit is saved but has not been approved for this V9 session. Use V9 until this edit is reviewed.' };
}

/** Preserve the existing cycle, match selections and guidance when previewing V9. */
export function v9SettingsForProfile(profile: Profile, today: string): MasterProgramSettings {
  assertV9Date(today);
  const guidance = effectiveTrainingGuidance(profile);
  const current = profile.masterProgram;
  const { rescheduledLowerDates: _oldMoves, optional: _oldOptional, ...settings } = current ?? {
    version: 1 as const, startDate: masterWeekStart(today), matchWeeks: [],
  };
  return { ...settings, ...getCoachRecords(profile), revision: '9', ...(current?.revision === '9' ? {} : { v9EffectiveDate: today }),
    ...(guidance ? { clearance: structuredClone(guidance) } : {}) };
}

/** The slot is not silently retargeted when an older extra session no longer exists. */
export function recommendedV9Workout(profile: Profile, today: string, date: string, slot: SessionSlot): PlanDay | undefined {
  assertV9Date(date);
  const settings = v9SettingsForProfile(profile, today);
  const base = profile.masterProgram?.revision === '9' ? profile.plan : createV9VolleyballMasterPlan();
  const weekend = profile.masterProgram?.revision === '9' && profile.masterMatchWeekend
    ? profile.masterMatchWeekend : createV9VolleyballMasterPlan(true).slice(5);
  const plan = resolveMasterProgramPlan(base, settings, date, weekend);
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return slot === 'extra' ? plan[day].extraSession : plan[day];
}

const working = (plan: PlanDay | undefined) => plan?.exercises.filter(exercise => !exercise.optionalWork) ?? [];
export function reviewV9UpcomingWorkouts(profile: Profile, today: string, options: { activeDates?: readonly string[] } = {}): V9UpcomingWorkoutReview[] {
  assertV9Date(today);
  const activation = [today, v9SettingsForProfile(profile, today).startDate].sort().at(-1)!;
  const activeDates = new Set(options.activeDates ?? []);
  for (const date of activeDates) assertV9Date(date);
  return (profile.sessionDrafts ?? []).filter(draft => draft.date >= activation).map(draft => {
    const recommended = recommendedV9Workout(profile, today, draft.date, draft.slot);
    const resolution = recommended ? getV9DraftDisposition(draft, recommended, { coach: true }) : undefined;
    const active = activeDates.has(draft.date);
    const currentPreparation = draft.plan.programRevision === '9'
      && draft.plan.programSessionId === recommended?.programSessionId;
    const disposition: V9UpcomingWorkoutReview['disposition'] = active ? 'active-preserved'
      : draft.customized === false ? currentPreparation ? 'preparation-preserved' : 'preparation-refresh'
        : !recommended || resolution?.kind === 'schedule-conflict' ? 'schedule-conflict'
          : resolution?.kind === 'custom' ? 'reviewed-custom' : 'review-required';
    return {
      key: v9DraftKey(draft), date: draft.date, slot: draft.slot, name: draft.plan.name, disposition,
      reason: active ? 'An active workout exists on this date. Its snapshot and this saved date edit remain unchanged.'
        : !recommended ? 'This old extra slot has no V9 recommendation. It stays stored and does not replace a main workout.'
          : resolution!.reason,
      currentExerciseCount: working(draft.plan).length,
      currentWorkingSets: working(draft.plan).reduce((sum, exercise) => sum + exercise.sets, 0),
      recommendedName: recommended?.name ?? null,
      recommendedExerciseCount: working(recommended).length,
      recommendedWorkingSets: working(recommended).reduce((sum, exercise) => sum + exercise.sets, 0),
      ...(recommended?.programSessionId ? { programSessionId: recommended.programSessionId } : {}),
      canKeep: !active && draft.customized !== false && Boolean(recommended?.programSessionId) && resolution?.kind !== 'schedule-conflict',
    };
  }).sort((left, right) => left.date.localeCompare(right.date) || left.slot.localeCompare(right.slot));
}

export interface V9DraftReviewOptions {
  replaceDraftKeys?: readonly string[];
  keepDraftKeys?: readonly string[];
  activeDates?: readonly string[];
}

/** Apply only named, reviewed future draft decisions; all other personal edits remain stored. */
export function applyV9UpcomingDraftDecisions(profile: Profile, today: string, options: V9DraftReviewOptions = {}): Profile['sessionDrafts'] {
  const rows = reviewV9UpcomingWorkouts(profile, today, options);
  const replace = new Set(options.replaceDraftKeys ?? []), keep = new Set(options.keepDraftKeys ?? []);
  if (replace.size !== (options.replaceDraftKeys ?? []).length || keep.size !== (options.keepDraftKeys ?? []).length
    || [...replace].some(key => keep.has(key))) throw new Error('Choose one recovery decision for each saved date edit.');
  const available = new Map(rows.map(row => [row.key, row]));
  for (const key of [...replace, ...keep]) {
    const row = available.get(key);
    if (!row) throw new Error('A selected date edit is no longer available. Review the upcoming workouts again.');
    if (row.disposition === 'active-preserved') throw new Error('Finish the active workout before changing its saved date edit.');
    if (keep.has(key) && !row.canKeep) throw new Error('This date edit cannot replace the actual V9 match/session variant. Keep it stored or choose the V9 recommendation.');
  }
  if (!profile.sessionDrafts) return undefined;
  return profile.sessionDrafts.flatMap(draft => {
    if (!available.has(v9DraftKey(draft)) || options.activeDates?.includes(draft.date)) return [structuredClone(draft)];
    const key = v9DraftKey(draft);
    if (replace.has(key) || available.get(key)?.disposition === 'preparation-refresh') return [];
    if (keep.has(key)) return [{ ...structuredClone(draft), reviewedForCoach: 1 as const, reviewedForProgram: { revision: '9' as const, programSessionId: available.get(key)!.programSessionId! } }];
    return [structuredClone(draft)];
  });
}

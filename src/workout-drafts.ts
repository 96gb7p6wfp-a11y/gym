import type { PlanDay } from './workout-customization';
import type { StretchStep } from './stretch-routine';

export type SessionSlot = 'main' | 'extra';
export interface SessionDraft {
  date: string;
  slot: SessionSlot;
  plan: PlanDay;
  warmupOverride?: boolean;
  readiness?: 'green' | 'yellow' | 'red';
  customized?: boolean;
}

/** A warm-up draft is not an override of a subsequently edited weekly plan. */
export function resolveSessionDraft(draft: SessionDraft | undefined, recommended: PlanDay): PlanDay {
  if (!draft) return recommended;
  if (draft.customized !== false) return draft.plan;
  const prescription = (plan: PlanDay) => JSON.stringify([plan.name, plan.kind, plan.goal,
    plan.exercises.map(exercise => Object.entries(exercise).filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)))]);
  return prescription(draft.plan) === prescription(recommended)
    ? { ...recommended, warmup: draft.plan.warmup }
    : recommended;
}

/** Planned work belongs to a date, never to workout history or a reusable week. */
export function findSessionDraft(drafts: readonly SessionDraft[] | undefined, date: string, slot: SessionSlot) {
  return drafts?.find(draft => draft.date === date && draft.slot === slot);
}

export function putSessionDraft(drafts: readonly SessionDraft[] | undefined, draft: SessionDraft): SessionDraft[] {
  return [...(drafts ?? []).filter(item => item.date !== draft.date || item.slot !== draft.slot), structuredClone(draft)];
}

/** After starting, keep today's prescription but require fresh preparation next time. */
export function resetDraftPreparation(draft: SessionDraft): SessionDraft {
  return { ...draft, warmupOverride: false,
    plan: { ...draft.plan, warmup: draft.plan.warmup?.map(step => ({ ...step, done: false })) } };
}

/** Report what was recorded; preparation is recommended and never a start gate. */
export function getPreparationStatus(items: readonly StretchStep[], override = false): 'prepared' | 'elsewhere' | 'not-recorded' {
  return override ? 'elsewhere' : items.length > 0 && items.every(step => step.done) ? 'prepared' : 'not-recorded';
}

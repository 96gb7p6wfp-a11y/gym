import { getMasterProgramWeek, masterWeekStart, type MasterProgramSettings } from './volleyball-master-plan.ts';
import { findLibraryExercise } from './exercise-library.ts';
import { v9ExplosiveExercise } from './volleyball-v9-plan.ts';
import type { TrainingGuidance } from './training-guidance.ts';
import type { PlanDay, PlanExercise } from './workout-customization';

export type PrescriptionSource = 'weekly' | 'today-edit' | 'snapshot';
export type WorkoutPrescriptionPlan = Pick<PlanDay, 'name' | 'kind' | 'exercises'>
  & Partial<Pick<PlanDay, 'goal' | 'minutes' | 'durationRange' | 'programRevision' | 'programSessionId'>> & { plannedMinutes?: number };
export interface PrescriptionReason { code: string; title: string; detail: string; }
export interface PrescriptionChange {
  key: string; name: string; kind: 'added' | 'removed' | 'changed'; before: string; after: string;
}
export interface WorkoutPrescription {
  objective: string;
  difficulty: 'light' | 'moderate' | 'demanding';
  label: string;
  intensity: string;
  workingSets: number;
  mandatoryExercises: number;
  optionalExercises: number;
  duration: string;
  durationEstimated: boolean;
  durationDetail: string;
  progression: string;
  reasons: PrescriptionReason[];
  changes: PrescriptionChange[];
  sourceLabel: string;
  readiness: 'green' | 'yellow' | 'red' | 'unrecorded';
  missingContext: string[];
}

function dose(exercise: PlanExercise): string {
  return `${exercise.sets} × ${exercise.target}${exercise.perSide ? ' per side' : ''}`
    + `${exercise.defaultKg != null ? ` · planned ${exercise.defaultKg} kg` : ''}`
    + `${exercise.targetRpe != null ? ` · RPE ${exercise.targetRpe}` : ''}`
    + `${exercise.targetRir != null ? ` · RIR ${exercise.targetRir}` : ''}`
    + ` · ${exercise.superset ? `${exercise.superset.restAfterRound} sec after pair` : exercise.restRange ? `${exercise.restRange} rest` : exercise.rest ? `${exercise.rest} sec rest` : 'no timed rest'}`
    + `${exercise.equipmentLabel ? ` · ${exercise.equipmentLabel}` : ''}${exercise.optionalWork ? ' · optional' : ''}`;
}
function explosiveExercise(exercise: PlanExercise): boolean {
  const category = findLibraryExercise(exercise)?.category;
  return Boolean(exercise.jumpContactsPerRep) || Boolean(exercise.measurement)
    || category === 'Power' || category === 'Plyometric';
}

/** Exact saved-key differences; renamed/replaced exercises remain separate rows. */
export function compareWorkoutPrescriptions(original: WorkoutPrescriptionPlan, current: WorkoutPrescriptionPlan): PrescriptionChange[] {
  const before = new Map(original.exercises.map(exercise => [exercise.key, exercise]));
  const after = new Map(current.exercises.map(exercise => [exercise.key, exercise]));
  const changes: PrescriptionChange[] = [];
  for (const exercise of original.exercises) {
    const next = after.get(exercise.key);
    if (!next) changes.push({ key: exercise.key, name: exercise.name, kind: 'removed', before: dose(exercise), after: 'Not prescribed in this session' });
    else if (dose(exercise) !== dose(next) || exercise.name !== next.name || exercise.preparationOnly !== next.preparationOnly
      || exercise.mode !== next.mode || exercise.measurement !== next.measurement || exercise.quantityUnit !== next.quantityUnit) {
      const configurationChanged = exercise.mode !== next.mode || exercise.measurement !== next.measurement || exercise.quantityUnit !== next.quantityUnit;
      const configuration = (item: PlanExercise) => item.measurement ? `${item.measurement} in cm`
        : item.mode === 'timed' ? 'duration' : item.quantityUnit === 'm' ? 'distance in metres' : item.mode === 'bodyweight' ? 'bodyweight reps' : 'weight and reps';
      changes.push({ key: exercise.key, name: next.name, kind: 'changed',
        before: `${dose(exercise)}${configurationChanged ? ` · ${configuration(exercise)}` : ''}`,
        after: `${dose(next)}${configurationChanged ? ` · ${configuration(next)}` : ''}` });
    }
  }
  for (const exercise of current.exercises) if (!before.has(exercise.key)) {
    changes.push({ key: exercise.key, name: exercise.name, kind: 'added', before: 'Not in the saved base session', after: dose(exercise) });
  }
  return changes;
}

// Only scales an existing planned time; this is not a measurement of completion
// or fatigue. Prescribed rest is weighted so a few power sets are not a circuit.
function doseWeight(plan: WorkoutPrescriptionPlan): number {
  return plan.exercises.filter(exercise => !exercise.optionalWork).reduce((sum, exercise) =>
    sum + exercise.sets * (45 + Math.min(600, exercise.superset?.restAfterRound ?? exercise.rest)), 0);
}

/** A stable identity alone never makes added heavy or explosive work gentle. */
export function isGentleV9MatchPrimer(plan: WorkoutPrescriptionPlan): boolean {
  return plan.programRevision === '9' && plan.programSessionId === 'v9-match-primer'
    && plan.kind === 'strength' && plan.exercises.length > 0 && plan.exercises.every(exercise =>
      exercise.mode !== 'weight' && !explosiveExercise(exercise) && !v9ExplosiveExercise(exercise)
      && !(exercise.defaultKg != null && exercise.defaultKg > 0) && (exercise.targetRpe ?? 5) <= 6
      && (exercise.targetRir == null || exercise.targetRir >= 4));
}

/** Presentation derived from explicit plan metadata; never rewrites a prescription. */
export function getWorkoutPrescription({ plan, originalPlan, settings, guidance, date, source = 'weekly' }: {
  plan: WorkoutPrescriptionPlan; originalPlan?: WorkoutPrescriptionPlan;
  settings?: MasterProgramSettings; guidance?: TrainingGuidance; date?: string; source?: PrescriptionSource;
}): WorkoutPrescription {
  const working = plan.exercises.filter(exercise => !exercise.optionalWork);
  const allPreparation = working.length > 0 && working.every(exercise => exercise.preparationOnly);
  const weighted = working.filter(exercise => exercise.mode === 'weight');
  const preparationStrength = weighted.length > 0 && weighted.every(exercise => exercise.preparationOnly);
  const week = settings && date ? getMasterProgramWeek(settings.startDate, date) : null;
  const day = date ? (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7 : null;
  const currentContext = source !== 'snapshot';
  const activeDate = !!(settings && date && (week || settings.revision === '9' && date >= settings.startDate));
  const readiness = currentContext && activeDate && settings && date
    ? settings.readiness?.find(row => row.date === date)?.status ?? 'unrecorded' : 'unrecorded';
  const reasons: PrescriptionReason[] = [];
  // A current profile is not evidence of the settings that created an old log.
  const changes = currentContext && originalPlan ? compareWorkoutPrescriptions(originalPlan, plan) : [];
  const missingContext: string[] = [];
  const add = (code: string, title: string, detail: string) => reasons.push({ code, title, detail });

  if (source === 'snapshot') {
    add('saved-snapshot', 'Saved workout snapshot', 'This workout keeps the prescription saved when it started. Later program, readiness or clearance changes apply to future workouts.');
    if (preparationStrength || allPreparation) add('saved-preparation', 'Saved preparation session', 'The recorded prescription contains easy preparation work. Current program settings cannot establish why an older snapshot was reduced. Review its saved instructions; a future full session requires your recorded guidance.');
  } else if (guidance || settings?.clearance || (['13.1', '9'].includes(plan.programRevision ?? '') && settings)) {
    const lifting = (guidance ?? settings?.clearance)?.heavyLifting ?? 'unknown';
    const impact = (guidance ?? settings?.clearance)?.impact ?? 'unknown';
    if (lifting !== 'cleared' && preparationStrength) add(`clearance-lifting-${lifting}`,
      lifting === 'restricted' ? 'Heavy lifting is restricted' : 'Heavy-lifting guidance is unconfirmed',
      'Weighted work is limited to at most two easy sets, RPE 5, with no prescribed added load. This is preparation rather than the full strength session. Only your explicit recorded guidance can change this limit.');
    if (impact !== 'cleared' && plan.kind === 'strength' && !working.some(exercise => !exercise.preparationOnly && explosiveExercise(exercise))) add(`clearance-impact-${impact}`,
      impact === 'restricted' ? 'Impact work is restricted' : 'Impact guidance is unconfirmed',
      plan.programRevision === '9' ? 'Maximal jumps, sprints, aggressive agility and ballistic work are excluded when guidance is unknown or restricted. Review your own recorded guidance; Setline does not grant clearance.' : 'Maximal jumps and ballistic work are excluded where restricted. Review your own recorded guidance before changing this setting; Setline does not grant clearance.');
  }
  if (source === 'today-edit') add('today-edit', 'Your change for this date', 'This date-specific workout takes priority over the recurring recommendation. The weekly plan and completed history stay separate.');
  if (source === 'today-edit' && plan.programRevision === '9' && (preparationStrength || allPreparation)) add('saved-preparation', 'Preparation saved in this date edit', 'This date edit retains an earlier preparation prescription. Changing readiness or guidance does not recreate removed sets. Review the full base, then use the reviewed date-only reset if you want this date to follow the current weekly prescription. Your history stays unchanged.');
  if (currentContext && activeDate && settings) {
    if (week === 4) add('deload', 'Deload week', 'This planned week reduces demanding sets and supplementary contacts. It is not a missing-workout penalty or a permanent reduction of your base plan.');
    if (week === 8) add('retest', 'Peak / retest week', 'Fresh jump measurements replace normal jump volume, with reduced strength work. Do not add a second full plyometric session.');
    if (readiness === 'yellow') add('readiness-yellow', 'You selected Yellow', settings.revision === '9' ? 'Acceleration, aggressive agility and high-impact jumps are omitted or reduced, with selected hard strength sets reduced. The full V9 base is retained as a read-only reference; use the modified recommended session.' : settings.revision === '13.1'
      ? 'Hard jumps and ballistic work are removed and selected working sets are reduced. Keep controlled technique and avoid aggressive overload.'
      : 'Selected demanding work and supplementary contacts are reduced. Follow the actual exercise list, keep controlled technique and avoid aggressive overload.');
    if (readiness === 'red') add('readiness-red', 'You selected Red', 'Use comfortable recovery and stop relevant painful or unstable work. No missed work needs to be made up.');
    const match = !!week && settings.matchWeeks.includes(week);
    if (match && (day === 5 || day === 6)) add('match-week', day === 5 ? 'Sunday match preparation' : 'Sunday match',
      day === 5 ? 'Saturday is brief, optional preparation to preserve Sunday performance. Full rest is valid; no catch-up lower workout is added.' : 'Competition takes priority over the usual lower-body session. Record actual playing time and contacts separately.');
    if (settings.revision === '13.1' && match && day === 0) add('match-week', 'Upcoming Sunday match', 'Monday approach contacts are capped and hurdles are omitted. The saved base week is retained.');
    const previousMatch = week === 1 ? settings.previousSundayMatch : !!week && settings.matchWeeks.includes(week - 1);
    if (settings.revision === '13.1' && previousMatch && day === 0) add('post-match', 'Match on the previous Sunday', 'Maximal Monday jumping is omitted. Controlled upper-body work remains subject to readiness and your recorded guidance.');
    if (settings.revision === '13.1' && !match && date && settings.rescheduledLowerDates?.includes(new Date(new Date(`${masterWeekStart(date)}T12:00:00Z`).getTime() + 5 * 86400000).toISOString().slice(0, 10)) && (day === 5 || day === 6)) {
      add('moved-session', 'Lower B moved by you', 'One existing Lower B session moves from Saturday to Sunday; it is not duplicated and a Sunday match always takes priority.');
    }
    if (readiness === 'unrecorded' && plan.kind === 'strength') missingContext.push('Readiness has not been recorded for this date; missing sleep, soreness and sport activity are not treated as zero or as proof of recovery.');
  }
  const workingSets = working.reduce((sum, exercise) => sum + exercise.sets, 0);
  const livePower = working.some(exercise => !exercise.preparationOnly && explosiveExercise(exercise));
  const mixedPreparation = preparationStrength && livePower;
  // Session identity survives title edits, but cannot make a customized heavy or
  // explosive workout into an easy primer. Include optional work in this guard.
  const matchPrimer = isGentleV9MatchPrimer(plan);
  const light = matchPrimer || allPreparation || (preparationStrength && !mixedPreparation) || plan.kind === 'recovery' || readiness === 'red'
    || (currentContext && plan.kind === 'strength' && (readiness === 'yellow' || week === 4 || week === 8));
  const demanding = !light && plan.kind === 'strength' && working.some(exercise => (exercise.targetRpe ?? 0) >= 8);
  const difficulty = light ? 'light' : demanding ? 'demanding' : 'moderate';
  const preparation = allPreparation || (preparationStrength && !mixedPreparation);
  const label = matchPrimer ? 'Light primer' : mixedPreparation ? 'Power + preparation' : preparation ? 'Preparation' : plan.kind === 'recovery' ? 'Recovery' : light ? 'Light' : demanding ? 'Demanding' : 'Moderate';
  const explosive = working.some(explosiveExercise);
  const objective = matchPrimer ? 'Brief, easy movement preparation to stay fresh for the match; full rest is also valid'
    : mixedPreparation ? 'High-quality jumping within your impact guidance, with easy strength preparation'
    : preparation ? 'Easy movement preparation within your recorded guidance'
    : plan.kind === 'recovery' ? 'Restore comfortable movement with minimal training fatigue'
      : plan.kind === 'sport' ? 'Sport practice or competition; record actual exposure'
        : plan.goal === 'power' || explosive ? 'High-quality power, followed by the prescribed strength work'
          : plan.goal === 'hypertrophy' ? 'Productive muscle-building sets with progressive overload'
            : 'Develop force production with controlled, challenging working sets';
  const rpes = [...new Set(working.flatMap(exercise => exercise.targetRpe == null ? [] : [exercise.targetRpe]))].sort((a, b) => a - b);
  const intensity = matchPrimer ? 'Easy, comfortable movement within your recorded guidance. No heavy lifting or maximal jumps; stop before fatigue.'
    : mixedPreparation ? 'Jumps: fast, fresh attempts with full prescribed rest, within your recorded impact guidance. Strength work: easy preparation at RPE 5 where prescribed, with no heavy straining.'
    : preparation ? 'Easy preparation · RPE 5 where prescribed; no heavy straining. Follow your recorded guidance.'
    : plan.kind === 'recovery' ? 'Comfortable, pain-free movement; stop before fatigue.'
      : plan.kind === 'sport' ? 'Intensity varies with practice and playing time. Log actual exertion and jump contacts.'
        : `${explosive || plan.goal === 'power' ? 'Power: fast, fresh repetitions and full prescribed rest; stop when quality falls. ' : ''}${rpes.length ? `Strength effort: exercise-specific RPE ${rpes[0]}${rpes.length > 1 ? `–${rpes.at(-1)}` : ''}; use each exercise’s target.` : 'Use the saved exercise targets; no effort target has been invented.'} No automatic training to failure.`;
  const progression = matchPrimer ? 'Keep preparation brief and easy. Do not add load, jumps or catch-up work; record only what you actually performed.'
    : preparation ? 'Keep preparation easy. Review recorded impact/lifting guidance before progressing; changing a setting never rewrites this saved workout.'
    : plan.kind === 'recovery' || plan.kind === 'sport' ? 'Record what you actually did. Missed sessions do not create training debt or automatic catch-up work.'
      : `${explosive ? 'For jumps, compare the same protocol and stop at the prescribed high-quality contacts. ' : ''}For strength, meet the rep target at the prescribed effort with the same equipment before choosing a small load increase. Missing logs do not justify added volume.`;

  let duration = plan.durationRange ?? (plan.minutes ?? plan.plannedMinutes ? `About ${plan.minutes ?? plan.plannedMinutes} min` : 'Time not specified');
  let durationEstimated = false;
  let durationDetail = 'Saved planning time, not measured completion time. Optional work may add time.';
  if (originalPlan && changes.length && doseWeight(originalPlan) > doseWeight(plan) && (originalPlan.minutes ?? originalPlan.plannedMinutes)) {
    const originalMinutes = originalPlan.minutes ?? originalPlan.plannedMinutes!;
    const ratio = Math.max(.15, Math.min(1, doseWeight(plan) / doseWeight(originalPlan)));
    const middle = 8 + Math.max(0, originalMinutes - 8) * ratio;
    const lower = Math.max(5, Math.floor((middle * .85) / 5) * 5);
    const upper = Math.max(lower + 5, Math.ceil((middle * 1.15) / 5) * 5);
    duration = `About ${lower}–${upper} min · estimate`;
    durationEstimated = true;
    durationDetail = 'A planning estimate scaled from the base session by prescribed sets and rest, with preparation time retained. Actual setup, pace and optional work can change it.';
  } else if (preparation) {
    duration = 'Short preparation · time varies';
    durationDetail = 'The original full-session duration is not a valid estimate for this reduced preparation prescription.';
  }
  return { objective, difficulty, label, intensity, workingSets, mandatoryExercises: working.length,
    optionalExercises: plan.exercises.length - working.length, duration, durationEstimated, durationDetail,
    progression, reasons, changes, sourceLabel: source === 'snapshot' ? 'Saved workout snapshot' : source === 'today-edit' ? 'Your workout for this date' : 'Saved weekly program',
    readiness, missingContext };
}

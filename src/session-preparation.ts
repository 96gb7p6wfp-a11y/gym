import { DEFAULT_PROFILE } from './domain.js';
import { findLibraryExercise } from './exercise-library.ts';
import { createVolleyballMasterPlan } from './volleyball-master-plan.ts';
import { getStretchRoutine, type StretchStep } from './stretch-routine.ts';

export interface PreparationExercise {
  exerciseId?: string;
  key?: string;
  name?: string;
  group?: string;
  mode?: string;
  defaultKg?: number | null;
  optionalWork?: boolean;
  logs?: readonly { done: boolean }[];
}
export interface SessionPreparationOptions {
  phase: 'warmup' | 'cooldown';
  kind: 'strength' | 'sport' | 'recovery';
  exercises: readonly PreparationExercise[];
  items?: readonly StretchStep[];
  name?: string;
  goal?: string;
  minutes?: number;
  programRevision?: '8.1';
  /** Finished sessions must not imply that unlogged exercises were performed. */
  completedOnly?: boolean;
}
type Focus = 'shoulders' | 'chest' | 'back' | 'biceps' | 'triceps' | 'quads' | 'glutes' | 'hamstrings' | 'calves' | 'hips' | 'adductors' | 'core' | 'jump';
type Template = Omit<StretchStep, 'done'> & { concept: string };
const step = (phase: string, concept: string, name: string, target: string, cue: string): Template =>
  ({ key: `prep-${phase}-${concept}`, concept, name, target, cue });
const W = {
  easy: step('warmup', 'easy', 'Easy Walk + Arm Swing', '2–3 min', 'Start easily and build warmth. Let the arms swing naturally.'),
  arms: step('warmup', 'arms', 'Arm Circles', '6–8 each direction', 'Start small and gradually open the circle. Keep it comfortable; no long holds.'),
  wall: step('warmup', 'wall', 'Wall Slide', '6–8 reps', 'Slide the arms smoothly; keep the ribs down and avoid shrugging.'),
  thoracic: step('warmup', 'thoracic', 'Thoracic Rotation', '6 / side', 'Turn gently through the upper back, without forcing the shoulder.'),
  ankle: step('warmup', 'ankle', 'Ankle Knee-to-Wall', '6–8 / side', 'Keep the heel down and move the knee forward smoothly within a comfortable range.'),
  hips: step('warmup', 'hips', '90/90 Hip Switch', '6 / side', 'Move slowly between sides. Do not force the knees into the floor.'),
  squat: step('warmup', 'squat', 'Bodyweight Squat', '6–8 reps', 'Rehearse a comfortable squat with feet planted and knees tracking over the toes.'),
  hinge: step('warmup', 'hinge', 'Unloaded Hip Hinge', '6–8 reps', 'Use soft knees and send the hips back. Stop before the back rounds.'),
  foot: step('warmup', 'foot', 'Short-Foot', '15–20 sec / side', 'Keep the heel and both toe bases down. Gently shorten the arch without curling the toes.'),
  jump: step('warmup', 'jump', 'Jump Ramp-Up', '3 gradual jumps', 'Build from easy to moderate to fast, with full resets. Skip if jumping is painful.'),
  rehearsal: step('warmup', 'rehearsal', 'Light Rehearsal Sets', '4–6 easy reps', 'Rehearse your first strength pattern with no load or a very light load. Add gradual loading at the lift, before working sets.'),
  cuff: step('warmup', 'cuff', 'Light External Rotation', '8 / side', 'Use a very light band or cable. Keep the elbow by your side and rotate smoothly, without shrugging.'),
  scapular: step('warmup', 'scapular', 'Scapular Row', '8 easy reps', 'Use a light band or cable. Draw the shoulder blades back gently; keep the neck relaxed.'),
  glute: step('warmup', 'glute', 'Glute Bridge', '8 easy reps', 'Lift through the hips with ribs controlled. Stop before the lower back arches.'),
  trunk: step('warmup', 'trunk', 'Dead Bug', '4 / side', 'Exhale gently, keep the ribs down and move only as far as the back stays comfortable.'),
  landing: step('warmup', 'landing', 'Snap-Down Landing', '3 easy reps', 'Rise onto the toes, then settle into a quiet quarter squat without jumping. Knees track with the feet.'),
  upperPower: step('warmup', 'upper-power', 'Progressive Throw Rehearsal', '3 single reps', 'Use a light ball with a clear throwing area. Build from easy to moderate to fast; reset fully, never throw to fatigue.'),
  breathing: step('warmup', 'breathing', '90/90 Breathing', '4 easy breaths', 'Let the ribs settle with a gentle exhale. Avoid arching or forcing the breath.'),
};
const C = {
  walk: step('cooldown', 'walk', 'Easy Walk + Breathing', '1–3 min', 'Let your breathing settle at an easy pace. No extra conditioning.'),
  shoulder: step('cooldown', 'shoulder', 'Cross-Body Shoulder Stretch', '20–30 sec / side', 'Bring one arm gently across the chest. Keep the shoulder down; stop if it pinches.'),
  pec: step('cooldown', 'pec', 'Pec Stretch', '20–30 sec / side', 'Use a doorway with the elbow below shoulder height. Turn gently; never force the shoulder.'),
  lat: step('cooldown', 'lat', 'Lat Stretch', '20–30 sec / side', 'Rest the hands on a support and ease the hips back. Keep the reach comfortable and pain-free.'),
  biceps: step('cooldown', 'biceps', 'Biceps Stretch', '15–20 sec / side', 'With the arm low and straight, gently reach behind the body. Use a small range; do not pull the shoulder forward.'),
  triceps: step('cooldown', 'triceps', 'Triceps Stretch', '20–30 sec / side', 'Bend the elbow overhead only if comfortable. Keep ribs down and use no force on the elbow.'),
  quad: step('cooldown', 'quad', 'Standing Quad Stretch', '20–30 sec / side', 'Use a support for balance. Keep the knees close and gently tuck the pelvis; do not pull hard.'),
  hamstring: step('cooldown', 'hamstring', 'Hamstring Stretch', '20–30 sec / side', 'Rest the heel on a low support and hinge gently. Keep the back comfortable; do not force the range.'),
  glute: step('cooldown', 'glute', 'Glute Stretch', '20–30 sec / side', 'Use a comfortable figure-four position. Ease in gently without pressing on the knee.'),
  calf: step('cooldown', 'calf', 'Gastrocnemius Stretch', '20–30 sec / side', 'Keep the back heel down and knee straight. Hold gentle tension without bouncing.'),
  hips: step('cooldown', 'hips', 'Hip Flexor Stretch', '20–30 sec / side', 'Gently tuck the pelvis and keep the ribs down. Do not arch the lower back.'),
  adductors: step('cooldown', 'adductors', 'Adductor Stretch', '20–30 sec / side', 'Use a shallow side lunge with support. Stop at a gentle inner-thigh stretch, without knee pain.'),
  breathing: step('cooldown', 'breathing', '90/90 Breathing', '4 easy breaths', 'Rest with feet supported and let the ribs settle. Breathe gently without forcing a stretch.'),
};

const allTemplates = [...Object.values(W), ...Object.values(C)];
const normalize = (value = '') => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const conceptByName = new Map(allTemplates.map(item => [normalize(item.name), item.concept]));
for (const [name, concept] of [
  ['Soleus Stretch', 'calf'], ['Easy Pogo', 'pogo'], ['Pogo Jump', 'pogo'], ['Progressive Jumps', 'jump'],
  ['Light Pulldown / Press', 'upper-rehearsal'], ['Light Squat / Hinge Warm-up', 'lower-rehearsal'],
  ['Band / Cable External Rotation', 'cuff'], ['Light Face Pull', 'scapular'],
  ['Leg Swings', 'hips'], ['Walking Lunge + Rotation', 'hips'], ['Walking Lunge + Reach', 'hips'],
  ['Mini-Band Lateral Walk', 'glute'],
  ['Light Bike', 'easy'], ['Dynamic Hip Mobility', 'hips'], ['Reverse Lunge', 'lunge'],
  ['Low-intensity Pogos', 'pogo'], ['Progressive Practice Jumps', 'jump'],
  ['Easy March in Place', 'easy'], ['Small Shoulder Rolls', 'arms'], ['Standing Scapular Circles', 'wall'],
  ['Standing Upper-Back Rotation', 'thoracic'], ['Supported Ankle Rock', 'ankle'], ['Supported Hip Circles', 'hips'],
  ['Sit-to-Stand Rehearsal', 'squat'], ['Hip Hinge to Wall', 'hinge'], ['Standing Glute Squeeze', 'glute'],
  ['Standing Brace + Breath', 'trunk'], ['Seated Foot Tripod', 'foot'], ['Unresisted External Rotation', 'cuff'],
  ['Standing Scapular Retraction', 'scapular'], ['Supported Quarter Squat', 'landing'],
  ['No-Impact Takeoff Rehearsal', 'jump'], ['Unloaded Throw Rehearsal', 'upper-power'],
  ['Unloaded Pattern Rehearsal', 'rehearsal'], ['Seated Easy Breathing', 'breathing'],
]) conceptByName.set(normalize(name), concept);

// Only exact shipped defaults are replaceable. Renamed steps or edited targets/cues are custom.
// This registry reads recommendation templates; it never mutates a plan or saved session.
const signature = (item: Omit<StretchStep, 'done'>) => JSON.stringify([item.key, item.name, item.target, item.cue]);
const automatic = new Map<string, string>();
const conceptByKey = new Map<string, string>();
const prescribedPreparation = new Map<string, readonly StretchStep[]>();
const register = (items: readonly Omit<StretchStep, 'done'>[]) => {
  for (const item of items) {
    const concept = conceptByName.get(normalize(item.name));
    if (concept) { automatic.set(signature(item), concept); conceptByKey.set(item.key, concept); }
  }
};
register(allTemplates);
register(getStretchRoutine());
for (const day of [...DEFAULT_PROFILE.plan, ...createVolleyballMasterPlan(), ...createVolleyballMasterPlan(true)]) {
  register(day.warmup ?? []);
  register(day.cooldown ?? []);
  if (day.extraSession) { register(day.extraSession.warmup ?? []); register(day.extraSession.cooldown ?? []); }
  if (day.programRevision === '8.1' && day.warmup?.length) prescribedPreparation.set(normalize(day.name), day.warmup);
  if (day.extraSession?.programRevision === '8.1' && day.extraSession.warmup?.length) prescribedPreparation.set(normalize(day.extraSession.name), day.extraSession.warmup);
}

function focusFor(exercises: readonly PreparationExercise[]): Set<Focus> {
  const focus = new Set<Focus>();
  for (const exercise of exercises) {
    if (exercise.optionalWork === true && !exercise.logs?.some(log => log.done)) continue;
    const library = findLibraryExercise(exercise);
    const labels = library?.muscles ?? [exercise.name ?? '', exercise.group ?? ''];
    const text = normalize(labels.join(' '));
    const add = (pattern: RegExp, ...values: Focus[]) => { if (pattern.test(text)) values.forEach(value => focus.add(value)); };
    add(/shoulder|delt|rotator/, 'shoulders'); add(/chest|pec/, 'chest');
    if (library?.movement !== 'Hip hinge') add(/back|lat|row|pull up|pulldown/, 'back');
    add(/bicep|curl/, 'biceps'); add(/tricep|pushdown/, 'triceps');
    add(/quad|squat|lunge|leg press/, 'quads'); add(/glute|hip thrust/, 'glutes');
    add(/hamstring|leg curl|deadlift|hip hinge/, 'hamstrings');
    add(/calf|calves|soleus|gastrocnemius|ankle|tibialis|feet|foot/, 'calves');
    add(/hip flexor|hips/, 'hips'); add(/adductor|copenhagen/, 'adductors');
    add(/core|abdominal|abs|plank|crunch|carry|pallof/, 'core');
    if (/jump|pogo|hurdle|approach|bounding/.test(normalize(`${library?.movement ?? ''} ${exercise.name ?? ''}`))) {
      focus.add('jump');
      // Pogo is ankle-dominant; do not invent a full lower-body session from it.
      if (!/pogo/.test(normalize(exercise.name))) { focus.add('quads'); focus.add('glutes'); }
      focus.add('calves');
    }
    if (/\blegs?\b|lower body/.test(text)) { focus.add('quads'); focus.add('glutes'); }
  }
  return focus;
}

function isUpperPower(exercises: readonly PreparationExercise[], goal: string | undefined, upper: boolean): boolean {
  // Throws involve the glutes too, but do not turn an upper-power day into a
  // lower-strength warm-up. Actual lower-body loading/jumps still take priority.
  const lowerDemand = exercises.some(item => item.optionalWork !== true && /squat|deadlift|leg press|hip thrust|leg curl|calf raise|jump|hurdle|pogo/i.test(item.name ?? ''));
  return upper && !lowerDemand && (goal === 'power' || exercises.some(item => /throw|slam/i.test(item.name ?? '')));
}

function suggestions({ phase, kind, exercises, completedOnly, name = '', goal }: SessionPreparationOptions): Template[] {
  const performed = exercises.filter(item => item.logs?.some(log => log.done));
  const relevant = phase === 'cooldown' && (completedOnly || performed.length > 0) ? performed : exercises;
  const focus = focusFor(relevant);
  if (kind === 'recovery') return phase === 'warmup'
    ? [W.easy, W.ankle, W.hips, W.thoracic, W.wall]
    : getStretchRoutine().map(({ done: _done, ...item }) => ({ ...item, concept: conceptByName.get(normalize(item.name))! }));
  if (kind === 'sport') return phase === 'warmup'
    ? [W.easy, W.ankle, W.hips, W.arms, W.wall]
    : [C.walk, C.calf, C.hips, C.shoulder];
  const upper = ['shoulders', 'chest', 'back', 'biceps', 'triceps'].some(item => focus.has(item as Focus));
  const upperPower = isUpperPower(exercises, goal, upper);
  const lower = !upperPower && ['quads', 'glutes', 'hamstrings', 'hips', 'adductors', 'calves'].some(item => focus.has(item as Focus));
  if (phase === 'warmup') {
    const primer = /primer|technique/i.test(name);
    const result = [W.easy];
    if (upper) {
      result.push(W.arms, W.wall, W.cuff);
      if (focus.has('back')) result.push(W.scapular);
      if (upperPower) result.push(W.thoracic, W.upperPower);
    }
    if (lower) {
      result.push(W.ankle);
      if (focus.has('quads') || focus.has('glutes') || focus.has('hips') || focus.has('adductors')) result.push(W.hips);
      if (!primer) {
        if (focus.has('quads')) result.push(W.squat);
        if (focus.has('hamstrings')) result.push(W.hinge);
        if (focus.has('glutes')) result.push(W.glute);
        if (!upper) result.push(W.trunk);
      }
    }
    if (focus.has('jump')) {
      result.push(W.foot, W.landing);
      // Primer jumps are already progressive. Do not add extra contacts to a
      // three-jump pre-match dose or the short Tuesday technique session.
      if (!primer) result.push(W.jump);
    }
    // Specific loading belongs at the actual lift, even when jumps come first.
    if (!primer && (upper || lower)) result.push(W.rehearsal);
    if (!upper && !lower && focus.has('core')) result.push(W.breathing);
    return result;
  }

  const result = [C.walk];
  if (focus.has('shoulders')) result.push(C.shoulder);
  if (focus.has('chest')) result.push(C.pec);
  if (focus.has('back')) result.push(C.lat);
  if (focus.has('quads')) result.push(C.quad);
  if (focus.has('hamstrings')) result.push(C.hamstring);
  if (focus.has('glutes')) result.push(C.glute);
  if (focus.has('calves')) result.push(C.calf);
  if (focus.has('hips')) result.push(C.hips);
  if (focus.has('adductors')) result.push(C.adductors);
  // Keep mixed sessions concise; arm-specific work remains useful on focused days.
  if (result.length < 5 && focus.has('triceps')) result.push(C.triceps);
  if (result.length < 5 && focus.has('biceps')) result.push(C.biceps);
  if (result.length === 1 && focus.has('core')) result.push(C.breathing);
  return result.slice(0, 7);
}

/** Pure view/new-session preparation. Custom instructions and completed checks are never discarded. */
export function getSessionPreparation(options: SessionPreparationOptions): StretchStep[] {
  if (options.phase === 'warmup' && options.programRevision === '8.1') {
    // The revised program prescribes one concise preparation sequence. Keep
    // its dose and saved substitutions instead of appending a generic routine.
    const prescribed = options.items ?? prescribedPreparation.get(normalize(options.name));
    if (prescribed?.length) return prescribed.slice(0, 20).map(item => ({ ...item }));
  }
  const desired = suggestions(options);
  const wanted = new Set(desired.map(item => item.concept));
  // Keep a prescribed low-dose pogo activation on actual jump days, without adding contacts.
  if (options.phase === 'warmup' && wanted.has('jump')) wanted.add('pogo');
  if (options.phase === 'warmup' && wanted.has('arms')) wanted.add('upper-rehearsal');
  if (options.phase === 'warmup' && wanted.has('ankle')) wanted.add('lower-rehearsal');
  if (options.phase === 'warmup' && options.exercises.some(item => findLibraryExercise(item)?.muscles.includes('Core'))) wanted.add('breathing');
  const supplied = new Set<string>();
  const result: StretchStep[] = [];
  for (const item of options.items ?? []) {
    const concept = automatic.get(signature(item));
    if (!concept || item.done || wanted.has(concept)) {
      result.push({ ...item });
      const suppliedConcept = concept ?? conceptByName.get(normalize(item.name));
      if (suppliedConcept) {
        supplied.add(suppliedConcept);
        if (suppliedConcept.endsWith('-rehearsal')) supplied.add('rehearsal');
        if (options.phase === 'warmup' && /walking lunge/i.test(item.name)) supplied.add('squat');
        if (options.phase === 'warmup' && concept === 'breathing') supplied.add('trunk');
      }
    }
  }
  for (const { concept, ...item } of desired) {
    if (result.length >= 20) break;
    if (!supplied.has(concept) && !result.some(saved => saved.key === item.key)) {
      result.push({ ...item, done: false }); supplied.add(concept);
    }
  }
  const limited = result.slice(0, 20);
  if (options.phase === 'warmup') {
    // General movement first; gradual jumps last. Preserve the ordering of
    // custom drills while sorting only slots occupied by shipped instructions.
    const order = ['easy', 'breathing', 'arms', 'ankle', 'hips', 'thoracic', 'wall', 'cuff', 'scapular', 'glute', 'trunk', 'squat', 'hinge', 'foot', 'landing', 'pogo', 'rehearsal', 'upper-rehearsal', 'lower-rehearsal', 'upper-power', 'jump'];
    const ordered = limited.filter(item => automatic.has(signature(item))).sort((a, b) => order.indexOf(automatic.get(signature(a))!) - order.indexOf(automatic.get(signature(b))!));
    let next = 0;
    return limited.map(item => automatic.has(signature(item)) ? ordered[next++] : item);
  }
  if (options.phase === 'cooldown' && limited.some(item => {
    const concept = automatic.get(signature(item));
    return concept && Object.values(C).some(stretch => stretch.concept === concept && !['walk', 'breathing'].includes(concept));
  })) {
    // Put the useful stretch in view first. Only shipped generic steps move;
    // custom instruction order, fields and completed checks stay intact.
    const generic = (item: StretchStep) => ['walk', 'breathing'].includes(automatic.get(signature(item)) ?? '');
    return [...limited.filter(item => !generic(item)), ...limited.filter(generic)];
  }
  return limited;
}

export type WarmupPlan = Pick<SessionPreparationOptions, 'kind' | 'exercises' | 'name' | 'goal' | 'minutes' | 'programRevision'> & { warmup?: readonly StretchStep[] };

/** Stable, short view of preparation. The full saved routine is never changed. */
export function getQuickWarmup(plan: WarmupPlan, items: readonly StretchStep[] = []): StretchStep[] {
  const available = items.length ? items : getSessionPreparation({ ...plan, items: plan.warmup, phase: 'warmup' });
  if (plan.programRevision === '8.1' && prescribedPreparation.has(normalize(plan.name))) return available.map(item => ({ ...item }));
  const focus = focusFor(plan.exercises);
  const upper = ['shoulders', 'chest', 'back', 'biceps', 'triceps'].some(value => focus.has(value as Focus));
  const lower = ['quads', 'glutes', 'hamstrings', 'hips', 'adductors', 'calves'].some(value => focus.has(value as Focus));
  const primer = /primer|technique/i.test(plan.name ?? '');
  const upperPower = isUpperPower(plan.exercises, plan.goal, upper);
  const firstLift = plan.exercises.find(item => item.mode === 'weight' && !/throw|slam|jump/i.test(item.name ?? ''));
  const pattern = /deadlift|romanian|hinge/i.test(firstLift?.name ?? '') ? 'hinge' : 'squat';
  const desired = plan.kind === 'recovery' ? ['hips', 'thoracic', 'wall']
    : plan.kind === 'sport' ? ['ankle', 'hips', 'arms', 'wall']
      : primer ? ['ankle', 'hips', 'landing']
        : focus.has('jump') ? ['ankle', 'hips', pattern, 'pogo']
          : upperPower ? ['arms', 'thoracic', 'wall']
            : upper && lower ? ['arms', 'wall', 'ankle', 'hips']
              : lower ? ['ankle', 'hips', pattern]
                : upper ? ['arms', 'wall', 'cuff'] : ['easy', 'breathing'];
  const concept = (item: StretchStep) => automatic.get(signature(item)) ?? conceptByKey.get(item.key) ?? conceptByName.get(normalize(item.name));
  const selected: StretchStep[] = [];
  for (const wanted of desired) {
    const exact = available.find(item => concept(item) === wanted && !selected.some(chosen => chosen.key === item.key));
    // A plan without prescribed pogos uses a no-impact landing rehearsal. Never
    // add jump contacts or change an existing prescribed dose for the quick view.
    const fallback = wanted === 'pogo' ? ['landing', 'foot'] : wanted === 'squat' ? ['glute', 'landing', 'lower-rehearsal', 'rehearsal'] : wanted === 'hinge' ? ['glute', 'rehearsal'] : wanted === 'cuff' ? ['scapular', 'upper-rehearsal', 'rehearsal'] : [];
    const match = exact ?? available.find(item => fallback.includes(concept(item) ?? '') && !selected.some(chosen => chosen.key === item.key));
    if (match) selected.push(match);
  }
  // Unknown/custom sessions still have an immediately usable saved routine.
  if (selected.length < 2) {
    for (const item of available) {
      if (selected.length >= Math.min(3, available.length)) break;
      if (!selected.some(chosen => chosen.key === item.key)) selected.push(item);
    }
  }
  return selected;
}

export function getQuickWarmupPresentation(plan: WarmupPlan): { title: string; duration: string; purpose: string; rampUp: string } {
  const detailed = getWarmupPresentation(plan);
  const firstLift = plan.exercises.find(item => item.mode === 'weight' && !/throw|slam|jump/i.test(item.name ?? ''));
  const primer = /primer|technique/i.test(plan.name ?? '');
  const focus = focusFor(plan.exercises);
  const jumping = focus.has('jump');
  const upperPower = isUpperPower(plan.exercises, plan.goal, ['shoulders', 'chest', 'back', 'biceps', 'triceps'].some(value => focus.has(value as Focus)));
  const rampUp = plan.programRevision === '8.1' && /main jump.*heavy lower a/i.test(plan.name ?? '')
    ? 'Build jump intensity gradually. At Hack Squat, take 2–4 progressively loaded practice sets; reduce reps as load rises and stay fresh. Rehearse the RDL lightly before its working sets.'
    : plan.programRevision === '8.1' && /heavy lower b/i.test(plan.name ?? '')
      ? 'Build up with 2–4 lighter sets of Leg Press before working sets. If replacing it with Trap Bar Deadlift, start with empty-bar technique; do not add it on top.'
    : plan.kind === 'recovery' ? 'Stay easy. Add more mobility only where it feels useful.'
    : plan.kind === 'sport' ? 'Build court movement and hitting speed gradually before full play.'
      : primer ? 'Use your planned progressive jumps. Do not add extra contacts.'
        : jumping ? 'Build jump intensity gradually. Take light ramp-up sets before heavy lifts.'
          : upperPower ? 'Build throwing speed gradually. Use light ramp-up sets at the first lift.'
          : firstLift ? `Then build up with lighter sets of ${firstLift.name}.`
            : 'Build the first movement gradually before working sets.';
  return { ...detailed, duration: plan.programRevision === '8.1' && /main jump.*heavy lower a/i.test(plan.name ?? '') ? '6–9 min'
    : plan.programRevision === '8.1' && /heavy lower b/i.test(plan.name ?? '') ? '5–7 min'
    : plan.kind === 'recovery' ? '2–3 min' : plan.kind === 'sport' || jumping ? '4–5 min' : '3–4 min', rampUp };
}

/** One glanceable instruction; saved technique remains available in details. */
export function getQuickWarmupCue(item: StretchStep): string {
  const concept = conceptByName.get(normalize(item.name));
  const cues: Record<string, string> = {
    easy: 'Move easily; breathe comfortably.', arms: 'Circle gently; stay comfortable.',
    wall: 'Ribs down. Slide without shrugging.', thoracic: 'Turn gently; keep hips quiet.',
    ankle: 'Heel down. Guide the knee forward smoothly.', hips: 'Turn gently through a comfortable hip range.',
    squat: 'Feet planted. Knees follow the toes.', hinge: 'Soft knees. Hips back; keep the back comfortable.',
    glute: 'Lift through the hips without arching the back.', cuff: 'Use a light load; keep elbows by your sides.',
    scapular: 'Draw the shoulder blades back; keep the neck easy.', landing: 'Settle softly; knees track with the feet.',
    foot: 'Keep the heel and both toe bases grounded.', pogo: 'Light, quick contacts. Skip if calves or Achilles hurt.',
    breathing: 'Exhale gently and let the ribs settle.', rehearsal: 'Start very light. Finish ready, not tired.',
  };
  return cues[concept ?? ''] ?? item.cue.split(/(?<=[.!?])\s/)[0];
}

/** Small shared labels for the preview and the preparation sheet. No session is created. */
export function getWarmupPresentation(plan: WarmupPlan): { title: string; duration: string; purpose: string } {
  const focus = focusFor(plan.exercises);
  const upper = ['shoulders', 'chest', 'back', 'biceps', 'triceps'].some(item => focus.has(item as Focus));
  const lower = ['quads', 'glutes', 'hamstrings', 'hips', 'adductors', 'calves'].some(item => focus.has(item as Focus));
  if (plan.kind === 'recovery') return { title: 'Easy Movement Preparation', duration: '5 min', purpose: 'Move gently, breathe easily and ease into mobility.' };
  if (plan.kind === 'sport') return { title: 'Court Preparation', duration: '6–8 min', purpose: 'Prepare ankles, hips and shoulders for court movement.' };
  if (/primer|technique/i.test(plan.name ?? '')) return { title: 'Technique Preparation', duration: '5–6 min', purpose: 'Find your rhythm without adding fatigue or extra jump contacts.' };
  if (focus.has('jump')) return { title: 'Jump + Lower Power Preparation', duration: '8–12 min', purpose: 'Prepare your ankles, hips and landing pattern for fast, high-quality jumps.' };
  if (isUpperPower(plan.exercises, plan.goal, upper)) return { title: 'Upper Power Preparation', duration: '6–10 min', purpose: 'Prepare shoulders, shoulder blades and trunk for fast, controlled throws.' };
  if (upper && lower) return { title: 'Full-Body Preparation', duration: '8–12 min', purpose: 'Prepare the movement patterns in this session without tiring them out.' };
  if (lower) return { title: 'Lower Strength Preparation', duration: '8–10 min', purpose: 'Prepare your hips, ankles and trunk for controlled force production.' };
  if (upper) return { title: 'Upper Body Preparation', duration: '6–8 min', purpose: 'Prepare shoulders and upper back for clean pressing and pulling.' };
  return { title: 'Movement Preparation', duration: '5–6 min', purpose: 'Build warmth and rehearse today’s movements gently.' };
}

type WarmupAlternative = Pick<StretchStep, 'name' | 'target' | 'cue'>;
export interface WarmupStepInfo { benefit: string; technique: string; followUp?: string; alternatives: WarmupAlternative[] }
const alternative = (name: string, target: string, cue: string): WarmupAlternative => ({ name, target, cue });
const benefits: Record<string, string> = {
  easy: 'Build warmth without fatigue.', arms: 'Open a comfortable shoulder range.', wall: 'Prepare shoulder-blade control.',
  thoracic: 'Free up upper-back rotation.', ankle: 'Prepare ankle range for takeoff and squatting.', hips: 'Prepare hip rotation and control.',
  squat: 'Rehearse knee and hip coordination.', hinge: 'Prepare the hamstrings and hip-hinge pattern.', foot: 'Find a stable foot tripod.',
  lunge: 'Rehearse controlled single-leg loading.',
  jump: 'Build jump speed gradually.', rehearsal: 'Practice the strength pattern before loading it.', breathing: 'Settle ribs and breathing.',
  cuff: 'Prepare shoulder rotation with a light load.', scapular: 'Activate the upper back gently.', glute: 'Prepare hip extension and pelvic control.',
  trunk: 'Prepare trunk control for loading.', landing: 'Rehearse a quiet, controlled landing.', 'upper-power': 'Build throwing speed without fatigue.',
  pogo: 'Prepare light, quick ankle contacts.', 'upper-rehearsal': 'Practice today’s upper-body pattern.', 'lower-rehearsal': 'Practice today’s lower-body pattern.',
};

/** Alternatives are low-dose preparation, never permission to train through pain. */
export function getWarmupStepInfo(item: StretchStep, plan: WarmupPlan): WarmupStepInfo {
  const concept = conceptByName.get(normalize(item.name));
  const choices: Record<string, WarmupAlternative[]> = {
    easy: [alternative('Easy March in Place', '2–3 min', 'March at an easy pace and swing the arms. Keep breathing comfortable.')],
    arms: [alternative('Small Shoulder Rolls', '8 each direction', 'Roll the shoulders gently through a comfortable range. Do not force it.')],
    wall: [alternative('Standing Scapular Circles', '6 each direction', 'With arms relaxed, gently move the shoulder blades up, back and down. Keep the neck easy.')],
    thoracic: [alternative('Standing Upper-Back Rotation', '6 / side', 'Cross the arms and rotate gently through the upper back. Keep hips quiet.')],
    ankle: [alternative('Supported Ankle Rock', '6–8 / side', 'Hold a support and move the knee gently over the toes with heel planted. Keep it pain-free.')],
    hips: [alternative('Supported Hip Circles', '5 each direction / side', 'Hold a support and circle one knee gently. Use a comfortable range without twisting the back.')],
    squat: [alternative('Sit-to-Stand Rehearsal', '6 easy reps', 'Use a stable bench or chair. Sit and stand slowly with feet planted; use support if needed.')],
    lunge: [alternative('Supported Split-Squat Rehearsal', '5 / side', 'Hold a stable support and use a shallow, pain-free split squat. Keep the front foot grounded and the knee aligned.')],
    hinge: [alternative('Hip Hinge to Wall', '6 easy reps', 'Stand a short step from a wall and reach the hips back to touch it. Keep a comfortable neutral back.')],
    glute: [alternative('Standing Glute Squeeze', '6 × 3 sec', 'Stand tall and gently squeeze both glutes. Keep the ribs down; do not arch the back.')],
    trunk: [alternative('Standing Brace + Breath', '4 easy breaths', 'Stand tall. Exhale gently, then keep light abdominal tension while breathing normally.')],
    foot: [alternative('Seated Foot Tripod', '15 sec / side', 'Sit with heel and both toe bases grounded. Lift the arch gently without curling the toes.')],
    cuff: [alternative('Unresisted External Rotation', '8 / side', 'Keep elbows by the ribs and turn the forearms outward slowly. Stay within a pain-free range.')],
    scapular: [alternative('Standing Scapular Retraction', '8 easy reps', 'With arms relaxed, gently draw shoulder blades back. Do not shrug or squeeze hard.')],
    landing: [alternative('Supported Quarter Squat', '4 easy reps', 'Hold a support and lower into a shallow squat. Keep feet planted and knees aligned; no impact.')],
    jump: [alternative('No-Impact Takeoff Rehearsal', '3 slow reps', 'Rehearse the arm swing and rise onto the toes without leaving the ground. If pain remains, avoid maximal jumping and adjust the main session.')],
    pogo: [alternative('Easy March in Place', '30 sec', 'Use easy, non-impact steps. If calves or Achilles hurt, avoid maximal jumping and adjust today’s session.')],
    'upper-power': [alternative('Unloaded Throw Rehearsal', '3 easy reps', 'Rehearse the arm path without a ball or release. Keep ribs controlled and stay pain-free.')],
    rehearsal: [alternative('Unloaded Pattern Rehearsal', '4–6 easy reps', 'Practice the first lift’s movement without equipment. Still build load gradually at the lift before working sets.')],
    breathing: [alternative('Seated Easy Breathing', '4 breaths', 'Sit comfortably and breathe slowly. Let the ribs settle without forcing the breath.')],
  };
  const firstStrength = plan.exercises.find(exercise => exercise.mode === 'weight' && !/throw|slam|jump/i.test(exercise.name ?? ''))
    ?? plan.exercises.find(exercise => /squat|press|deadlift|row|pull.?up|pulldown/i.test(exercise.name ?? ''));
  const rehearsal = concept === 'rehearsal' || concept?.endsWith('-rehearsal');
  const followUp = rehearsal && firstStrength
    ? `At ${firstStrength.name}: build up with 2–4 easy practice sets before working sets. Start very light, reduce reps as load rises and stay well short of fatigue.${/pull.?up/i.test(firstStrength.name ?? '') ? ' Use more assistance for the easy sets.' : ''}`
    : concept === 'jump' || concept === 'pogo' || concept === 'landing'
      ? 'Keep preparation easy. Stop impact work if pain appears or landings feel uncontrolled; adjust the main session too.'
      : undefined;
  return { benefit: benefits[concept ?? ''] ?? 'Your saved preparation drill.', technique: item.cue,
    ...(followUp ? { followUp } : {}), alternatives: [
      ...(choices[concept ?? ''] ?? []),
      ...Object.values(W).filter(template => template.concept === concept && template.name !== item.name)
        .map(({ name, target, cue }) => ({ name, target, cue })),
    ].filter(choice => choice.name !== item.name) };
}

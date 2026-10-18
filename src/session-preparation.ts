import { DEFAULT_PROFILE } from './domain.js';
import { findLibraryExercise } from './exercise-library.ts';
import { createVolleyballMasterPlan } from './volleyball-master-plan.ts';
import { getStretchRoutine, type StretchStep } from './stretch-routine.ts';

export interface PreparationExercise {
  exerciseId?: string;
  key?: string;
  name?: string;
  group?: string;
  logs?: readonly { done: boolean }[];
}
export interface SessionPreparationOptions {
  phase: 'warmup' | 'cooldown';
  kind: 'strength' | 'sport' | 'recovery';
  exercises: readonly PreparationExercise[];
  items?: readonly StretchStep[];
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
  rehearsal: step('warmup', 'rehearsal', 'Light Rehearsal Sets', '1–3 gradual sets', 'Rehearse the next strength movement with light loads. Build toward working weight without fatigue.'),
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
  ['Band / Cable External Rotation', 'wall'], ['Light Face Pull', 'wall'],
  ['Leg Swings', 'hips'], ['Walking Lunge + Rotation', 'hips'], ['Walking Lunge + Reach', 'hips'],
  ['Mini-Band Lateral Walk', 'hips'],
]) conceptByName.set(normalize(name), concept);

// Only exact shipped defaults are replaceable. Renamed steps or edited targets/cues are custom.
// This registry reads recommendation templates; it never mutates a plan or saved session.
const signature = (item: Omit<StretchStep, 'done'>) => JSON.stringify([item.key, item.name, item.target, item.cue]);
const automatic = new Map<string, string>();
const register = (items: readonly Omit<StretchStep, 'done'>[]) => {
  for (const item of items) {
    const concept = conceptByName.get(normalize(item.name));
    if (concept) automatic.set(signature(item), concept);
  }
};
register(allTemplates);
register(getStretchRoutine());
for (const day of [...DEFAULT_PROFILE.plan, ...createVolleyballMasterPlan(), ...createVolleyballMasterPlan(true)]) {
  register(day.warmup ?? []);
  register(day.cooldown ?? []);
  if (day.extraSession) { register(day.extraSession.warmup ?? []); register(day.extraSession.cooldown ?? []); }
}

function focusFor(exercises: readonly PreparationExercise[]): Set<Focus> {
  const focus = new Set<Focus>();
  for (const exercise of exercises) {
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

function suggestions({ phase, kind, exercises, completedOnly }: SessionPreparationOptions): Template[] {
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
  const lower = ['quads', 'glutes', 'hamstrings', 'hips', 'adductors', 'calves'].some(item => focus.has(item as Focus));
  if (phase === 'warmup') {
    const result = [W.easy];
    if (upper) { result.push(W.arms, W.wall); if (focus.has('back')) result.push(W.thoracic); }
    if (lower) {
      result.push(W.ankle);
      if (focus.has('quads') || focus.has('glutes') || focus.has('hips') || focus.has('adductors')) result.push(W.hips);
      if (focus.has('quads')) result.push(W.squat);
      if (focus.has('hamstrings')) result.push(W.hinge);
    }
    if (focus.has('jump')) result.push(W.foot, W.jump);
    else if (upper || lower) result.push(W.rehearsal);
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
      if (concept) {
        supplied.add(concept);
        if (concept.endsWith('-rehearsal')) supplied.add('rehearsal');
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

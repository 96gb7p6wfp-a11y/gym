import { findLibraryExercise } from './exercise-library.ts';
import type { PlanDay, PlanExercise } from './workout-customization';
import type { MasterProgramSettings, MasterReadiness } from './volleyball-master-plan';

/** The prescription revision is independent of the installed Setline version. */
export const V9_PROGRAM_NAME = 'Volleyball Performance Plan V9 — Collegiate-Style Performance';

const prep = (key: string, name: string, target: string, cue: string) => ({
  key: `v9-prep-${key}`, name, target, cue, done: false,
});
const cooldown = () => [prep('cooldown', 'Easy Walk + Comfortable Mobility', '3–5 min', 'Finish with easy breathing and comfortable, pain-free movement.')];
const upperPreparation = () => [
  prep('upper-warm', 'Easy Upper-Body Movement', '2 min', 'Easy walking or cycling with comfortable arm movement; warm up without fatigue.'),
  prep('wall-slide', 'Wall Slide', '6–8 reps', 'Move comfortably without arching or forcing the shoulder.'),
  prep('cuff', 'Light External Rotation', '8 / side', 'Very light controlled resistance; stop painful movements.'),
  prep('throw-rehearsal', 'Light Throwing Rehearsal', '3 gradual reps', 'Light ball, approved clear area; build speed gradually within your recorded guidance.'),
];
const lowerPreparation = (jump = false) => [
  prep('lower-warm', 'Easy Walk or Bike', '2–3 min', 'Raise temperature gradually, not to fatigue.'),
  prep('ankle', 'Ankle Knee-to-Wall', '6 / side', 'Keep the heel down; use a comfortable ankle range.'),
  prep('hips', 'Dynamic Hip Mobility', '6 / side', 'Move smoothly without forcing range.'),
  prep('squat', 'Bodyweight Squat + Hinge', '6 each', 'Practice a controlled squat and unloaded hip hinge.'),
  ...(jump ? [prep('landing', 'Landing + Progressive Jump Preparation', '3 gradual attempts', 'Only when impact-cleared: rehearse quiet stable landings and progress from easy to faster jumps. Stop if control declines.')] : []),
];

function ex(key: string, name: string, section: string, group: string, sets: number, target: string, rest: number,
  options: Partial<PlanExercise> = {}): PlanExercise {
  // The catalogue retains historical canonical IDs (for example `rdl` and
  // `cmj`). A factory may use a descriptive legacy ID, but new records should
  // carry the actual catalogue identity rather than an unresolvable spelling.
  const movement = findLibraryExercise(options.exerciseId ?? name) ?? findLibraryExercise(name);
  return {
    key: `master-v9-${key}`, name, section, group, sets, target, rest, mode: 'weight', perSide: false,
    ...options, ...(movement ? { exerciseId: movement.id } : {}),
  };
}
const strength = (options: Partial<PlanExercise> = {}): Partial<PlanExercise> => ({ targetRir: 2, targetRpe: 8, ...options });
const hypertrophy = (options: Partial<PlanExercise> = {}): Partial<PlanExercise> => ({ targetRir: 1.5, targetRpe: 8.5, ...options });
const sprintSafety = 'Use a genuinely unobstructed, non-slip lane with enough deceleration distance. Never sprint between gym machines. Move this block to a sports hall or suitable outdoor area, or omit it if no safe space is available. Log distance; enter a time only if actually measured.';
const jumpQuality = 'Full reset and prescribed rest. Stop the explosive block if speed, height, landing control or coordination deteriorates; the dose is a ceiling, not a quota.';

export function createV9Recovery(note = 'Optional easy walking, mobility, light cycling or full rest. No additional heavy lower-body day or catch-up work.'): PlanDay {
  return { programRevision: '9', programSessionId: 'v9-recovery', name: 'Recovery', kind: 'recovery', goal: 'recovery',
    minutes: 20, durationRange: 'Optional', note, exercises: [], warmup: [], cooldown: [] };
}

/** Complete unmodified recommendations; runtime safety and phase changes are separate. */
export function createV9VolleyballMasterPlan(matchWeek = false): PlanDay[] {
  const plan: PlanDay[] = [
    { programRevision: '9', programSessionId: 'v9-upper-a', name: 'Upper A — Spike Power + Strength', kind: 'strength', goal: 'power',
      minutes: 92, durationRange: '85–100 min', note: 'Spike power, upper-body strength and athletic muscle. Fast controlled throws first. Main lifts and isolation: RIR 1–2; shoulder press RIR 2. Complete specific lighter press/pull sets before demanding work. Increase load only after every working set meets the rep target at the prescribed effort.',
      warmup: upperPreparation(), cooldown: cooldown(), exercises: [
        ex('spike', 'Medicine Ball Spike Slam', 'Upper A', 'Power', 4, '3 reps', 90,
          { exerciseId: 'spike-slam', defaultKg: 2, cue: 'Use an appropriately light ball, about 2–3 kg initially. Two-handed overhead explosive action, not a heavy one-handed spike imitation. Maximum controlled speed, reset between repetitions.' }),
        ex('pullup', 'Pull-ups / Assisted Pull-ups', 'Upper A', 'Back', 3, '5–8 reps', 180,
          strength({ exerciseId: 'pull-up', mode: 'bodyweight', restRange: '120–180 sec', cue: 'RIR 1–2. Full controlled range. Use assistance as needed; log added load only, and record assistance separately in notes.' })),
        ex('incline-a', 'Incline Machine Press', 'Upper A', 'Chest', 3, '6–10 reps', 180,
          strength({ exerciseId: 'incline-machine-press', restRange: '120–180 sec', cue: 'RIR 1–2. Controlled lowering, comfortable shoulder position and strong upward intent.' })),
        ex('row-a', 'Chest-Supported Row', 'Upper A', 'Back', 3, '8–12 reps', 120,
          strength({ cue: 'RIR 1–2. Keep the chest supported and lower under control.' })),
        ex('shoulder-press', 'Single-Arm DB Shoulder Press', 'Upper A', 'Shoulders', 2, '6–8 reps', 90,
          strength({ exerciseId: 'single-arm-dumbbell-press', perSide: true, cue: 'RIR 2 per side. Steady trunk, comfortable overhead range; do not force through pain.' })),
        ex('lateral', 'Cable Lateral Raise', 'Upper A', 'Shoulders', 3, '12–20 reps', 75,
          hypertrophy({ restRange: '60–75 sec', cue: 'RIR 1–2, controlled repetitions without swinging.' })),
        ex('rear', 'Reverse Pec Deck', 'Upper A', 'Shoulders', 2, '12–20 reps', 75,
          hypertrophy({ restRange: '60–75 sec', cue: 'RIR 1–2. Move the arms under control without shrugging.' })),
        ex('rotation-isometric', 'Cable External-Rotation Isometric', 'Upper A', 'Shoulder control', 2, '20 sec', 60,
          { exerciseId: 'external-rotation-isometric', mode: 'timed', perSide: true, restRange: '45–60 sec', targetRpe: 6, cue: 'Moderate controlled effort, 20 seconds each side. Breathe steadily; do not chase maximal resistance.' }),
        ex('crunch', 'Cable Crunch', 'Upper A', 'Core', 3, '10–15 reps', 60, hypertrophy({ cue: 'RIR 1–2. Controlled trunk flexion and steady breathing.' })),
        ex('curl', 'Dumbbell Biceps Curl', 'Upper A', 'Arms', 2, '8–12 reps', 60, hypertrophy({ exerciseId: 'biceps-curl', cue: 'RIR 1–2. Keep the upper arms steady.' })),
        ex('pushdown', 'Triceps Pushdown', 'Upper A', 'Arms', 2, '10–15 reps', 60, hypertrophy({ exerciseId: 'triceps', cue: 'RIR 1–2. Extend the elbows without swinging the torso.' })),
      ] },
    { programRevision: '9', programSessionId: 'v9-tuesday-volleyball', name: 'Volleyball + Approach Technique', kind: 'sport', goal: 'sport',
      minutes: 120, durationRange: 'Practice + optional 10 min', startTime: '20:00', note: 'Tuesday volleyball 20:00–22:00. Log actual practice duration and exposure afterward. Optional technical work may be skipped if practice already covers it; planned work is never automatically completed.',
      warmup: [], cooldown: [], exercises: [ex('volleyball', 'Volleyball practice', 'Volleyball', 'Sport', 1, '120 min', 0, { mode: 'timed' })],
      extraSession: { programRevision: '9', programSessionId: 'v9-approach-technique', name: 'Optional Approach Technique', kind: 'strength', goal: 'mobility', minutes: 10, durationRange: 'Optional · 10 min',
        note: 'Approach rhythm, penultimate step, arm-swing timing and coordinated plant. Home version needs no maximal indoor jumps. Rehearse submaximally in a clear area; skip when practice already provides this work.', warmup: [], cooldown: [], exercises: [
          ex('rhythm', 'Three-Step L-R-L Rhythm', 'Approach technique', 'Technique', 3, '3 reps', 30, { mode: 'bodyweight', exerciseId: 'slow-approach-rhythm', cue: 'Rehearse your usual takeoff pattern; mirror the lead pattern if appropriate. No maximal jump.' }),
          ex('penultimate', 'Penultimate-Step + Plant Rehearsal', 'Approach technique', 'Technique', 3, '2 reps', 30, { mode: 'bodyweight', exerciseId: 'penultimate-step', cue: 'Build a smooth penultimate step and quick controlled plant without an aggressive takeoff.' }),
          ex('arm-swing', 'Arm-Swing Timing Drill', 'Approach technique', 'Technique', 2, '5 reps', 30, { mode: 'bodyweight', exerciseId: 'arm-swing-drill', cue: 'Coordinate relaxed arm swing with the plant; stable trunk and comfortable shoulders.' }),
          ex('full-approach', 'Full Approach Rehearsal', 'Approach technique', 'Technique', 3, '1 rep', 45, { mode: 'bodyweight', exerciseId: 'slow-approach-rhythm', cue: 'Submaximal rehearsal only. Home version is footwork and arm swing without a maximal indoor jump.' }),
        ] } },
    { programRevision: '9', programSessionId: 'v9-speed-lower-a', name: 'Speed + Jump + Heavy Lower A', kind: 'strength', goal: 'jump', minutes: 110,
      durationRange: '100–120 min', note: 'Four blocks: acceleration; maximal/reactive jumps; three Hack Squat → rest → CMJ → rest complex rounds; strength and stability. The Hack Squat dose is three total working sets, never three additional sets afterward. Main programmed jump ceiling: 24 contacts. Quality and recovery take priority.',
      warmup: lowerPreparation(true), cooldown: cooldown(), exercises: [
        ex('sprint-5m', '5 m Acceleration', 'A · Acceleration', 'Speed', 2, '5 m', 90, { mode: 'bodyweight', exerciseId: 'acceleration-sprint-5m', quantityUnit: 'm', prescribedDistanceM: 5, restRange: '60–90 sec', cue: sprintSafety }),
        ex('sprint-10m', '10 m Acceleration', 'A · Acceleration', 'Speed', 2, '10 m', 90, { mode: 'bodyweight', exerciseId: 'acceleration-sprint', quantityUnit: 'm', prescribedDistanceM: 10, restRange: '60–90 sec', cue: sprintSafety }),
        ex('approach', 'Maximal Three-Step Approach Jump', 'B · Maximal Jump + Reactive Work', 'Jump', 4, '2 reps', 180, { mode: 'bodyweight', exerciseId: 'approach-jump', measurement: 'touch', jumpContactsPerRep: 1, restRange: '120–180 sec', cue: 'Maximal height with full reset. Optional measured touch stays distinct from jump height. '+jumpQuality }),
        ex('drop', 'Low Drop Jump, 15–20 cm', 'B · Maximal Jump + Reactive Work', 'Reactive', 2, '2 reps', 120, { mode: 'bodyweight', exerciseId: 'drop-jump', jumpContactsPerRep: 1, cue: 'Begin around 15–20 cm only when familiar with stable landings. Start with landing progressions if unfamiliar. Quick controlled rebound; never auto-increase box height. '+jumpQuality }),
        ex('loaded-jump', 'Light Dumbbell Squat Jump', 'B · Maximal Jump + Reactive Work', 'Power', 2, '3 reps', 120, { exerciseId: 'light-dumbbell-squat-jump', jumpContactsPerRep: 1, cue: 'Use technically manageable loading, approximately 2–4 kg per hand initially when appropriate. Record the actual chosen load; no automatic increase. '+jumpQuality }),
        ex('hack', 'Hack Squat', 'C · Heavy Hack Squat + CMJ Complex', 'A1 · Complex pair', 3, '4–6 reps', 240, strength({ exerciseId: 'hack-squat', restRange: '180–240 sec', cue: 'RIR 2. Controlled lowering, powerful upward intent. Rest 3–4 minutes, then two CMJs. Three working sets total; do not add a second Hack Squat block.' })),
        ex('cmj', 'Countermovement Jump', 'C · Heavy Hack Squat + CMJ Complex', 'A2 · Complex pair', 3, '2 reps', 180, { mode: 'bodyweight', exerciseId: 'countermovement-jump', measurement: 'height', jumpContactsPerRep: 1, restRange: '120–180 sec', cue: 'Full arm swing and maximum controlled height. Rest 2–3 minutes before the next Hack Squat round. '+jumpQuality }),
        ex('rdl', 'Romanian Deadlift', 'D · Heavy Strength + Stability', 'Hamstrings', 3, '5–7 reps', 180, strength({ exerciseId: 'romanian-deadlift', restRange: '120–180 sec', cue: 'RIR 2. Controlled hinge, load close and comfortable hamstring-limited range. Do not force through back pain.' })),
        ex('bulgarian-a', 'Bulgarian Split Squat', 'D · Heavy Strength + Stability', 'Single-leg strength', 3, '6 reps', 120, strength({ exerciseId: 'bulgarian-split-squat', perSide: true, cue: 'RIR 2 per leg. Start with the weaker side and match controlled reps and loading.' })),
        ex('soleus', 'Seated Calf Raise', 'D · Heavy Strength + Stability', 'Calves', 3, '8–12 reps', 90, strength({ cue: 'Controlled rise and lowering; no bouncing or painful range.' })),
        ex('pallof', 'Pallof Press Isometric Hold', 'D · Heavy Strength + Stability', 'Core', 2, '20 sec', 60, { mode: 'timed', exerciseId: 'pallof-isometric-hold', perSide: true, targetRpe: 6, cue: '20 seconds each side. Steady ribs and pelvis, resist rotation and breathe normally.' }),
        ex('suitcase', 'DB Suitcase Carry / Static Hold', 'D · Heavy Strength + Stability', 'Core', 2, '30 sec', 60, { mode: 'timed', exerciseId: 'suitcase-static-hold', perSide: true, targetRpe: 7, cue: '30 seconds per side, not 30 reps. Carry only in a clear area or hold statically; remain tall without leaning.' }),
      ] },
    { programRevision: '9', programSessionId: 'v9-agility-upper-b', name: 'Agility + Upper B', kind: 'strength', goal: 'hypertrophy', minutes: 95,
      durationRange: '85–105 min', note: 'Defensive movement and agility first, then rotational power and demanding upper-body hypertrophy. Main presses/pulls and isolation: RIR 1–2. External rotation and Push-Up Plus stay controlled. Use a clear non-slip movement area; never cut around gym machines.',
      warmup: [prep('agility-area', 'Easy Defensive Footwork', '2 min', 'Check a clear non-slip area, then rehearse slow shuffles and controlled plants.'), ...upperPreparation().slice(1)], cooldown: cooldown(), exercises: [
        ex('shuffle', 'Lateral Shuffle → Plant → Accelerate', 'A · Defensive Movement + Agility', 'Speed', 3, '2 reps', 90, { mode: 'bodyweight', exerciseId: 'lateral-shuffle-plant-accelerate', perSide: true, restRange: '60–90 sec', cue: 'Two efforts per side: shuffle 2–3 m, plant, accelerate 3–5 m. Use an unobstructed non-slip area with room to stop; never perform aggressive changes of direction around gym machines.' }),
        ex('reaction', 'Split-Step Reaction Drill', 'A · Defensive Movement + Agility', 'Speed', 3, '4 reactions', 60, { mode: 'bodyweight', exerciseId: 'split-step-reaction', cue: 'Respond to unpredictable left/right cues from a partner or optional randomized audio aid. Use a clear non-slip area. Log completed reactions only; do not invent reaction times.' }),
        ex('rotation', 'Medicine-Ball Rotational Wall Throw', 'B · Upper B', 'Power', 3, '3 reps', 90, { exerciseId: 'rotational-throw', perSide: true, defaultKg: 2, cue: 'Maximum controlled speed with a light ball and suitable throwing wall. Reset each repetition; three per side. Stop if shoulder or trunk symptoms occur.' }),
        ex('pulldown', 'Lat Pulldown', 'B · Upper B', 'Back', 3, '8–10 reps', 120, strength({ cue: 'RIR 1–2. Controlled full-range pulling without excessive backward lean.' })),
        ex('row-b', 'Chest-Supported Row', 'B · Upper B', 'Back', 3, '8–12 reps', 120, strength({ cue: 'RIR 1–2. Keep the chest supported and lower under control.' })),
        ex('incline-b', 'Low-Incline Machine Press', 'B · Upper B', 'Chest', 3, '8–12 reps', 120, strength({ exerciseId: 'incline-machine-press', cue: 'RIR 1–2. Comfortable shoulder position and controlled pressing.' })),
        ex('lateral', 'Cable Lateral Raise', 'B · Upper B', 'Shoulders', 3, '12–20 reps', 75, hypertrophy({ restRange: '60–75 sec' })),
        ex('rear', 'Reverse Pec Deck', 'B · Upper B', 'Shoulders', 2, '12–20 reps', 75, hypertrophy({ restRange: '60–75 sec' })),
        ex('rotation-cuff', 'Cable External Rotation', 'B · Upper B', 'Shoulder control', 2, '12–15 reps', 45, { perSide: true, targetRpe: 6, cue: 'Controlled light resistance, not maximal loading. Keep the elbow stable and avoid trunk rotation.' }),
        ex('pushup-plus', 'Push-Up Plus', 'B · Upper B', 'Shoulder control', 2, '10–12 reps', 60, { mode: 'bodyweight', exerciseId: 'push-up-plus', targetRpe: 6, cue: 'Controlled push-up and comfortable scapular protraction. Use an appropriate incline if needed; avoid maximal straining.' }),
        ex('crunch', 'Cable Crunch', 'B · Upper B', 'Core', 3, '10–15 reps', 60, hypertrophy()),
        ex('hammer', 'Hammer Curl', 'B · Upper B', 'Arms', 2, '10–15 reps', 60, hypertrophy()),
        ex('pushdown', 'Triceps Pushdown', 'B · Upper B', 'Arms', 2, '10–15 reps', 60, hypertrophy({ exerciseId: 'triceps' })),
      ] },
    { programRevision: '9', programSessionId: 'v9-friday-sport', name: 'School PE + Volleyball', kind: 'sport', goal: 'sport', minutes: 120,
      durationRange: 'PE ~2 h + volleyball', startTime: '20:00', note: 'School PE about two hours plus volleyball 20:00–22:00 is substantial physical workload, not full recovery. No gym training. Record actual PE/practice duration, exertion and jump exposure; planned activities are not completed logs. Check Saturday readiness after this day.',
      warmup: [], cooldown: [], exercises: [ex('volleyball', 'Volleyball practice', 'Volleyball', 'Sport', 1, '120 min', 0, { mode: 'timed' })] },
    { programRevision: '9', programSessionId: 'v9-lower-b', name: 'Lower B — Full Strength', subtitle: 'Speed + Lower-Body Strength', kind: 'strength', goal: 'strength', minutes: 95,
      durationRange: '85–105 min', note: 'Complete no-match Saturday prescription: speed, unilateral jumps, heavy lower strength and conditioning. Friday PE and volleyball require a quick readiness check. Green retains the base dose within recorded guidance; Yellow/Red are visibly modified. No extra volume to repay missed workouts.',
      warmup: lowerPreparation(), cooldown: cooldown(), exercises: [
        ex('sprint-10m', '10 m Acceleration', 'Lower B', 'Speed', 4, '10 m', 90, { mode: 'bodyweight', exerciseId: 'acceleration-sprint', quantityUnit: 'm', prescribedDistanceM: 10, cue: sprintSafety }),
        ex('split-jump', 'Split-Squat Jump', 'Lower B', 'Jump', 2, '3 reps', 120, { mode: 'bodyweight', exerciseId: 'split-squat-jump', perSide: true, jumpContactsPerRep: 2, cue: 'Three jumps per leg per set: six contacts each set. Stable landings and full reset. '+jumpQuality }),
        ex('leg-press', 'Leg Press', 'Lower B', 'Quads', 3, '5–8 reps', 180, strength({ cue: 'Challenging controlled work with about two reps in reserve. Keep the pelvis supported.' })),
        ex('bulgarian-b', 'Smith Machine Bulgarian Split Squat', 'Lower B', 'Single-leg strength', 3, '6–8 reps', 120, strength({ exerciseId: 'smith-bulgarian-split-squat', perSide: true, cue: 'About RIR 2 per leg. Use a stable support and match controlled repetitions on both sides.' })),
        ex('hip-thrust', 'Hip Thrust Machine', 'Lower B', 'Glutes', 3, '6–8 reps', 120, strength({ exerciseId: 'hip-thrust-machine', cue: 'Strong hip extension with a controlled trunk; avoid arching the low back.' })),
        ex('leg-curl', 'Leg Curl', 'Lower B', 'Hamstrings', 3, '8–12 reps', 90, hypertrophy({ cue: 'RIR 1–2. Use the selected machine consistently and control the lowering.' })),
        ex('calf', 'Standing Calf Raise', 'Lower B', 'Calves', 3, '6–10 reps', 90, strength({ cue: 'Controlled full comfortable range. No bouncing, sharp pain or cramping.' })),
        ex('calf-isometric', 'Standing Calf Isometric Hold', 'Lower B', 'Calves', 2, '30 sec', 90, { mode: 'timed', exerciseId: 'standing-calf-isometric', targetRpe: 7, cue: 'A controlled 30-second standing calf hold with steady breathing; stop painful or cramping effort.' }),
        ex('tibialis', 'Tibialis Raise', 'Lower B', 'Lower leg', 2, '15–20 reps', 60, { mode: 'bodyweight', targetRpe: 7, cue: 'Controlled dorsiflexion without rocking the body.' }),
        ex('copenhagen', 'Copenhagen Plank', 'Lower B', 'Core / adductors', 2, '20–30 sec', 60, { mode: 'timed', perSide: true, targetRpe: 7, cue: '20–30 seconds per side with a stable supported position; use a manageable lever and stop painful work.' }),
        ex('crunch', 'Cable Crunch', 'Lower B', 'Core', 2, '10–15 reps', 60, hypertrophy()),
      ] },
    createV9Recovery(),
  ];
  if (matchWeek) {
    plan[5] = { programRevision: '9', programSessionId: 'v9-match-primer', name: 'Pre-Match Primer', kind: 'strength', goal: 'mobility', minutes: 12, durationRange: '10–15 min',
      note: 'A separate optional pre-match preparation session, not Lower B. No heavy lifting or maximal jumps. The primer itself is the preparation; no extra checklist is needed. If fatigued after Friday, full rest is acceptable.', warmup: [], cooldown: [], exercises: [
        ex('primer-dynamic', 'Easy Dynamic Movement', 'Pre-Match Primer', 'Mobility', 1, '3–4 min', 0, { mode: 'timed', exerciseId: 'light-dynamic-mobility' }),
        ex('primer-mobility', 'Ankle and Hip Mobility', 'Pre-Match Primer', 'Mobility', 1, '3 min', 0, { mode: 'timed', exerciseId: 'light-dynamic-mobility' }),
        ex('primer-footwork', 'Controlled Approach Footwork', 'Pre-Match Primer', 'Technique', 2, '3 reps', 30, { mode: 'bodyweight', exerciseId: 'slow-approach-rhythm', cue: 'Easy coordinated footwork without a maximal takeoff.' }),
        ex('primer-shoulder', 'Light Shoulder Activation', 'Pre-Match Primer', 'Shoulder control', 2, '10 reps', 30, { mode: 'bodyweight', exerciseId: 'band-pull-apart', targetRpe: 4, cue: 'Gentle comfortable activation, no heavy loading or fatigue.' }),
        ex('primer-walk', 'Relaxed Walking', 'Pre-Match Primer', 'Recovery', 1, '3 min', 0, { mode: 'timed', exerciseId: 'walk', optionalWork: true }),
      ] };
    plan[6] = { programRevision: '9', programSessionId: 'v9-match', name: 'Volleyball Match', kind: 'sport', goal: 'sport', minutes: 90, durationRange: 'Log actual duration',
      note: 'Confirmed Sunday match. Start time stays unset unless supplied. Log actual playing duration, exertion and jump exposure; the planning duration is not a recorded result. No additional gym session.', warmup: [], cooldown: [],
      exercises: [ex('match', 'Volleyball match', 'Match', 'Sport', 1, 'Match · log actual min', 0, { mode: 'timed' })] };
  }
  return plan;
}

export function v9ExplosiveExercise(item: PlanExercise): boolean {
  return !!item.jumpContactsPerRep || item.quantityUnit === 'm' || item.group === 'Speed'
    || ['master-v9-spike', 'master-v9-rotation'].includes(item.key)
    || /\b(?:jumps?|hops?|bounds?|throws?|slams?|sprints?|accelerat(?:ion|e))\b/i.test(item.name);
}
function unlinkComplex(exercises: PlanExercise[]): PlanExercise[] {
  const hack = exercises.findIndex(item => item.group === 'A1 · Complex pair');
  const cmj = exercises.findIndex(item => item.group === 'A2 · Complex pair');
  if (hack >= 0 && cmj === hack + 1 && !exercises[hack].preparationOnly && !exercises[cmj].preparationOnly
    && exercises[hack].sets === exercises[cmj].sets) return exercises;
  return exercises.map(item => /complex pair/i.test(item.group) ? { ...item, group: item.jumpContactsPerRep ? 'Jump' : 'Strength' } : item);
}
const modifiedTitle = (day: PlanDay) => day.programSessionId === 'v9-lower-b' ? 'Modified Lower B — Reduced Strength'
  : day.programSessionId === 'v9-speed-lower-a' ? 'Modified Speed + Jump + Lower A'
    : day.programSessionId === 'v9-agility-upper-b' ? 'Modified Agility + Upper B'
      : day.programSessionId === 'v9-upper-a' ? 'Modified Upper A' : `Modified — ${day.name}`.slice(0, 80);

/** Changes only a future recommendation, never the stored base or a session. */
export function applyV9Readiness(workout: PlanDay, readiness?: MasterReadiness): PlanDay {
  if (!readiness || readiness === 'green' || workout.kind !== 'strength' || workout.programSessionId === 'v9-approach-technique') return workout;
  if (readiness === 'red') return { ...createV9Recovery('Modified because of self-reported Red readiness. Stop relevant painful/high-impact work; choose comfortable recovery or rest. Sharp pain, worsening tendon symptoms and unstable landings are stop signals. Missing workouts create no training debt.'),
    programSessionId: workout.programSessionId, name: 'Modified — Recovery' };
  if (workout.programSessionId === 'v9-match-primer') return { ...workout, name: 'Modified — Pre-Match Primer or Rest', note: ('Self-reported Yellow after Friday: full rest is acceptable. Keep any chosen primer movement easy and comfortable. '+workout.note).slice(0, 500) };
  const exercises = unlinkComplex(workout.exercises.filter(item => !v9ExplosiveExercise(item)).map(item => {
    const hard = (item.targetRpe ?? 0) >= 8;
    return hard ? { ...item, sets: Math.max(1, item.sets - 1), targetRpe: 7, targetRir: 3 } : { ...item };
  }));
  return { ...workout, name: modifiedTitle(workout), exercises,
    warmup: workout.warmup?.filter(item => !/jump|pogo|throw/i.test(item.name)),
    note: `Modified because of self-reported Yellow readiness: acceleration, reactive/maximal jumps, aggressive agility and ballistic throws omitted; demanding strength sets reduced with more reserve. Full V9 base remains available to review. ${workout.note}`.slice(0, 500) };
}

/** Preserves the full base; lighter phases do not become a new weekly template. */
export function v9PhasePlan(day: PlanDay, week: number): PlanDay {
  if (![4, 8].includes(week) || day.kind !== 'strength' || ['v9-approach-technique', 'v9-match-primer'].includes(day.programSessionId ?? '')) return day;
  const evaluation = week === 8;
  let exercises = day.exercises.flatMap(item => {
    if (evaluation && ['master-v9-drop', 'master-v9-loaded-jump', 'master-v9-split-jump'].includes(item.key)) return [];
    if (item.jumpContactsPerRep) return [{ ...item, sets: Math.max(1, Math.ceil(item.sets * .5)), ...(evaluation ? { target: '1 rep' } : {}) }];
    if (item.group === 'Speed') return [{ ...item, sets: Math.max(1, Math.ceil(item.sets * .5)) }];
    if ((item.targetRpe ?? 0) >= 8) return [{ ...item, sets: Math.max(1, Math.round(item.sets * .65)), targetRpe: Math.min(item.targetRpe ?? 8, 8), targetRir: Math.max(item.targetRir ?? 2, 2) }];
    return [{ ...item }];
  });
  if (evaluation && day.programSessionId === 'v9-speed-lower-a') {
    const cmj = exercises.find(item => item.key === 'master-v9-cmj');
    exercises = exercises.filter(item => item.key !== 'master-v9-cmj');
    const approach = exercises.findIndex(item => item.key === 'master-v9-approach');
    if (cmj) exercises.splice(Math.max(0, approach), 0, { ...cmj, group: 'Standing vertical evaluation', section: 'B · Fresh Performance Evaluation', cue: 'Fresh measured standing jump attempts with full recovery. This replaces normal CMJ complex contacts; do not add another jump session.' });
    exercises = exercises.map(item => item.key === 'master-v9-hack' ? { ...item, group: 'Strength', cue: 'Reduced-volume evaluation-week strength after fresh jump measurements. Keep about RIR 2.' } : item);
  }
  return { ...day, name: `${evaluation ? 'Evaluation' : 'Deload'} — ${day.name}`.slice(0, 80), exercises: unlinkComplex(exercises),
    note: `${evaluation ? 'Week 8: reduced-volume evaluation. Fresh jump tests replace normal jump volume; record results only when actually measured. No automatic cycle restart.' : 'Week 4: recovery/deload opportunity. Demanding working sets and additional jump/acceleration volume are reduced; movement quality takes priority.'} ${day.note}`.slice(0, 500) };
}

/** Unknown guidance never becomes approval when selecting the complete V9 plan. */
export function applyV9Clearance(workout: PlanDay, clearance?: MasterProgramSettings['clearance']): PlanDay {
  if (workout.kind !== 'strength') return workout;
  const impact = clearance?.impact === 'cleared', heavy = clearance?.heavyLifting === 'cleared';
  if (impact && heavy) return workout;
  // The match primer and technique routine are already non-maximal preparation;
  // do not turn their gentle bodyweight drills into an alleged heavy workout.
  if (['v9-match-primer', 'v9-approach-technique'].includes(workout.programSessionId ?? '')
    && workout.exercises.every(item => item.mode !== 'weight' && !v9ExplosiveExercise(item)
      && (item.targetRpe ?? 5) <= 6 && !(item.defaultKg != null && item.defaultKg > 0))) return workout;
  let exercises = workout.exercises.filter(item => impact || !v9ExplosiveExercise(item));
  if (!heavy) exercises = exercises.filter(item => !v9ExplosiveExercise(item)
    || (item.mode === 'bodyweight' && !item.quantityUnit && !!item.jumpContactsPerRep)).map(item => {
    if (v9ExplosiveExercise(item)) return { ...item, defaultKg: 0, cue: `Bodyweight only within recorded impact guidance. ${item.cue ?? ''}`.slice(0, 500) };
    const { superset: _superset, ...unpaired } = item;
    return { ...unpaired, sets: Math.min(2, item.sets), targetRpe: 5, targetRir: 5, defaultKg: 0, preparationOnly: true,
      cue: `Easy preparation only until your individual heavy-lifting guidance is confirmed. No heavy straining or breath-holding. ${item.cue ?? ''}`.slice(0, 500) };
  });
  if (!exercises.length) exercises = [ex('clearance-mobility', 'Easy Dynamic Movement', 'Modified preparation', 'Mobility', 1, '2–3 min', 0,
    { mode: 'timed', exerciseId: 'light-dynamic-mobility', preparationOnly: true, targetRpe: 4, cue: 'Choose comfortable non-impact movement or rest within your recorded guidance.' })];
  return { ...workout, name: heavy ? modifiedTitle(workout) : 'Modified — Easy Preparation', exercises: unlinkComplex(exercises),
    warmup: workout.warmup?.filter(item => impact || !/jump|pogo|throw/i.test(item.name)),
    note: `Modified by recorded guidance: ${!impact ? 'impact approval is unknown or restricted; maximal jumps, sprints, aggressive agility and ballistic throws omitted. ' : ''}${!heavy ? 'heavy-lifting approval is unknown or restricted; easy preparation instead of full strength. ' : ''}The full V9 base remains available to preview; only your explicit guidance changes these limits. ${workout.note}`.slice(0, 500) };
}

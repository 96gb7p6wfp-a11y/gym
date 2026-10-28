import { z } from 'zod';
import { findLibraryExercise } from './exercise-library.ts';
import type { PlanDay, PlanExercise } from './workout-customization';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const day = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
});
export const MasterProgramSettingsSchema = z.object({
  version: z.literal(1),
  revision: z.literal('8.1').optional(),
  startDate: dateSchema.refine(value => new Date(`${value}T12:00:00Z`).getUTCDay() === 1, 'Choose a Monday.'),
  matchWeeks: z.array(z.number().int().min(1).max(8)).max(8).refine(values => new Set(values).size === values.length),
  matchTimes: z.array(z.object({ week: z.number().int().min(1).max(8), startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/) }))
    .max(8).refine(values => new Set(values.map(value => value.week)).size === values.length).optional(),
  optional: z.object({
    mondayArms: z.boolean(), thursdayArms: z.boolean(), tuesdayPogos: z.boolean(),
    thursdayPlyoPushup: z.boolean().optional(), wednesdayShortFoot: z.boolean().optional(),
    sundaySplitSquatJump: z.boolean().optional(), primerPogos: z.boolean().optional(),
    primerSlam: z.boolean().optional(), easyRun: z.boolean().optional(),
  }).optional(),
  readiness: z.array(z.object({ date: dateSchema, status: z.enum(['green', 'yellow', 'red']) })).max(100)
    .refine(values => new Set(values.map(value => value.date)).size === values.length).optional(),
});
export type MasterProgramSettings = z.infer<typeof MasterProgramSettingsSchema>;
export type MasterReadiness = 'green' | 'yellow' | 'red';
const DAY = 86400000;
const timestamp = (date: string) => new Date(`${date}T12:00:00Z`).getTime();
export function masterWeekStart(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function getMasterProgramWeek(startDate: string, date: string): number | null {
  const week = Math.floor((timestamp(date) - timestamp(startDate)) / (7 * DAY)) + 1;
  return week >= 1 && week <= 8 ? week : null;
}
export function getMasterProgramPhase(week: number) {
  return week === 4 ? 'Deload' : week === 8 ? 'Peak / retest' : week < 4 ? 'Build 1' : 'Build 2';
}
function exercise(key: string, name: string, group: string, sets: number, target: string,
  mode: PlanExercise['mode'] = 'weight', rest = 90, perSide = false, cue = '', extra: Partial<PlanExercise> = {}): PlanExercise {
  const movement = findLibraryExercise(name);
  return { key: `master-${key}`, ...(movement ? { exerciseId: movement.id } : {}), name, group, sets, target, mode, rest, perSide, cue, ...extra };
}
function preparation(key: string, name: string, target: string, cue: string) {
  return { key: `master-prep-${key}`, name, target, cue, done: false };
}
const warmup = () => [
  preparation('breathing', '90/90 Breathing', '4 breaths', 'Let ribs settle; avoid arching the low back.'),
  preparation('ankle', 'Ankle Knee-to-Wall', '6 / side', 'Heel down; move through a comfortable range.'),
  preparation('hip', '90/90 Hip Switch', '6 / side', 'Rotate at the hips without forcing the knees.'),
  preparation('lunge', 'Walking Lunge + Reach', '5 / side', 'Reach tall with controlled ribs.'),
  preparation('band', 'Mini-Band Lateral Walk', '8 steps / side', 'Keep the pelvis level; do not sway.'),
  preparation('foot', 'Short-Foot', '15–20 sec / side', 'Heel, big-toe base and little-toe base stay planted.'),
  preparation('pogo', 'Pogo Jump', '2 × 10', 'Light activation, quick contacts; skip if calf/Achilles feels tight.'),
  preparation('ramp', 'Jump Ramp-Up', '1 each at ~60%, 75%, 90%', 'Rest between jumps. Finish ready, not tired.'),
];
const lowerWarmup = () => warmup().filter(item => !['breathing', 'band', 'ramp'].some(key => item.key.endsWith(key)));
const cooldown = () => [preparation('cooldown', 'Easy Walk + Breathing', '3–5 min', 'Let breathing settle; use gentle, pain-free mobility.')];
const approach = (sets: number, target = '2 reps', cue = 'Maximal height, full recovery. Record highest touch, not jump height.') =>
  exercise('approach', 'Approach Jump', 'Power', sets, target, 'bodyweight', 150, false, cue, { measurement: 'touch', exerciseId: 'approach-jump' });
const pogos = () => exercise('optional-pogo', 'Pogo Jump', 'Optional activation', 2, '8–10 reps', 'bodyweight', 60, false, 'Quick, light contacts. Skip if calves or Achilles feel tight.', { exerciseId: 'pogo-jump' });
const arms = (thursday = false) => [
  exercise(thursday ? 'hammer' : 'curl', thursday ? 'Hammer Curl' : 'Biceps Curl', 'Optional arms', 2, '10–15 reps', 'weight', 60),
  exercise('pushdown', 'Triceps Pushdown', 'Optional arms', 2, '10–15 reps', 'weight', 60),
];
function getLegacyOptionalExercises(day: number): PlanExercise[] {
  return day === 0 ? arms() : day === 3 ? arms(true) : day === 1 ? [pogos()] : [];
}

/** A new recommendation, separate from the original plan and all saved sessions. */
function createLegacyVolleyballMasterPlan(matchWeek = false): PlanDay[] {
  const plan: PlanDay[] = [
    { name: 'Upper Power A', kind: 'strength', goal: 'power', minutes: 90,
      note: '80–95 min. Hitting power, back, shoulders and abs. Fast throws first; clean pulling. Optional arms only if time and recovery allow.',
      exercises: [
        exercise('spike', 'Medicine Ball Spike Slam', 'Power', 4, '3 reps', 'weight', 90, false, 'Full speed, reset each rep. Never chase fatigue.'),
        exercise('pullup', 'Pull-Up / Assisted Pull-Up', 'Back', 3, '5–8 reps', 'bodyweight', 150, false, 'Full range, scapular control. Use assistance for clean reps; reduce it only after 8/8/8. Log added load only in kg.', { exerciseId: 'pull-up', targetRpe: 8 }),
        exercise('row-a', 'Chest-Supported Row', 'Back', 3, '8–12 reps', 'weight', 120, false, 'Chest stays on the pad; control the lowering.'),
        exercise('high-row', 'High Row Machine', 'Back', 2, '8–12 reps', 'weight', 90, false, 'Feel lats and upper back; avoid shrugging.'),
        exercise('incline-a', 'Incline Machine Press', 'Chest', 3, '6–10 reps', 'weight', 120, false, 'Leave 1–2 reps in reserve; no grinding.', { targetRpe: 8.5 }),
        exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, '12–20 reps', 'weight', 60),
        exercise('rear', 'Reverse Pec Deck', 'Shoulders', 2, '12–20 reps', 'weight', 60),
        exercise('crunch', 'Cable Crunch', 'Core', 3, '10–15 reps', 'weight', 60, false, 'Curl the ribs toward the pelvis; do not just hinge at the hips.'),
      ], cooldown: cooldown() },
    { name: 'Volleyball', kind: 'sport', goal: 'sport', minutes: 120,
      note: 'Tuesday 20:00–22:00. Technique primer is separate. No extra depth jumps, hurdles, leg strength or sprints.',
      exercises: [exercise('volleyball', 'Volleyball practice', 'Sport', 1, '120 min', 'timed', 0)],
      extraSession: { name: 'Approach Technique Primer', kind: 'strength', goal: 'jump', minutes: 12,
        note: '8–15 min, low fatigue. FAST → LONG PENULTIMATE → QUICK PLANT → ARMS → UP. Full approaches at 80–90%; film the final two side-on reps. Not a leg day.',
        exercises: [
          exercise('rhythm', 'Slow L-R-L Rhythm', 'Technique', 2, '3 reps', 'bodyweight', 45, false, 'Use your own takeoff pattern; mirror L-R-L if appropriate. Build speed.'),
          exercise('penultimate', 'Penultimate Step Drill', 'Technique', 3, '2 reps', 'bodyweight', 60, false, 'Slightly longer penultimate, natural lowering, quick final plant.'),
          approach(4, '1 rep', '80–90%, not maximal. Four to six total reps; these four include the final two filmed reps. Rest 45–90 sec.'),
        ].map(item => item.key === 'master-approach' ? { ...item, rest: 90 } : item), cooldown: [] } },
    { name: 'Main Jump + Heavy Lower A', kind: 'strength', goal: 'jump', minutes: 105,
      note: '95–110 min. Approach height + force + vertical power. Eight maximal approach jumps + six CMJs = 14 maximal jumps, plus eight lower hurdle contacts. Complex pair is not a circuit: rest 2–3 min after BOTH movements.',
      warmup: warmup(), cooldown: cooldown(), exercises: [
        approach(4),
        exercise('hurdle', 'Hurdle Hops', 'Reactive', 2, '4 reps', 'bodyweight', 120, false, 'Low–medium hurdles, quick ground contact. Do not chase height.'),
        exercise('hack', 'Hack Squat', 'A1 · Complex pair', 3, '4–6 reps', 'weight', 150, false, 'RIR 2. Rest 2–3 min, then CMJ. This is not a circuit.', { targetRpe: 8 }),
        exercise('cmj', 'CMJ with Arm Swing', 'A2 · Complex pair', 3, '2 reps', 'bodyweight', 150, false, 'Two maximal jumps. Rest 2–3 min before the next squat round.', { measurement: 'height' }),
        exercise('rdl', 'Romanian Deadlift', 'Hamstrings', 3, '5–7 reps', 'weight', 150, false, 'RIR 2–3. Ribs controlled, neutral pelvis, soft knees; hips back, bar close. Stop when hamstrings limit range, not by rounding the back.', { targetRpe: 7.5 }),
        exercise('soleus', 'Seated Calf Raise', 'Soleus', 3, '8–12 reps', 'weight', 90, false, 'Bent knees; lower slowly and pause briefly at the bottom.'),
        exercise('pallof', 'Pallof Press', 'Core', 2, '8–10 reps', 'weight', 60, true, 'Resist trunk rotation.'),
        exercise('carry', 'Suitcase Carry', 'Core', 2, '20–30 m', 'weight', 60, true, 'Stay tall with ribs controlled; do not lean toward the load.', { quantityUnit: 'm' }),
        exercise('short-foot', 'Short-Foot', 'Foot control', 2, '20 sec', 'timed', 30, true, 'Keep heel and both toe bases down. Shorten the arch without curling toes.'),
      ] },
    { name: 'Upper Power B', kind: 'strength', goal: 'power', minutes: 80,
      note: '70–85 min. Upper-body power + back/shoulders/abs. Separate easy 5 km if possible by a few hours; after gym is acceptable. Run at RPE 3–4, conversational pace, never a time trial.',
      cooldown: cooldown(), exercises: [
        exercise('rotation', 'Medicine Ball Rotational Throw', 'Power', 3, '3 reps', 'weight', 90, true, 'Accelerate through the throw; do not slowly push.'),
        exercise('landmine', 'Half-Kneeling Landmine Press', 'Shoulders', 3, '6–8 reps', 'weight', 90, true, 'Stable trunk; transfer force from glute/core through shoulder and arm.'),
        exercise('pulldown', 'Lat Pulldown', 'Back', 3, '8–10 reps', 'weight', 120),
        exercise('row-b', 'Chest-Supported Row', 'Back', 3, '8–12 reps', 'weight', 120),
        exercise('incline-b', 'Low-Incline Machine Press', 'Chest', 2, '8–12 reps', 'weight', 120),
        exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, '12–20 reps', 'weight', 60),
        exercise('rear', 'Reverse Pec Deck', 'Shoulders', 2, '12–20 reps', 'weight', 60),
        exercise('rotation-cuff', 'Cable External Rotation', 'Shoulder control', 2, '12–15 reps', 'weight', 60, true, 'Light load and controlled movement; not a heavy lift.'),
        exercise('ab-wheel', 'Ab Wheel', 'Core', 3, '6–10 reps', 'bodyweight', 60, false, 'Two to three sets. Stop before the low back sags; Body Saw is an alternative.'),
      ] },
    { name: 'Volleyball', kind: 'sport', goal: 'sport', minutes: 120,
      note: 'School PE ~2 h (high jump / shot put) counts as load, even if it feels easy. Volleyball 20:00–22:00. No extra gym, plyometrics or sprints. Check Saturday readiness during warm-up.',
      exercises: [exercise('volleyball', 'Volleyball practice', 'Sport', 1, '120 min', 'timed', 0)] },
    { name: 'Reactive + Hard Lower B', kind: 'strength', goal: 'jump', minutes: 100,
      note: '90–110 min. No Sunday match. Six maximal approaches, six drop jumps and eight hurdle contacts. Readiness first after Friday PE + volleyball. No automatic box-height increase.',
      warmup: lowerWarmup(), cooldown: cooldown(), exercises: [
        approach(3, '2 reps', '95–100%, six high-quality jumps. Full recovery between sets.'),
        exercise('drop', 'Drop Jump', 'Reactive', 3, '2 reps', 'bodyweight', 150, false, 'Start around 20–30 cm. Step off; quick contact and vertical rebound. Lower the box if contact slows.'),
        exercise('hurdle', 'Hurdle Hops', 'Reactive', 2, '4 reps', 'bodyweight', 120, false, 'Fast, springy contacts. Finish plyometrics here.'),
        exercise('leg-press', 'Leg Press', 'Quads', 3, '6–8 reps', 'weight', 150, false, 'Heavy, controlled; RIR 2.', { targetRpe: 8 }),
        exercise('bulgarian', 'Smith Machine Bulgarian Split Squat', 'Single-leg strength', 3, '6 reps', 'weight', 150, true, 'Left leg first. Match reps and load on both sides; RIR 2.', { targetRpe: 8 }),
        exercise('hip-thrust', 'Hip Thrust Machine', 'Glutes', 3, '6–8 reps', 'weight', 120, false, 'RIR 1–2. Extend the hips without arching the low back.', { targetRpe: 8.5 }),
        exercise('leg-curl', 'Leg Curl', 'Hamstrings', 3, '8–12 reps', 'weight', 90, false, 'Seated or lying. RIR 1–2.', { targetRpe: 8.5 }),
        exercise('calf', 'Standing Calf Raise', 'Calves', 3, '6–10 reps', 'weight', 90, false, 'Gastrocnemius emphasis; RIR 1–2.', { targetRpe: 8.5 }),
        exercise('tibialis', 'Tibialis Raise', 'Lower leg', 2, '15–20 reps', 'bodyweight', 60),
        exercise('copenhagen', 'Copenhagen Plank', 'Core / adductors', 2, '20–30 sec', 'timed', 60, true, 'Or replace with Adductor Machine 2 × 10–15; do not add both.'),
        exercise('ab-wheel', 'Ab Wheel', 'Core', 3, '6–10 reps', 'bodyweight', 60, false, 'Keep ribs and pelvis controlled; no low-back sag.'),
        exercise('crunch', 'Cable Crunch', 'Core', 2, '10–15 reps', 'weight', 60),
      ] },
    { name: 'Recovery', kind: 'recovery', goal: 'recovery', minutes: 20, note: 'Light mobility or an easy walk. Restore performance; no catch-up leg work.', exercises: [], warmup: lowerWarmup().filter(item => !/Pogo/.test(item.name)) },
  ];
  if (matchWeek) {
    plan[5] = { name: 'Pre-Match Primer', kind: 'strength', goal: 'power', minutes: 35,
      note: '30–45 min. Feel fast and springy, not sore. Only three approach jumps (~80%, 90%, 95%). Stop there, even when you feel great. All structural work stays easy with high RIR.',
      warmup: lowerWarmup().filter(item => !/Pogo/.test(item.name)), exercises: [
        approach(3, '1 rep', 'Set 1 ~80%, set 2 ~90%, set 3 ~95%. Exactly three jumps; do not add more.'),
        exercise('spike', 'Medicine Ball Spike Slam', 'Power', 2, '3 reps', 'weight', 90),
        exercise('row', 'Chest-Supported Row', 'Back', 2, '10 reps', 'weight', 60, false, 'Easy effort; avoid soreness.', { targetRpe: 5 }),
        exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 2, '15 reps', 'weight', 60, false, 'Easy, high RIR.', { targetRpe: 5 }),
        exercise('copenhagen', 'Copenhagen Plank', 'Core / adductors', 2, '20–30 sec', 'timed', 60, true),
        exercise('wall-slide', 'Wall Slide', 'Shoulder control', 2, '8 reps', 'bodyweight', 30),
        exercise('short-foot', 'Short-Foot', 'Foot control', 2, '20 sec', 'timed', 30, true),
      ] };
    plan[6] = { name: 'Match', kind: 'sport', goal: 'sport', minutes: 90,
      note: 'Highest priority today. Match time is not set; 90 min is an editable duration placeholder. Log actual playing/training time. No extra plyometrics or evening legs.',
      exercises: [exercise('match', 'Volleyball match', 'Sport', 1, 'Match · log actual min', 'timed', 0)] };
  }
  return plan;
}
const isJump = (item: PlanExercise) => /approach|cmj|drop jump|hurdle|pogo/i.test(item.name);
const lowerDay = (day: PlanDay) => /lower|main jump|reactive/i.test(day.name);
function legacyPhasePlan(day: PlanDay, index: number, week: number, match: boolean): PlanDay {
  if (week !== 4 && week !== 8) return day;
  if (match && index === 5) return day; // A primer never becomes a hard training day.
  const lower = lowerDay(day);
  const exercises = day.exercises.map(item => {
    if (index === 2 && /Approach Jump/.test(item.name)) return { ...item, sets: week === 4 ? 3 : 2 };
    if (index === 2 && /CMJ/.test(item.name)) return { ...item, sets: 2 };
    if (index === 5 && /Approach Jump|Drop Jump/.test(item.name)) return { ...item, sets: 2 };
    if (isJump(item) || day.kind !== 'strength') return item;
    return (week === 4 || lower) ? { ...item, sets: Math.max(1, Math.ceil(item.sets * 0.5)) } : item;
  }).filter(item => !(week === 8 && /Hurdle/.test(item.name)));
  return { ...day, exercises, note: `${week === 4 ? 'Deload: strength sets reduced about 40–50%. Omit hurdles if legs feel heavy.' : 'Peak/retest: lower strength sets reduced about 40–50%; high jump intent, fewer contacts.'} ${day.note}`.slice(0, 500) };
}
function applyLegacyReadiness(workout: PlanDay, readiness?: MasterReadiness): PlanDay {
  if (!readiness || readiness === 'green' || workout.kind !== 'strength') return workout;
  if (readiness === 'red' && workout.exercises.some(isJump)) return {
    name: 'Recovery', kind: 'recovery', goal: 'recovery', minutes: 20, exercises: [],
    note: 'No maximal jumping today. Sharp/worsening joint, Achilles, knee or back pain, painful movement or poor landings: stop painful work. Seek assessment for persistent or worsening symptoms.',
    warmup: [], cooldown: cooldown(),
  };
  if (readiness === 'red') return { ...workout, note: `Stop painful movements; choose pain-free upper work or recovery. ${workout.note}`.slice(0, 500) };
  return { ...workout, exercises: workout.exercises.filter(item => !/Hurdle/.test(item.name)).map(item => isJump(item) ? { ...item, sets: Math.max(1, Math.ceil(item.sets * 0.5)) } : item),
    note: `Yellow: jump sets reduced about 30–50%; hurdles omitted. Keep strength controlled, no grinding. ${workout.note}`.slice(0, 500),
    warmup: workout.warmup?.filter(item => !/Pogo/.test(item.name)) };
}

const v81Exercise = (key: string, name: string, group: string, sets: number, target: string,
  rest: number, benefit: string, options: Partial<PlanExercise> = {}): PlanExercise =>
  exercise(key, name, group, sets, target, options.mode ?? 'weight', rest, options.perSide ?? false,
    options.cue ?? '', { benefit, ...options });
const v81Approach = (sets = 4, target = '2 reps', rest = 150, cue = 'Maximal height. Reset fully between attempts; log highest touch when measured.') =>
  v81Exercise('approach', 'Approach Jump', 'Jump', sets, target, rest, 'Sport-specific maximum takeoff',
    { mode: 'bodyweight', measurement: 'touch', exerciseId: 'approach-jump', jumpContactsPerRep: 1, cue });
const quickLowerPreparation = () => [
  preparation('bike', 'Light Bike', '2–3 min', 'Easy pace; finish warmer, not tired.'),
  preparation('ankle', 'Ankle Knee-to-Wall', '8 / side', 'Keep the heel down and move smoothly.'),
  preparation('hip', 'Dynamic Hip Mobility', '6 / side', 'Move through a comfortable range without forcing it.'),
  preparation('squat', 'Bodyweight Squat', '8 reps', 'Brace lightly, keep the whole foot down and move smoothly.'),
  preparation('lunge', 'Reverse Lunge', '5 / leg', 'Step back under control with a stable front foot.'),
  preparation('pogo', 'Low-intensity Pogos', '2 × 8', 'Light springy contacts; skip with calf or Achilles discomfort.'),
  preparation('ramp', 'Progressive Practice Jumps', '3 reps · easy → faster', 'Reset between jumps; build toward training speed without fatigue.'),
];
const quickStrengthPreparation = () => quickLowerPreparation().filter(step => !/pogo|ramp/.test(step.key));
const v81Recovery = (): PlanDay => ({
  name: 'Recovery / Optional Mobility', kind: 'recovery', goal: 'recovery', minutes: 20,
  programRevision: '8.1', durationRange: '0–25 min',
  note: 'Full rest is valid. Easy walking, gentle mobility or light foot/shoulder control only if useful. No required jumping or heavy lifting. Recover from Friday and prepare for Sunday; no catch-up work.',
  exercises: [], warmup: [],
});

/** The current recommendation. Existing personal plans change only through explicit upgrade. */
export function createVolleyballMasterPlan(matchWeek = false): PlanDay[] {
  const plan: PlanDay[] = [
    { name: 'Upper A', kind: 'strength', goal: 'power', minutes: 90, durationRange: '80–95 min', programRevision: '8.1',
      note: 'Spike Power + Strength + Physique. After a demanding Sunday match, omit slams and reduce demanding pressing if shoulders feel sore or fatigued. Keep explosive reps fast and lifting controlled.',
      cooldown: cooldown(), exercises: [
        v81Exercise('spike', 'Medicine Ball Spike Slam', 'Power', 3, '3 reps', 90, 'Explosive overhead force', { defaultKg: 2, cue: 'Start around 2–3 kg. Two-handed overhead slam, maximal speed; reset every rep. Omit if shoulders are sore or fatigued.' }),
        v81Exercise('pullup', 'Pull-Up / Assisted Pull-Up', 'Back', 3, '5–8 reps', 150, 'Upper-back and pulling strength', { mode: 'bodyweight', exerciseId: 'pull-up', targetRpe: 8.5, cue: 'RIR 1–2. Use assistance for clean full-range reps. Log added load only; record assistance in notes.' }),
        v81Exercise('incline-a', 'Incline Machine Chest Press', 'Chest', 3, '6–10 reps', 150, 'Upper-chest strength and development', { exerciseId: 'incline-machine-press', targetRpe: 8.5, cue: 'RIR 1–2. Controlled lowering; no grinding or painful shoulder range.' }),
        v81Exercise('row-a', 'Chest-Supported Row', 'Back', 3, '8–12 reps', 120, 'Back strength and scapular control', { targetRpe: 8, cue: 'RIR 2. Chest stays supported; control the lowering without shrugging.' }),
        v81Exercise('shoulder-press', 'Single-arm Neutral-grip Dumbbell Shoulder Press', 'Shoulders', 2, '6–8 reps', 90, 'Shoulder strength and unilateral stability', { perSide: true, targetRpe: 7.5, cue: 'RIR 2–3. Neutral grip, steady ribs and pain-free range; avoid leaning or arching.' }),
        v81Exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, '12–20 reps', 60, 'Lateral deltoid development', { targetRpe: 8.5, cue: 'RIR 1–2. Lead with the upper arm; avoid swinging.' }),
        v81Exercise('rear', 'Reverse Pec Deck', 'Shoulders', 2, '12–20 reps', 60, 'Rear shoulder and upper-back development', { targetRpe: 8, cue: 'RIR 2. Keep shoulders relaxed and move under control.' }),
        v81Exercise('crunch', 'Cable Crunch', 'Core', 2, '10–15 reps', 60, 'Trunk strength', { targetRpe: 8, cue: 'RIR 2. Curl ribs toward pelvis rather than moving only at the hips.' }),
        v81Exercise('curl', 'Dumbbell Biceps Curl', 'Arms', 2, '8–12 reps', 60, 'Biceps strength and development', { exerciseId: 'biceps-curl', targetRpe: 8.5, cue: 'RIR 1–2. Keep the upper arm steady and avoid momentum.' }),
        v81Exercise('pushdown', 'Triceps Pushdown', 'Arms', 2, '10–15 reps', 60, 'Triceps strength and development', { targetRpe: 8.5, cue: 'RIR 1–2. Keep elbows controlled and shoulders relaxed.' }),
      ] },
    { name: 'Volleyball', kind: 'sport', goal: 'sport', minutes: 120, durationRange: '20:00–22:00', programRevision: '8.1',
      note: 'Tuesday club practice · 20:00–22:00 Europe/Berlin. The short technique primer is optional; skip it if practice already has substantial jumping. Record practice once as sport-specific training.',
      exercises: [v81Exercise('volleyball', 'Volleyball practice', 'Sport', 1, '120 min', 0, 'Sport-specific skills and performance', { mode: 'timed' })],
      extraSession: { name: 'Approach Technique Primer', kind: 'strength', goal: 'jump', minutes: 8, durationRange: '5–10 min', programRevision: '8.1',
        note: 'Optional technique work, not a high-intensity jump workout. Skip the whole primer when practice already contains enough jumps. FAST → LONG PENULTIMATE → QUICK PLANT → ARMS → UP.',
        warmup: [], cooldown: [], exercises: [
          v81Exercise('rhythm', 'Slow L-R-L Approach Rhythm', 'Technique', 2, '3 reps', 45, 'Approach rhythm and acceleration', { mode: 'bodyweight', exerciseId: 'slow-approach-rhythm', cue: 'Build speed into the plant; mirror the pattern if your takeoff uses the opposite lead.' }),
          v81Exercise('penultimate', 'Penultimate Step Drill', 'Technique', 2, '2 reps', 60, 'Controlled lowering and quick plant', { mode: 'bodyweight', cue: 'A controlled longer penultimate step, then a quick final plant.' }),
          v81Approach(3, '1 rep', 75, '75–85% effort. Two to three controlled attempts; this is technique, not maximal testing.'),
        ] } },
    { name: 'Main Jump + Heavy Lower A', kind: 'strength', goal: 'jump', minutes: 105, durationRange: '95–115 min', programRevision: '8.1',
      note: 'Vertical Jump + Maximum Force Production. Ceiling: 24 main jump contacts, not a minimum. Stop explosive work when height, landing quality or coordination declines. After unusually demanding Tuesday practice, remove loaded jumps first. Ramp up heavy lifts separately.',
      warmup: quickLowerPreparation(), cooldown: cooldown(), exercises: [
        v81Approach(),
        v81Exercise('drop', 'Low-box Drop Jump', 'Reactive', 2, '2 reps', 120, 'Reactive strength and rapid rebound', { mode: 'bodyweight', exerciseId: 'drop-jump', jumpContactsPerRep: 1, cue: 'Begin around 15–20 cm. Step off, rebound quickly and land under control. If unfamiliar, use step-down landing preparation first. Never raise the box automatically.' }),
        v81Exercise('loaded-jump', 'Light Dumbbell Squat Jump', 'Power', 2, '3 reps', 120, 'Loaded vertical power', { defaultKg: 4, jumpContactsPerRep: 1, cue: 'Technique first. Start around 2–4 kg in each hand; log the combined load. Jump vertically and land under control. Remove this first after a demanding Tuesday.' }),
        v81Exercise('hack', 'Hack Squat', 'A1 · Complex pair', 3, '4–6 reps', 240, 'Lower-body force production', { targetRpe: 8, cue: 'RIR 2. Controlled eccentric, explosive concentric intent. Rest about 4 min before CMJ; this is not a circuit.' }),
        v81Exercise('cmj', 'CMJ with Arm Swing', 'A2 · Complex pair', 3, '2 reps', 150, 'Maximum standing takeoff', { mode: 'bodyweight', measurement: 'height', jumpContactsPerRep: 1, cue: 'Maximal height with a full arm swing. Reset between jumps. Rest 2–3 min before the next hack squat round.' }),
        v81Exercise('rdl', 'Romanian Deadlift', 'Hamstrings', 3, '5–7 reps', 150, 'Hamstring and hip strength', { targetRpe: 8, cue: 'RIR 2. Ribs controlled, soft knees, hips back and bar close. Stop at hamstring-limited range; do not round or force through back pain.' }),
        v81Exercise('bulgarian-a', 'Bulgarian Split Squat', 'Single-leg strength', 2, '6 reps', 120, 'Unilateral strength and stability', { perSide: true, targetRpe: 8, cue: 'RIR 2 each leg. Match load and reps; use a stable stance and controlled depth.' }),
        v81Exercise('soleus', 'Seated Calf Raise', 'Soleus', 3, '8–12 reps', 90, 'Soleus strength', { targetRpe: 8.5, cue: 'RIR 1–2. Bent knees, slow lowering and a brief pause at the bottom.' }),
        v81Exercise('pallof', 'Pallof Press Isometric Hold', 'Core', 2, '20 sec', 60, 'Anti-rotation trunk stability', { mode: 'timed', perSide: true, cue: 'Hold 20 sec each side. Keep ribs and pelvis steady; resist cable rotation.' }),
        v81Exercise('short-foot', 'Short-Foot Hold', 'Foot control', 2, '20 sec', 30, 'Foot control', { mode: 'timed', exerciseId: 'short-foot', perSide: true, optionalWork: true, cue: 'Keep heel and both toe bases down. Shorten the arch without curling the toes.' }),
      ] },
    { name: 'Upper B', kind: 'strength', goal: 'power', minutes: 82, durationRange: '75–90 min', programRevision: '8.1',
      note: 'Rotational Power + Shoulder + Physique. Keep throws fast and shoulder work controlled. An easy 5 km may be scheduled separately if needed; conversational effort only, never hard running before Friday volleyball.',
      cooldown: cooldown(), exercises: [
        v81Exercise('rotation', 'Medicine Ball Rotational Throw', 'Power', 3, '3 reps', 90, 'Rotational power', { perSide: true, defaultKg: 2, cue: 'Start around 2–3 kg. Three reps each side; accelerate through the throw rather than pushing slowly.' }),
        v81Exercise('plyo-pushup', 'Plyometric Push-up', 'Power', 2, '3 reps', 90, 'Upper-body rate of force development', { mode: 'bodyweight', optionalWork: true, cue: 'Optional. Use a stable setup and crisp, low-fatigue reps; stop if shoulders hurt or speed falls.' }),
        v81Exercise('pulldown', 'Lat Pulldown', 'Back', 3, '8–10 reps', 120, 'Back and pulling strength', { targetRpe: 8, cue: 'RIR 2. Pull through a comfortable full range without leaning back excessively.' }),
        v81Exercise('incline-b', 'Low-incline Chest Press', 'Chest', 3, '8–12 reps', 120, 'Upper-chest development', { exerciseId: 'incline-machine-press', targetRpe: 8, cue: 'RIR 2. Controlled lowering and a pain-free shoulder range.' }),
        v81Exercise('row-b', 'Seated Cable Row', 'Back', 3, '8–12 reps', 90, 'Back strength and scapular control', { targetRpe: 8, cue: 'RIR 2. Keep torso steady; move through the upper back without shrugging.' }),
        v81Exercise('lateral', 'Cable Lateral Raise', 'Shoulders', 3, '12–20 reps', 60, 'Lateral deltoid development'),
        v81Exercise('rear', 'Reverse Pec Deck', 'Shoulders', 2, '12–20 reps', 60, 'Rear shoulder development'),
        v81Exercise('rotation-cuff', 'Cable External Rotation', 'Shoulder control', 2, '12–15 reps', 45, 'Rotator-cuff control', { perSide: true, cue: 'Light controlled load. Keep the elbow steady; stop before compensating with the trunk.' }),
        v81Exercise('pushup-plus', 'Push-up Plus', 'Shoulder control', 2, '10–12 reps', 60, 'Scapular control', { mode: 'bodyweight', cue: 'At the top, gently push the floor away without shrugging or arching the back.' }),
        v81Exercise('ab-wheel', 'Ab Wheel', 'Core', 2, '8–12 reps', 60, 'Anti-extension trunk control', { mode: 'bodyweight', cue: 'Keep ribs and pelvis controlled. Stop the rollout before the lower back sags.' }),
        v81Exercise('hammer', 'Hammer Curl', 'Optional arms', 2, '10–15 reps', 60, 'Arm development', { optionalWork: true, targetRpe: 8.5 }),
        v81Exercise('pushdown', 'Triceps Pushdown', 'Optional arms', 2, '10–15 reps', 60, 'Triceps development', { optionalWork: true, targetRpe: 8.5 }),
      ] },
    { name: 'Volleyball', kind: 'sport', goal: 'sport', minutes: 120, durationRange: '20:00–22:00', programRevision: '8.1',
      note: 'Friday school PE about 2 h plus club volleyball 20:00–22:00 Europe/Berlin. No extra gym, plyometrics or sprints. Planned work is not completed load; log actual activity once.',
      exercises: [v81Exercise('volleyball', 'Volleyball practice', 'Sport', 1, '120 min', 0, 'Sport-specific skills and performance', { mode: 'timed' })] },
    v81Recovery(),
    { name: 'Heavy Lower B', kind: 'strength', goal: 'strength', minutes: 82, durationRange: '75–90 min', programRevision: '8.1',
      note: 'Lower-body Strength + Single-leg Stability. If still fatigued after Friday and Saturday recovery, reduce work or recover instead; never move missed heavy work automatically to Monday. Trap Bar Deadlift may replace Leg Press after consistent technique; never add both.',
      warmup: quickStrengthPreparation(), cooldown: cooldown(), exercises: [
        v81Exercise('split-jump', 'Split-squat Jump', 'Power', 2, '2 reps', 120, 'Single-leg power and landing control', { mode: 'bodyweight', perSide: true, optionalWork: true, jumpContactsPerRep: 2, cue: 'Optional, bodyweight only. Two reps per leg; controlled landings. Omit when fatigued or unfamiliar.' }),
        v81Exercise('leg-press', 'Leg Press', 'Quads', 3, '5–8 reps', 180, 'Lower-body strength', { targetRpe: 8, cue: 'RIR 2. Controlled depth and strong upward intent. Trap Bar Deadlift 3 × 4–6 can replace this only after technique is reliable: begin with the 20 kg empty bar on the platform, keep the load close and stand tall. Technique practice first; no trap-bar jumps.' }),
        v81Exercise('bulgarian', 'Smith Machine Bulgarian Split Squat', 'Single-leg strength', 2, '6–8 reps', 120, 'Unilateral strength and stability', { perSide: true, targetRpe: 8, cue: 'RIR 2 each leg. Match load and reps on both sides; keep stance stable.' }),
        v81Exercise('hip-thrust', 'Hip Thrust Machine', 'Glutes', 3, '6–8 reps', 120, 'Hip-extension strength', { targetRpe: 8, cue: 'RIR 2. Extend the hips without finishing by arching the lower back.' }),
        v81Exercise('leg-curl', 'Leg Curl', 'Hamstrings', 2, '8–12 reps', 90, 'Hamstring strength', { targetRpe: 8.5, cue: 'Seated or lying. RIR 1–2 with controlled lowering.' }),
        v81Exercise('calf', 'Standing Calf Raise', 'Calves', 3, '6–10 reps', 90, 'Gastrocnemius strength', { targetRpe: 8.5, cue: 'RIR 1–2. Use controlled full comfortable range; avoid bouncing.' }),
        v81Exercise('tibialis', 'Tibialis Raise', 'Lower leg', 2, '15–20 reps', 60, 'Anterior lower-leg capacity', { mode: 'bodyweight' }),
        v81Exercise('copenhagen', 'Copenhagen Plank', 'Core / adductors', 2, '20–30 sec', 60, 'Lateral trunk and adductor capacity', { mode: 'timed', perSide: true, cue: 'Choose a pain-free lever and hold with steady breathing.' }),
      ] },
  ];
  if (matchWeek) {
    plan[5] = { name: 'Pre-Match Primer', kind: 'strength', goal: 'power', minutes: 15, durationRange: '12–18 min', programRevision: '8.1',
      note: 'Maintain readiness, not fatigue. Three approaches at about 70%, 80%, 90%. If tired, sore or travelling, full rest is a valid choice. Finish feeling easy and refreshed.',
      warmup: [], cooldown: [], exercises: [
        v81Exercise('dynamic-mobility', 'Light Dynamic Mobility', 'Mobility', 1, '2–3 min', 0, 'Easy movement preparation', { mode: 'timed', cue: 'Gentle shoulder, hip and ankle movement through a comfortable range.' }),
        v81Exercise('snapdown', 'Snap-down Landing', 'Landing control', 1, '3 reps', 45, 'Controlled landing positions', { mode: 'bodyweight', cue: 'Finish balanced with knees tracking over feet; these are landing drills, not maximal jumps.' }),
        v81Exercise('primer-pogo', 'Light Pogos', 'Optional activation', 1, '8 reps', 60, 'Light ankle activation', { mode: 'bodyweight', exerciseId: 'pogo-jump', optionalWork: true, cue: 'Optional quick, easy contacts. Skip with calf or Achilles discomfort.' }),
        v81Approach(3, '1 rep', 75, 'Set 1 about 70%, set 2 about 80%, set 3 about 90%. Only three jumps; stop while fresh.'),
        v81Exercise('primer-slam', 'Light Medicine Ball Spike Slam', 'Optional power', 2, '2 reps', 60, 'Easy overhead activation', { exerciseId: 'spike-slam', optionalWork: true, defaultKg: 2, cue: 'Optional light ball. Two crisp reps, well short of fatigue; omit for sore shoulders.' }),
      ] };
    plan[6] = { name: 'Volleyball Match', kind: 'sport', goal: 'sport', minutes: 90, durationRange: 'Log actual duration', programRevision: '8.1',
      note: 'Competition takes priority. Match start time is unset and remains editable in your schedule/notes. Duration is an editable placeholder; record actual playing time afterwards. No Heavy Lower B or additional plyometrics.',
      exercises: [v81Exercise('match', 'Volleyball match', 'Sport', 1, 'Match · log actual min', 0, 'Competition performance', { mode: 'timed' })] };
  }
  return plan;
}

export function getMasterOptionalExercises(day: number, settings?: MasterProgramSettings): PlanExercise[] {
  if (settings && settings.revision !== '8.1') return getLegacyOptionalExercises(day);
  const match = day === 5;
  return createVolleyballMasterPlan(match)[day]?.exercises.filter(item => item.optionalWork) ?? [];
}

/** Reset keeps the user's current prescription generation until they explicitly upgrade. */
export function createRecommendedMasterPlan(settings?: MasterProgramSettings, matchWeek = false): PlanDay[] {
  return settings && settings.revision !== '8.1' ? createLegacyVolleyballMasterPlan(matchWeek) : createVolleyballMasterPlan(matchWeek);
}

function v81PhasePlan(day: PlanDay, index: number, week: number, match: boolean): PlanDay {
  if (![4, 8].includes(week) || day.kind !== 'strength' || /technique primer/i.test(day.name) || (match && index === 5)) return day;
  let exercises = day.exercises.flatMap(item => {
    // Retesting replaces supplementary jumps; it is not an extra full jump session.
    if (week === 8 && ['master-drop', 'master-loaded-jump', 'master-split-jump'].includes(item.key)) return [];
    if (index === 2 && item.key === 'master-approach') return [{ ...item, sets: 2, ...(week === 8 ? { target: '1 rep', cue: 'Fresh approach retest: two quality measured attempts, fully reset. No extra maximal test session.' } : {}) }];
    if (index === 2 && item.key === 'master-cmj') return [{ ...item, sets: 2, ...(week === 8 ? { target: '1 rep', cue: 'Standing vertical retest: two fresh measured attempts with full rest. Stop if height or quality falls.' } : {}) }];
    if (item.jumpContactsPerRep) return [{ ...item, sets: Math.max(1, Math.ceil(item.sets * 0.5)) }];
    return [{ ...item, sets: Math.max(1, Math.ceil(item.sets * 0.5)) }];
  });
  if (week === 8 && index === 2) {
    // Test standing jumps before strength. The normal build-week complex resumes
    // next block only after an explicit user action, never an automatic repeat.
    const cmj = exercises.find(item => item.key === 'master-cmj');
    exercises = exercises.filter(item => item.key !== 'master-cmj');
    if (cmj) exercises.splice(1, 0, { ...cmj, group: 'Standing vertical retest' });
    exercises = exercises.map(item => item.key === 'master-hack' ? { ...item, group: 'Strength', cue: 'Reduced retest-week strength after fresh jump measurements. RIR 2; controlled reps.' } : item);
  }
  return { ...day, exercises, note: `${week === 4 ? 'Deload: demanding sets reduced about 40–50%; fewer jump contacts. Quality first.' : 'Peak / retest: fresh standing/approach tests replace the usual complex jumps; reduced strength afterward. Do not add a full-volume jump session.'} ${day.note}`.slice(0, 500) };
}

/** Readiness only changes a future prescription; saved session snapshots are never touched. */
export function applyMasterReadiness(workout: PlanDay, readiness?: MasterReadiness): PlanDay {
  if (workout.programRevision !== '8.1') return applyLegacyReadiness(workout, readiness);
  if (!readiness || readiness === 'green' || workout.kind !== 'strength') return workout;
  if (readiness === 'red') return { ...v81Recovery(), note: 'Self-reported red readiness: stop painful/high-impact work. Choose pain-free recovery only. Sharp or worsening pain, unstable landings or painful movement are stop signals; seek professional assessment if symptoms persist or worsen.' };
  const exercises = workout.exercises.filter(item =>
    !item.optionalWork && !['master-loaded-jump', 'master-drop', 'master-split-jump', 'master-spike', 'master-primer-slam', 'master-primer-pogo', 'master-plyo-pushup'].includes(item.key))
    .map(item => {
      if (item.jumpContactsPerRep) return { ...item, sets: Math.max(1, Math.ceil(item.sets * 0.5)) };
      if (/press|pull-up|squat|leg press|deadlift|hip thrust/i.test(item.name)) return { ...item, sets: Math.max(1, item.sets - 1), targetRpe: Math.min(item.targetRpe ?? 8, 7) };
      return item;
    });
  return { ...workout, exercises, warmup: workout.warmup?.filter(item => !/pogo/i.test(item.name)),
    note: `Self-reported yellow: supplementary jumps/ballistics omitted, hard work reduced. Keep technique clean; no aggressive overload. ${workout.note}`.slice(0, 500) };
}

export function isMasterReadinessRequired(settings: MasterProgramSettings | undefined, date: string, plan: PlanDay): boolean {
  if (!settings || !getMasterProgramWeek(settings.startDate, date)) return false;
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  if (settings.revision !== '8.1') return day === 5;
  const match = settings.matchWeeks.includes(getMasterProgramWeek(settings.startDate, date)!);
  // Red may already have converted the prescription to recovery; the day still
  // carries its recorded check, while an ordinary Saturday recovery never gates.
  const strengthOrRed = plan.kind === 'strength' || settings.readiness?.some(row => row.date === date && row.status === 'red');
  return !!strengthOrRed && (day === 2 || (day === 6 && !match && plan.programRevision === '8.1'));
}

export function resolveMasterProgramPlan(basePlan: PlanDay[], settings: MasterProgramSettings, date: string,
  matchWeekend?: PlanDay[]): PlanDay[] {
  const week = getMasterProgramWeek(settings.startDate, date);
  if (!week) return structuredClone(basePlan);
  const v81 = settings.revision === '8.1';
  const match = settings.matchWeeks.includes(week);
  let plan = structuredClone(basePlan);
  if (match) plan.splice(5, 2, ...structuredClone(matchWeekend ?? (v81 ? createVolleyballMasterPlan(true) : createLegacyVolleyballMasterPlan(true)).slice(5)));
  const matchTime = settings.matchTimes?.find(value => value.week === week)?.startTime;
  if (v81 && match && matchTime) plan[6] = { ...plan[6], startTime: matchTime };
  if (v81) {
    const flags = settings.optional;
    const enabled = new Set([
      ...(flags?.thursdayArms ? ['master-hammer', 'master-pushdown'] : []),
      ...(flags?.thursdayPlyoPushup ? ['master-plyo-pushup'] : []),
      ...(flags?.wednesdayShortFoot ? ['master-short-foot'] : []),
      ...(flags?.sundaySplitSquatJump ? ['master-split-jump'] : []),
      ...(flags?.primerPogos ? ['master-primer-pogo'] : []),
      ...(flags?.primerSlam ? ['master-primer-slam'] : []),
    ]);
    plan = plan.map(day => ({ ...day, exercises: day.exercises.map(item => item.optionalWork && enabled.has(item.key) ? { ...item, optionalWork: false } : item) }));
    plan = plan.map((day, index) => v81PhasePlan(day, index, week, match));
  } else {
    if (settings.optional?.mondayArms) plan[0].exercises.push(...arms());
    if (settings.optional?.thursdayArms) plan[3].exercises.push(...arms(true));
    if (settings.optional?.tuesdayPogos && plan[1].extraSession) plan[1].extraSession.exercises.splice(2, 0, pogos());
    plan = plan.map((day, index) => legacyPhasePlan(day, index, week, match));
  }
  const start = masterWeekStart(date);
  return plan.map((day, index) => {
    const currentDate = new Date(timestamp(start) + index * DAY).toISOString().slice(0, 10);
    const readiness = settings.readiness?.find(item => item.date === currentDate)?.status;
    return { ...applyMasterReadiness(day, readiness), ...(day.extraSession ? { extraSession: applyMasterReadiness(day.extraSession, readiness) } : {}) };
  });
}

/** Planned contacts are ceilings; completed contacts come only from actual done logs. */
export function masterJumpContacts(plan: Pick<PlanDay, 'exercises'>, session?: {
  exercises: readonly { jumpContactsPerRep?: number; logs: readonly { done: boolean; reps: number | null }[] }[];
}): { planned: number; completed: number } {
  const planned = plan.exercises.filter(item => !item.optionalWork && item.jumpContactsPerRep).reduce((sum, item) => {
    const reps = item.target.match(/(\d+)\s*(?:[–—-]\s*(\d+))?/);
    return sum + item.sets * Number(reps?.[2] ?? reps?.[1] ?? 0) * item.jumpContactsPerRep!;
  }, 0);
  const completed = (session?.exercises ?? []).reduce((sum, item) => sum + (item.jumpContactsPerRep ?? 0)
    * item.logs.reduce((count, log) => count + (log.done && Number.isFinite(log.reps) && (log.reps ?? 0) > 0 ? log.reps! : 0), 0), 0);
  return { planned, completed };
}

export function masterScheduledEvents(settings: MasterProgramSettings | undefined, date: string) {
  if (!settings || !getMasterProgramWeek(settings.startDate, date)) return [];
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return day === 3 && (settings.revision !== '8.1' || settings.optional?.easyRun)
    ? [{ name: 'Easy 5 km', detail: 'Optional · RPE 3–4 · conversational pace · log only when done' }]
    : day === 4 ? [{ name: 'School PE', detail: '~2 h · high jump + shot put · planned load, not automatically completed' }] : [];
}

/** PE logged as an extra already contributes to fueling time in the caller. */
export function masterPlannedMinutes(settings: MasterProgramSettings | undefined, date: string, mainMinutes: number,
  extras: readonly { name: string; durationMinutes: number }[]) {
  if (!masterScheduledEvents(settings, date).some(event => event.name === 'School PE')) return mainMinutes;
  const loggedPe = extras.filter(activity => /\b(?:school\s*)?pe\b|physical education|schulsport|hochsprung|kugelstoßen|体育课/i.test(activity.name))
    .reduce((sum, activity) => sum + activity.durationMinutes, 0);
  return mainMinutes + Math.max(0, 120 - loggedPe);
}

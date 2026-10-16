import { z } from 'zod';
import { findLibraryExercise } from './exercise-library.ts';
import type { PlanDay, PlanExercise } from './workout-customization';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const day = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
});
export const MasterProgramSettingsSchema = z.object({
  version: z.literal(1),
  startDate: dateSchema.refine(value => new Date(`${value}T12:00:00Z`).getUTCDay() === 1, 'Choose a Monday.'),
  matchWeeks: z.array(z.number().int().min(1).max(8)).max(8).refine(values => new Set(values).size === values.length),
  optional: z.object({ mondayArms: z.boolean(), thursdayArms: z.boolean(), tuesdayPogos: z.boolean() }).optional(),
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
export function getMasterOptionalExercises(day: number): PlanExercise[] {
  return day === 0 ? arms() : day === 3 ? arms(true) : day === 1 ? [pogos()] : [];
}

/** A new recommendation, separate from the original plan and all saved sessions. */
export function createVolleyballMasterPlan(matchWeek = false): PlanDay[] {
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
function phasePlan(day: PlanDay, index: number, week: number, match: boolean): PlanDay {
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
export function resolveMasterProgramPlan(basePlan: PlanDay[], settings: MasterProgramSettings, date: string,
  matchWeekend?: PlanDay[]): PlanDay[] {
  const week = getMasterProgramWeek(settings.startDate, date);
  if (!week) return structuredClone(basePlan);
  const match = settings.matchWeeks.includes(week);
  let plan = structuredClone(basePlan);
  if (match) plan.splice(5, 2, ...structuredClone(matchWeekend ?? createVolleyballMasterPlan(true).slice(5)));
  if (settings.optional?.mondayArms) plan[0].exercises.push(...arms());
  if (settings.optional?.thursdayArms) plan[3].exercises.push(...arms(true));
  if (settings.optional?.tuesdayPogos && plan[1].extraSession) plan[1].extraSession.exercises.splice(2, 0, pogos());
  plan = plan.map((day, index) => phasePlan(day, index, week, match));
  const start = masterWeekStart(date);
  return plan.map((day, index) => {
    const currentDate = new Date(timestamp(start) + index * DAY).toISOString().slice(0, 10);
    const readiness = settings.readiness?.find(item => item.date === currentDate)?.status;
    function adapt(workout: PlanDay): PlanDay {
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
    return { ...adapt(day), ...(day.extraSession ? { extraSession: adapt(day.extraSession) } : {}) };
  });
}
export function masterScheduledEvents(settings: MasterProgramSettings | undefined, date: string) {
  if (!settings || !getMasterProgramWeek(settings.startDate, date)) return [];
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return day === 3 ? [{ name: 'Easy 5 km', detail: 'RPE 3–4 · conversational pace · log when done' }]
    : day === 4 ? [{ name: 'School PE', detail: '~2 h · high jump + shot put · counts as load' }] : [];
}

/** PE logged as an extra already contributes to fueling time in the caller. */
export function masterPlannedMinutes(settings: MasterProgramSettings | undefined, date: string, mainMinutes: number,
  extras: readonly { name: string; durationMinutes: number }[]) {
  if (!masterScheduledEvents(settings, date).some(event => event.name === 'School PE')) return mainMinutes;
  const loggedPe = extras.filter(activity => /\b(?:school\s*)?pe\b|physical education|schulsport|hochsprung|kugelstoßen|体育课/i.test(activity.name))
    .reduce((sum, activity) => sum + activity.durationMinutes, 0);
  return mainMinutes + Math.max(0, 120 - loggedPe);
}

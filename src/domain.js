import {
  string as zString,
  number as zNumber,
  boolean as zBoolean,
  array as zArray,
  object as zObject,
  discriminatedUnion as zDiscriminatedUnion,
  literal as zLiteral,
  enum as zEnum,
} from "zod";
import { ZodIssueCode } from "zod";

var NutritionAmountSchema = zNumber().finite().min(0).max(2e4),
  FoodSchema = zObject({
    name: zString().trim().min(1).max(100),
    portion: zString().max(100),
    calories: NutritionAmountSchema,
    protein: NutritionAmountSchema,
    carbs: NutritionAmountSchema,
    fat: NutritionAmountSchema,
  }),
  MealSchema = zObject({
    kind: zLiteral(`meal`),
    name: zString().trim().min(1).max(100),
    foods: zArray(FoodSchema).min(1).max(30),
    source: zEnum([`manual`, `photo`]),
    notes: zString().max(1e3),
    assumptions: zString().max(1e3),
    confidence: zEnum([`low`, `medium`, `high`]).nullable(),
  }),
  NutritionTargetsSchema = zObject({
    kind: zLiteral(`targets`),
    calories: NutritionAmountSchema.nullable(),
    protein: NutritionAmountSchema.nullable(),
    carbs: NutritionAmountSchema.nullable(),
    fat: NutritionAmountSchema.nullable(),
    goalWeight: zNumber().min(20).max(400).nullable(),
  }),
  NutritionPayloadSchema = zDiscriminatedUnion(`kind`, [
    MealSchema,
    NutritionTargetsSchema,
    zObject({
      kind: zLiteral(`weight`),
      kg: zNumber().min(20).max(400),
    }),
  ]);
zObject({
  id: zString().min(1).max(100),
  date: zString()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((e) => {
      let t = new Date(e + `T12:00:00Z`);
      return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === e;
    }),
  payload: NutritionPayloadSchema,
});
var DEFAULT_NUTRITION_TARGETS = {
  kind: `targets`,
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  goalWeight: null,
};
function sumNutrients(e) {
  return e.reduce(
    (e, t) => ({
      calories: e.calories + t.calories,
      protein: e.protein + t.protein,
      carbs: e.carbs + t.carbs,
      fat: e.fat + t.fat,
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  );
}
function createExercise(
  e,
  t,
  n,
  r,
  i,
  a = `weight`,
  o = 90,
  s = !1,
  c = ``,
  l,
) {
  return {
    key: e,
    name: t,
    group: n,
    sets: r,
    target: i,
    mode: a,
    rest: o,
    perSide: s,
    cue: c,
    ...(l
      ? {
          measurement: l,
        }
      : {}),
  };
}
var DEFAULT_WEEKLY_PLAN = [
    {
      name: `Upper Power + Muscle`,
      kind: `strength`,
      minutes: 65,
      note: `60–70 min. Medicine-ball work first: fast, powerful reps, never to fatigue. Then chest, back, shoulders and arms.`,
      exercises: [
        createExercise(
          `spike-slam`,
          `Medicine Ball Spike Slam`,
          `Power`,
          4,
          `4 reps`,
          `weight`,
          90,
          !1,
          `Do this first. Reset between explosive reps.`,
        ),
        createExercise(
          `chest-press`,
          `Machine Chest Press / Bench Press`,
          `Chest`,
          3,
          `6–8 reps`,
          `weight`,
          120,
        ),
        createExercise(
          `lat-pulldown`,
          `Neutral-Grip Lat Pulldown`,
          `Back`,
          3,
          `6–10 reps`,
          `weight`,
          120,
        ),
        createExercise(
          `chest-row`,
          `Chest-Supported Row`,
          `Back`,
          3,
          `8–10 reps`,
          `weight`,
          120,
        ),
        createExercise(
          `incline-db`,
          `Incline Dumbbell Press`,
          `Chest`,
          2,
          `8–12 reps`,
        ),
        createExercise(
          `lateral-raise`,
          `Cable Lateral Raise`,
          `Shoulders`,
          3,
          `12–20 reps`,
          `weight`,
          60,
        ),
        createExercise(
          `reverse-pec`,
          `Reverse Pec Deck`,
          `Shoulders`,
          2,
          `12–20 reps`,
          `weight`,
          60,
        ),
        createExercise(
          `biceps-curl`,
          `Biceps Curl`,
          `Arms`,
          2,
          `10–15 reps`,
          `weight`,
          60,
        ),
        createExercise(
          `triceps`,
          `Triceps Pushdown`,
          `Arms`,
          2,
          `10–15 reps`,
          `weight`,
          60,
        ),
        createExercise(
          `pallof`,
          `Pallof Press`,
          `Core`,
          2,
          `10 reps`,
          `weight`,
          60,
          !0,
        ),
      ],
    },
    {
      name: `Volleyball`,
      kind: `sport`,
      minutes: 120,
      note: `Club training · 20:00–22:00. Log the 16:15–16:35 technique primer separately. Main meal around 17:15–18:00.`,
      exercises: [
        createExercise(
          `volleyball`,
          `Volleyball practice`,
          `Sport`,
          1,
          `120 min`,
          `timed`,
          0,
        ),
      ],
      extraSession: {
        name: `Jump Technique Primer`,
        kind: `strength`,
        minutes: 20,
        note: `16:15–16:35 · 15–20 min before evening volleyball. Practice technique without fatigue. Recover fully between jumps; finish feeling fresh.`,
        exercises: [
          createExercise(
            `penultimate-step`,
            `Penultimate Step Drill`,
            `Technique`,
            3,
            `3 reps`,
            `bodyweight`,
            60,
            !1,
            `Slow to fast. Quick final two steps; swing the arms back, then explode up.`,
          ),
          createExercise(
            `approach-jump`,
            `Approach Jump`,
            `Power`,
            4,
            `1 rep`,
            `bodyweight`,
            90,
            !1,
            `One high-quality jump per set. Rest 45–90 sec. Record your highest touch in cm.`,
            `touch`,
          ),
          createExercise(
            `pogo`,
            `Pogo Jump`,
            `Elasticity`,
            2,
            `10 sec`,
            `timed`,
            60,
            !1,
            `Spring through the ankles with brief ground contact.`,
          ),
          createExercise(
            `arm-swing-jump`,
            `Arm-Swing Jump`,
            `Technique`,
            2,
            `2 reps`,
            `bodyweight`,
            90,
            !1,
            `Coordinate the arm swing with take-off. Stop before fatigue.`,
          ),
        ],
      },
    },
    {
      name: `Lower Strength`,
      kind: `strength`,
      minutes: 60,
      note: `Strength only after Tuesday’s volleyball; no extra plyometrics. Hack squat at about RIR 2. Keep effort in reserve and use controlled technique.`,
      exercises: [
        createExercise(
          `hack-squat`,
          `Hack Squat`,
          `Quads`,
          3,
          `4–6 reps`,
          `weight`,
          180,
          !1,
          `Keep about 2 reps in reserve. No 1RM test needed.`,
        ),
        createExercise(
          `rdl`,
          `Romanian Deadlift`,
          `Hamstrings`,
          3,
          `5–8 reps`,
          `weight`,
          150,
        ),
        createExercise(
          `bulgarian`,
          `Bulgarian Split Squat`,
          `Legs`,
          2,
          `6–8 reps`,
          `weight`,
          120,
          !0,
        ),
        createExercise(`leg-curl`, `Leg Curl`, `Hamstrings`, 2, `8–12 reps`),
        createExercise(`calf`, `Standing Calf Raise`, `Calves`, 3, `8–12 reps`),
        createExercise(
          `tibialis`,
          `Tibialis Raise`,
          `Lower legs`,
          2,
          `15–20 reps`,
          `bodyweight`,
          60,
        ),
        createExercise(
          `side-plank`,
          `Side Plank`,
          `Core`,
          2,
          `30–45 sec`,
          `timed`,
          60,
          !0,
        ),
      ],
    },
    {
      name: `Upper Power B`,
      kind: `strength`,
      minutes: 65,
      note: `Medicine-ball throws first, then back, shoulders and chest. Transfer power through hips and trunk to the arm; keep explosive reps crisp.`,
      exercises: [
        createExercise(
          `rotational-throw`,
          `Medicine Ball Rotational Throw`,
          `Power`,
          3,
          `4 reps`,
          `weight`,
          90,
          !0,
          `Fast throws with a full reset. Record reps per side.`,
        ),
        createExercise(
          `overhead-throw`,
          `Medicine Ball Overhead Throw / Slam`,
          `Power`,
          3,
          `4 reps`,
          `weight`,
          90,
          !1,
          `Explosive reps, not a conditioning circuit.`,
        ),
        createExercise(
          `lat-pulldown`,
          `Neutral-Grip Lat Pulldown / Pull-up`,
          `Back`,
          3,
          `6–10 reps`,
          `weight`,
          120,
          !1,
          `The weight field is for pulldown load. If using pull-ups, edit this movement to bodyweight logging.`,
        ),
        createExercise(
          `chest-row`,
          `Chest-Supported Row`,
          `Back`,
          3,
          `8–12 reps`,
          `weight`,
          120,
        ),
        createExercise(
          `landmine-press`,
          `Landmine Press / Machine Shoulder Press`,
          `Shoulders`,
          3,
          `8–10 reps`,
          `weight`,
          120,
          !1,
          `Choose one variation and keep the same setup for comparisons.`,
        ),
        createExercise(
          `chest-press`,
          `Machine Chest Press`,
          `Chest`,
          2,
          `8–12 reps`,
        ),
        createExercise(
          `lateral-raise`,
          `Cable Lateral Raise`,
          `Shoulders`,
          3,
          `12–20 reps`,
          `weight`,
          60,
        ),
        createExercise(
          `face-pull`,
          `Face Pull`,
          `Shoulders`,
          2,
          `15–20 reps`,
          `weight`,
          60,
        ),
        createExercise(
          `external-rotation`,
          `Cable External Rotation`,
          `Shoulders`,
          2,
          `12–15 reps`,
          `weight`,
          60,
          !0,
        ),
        createExercise(
          `hammer-curl`,
          `Hammer Curl`,
          `Arms`,
          2,
          `10–15 reps`,
          `weight`,
          60,
        ),
      ],
    },
    {
      name: `Volleyball`,
      kind: `sport`,
      minutes: 120,
      note: `Club training · 20:00–22:00. No gym or extra jump training today.`,
      exercises: [
        createExercise(
          `volleyball`,
          `Volleyball practice`,
          `Sport`,
          1,
          `120 min`,
          `timed`,
          0,
        ),
      ],
    },
    {
      name: `Recovery`,
      kind: `recovery`,
      minutes: 40,
      note: `Rest the legs for Sunday. Optional 20–30 min easy walk, plus 15–20 min of mobility and stretching. No heavy squats, deadlifts, jumps or sprints. Optional light arms/core only.`,
      exercises: [
        createExercise(
          `walk`,
          `Easy walk`,
          `Recovery`,
          1,
          `20–30 min`,
          `timed`,
          0,
        ),
        createExercise(
          `mobility`,
          `Ankle, hip & thoracic mobility`,
          `Recovery`,
          1,
          `15–20 min`,
          `timed`,
          0,
        ),
      ],
    },
    {
      name: `Main Jump + Complex Lower`,
      kind: `strength`,
      minutes: 70,
      note: `65–75 min. Jumps first; stop if height or quality falls. Alternate A1/A2 for 3 rounds, then B1/B2 for 2 rounds. Rest 2–3 min after each strength set before jumping, then recover fully before the next round.`,
      exercises: [
        createExercise(
          `approach-jump`,
          `Approach Jump`,
          `Technique`,
          4,
          `2 reps`,
          `bodyweight`,
          120,
          !1,
          `8 high-quality jumps total. Rest 90–120 sec between sets. Record the highest touch.`,
          `touch`,
        ),
        createExercise(
          `pogo`,
          `Pogo Jump`,
          `Elasticity`,
          3,
          `10–15 sec`,
          `timed`,
          60,
          !1,
          `Ankles like springs; keep ground contact short.`,
        ),
        createExercise(
          `hack-squat`,
          `Hack Squat`,
          `A1 · Complex pair`,
          3,
          `3–4 reps`,
          `weight`,
          180,
          !1,
          `RIR 1–2. After each set, rest 2–3 min, then do A2. Recover fully before the next round.`,
        ),
        createExercise(
          `cmj`,
          `Countermovement Jump`,
          `A2 · Complex pair`,
          3,
          `2 reps`,
          `bodyweight`,
          180,
          !1,
          `Pair with A1 for 3 rounds. Full-effort jumps with controlled landings. Enter jump height, not touch height.`,
          `height`,
        ),
        createExercise(
          `bulgarian`,
          `Bulgarian Split Squat`,
          `B1 · Complex pair`,
          2,
          `5–6 reps`,
          `weight`,
          180,
          !0,
          `After both legs, rest 2–3 min, then do B2. Repeat for 2 rounds.`,
        ),
        createExercise(
          `broad-jump`,
          `Broad Jump`,
          `B2 · Complex pair`,
          2,
          `2 reps`,
          `bodyweight`,
          180,
          !1,
          `Pair with B1. Reset for each jump and recover fully before the next round.`,
          `distance`,
        ),
        createExercise(
          `rdl`,
          `Romanian Deadlift`,
          `Hamstrings`,
          3,
          `5–6 reps`,
          `weight`,
          150,
        ),
        createExercise(`leg-curl`, `Leg Curl`, `Hamstrings`, 2, `8–12 reps`),
        createExercise(
          `calf`,
          `Standing Calf Raise`,
          `Calves`,
          3,
          `6–10 reps`,
          `weight`,
          120,
          !1,
          `Heavy, controlled repetitions.`,
        ),
        createExercise(
          `tibialis`,
          `Tibialis Raise`,
          `Lower legs`,
          2,
          `15–20 reps`,
          `bodyweight`,
          60,
        ),
        createExercise(
          `copenhagen`,
          `Copenhagen Plank`,
          `Core`,
          2,
          `20–30 sec`,
          `timed`,
          60,
          !0,
        ),
      ],
    },
  ],
  EXERCISE_LIBRARY = [
    {
      weeks: `Weeks 1–2`,
      title: `Technique & adaptation`,
      note: `Learn the movements and build consistent jump technique.`,
    },
    {
      weeks: `Weeks 3–5`,
      title: `Strength & complex training`,
      note: `Progress strength while keeping every jump fast and high quality.`,
    },
    {
      weeks: `Week 6`,
      title: `Deload`,
      note: `Reduce training volume by about 35–50%; keep movement quality.`,
    },
    {
      weeks: `Weeks 7–8`,
      title: `Power peak`,
      note: `Reduce strength volume and prioritize jump quality.`,
    },
  ];
function measurementLabel(e) {
  return e.measurement === `touch`
    ? `Highest touch · cm`
    : e.measurement === `height`
      ? `Jump height · cm`
      : `Jump distance · cm`;
}
function bestMeasurement(e) {
  let t =
    e?.logs
      .filter((e) => e.done && e.measurementCm != null)
      .map((e) => e.measurementCm) ?? [];
  return t.length ? Math.max(...t) : null;
}
var createPreparationStep = (e, t, n, r = ``) => ({
    key: e,
    name: t,
    target: n,
    cue: r,
    done: !1,
  }),
  LOWER_WARMUP = [
    createPreparationStep(
      `ankle-wall`,
      `Ankle Knee-to-Wall`,
      `2 × 8 / side`,
      `Keep the heel down and move smoothly.`,
    ),
    createPreparationStep(
      `leg-swings`,
      `Leg Swings`,
      `10 forward/back + 10 sideways / side`,
      `Controlled swings; avoid forcing the range.`,
    ),
    createPreparationStep(
      `lunge-rotation`,
      `Walking Lunge + Rotation`,
      `6–8 steps / side`,
      `Move through the hips and upper back with control.`,
    ),
    createPreparationStep(
      `hip-switch`,
      `90/90 Hip Switch`,
      `8 / side`,
      `Use a comfortable range on both sides.`,
    ),
    createPreparationStep(
      `bw-squat`,
      `Bodyweight Squat`,
      `2 × 8`,
      `Controlled reps before loading the legs.`,
    ),
  ],
  JUMP_WARMUP = [
    createPreparationStep(
      `warm-pogo`,
      `Easy Pogo`,
      `2 × 10 sec`,
      `Light ankle bounces; this is a warm-up.`,
    ),
    createPreparationStep(
      `progressive-jumps`,
      `Progressive Jumps`,
      `50% → 70% → 85% effort`,
      `Build up gradually before full-effort jumps.`,
    ),
  ],
  UPPER_WARMUP = [
    createPreparationStep(
      `warm-external`,
      `Band / Cable External Rotation`,
      `2 × 12`,
      `Light resistance, controlled movement.`,
    ),
    createPreparationStep(
      `warm-face-pull`,
      `Light Face Pull`,
      `1–2 × 15`,
      `Use a light load without fatigue.`,
    ),
    createPreparationStep(
      `wall-slide`,
      `Wall Slide`,
      `2 × 8`,
      `Keep the ribs controlled; move comfortably.`,
    ),
    createPreparationStep(
      `thoracic-rotation`,
      `Thoracic Rotation`,
      `8 / side`,
      `Rotate gently through the upper back.`,
    ),
    createPreparationStep(
      `ramp-upper`,
      `Light Pulldown / Press`,
      `1–2 warm-up sets each`,
      `Build the load gradually before working sets.`,
    ),
  ],
  COOLDOWN = [
    createPreparationStep(
      `stretch-gastroc`,
      `Gastrocnemius Stretch`,
      `1–2 × 20–40 sec / side`,
      `Straight back knee; gentle stretch with heel down.`,
    ),
    createPreparationStep(
      `stretch-soleus`,
      `Soleus Stretch`,
      `1–2 × 20–40 sec / side`,
      `Bend the back knee slightly; keep the heel down.`,
    ),
    createPreparationStep(
      `stretch-hip-flexor`,
      `Hip Flexor Stretch`,
      `1–2 × 20–40 sec / side`,
      `Keep the ribs and pelvis controlled.`,
    ),
    createPreparationStep(
      `stretch-hamstring`,
      `Hamstring Stretch`,
      `1–2 × 20–40 sec / side`,
      `Comfortable range; avoid rounding or forcing the back.`,
    ),
    createPreparationStep(
      `stretch-glute`,
      `Glute Stretch`,
      `1–2 × 20–40 sec / side`,
      `Use a gentle figure-four position.`,
    ),
    createPreparationStep(
      `stretch-lat`,
      `Lat Stretch`,
      `1–2 × 20–40 sec / side`,
      `Reach gently; do not force the shoulder.`,
    ),
    createPreparationStep(
      `stretch-pec`,
      `Pec Stretch`,
      `1–2 × 20–40 sec / side`,
      `Gentle doorway stretch, without shoulder pain.`,
    ),
  ];
function withPreparation(e, t) {
  let n;
  n =
    e.kind === `recovery`
      ? []
      : e.kind === `sport`
        ? [
            ...LOWER_WARMUP.slice(0, 4),
            ...UPPER_WARMUP.filter((e) =>
              [`warm-external`, `wall-slide`, `thoracic-rotation`].includes(
                e.key,
              ),
            ),
            ...JUMP_WARMUP,
          ]
        : t === 0 || t === 3
          ? UPPER_WARMUP
          : t === 2
            ? [
                ...LOWER_WARMUP,
                createPreparationStep(
                  `ramp-lower`,
                  `Light Squat / Hinge Warm-up`,
                  `1–2 gradual warm-up sets`,
                  `Build the load gradually. No extra jumping today.`,
                ),
              ]
            : [...LOWER_WARMUP, ...JUMP_WARMUP];
  let r =
      e.kind === `recovery`
        ? [LOWER_WARMUP[0], LOWER_WARMUP[3], UPPER_WARMUP[3], ...COOLDOWN]
        : COOLDOWN,
    i = {
      ...e,
      warmup: e.warmup ?? structuredClone(n),
      cooldown: e.cooldown ?? structuredClone(r),
    };
  return (
    e.extraSession && (i.extraSession = withPreparation(e.extraSession, t)),
    i
  );
}
var optionalAmount = (e) => zNumber().finite().min(0).max(e).nullable(),
  PreparationSchema = zArray(
    zObject({
      key: zString().min(1).max(120),
      name: zString().min(1).max(120),
      target: zString().max(100),
      cue: zString().max(500),
      done: zBoolean(),
    }),
  ).max(20),
  ExerciseSchema = zObject({
    key: zString().min(1).max(120),
    name: zString().trim().min(1).max(120),
    group: zString().max(80),
    sets: zNumber().int().min(1).max(20),
    target: zString().max(60),
    mode: zEnum([`weight`, `bodyweight`, `timed`]),
    rest: zNumber().int().min(0).max(600),
    perSide: zBoolean(),
    cue: zString().max(500).optional(),
    measurement: zEnum([`touch`, `height`, `distance`]).optional(),
  }),
  PlanDaySchema = zObject({
    name: zString().trim().min(1).max(80),
    kind: zEnum([`strength`, `sport`, `recovery`]),
    minutes: zNumber().int().min(1).max(600),
    note: zString().max(500),
    exercises: zArray(ExerciseSchema).max(40),
    warmup: PreparationSchema.optional(),
    cooldown: PreparationSchema.optional(),
  }),
  ProfileSchema = zObject({
    plan: zArray(
      PlanDaySchema.extend({
        extraSession: PlanDaySchema.optional(),
      }).refine(
        (e) =>
          new Set(e.exercises.map((e) => e.key)).size === e.exercises.length &&
          (!e.extraSession ||
            new Set(e.extraSession.exercises.map((e) => e.key)).size ===
              e.extraSession.exercises.length),
        `Use a unique name for each exercise in a session.`,
      ),
    ).length(7),
    bodyWeight: zNumber().finite().min(20).max(400),
    restSeconds: zNumber().int().min(15).max(600),
    nutrition: zObject({
      age: zNumber().int().min(18).max(100),
      heightCm: zNumber().finite().min(100).max(250),
      sex: zEnum([`male`, `female`, `unspecified`]),
      activityFactor: zNumber().finite().min(1.2).max(2.4),
      surplusKcal: zNumber().finite().min(0).max(500),
    }).optional(),
    volleyballSchedule: zObject({
      days: zArray(zNumber().int().min(0).max(6)).min(1).max(7)
        .refine((days) => new Set(days).size === days.length),
      startTime: zString().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      endTime: zString().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
      timeZone: zLiteral(`Europe/Berlin`),
    }).refine((schedule) => schedule.endTime > schedule.startTime,
      `The end time must be after the start time.`).optional(),
  }),
  SetLogSchema = zObject({
    id: zString().min(1).max(80),
    kg: optionalAmount(2e3),
    reps: zNumber().int().min(0).max(1e3).nullable(),
    seconds: optionalAmount(86400),
    rir: optionalAmount(10),
    done: zBoolean(),
    measurementCm: optionalAmount(1e3).optional(),
  }),
  SessionExerciseSchema = ExerciseSchema.extend({
    logs: zArray(SetLogSchema).min(1).max(30),
    elapsedMs: zNumber().min(0).max(6048e5),
    runningSince: zNumber().finite().min(0).nullable(),
  }),
  SessionSchema = zObject({
    id: zString().uuid(),
    date: zString()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((e) => {
        let t = new Date(`${e}T12:00:00Z`);
        return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === e;
      }),
    day: zNumber().int().min(0).max(6),
    name: zString().min(1).max(80),
    kind: zEnum([`strength`, `sport`, `recovery`]),
    status: zEnum([`active`, `completed`, `cancelled`, `deleted`]),
    startedAt: zNumber().min(0),
    finishedAt: zNumber().min(0).nullable(),
    elapsedMs: zNumber().min(0).max(6048e5),
    runningSince: zNumber().min(0).nullable(),
    bodyWeight: zNumber().min(20).max(400),
    met: zNumber().min(1).max(15),
    watchCalories: optionalAmount(2e4),
    notes: zString().max(2e3),
    exercises: zArray(SessionExerciseSchema).max(40),
    warmup: PreparationSchema.optional(),
    cooldown: PreparationSchema.optional(),
    deletedAt: zNumber().finite().min(0).nullable().optional(),
  }).superRefine((e, t) => {
    (e.status !== `active` &&
      (e.runningSince !== null ||
        e.exercises.some((e) => e.runningSince !== null)) &&
      t.addIssue({
        code: ZodIssueCode.custom,
        message: `Finished workouts cannot have running timers.`,
      }),
      (e.status === `completed` || e.status === `deleted`) &&
        e.finishedAt === null &&
        t.addIssue({
          code: ZodIssueCode.custom,
          message: `A finished workout needs a finish time.`,
        }),
      e.status === `deleted` &&
        e.deletedAt == null &&
        t.addIssue({
          code: ZodIssueCode.custom,
          message: `A deleted workout needs a deletion time.`,
        }),
      new Set(e.exercises.map((e) => e.key)).size !== e.exercises.length &&
        t.addIssue({
          code: ZodIssueCode.custom,
          message: `Exercises need unique identifiers.`,
        }));
    for (let n of e.exercises)
      (n.logs.some(
        (e) =>
          e.done && (n.mode === `timed` ? !(e.seconds ?? 0) : !(e.reps ?? 0)),
      ) &&
        t.addIssue({
          code: ZodIssueCode.custom,
          message: `Completed sets need reps or a duration.`,
        }),
        n.mode === `weight` &&
          n.logs.some((e) => e.done && e.kg === null) &&
          t.addIssue({
            code: ZodIssueCode.custom,
            message: `Completed weight sets need a weight.`,
          }));
  }),
  WEEKDAYS = [
    `Monday`,
    `Tuesday`,
    `Wednesday`,
    `Thursday`,
    `Friday`,
    `Saturday`,
    `Sunday`,
  ],
  DEFAULT_PROFILE = {
    plan: DEFAULT_WEEKLY_PLAN.map(withPreparation),
    bodyWeight: 64,
    restSeconds: 90,
    nutrition: { age: 18, heightCm: 180, sex: `male`, activityFactor: 1.65, surplusKcal: 200 },
    volleyballSchedule: { days: [1, 4], startTime: `20:00`, endTime: `22:00`, timeZone: `Europe/Berlin` },
  };
function elapsedTime(e, t, n = Date.now()) {
  return Math.max(0, e + (t === null ? 0 : n - t));
}
function sessionDuration(e, t = Date.now()) {
  return elapsedTime(e.elapsedMs, e.runningSince, t);
}
function formatDuration(e, t = Date.now()) {
  let n = e.logs
    .filter((e) => e.done)
    .reduce((e, t) => e + (t.seconds ?? 0) * 1e3, 0);
  return Math.max(elapsedTime(e.elapsedMs, e.runningSince, t), n);
}
function formatElapsedTime(e) {
  let t = Math.max(0, Math.floor(e / 1e3));
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, `0`)}:${(t % 60).toString().padStart(2, `0`)}`;
}
function completedSets(e) {
  return e.exercises.reduce(
    (e, t) => e + t.logs.filter((e) => e.done).length,
    0,
  );
}
function estimatedCalories(e) {
  return e.reduce(
    (e, t) =>
      e +
      t.logs.reduce(
        (e, t) => e + (t.done ? (t.kg ?? 0) * (t.reps ?? 0) : 0),
        0,
      ),
    0,
  );
}
function getCalories(e, t = Date.now()) {
  return e.watchCalories === null
    ? Math.round(
        (((Math.max(0, e.met - 1) * 3.5 * e.bodyWeight) / 200) *
          sessionDuration(e, t)) /
          6e4,
      )
    : e.watchCalories;
}
function topSet(e) {
  return e?.logs
    .filter((e) => e.done && (e.kg ?? 0) > 0 && (e.reps ?? 0) > 0)
    .sort(
      (e, t) => (t.kg ?? 0) - (e.kg ?? 0) || (t.reps ?? 0) - (e.reps ?? 0),
    )[0];
}
function previousExercise(e, t, n, r) {
  for (let i of e
    .filter((e) => e.status === `completed` && e.date <= n && e.id !== r)
    .sort(
      (e, t) => t.date.localeCompare(e.date) || t.startedAt - e.startedAt,
    )) {
    let e = i.exercises.find((e) => e.key === t && e.logs.some((e) => e.done));
    if (e)
      return {
        session: i,
        exercise: e,
      };
  }
  return null;
}
function dateKey(e) {
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, `0`)}-${String(e.getDate()).padStart(2, `0`)}`;
}
function startOfWeek(e) {
  let t = new Date(e);
  return (
    t.setHours(12, 0, 0, 0),
    t.setDate(t.getDate() - ((t.getDay() + 6) % 7)),
    t
  );
}
function addDays(e, t) {
  let n = new Date(e);
  return (n.setDate(n.getDate() + t), n);
}
function formatDate(e, t = !1) {
  return new Date(`${e}T12:00:00`).toLocaleDateString(`en-GB`, {
    day: `numeric`,
    month: t ? `short` : `long`,
  });
}
function createSession(e, t, n, r, i) {
  let a = Date.now();
  return {
    id: crypto.randomUUID(),
    date: n,
    day: t,
    name: e.name,
    kind: e.kind,
    status: `active`,
    startedAt: a,
    finishedAt: null,
    elapsedMs: 0,
    runningSince: a,
    bodyWeight: r.bodyWeight,
    met: e.kind === `sport` ? 4 : e.kind === `recovery` ? 2.3 : 3.5,
    watchCalories: null,
    notes: ``,
    warmup: e.warmup?.map((e) => ({
      ...e,
      done: !1,
    })),
    cooldown: e.cooldown?.map((e) => ({
      ...e,
      done: !1,
    })),
    exercises: e.exercises.map((e) => {
      let t = previousExercise(i, e.key, n)?.exercise;
      return {
        ...e,
        elapsedMs: 0,
        runningSince: null,
        logs: Array.from(
          {
            length: e.sets,
          },
          (e, n) => {
            let r = t?.logs.filter((e) => e.done)[n];
            return {
              id: crypto.randomUUID(),
              kg: r?.kg ?? null,
              reps: r?.reps ?? null,
              seconds: r?.seconds ?? null,
              rir: null,
              done: !1,
            };
          },
        ),
      };
    }),
  };
}
function stopSessionTimers(e, t, n = Date.now()) {
  return {
    ...e,
    status: t,
    elapsedMs: sessionDuration(e, n),
    runningSince: null,
    finishedAt: t === `active` ? null : n,
    exercises: e.exercises.map((e) => ({
      ...e,
      elapsedMs: elapsedTime(e.elapsedMs, e.runningSince, n),
      runningSince: null,
    })),
  };
}

export {
  NutritionAmountSchema,
  FoodSchema,
  MealSchema,
  NutritionTargetsSchema,
  NutritionPayloadSchema,
  DEFAULT_NUTRITION_TARGETS,
  sumNutrients,
  createExercise,
  DEFAULT_WEEKLY_PLAN,
  EXERCISE_LIBRARY,
  measurementLabel,
  bestMeasurement,
  createPreparationStep,
  LOWER_WARMUP,
  JUMP_WARMUP,
  UPPER_WARMUP,
  COOLDOWN,
  withPreparation,
  optionalAmount,
  PreparationSchema,
  ExerciseSchema,
  PlanDaySchema,
  ProfileSchema,
  SetLogSchema,
  SessionExerciseSchema,
  SessionSchema,
  WEEKDAYS,
  DEFAULT_PROFILE,
  elapsedTime,
  sessionDuration,
  formatDuration,
  formatElapsedTime,
  completedSets,
  estimatedCalories,
  getCalories,
  topSet,
  previousExercise,
  dateKey,
  startOfWeek,
  addDays,
  formatDate,
  createSession,
  stopSessionTimers,
};

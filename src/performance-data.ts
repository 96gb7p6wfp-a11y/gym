import { z } from 'zod';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Choose a valid date.');

/** Height above takeoff and absolute highest touch are deliberately separate. */
export const JumpEntrySchema = z.object({
  id: z.string().uuid(),
  date: DateSchema,
  type: z.enum(['standing', 'approach', 'block']),
  measurement: z.enum(['height', 'touch']),
  cm: z.number().finite().gt(0).max(1000),
  notes: z.string().max(500),
  // Absent source means a directly measured legacy record. Never rewrite it.
  source: z.enum(['measured', 'video-estimate']).optional(),
  // Retain the original setup with each test, rather than recalculating old
  // results when an athlete measures a different standing reach later.
  standingReachCm: z.number().finite().gt(0).max(1000).optional(),
  touchCm: z.number().finite().gt(0).max(1000).optional(),
}).strict().superRefine((entry, context) => {
  const hasReach = entry.standingReachCm !== undefined;
  const hasTouch = entry.touchCm !== undefined;
  if (hasReach !== hasTouch) {
    context.addIssue({ code: 'custom', message: 'Keep standing reach and jump touch together.' });
  } else if (hasReach && hasTouch) {
    if (entry.measurement !== 'height' || entry.touchCm! <= entry.standingReachCm!) {
      context.addIssue({ code: 'custom', message: 'Jump touch must be above standing reach.' });
    } else if (Math.abs(entry.cm - (entry.touchCm! - entry.standingReachCm!)) > 0.000001) {
      context.addIssue({ code: 'custom', message: 'Jump height must equal jump touch minus standing reach.' });
    }
  }
});

export const ReadinessEntrySchema = z.object({
  id: z.string().uuid(),
  date: DateSchema,
  energy: z.enum(['low', 'normal', 'high']),
  soreness: z.enum(['low', 'moderate', 'high']),
}).strict();

export const PerformanceDataSchema = z.object({
  jumps: z.array(JumpEntrySchema).max(10000),
  readiness: z.array(ReadinessEntrySchema).max(10000),
}).strict().superRefine((data, context) => {
  if (new Set(data.jumps.map((jump) => jump.id)).size !== data.jumps.length
    || new Set(data.readiness.map((entry) => entry.id)).size !== data.readiness.length) {
    context.addIssue({ code: 'custom', message: 'Performance records need unique identifiers.' });
  }
  if (new Set(data.readiness.map((entry) => entry.date)).size !== data.readiness.length) {
    context.addIssue({ code: 'custom', message: 'Keep one readiness check-in per day.' });
  }
});

export type JumpEntry = z.infer<typeof JumpEntrySchema>;
export type ReadinessEntry = z.infer<typeof ReadinessEntrySchema>;
export type PerformanceData = z.infer<typeof PerformanceDataSchema>;
export type PerformancePayload = PerformanceData & { version: number };

const ReachJumpInputSchema = z.object({
  date: DateSchema,
  standingReachCm: z.number().finite().gt(0).max(1000),
  standingTouchCm: z.number().finite().gt(0).max(1000).optional(),
  approachTouchCm: z.number().finite().gt(0).max(1000).optional(),
  notes: z.string().max(500).optional(),
  source: z.enum(['measured', 'video-estimate']).optional(),
}).strict().superRefine((input, context) => {
  if (input.standingTouchCm === undefined && input.approachTouchCm === undefined) {
    context.addIssue({ code: 'custom', message: 'Enter a standing-jump or approach-jump touch height.' });
  }
  for (const key of ['standingTouchCm', 'approachTouchCm'] as const) {
    if (input[key] !== undefined && input[key]! <= input.standingReachCm) {
      context.addIssue({ code: 'custom', path: [key], message: 'Jump touch must be above standing reach.' });
    }
  }
});

/** One test may record either or both jump types; each retains its reach/touch. */
export function createReachJumpEntries(input: z.input<typeof ReachJumpInputSchema>): JumpEntry[] {
  const parsed = ReachJumpInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Enter valid reach and touch heights.');
  const data = parsed.data;
  return (['standing', 'approach'] as const).flatMap(type => {
    const touchCm = type === 'standing' ? data.standingTouchCm : data.approachTouchCm;
    if (touchCm === undefined) return [];
    return [JumpEntrySchema.parse({
      id: crypto.randomUUID(), date: data.date, type, measurement: 'height',
      cm: Math.round((touchCm - data.standingReachCm) * 1_000_000) / 1_000_000,
      standingReachCm: data.standingReachCm, touchCm,
      notes: data.notes ?? '', source: data.source ?? 'measured',
    })];
  });
}

export function emptyPerformance(): PerformanceData {
  return { jumps: [], readiness: [] };
}

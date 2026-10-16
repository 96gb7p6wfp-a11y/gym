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
}).strict();

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

export function emptyPerformance(): PerformanceData {
  return { jumps: [], readiness: [] };
}

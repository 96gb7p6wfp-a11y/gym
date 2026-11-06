import { z } from 'zod';
import type { MasterProgramSettings, MasterReadiness } from './volleyball-master-plan';

export const CoachDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const day = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}, 'Choose a valid calendar date.');
export const CalendarMatchSchema = z.object({
  date: CoachDateSchema.refine(value => new Date(`${value}T12:00:00Z`).getUTCDay() === 0, 'Choose the Sunday match date.'),
  scheduled: z.boolean(),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  opponent: z.string().trim().max(120).optional(),
  location: z.string().trim().max(180).optional(),
  notes: z.string().trim().max(500).optional(),
}).strict();
export const DailyReadinessSchema = z.object({
  date: CoachDateSchema,
  feeling: z.enum(['great', 'normal', 'tired', 'poor']),
}).strict();
export const TrainingPhaseSchema = z.object({
  startDate: CoachDateSchema,
  endDate: CoachDateSchema,
  phase: z.enum(['normal', 'deload', 'evaluation']),
}).strict().refine(value => value.startDate <= value.endDate, 'The end date must be on or after the start date.');
export type CalendarMatch = z.infer<typeof CalendarMatchSchema>;
export type DailyFeeling = z.infer<typeof DailyReadinessSchema>['feeling'];
export type CoachPhase = z.infer<typeof TrainingPhaseSchema>['phase'];

const shifted = (date: string, days: number): string => {
  CoachDateSchema.parse(date);
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

/** Calendar arithmetic, not 24-hour local instants: Berlin DST cannot move a match. */
export function sundayForDate(date: string): string {
  CoachDateSchema.parse(date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shifted(date, (7 - day) % 7);
}

/** Exact original dates only. Historic selections never roll into a new block. */
function legacyMatches(settings: MasterProgramSettings): CalendarMatch[] {
  CoachDateSchema.parse(settings.startDate);
  return settings.matchWeeks.map(week => ({
    date: shifted(settings.startDate, (week - 1) * 7 + 6), scheduled: true,
    ...(settings.matchTimes?.find(row => row.week === week)?.startTime
      ? { startTime: settings.matchTimes.find(row => row.week === week)!.startTime } : {}),
  })).map(row => CalendarMatchSchema.parse(row));
}

/** Pure compatibility view. No storage is written when a plan is opened. */
export function getCalendarMatch(settings: MasterProgramSettings | undefined, sundayDate: string): CalendarMatch {
  CalendarMatchSchema.shape.date.parse(sundayDate);
  if (!settings) return { date: sundayDate, scheduled: false };
  // Presence, including [], marks the date schedule as authoritative. Legacy
  // indices remain available for history but can no longer recreate deleted dates.
  const rows = settings.calendarMatches ?? legacyMatches(settings);
  const row = rows.find(match => match.date === sundayDate);
  return row ? structuredClone(row) : { date: sundayDate, scheduled: false };
}

/** Persist only as part of an explicit match/settings save, never during hydration. */
export function migrateLegacyMatchSchedule(settings: MasterProgramSettings): MasterProgramSettings {
  return { ...structuredClone(settings), calendarMatches: structuredClone(settings.calendarMatches ?? legacyMatches(settings)) };
}

export function saveCalendarMatch(settings: MasterProgramSettings, entry: CalendarMatch): MasterProgramSettings {
  const migrated = migrateLegacyMatchSchedule(settings);
  // This is a complete reviewed row, not a patch. Omitting an optional field
  // clears it; callers retain wanted metadata in their current editing draft.
  const candidate = { ...entry };
  // An empty optional time is unconfirmed, never a default kick-off time.
  if (candidate.startTime === '') delete candidate.startTime;
  const match = CalendarMatchSchema.parse(candidate);
  return { ...migrated, calendarMatches: [...(migrated.calendarMatches ?? []).filter(row => row.date !== match.date), match]
    .sort((left, right) => left.date.localeCompare(right.date)) };
}

/** Legacy questionnaire rows remain saved, but are not today's new response. */
export function getDailyReadiness(settings: MasterProgramSettings | undefined, date: string): DailyFeeling | undefined {
  CoachDateSchema.parse(date);
  return settings?.dailyReadiness?.find(row => row.date === date)?.feeling;
}
export function getCoachReadinessStatus(settings: MasterProgramSettings | undefined, date: string): MasterReadiness | undefined {
  const feeling = getDailyReadiness(settings, date);
  return feeling === 'great' || feeling === 'normal' ? 'green' : feeling === 'tired' ? 'yellow' : feeling === 'poor' ? 'red' : undefined;
}

/** Calendar observations survive restoring a plan without a master-program block. */
export function getCoachRecords(profile: { masterProgram?: MasterProgramSettings; coachRecords?: { calendarMatches?: CalendarMatch[]; dailyReadiness?: z.infer<typeof DailyReadinessSchema>[] } }) {
  const current = profile.masterProgram;
  const fallback = profile.coachRecords;
  const calendarMatches = current?.calendarMatches ?? fallback?.calendarMatches
    ?? (current?.revision === '9' && current.matchWeeks.length ? legacyMatches(current) : undefined);
  const dailyReadiness = current?.dailyReadiness ?? fallback?.dailyReadiness;
  return calendarMatches !== undefined || dailyReadiness !== undefined ? {
    ...(calendarMatches !== undefined ? { calendarMatches: structuredClone(calendarMatches) } : {}),
    ...(dailyReadiness !== undefined ? { dailyReadiness: structuredClone(dailyReadiness) } : {}),
  } : undefined;
}

/** Last accepted interval wins, preserving earlier choices for interpretation. */
export function getCoachPhase(settings: MasterProgramSettings, date: string): {
  phase: CoachPhase; source: 'explicit' | 'legacy-cycle' | 'default'; startDate?: string; endDate?: string;
} {
  CoachDateSchema.parse(date);
  const selected = [...(settings.trainingPhases ?? [])].reverse().find(row => row.startDate <= date && date <= row.endDate);
  if (selected) return { ...selected, source: 'explicit' };
  if (settings.periodizationMode === 'legacy-cycle') {
    const weeks = Math.floor((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${settings.startDate}T12:00:00Z`)) / 604800000) + 1;
    if (weeks === 4 || weeks === 8) return { phase: weeks === 4 ? 'deload' : 'evaluation', source: 'legacy-cycle' };
  }
  return { phase: 'normal', source: 'default' };
}

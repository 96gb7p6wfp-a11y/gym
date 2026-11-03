import { z } from 'zod';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Choose a real date.');
const identifier = z.string().min(1).max(100);
const timestamp = z.number().finite().int().nonnegative();

/** Instructions are entered from the label/prescription, never inferred from a brand. */
export const ReminderSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['supplement', 'medicine', 'meal']),
  instructions: z.string().trim().min(1).max(1000),
  // Optional fields keep older local records and backups unchanged.
  dosageText: z.string().trim().max(160).optional(),
  foodRelation: z.enum(['before', 'with', 'after']).optional(),
  schedule: z.enum(['once-daily', 'instructions-only']),
  timing: z.enum(['meal', 'evening', 'time', 'instructions']),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    .refine(values => new Set(values).size === values.length).optional(),
  confirmed: z.boolean(),
  enabled: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (value.timing === 'time' && value.time === null) ctx.addIssue({ code: 'custom', path: ['time'], message: 'Choose a reminder time.' });
  if (value.schedule === 'instructions-only' && value.confirmed) ctx.addIssue({ code: 'custom', path: ['schedule'], message: 'Choose a confirmed once-daily schedule before tracking doses.' });
});
export type Reminder = z.infer<typeof ReminderSchema>;
export interface ReminderRecord { reminder: Reminder; version: number }

export const ReminderEntrySchema = z.object({
  id: z.string().min(1).max(111),
  reminderId: identifier,
  date: day,
  status: z.enum(['taken', 'later', 'pending']),
  takenAt: timestamp.nullable(),
  updatedAt: timestamp,
}).strict().superRefine((value, ctx) => {
  if (value.id !== reminderEntryId(value.reminderId, value.date)) ctx.addIssue({ code: 'custom', path: ['id'], message: 'The reminder date is invalid.' });
  if ((value.status === 'taken') !== (value.takenAt !== null)) ctx.addIssue({ code: 'custom', path: ['takenAt'], message: 'Only a taken reminder can have a recorded time.' });
  if (value.takenAt !== null && value.takenAt > value.updatedAt) ctx.addIssue({ code: 'custom', path: ['takenAt'], message: 'The recorded time is invalid.' });
});
export type ReminderEntry = z.infer<typeof ReminderEntrySchema>;
export interface ReminderEntryRecord { entry: ReminderEntry; version: number }
export interface ReminderState { items: ReminderRecord[]; entries: ReminderEntryRecord[] }

export function reminderEntryId(reminderId: string, date: string) { return `${reminderId}:${date}`; }

export function defaultReminderState(): ReminderState {
  const reminder = (id: string, name: string, instructions: string, timing: Reminder['timing'], confirmed = false, schedule: Reminder['schedule'] = 'once-daily'): ReminderRecord => ({
    reminder: { id, name, kind: 'supplement', instructions, timing, confirmed, schedule, enabled: true, time: null }, version: 0,
  });
  return {
    items: [
      reminder('zinc', 'Mivolis zinc', 'User-confirmed daily product: 15 mg zinc, 100 mg histidine and 19 mg cysteine. Once daily with a meal, according to your label.', 'meal', true),
      reminder('vitamin-d-k2', 'Doppelherz D3 + K2', 'Pack strength: 2,500 IU D3 (62.5 µg). K2 amount and label frequency are not confirmed. Enter the pack instructions before enabling a dose reminder. A meal containing some fat is convenient.', 'meal', false, 'instructions-only'),
      reminder('omega-3', 'Doppelherz omega-3', 'Exact product, amount and label frequency are not confirmed. Enter the pack instructions before enabling a dose reminder. Taking it with a meal may improve tolerance.', 'meal', false, 'instructions-only'),
      reminder('magnesium', 'Mivolis Magnesium 500', 'You reported once daily. Confirm elemental magnesium per daily portion: if it is 500 mg supplemental elemental magnesium, have a pharmacist check the dose; it exceeds usual supplemental limits and can cause diarrhoea. An evening meal is convenient; bedtime is not proven better for training benefits.', 'evening'),
    ],
    entries: [],
  };
}

export function isTrackable(reminder: Reminder) {
  return reminder.enabled && reminder.confirmed && reminder.schedule === 'once-daily';
}
/** Absent days keep older once-daily instructions exactly as saved. */
export function reminderScheduledOn(reminder: Reminder, date: string) {
  if (!reminder.days) return true;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    && reminder.days.includes((parsed.getUTCDay() + 6) % 7);
}
export function reminderStatus(state: ReminderState, reminderId: string, date: string): ReminderEntry['status'] {
  return state.entries.find(({ entry }) => entry.reminderId === reminderId && entry.date === date)?.entry.status ?? 'pending';
}
/** Saving a meal only suggests reminders; it never records supplement consumption. */
export function mealReminders(state: ReminderState, date: string): Reminder[] {
  return state.items.map(({ reminder }) => reminder).filter((reminder) => reminder.kind !== 'meal' && isTrackable(reminder) && reminderScheduledOn(reminder, date) && reminder.timing === 'meal' && reminderStatus(state, reminder.id, date) === 'pending');
}
/** A foreground cue only: no timer schedules an alert when the app is closed. */
export function timeReminders(state: ReminderState, date: string, now: Date): Reminder[] {
  if (!Number.isFinite(now.getTime())) return [];
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  if (date !== `${get('year')}-${get('month')}-${get('day')}`) return [];
  const clock = `${get('hour')}:${get('minute')}`;
  return state.items.map(({ reminder }) => reminder).filter((reminder) => isTrackable(reminder) && reminderScheduledOn(reminder, date) && reminder.timing === 'time' && reminder.time !== null && reminder.time <= clock && reminderStatus(state, reminder.id, date) === 'pending');
}

/** Optional templates are returned only; nothing is stored or enabled on app load. */
export function optionalMealReminderTemplates(schedule: { days: number[]; startTime: string; endTime: string } = { days: [1, 4], startTime: '20:00', endTime: '22:00' }): Reminder[] {
  const offset = (clock: string, minutes: number) => {
    const [hours, remainder] = clock.split(':').map(Number);
    const total = ((hours * 60 + remainder + minutes) % 1440 + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const offsetDays = (days: number[], clock: string, minutes: number) => {
    const [hours, remainder] = clock.split(':').map(Number);
    const shift = Math.floor((hours * 60 + remainder + minutes) / 1440);
    return days.map(day => ((day + shift) % 7 + 7) % 7).sort();
  };
  const meal = (id: string, name: string, time: string, instructions: string, days?: number[]): Reminder => ({
    id: `meal-${id}`, kind: 'meal', name, instructions, schedule: 'once-daily', timing: 'time',
    time, confirmed: true, enabled: true, ...(days ? { days: [...days] } : {}),
  });
  return [
    meal('breakfast', 'Breakfast', '07:00', 'A simple breakfast with carbs and protein, such as oats and yogurt.'),
    meal('school-snack', 'School snack', '10:00', 'Pack an easy snack, such as fruit and a sandwich or yogurt.', [0, 1, 2, 3, 4]),
    meal('lunch', 'Lunch', '13:00', 'Include a carb source, protein and vegetables.'),
    meal('afternoon', 'Afternoon food', '16:00', 'Have a convenient meal or snack to support the rest of your day.'),
    meal('pre-volleyball', 'Pre-volleyball meal', offset(schedule.startTime, -150), 'Eat a familiar carb-rich meal with some protein about 2–3 hours before volleyball.', offsetDays(schedule.days, schedule.startTime, -150)),
    meal('post-volleyball', 'Post-volleyball meal', offset(schedule.endTime, 15), 'Prepare a small meal with protein and carbs, rehydrate, then settle for sleep.', offsetDays(schedule.days, schedule.endTime, 15)),
  ];
}
export function timingLabel(reminder: Reminder): string {
  if (reminder.foodRelation) {
    const relation = { before: 'Before', with: 'With', after: 'After' }[reminder.foodRelation];
    if (reminder.timing === 'meal') return `${relation} a meal`;
    if (reminder.timing === 'evening') return `${relation} your evening meal`;
    if (reminder.timing === 'time') return `At ${reminder.time} · ${relation.toLowerCase()} food`;
    return `${relation} food · Follow your recorded instructions`;
  }
  if (reminder.timing === 'meal') return 'With a meal';
  if (reminder.timing === 'evening') return 'With your evening meal';
  if (reminder.timing === 'time') return `At ${reminder.time}`;
  return 'Follow your recorded instructions';
}

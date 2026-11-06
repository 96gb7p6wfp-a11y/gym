import type { ReadinessEntry } from './performance-data';
import type { TrainingExposure } from './training-exposure';

type ExposureRecord = { date: string; trainingExposure?: TrainingExposure };
export interface V9ReadinessAdvice {
  title: string;
  detail: string;
  suggested?: 'yellow' | 'red';
  sourceDate?: string;
}

/** Explicit observations support advice; missing logs never establish recovery. */
export function getV9ReadinessAdvice(date: string, entries: readonly ReadinessEntry[], exposures: readonly ExposureRecord[] = []): V9ReadinessAdvice {
  const day = new Date(`${date}T12:00:00Z`);
  const saturday = day.getUTCDay() === 6;
  const previous = new Date(day.getTime() - 86400000).toISOString().slice(0, 10);
  const report = entries.find(entry => entry.date === date)
    ?? (saturday ? entries.find(entry => entry.date === previous) : undefined);
  const reportedPain = Object.entries(report?.joints ?? {}).filter(([, value]) => value === 'pain').map(([joint]) => joint);
  if (reportedPain.length) return { title: 'Review reported pain before training', suggested: 'red', sourceDate: report!.date,
    detail: `On ${report!.date} you reported pain or instability in ${reportedPain.join(', ')}. Stop relevant impact or painful loading and use recovery or an appropriate pain-free modification. This is your report, not a medical assessment.` };
  const jointSoreness = Object.values(report?.joints ?? {}).some(value => value === 'sore');
  const exposure = exposures.find(row => (row.date === date || saturday && row.date === previous)
    && [row.trainingExposure?.kneeSoreness, row.trainingExposure?.achillesSoreness, row.trainingExposure?.shoulderSoreness].some(value => value === 'high'));
  if (report?.energy === 'low' || report?.soreness === 'high' || jointSoreness || exposure) return {
    title: 'Consider a reduced session', suggested: 'yellow', sourceDate: exposure?.date ?? report?.date,
    detail: `Your ${exposure?.date ?? report?.date} report includes low energy, soreness or uncomfortable joints. Recheck after preparation; omit demanding acceleration or jumps and reduce hard work when needed. Missing sleep and match details remain unknown.` };
  return { title: saturday ? 'Check readiness after Friday' : 'Choose today’s readiness',
    detail: saturday ? 'Friday can include school PE and volleyball. Check legs, Achilles, knees, shoulders and landing control before choosing Green. Unrecorded Friday activity or sleep is unknown, not proof of recovery.'
      : 'Use your own current report and warm-up quality. Setline does not measure physiological recovery or turn missed workouts into training debt.' };
}

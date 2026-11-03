import { z } from 'zod';

const soreness = z.enum(['none', 'mild', 'moderate', 'high']);
/** Optional athlete-entered observations. Missing contacts never mean zero. */
export const TrainingExposureSchema = z.object({
  sport: z.enum(['volleyball', 'pe', 'other']).optional(),
  hardJumpContacts: z.number().int().min(0).max(5000).optional(),
  contactSource: z.enum(['recorded', 'estimate']).optional(),
  sessionRpe: z.number().finite().min(0).max(10).optional(),
  shoulderSoreness: soreness.optional(),
  kneeSoreness: soreness.optional(),
  achillesSoreness: soreness.optional(),
  notes: z.string().max(500).optional(),
}).strict();
export type TrainingExposure = z.infer<typeof TrainingExposureSchema>;

type ExposureSession = {
  id: string; date: string; name: string; kind: string; status: string; deletedAt?: number | null;
  trainingExposure?: TrainingExposure;
  exercises: readonly { jumpContactsPerRep?: number; logs: readonly { done: boolean; reps: number | null }[] }[];
};
type ExposureActivity = { version: number; activity: {
  id: string; date: string; name: string; deletedAt: number | null; trainingExposure?: TrainingExposure;
} };
export interface TrainingExposureSummary {
  completedGymContacts: number;
  recordedVolleyballContacts: number;
  recordedPeContacts: number;
  estimatedSportContacts: number;
  volleyballSessions: number;
  peSessions: number;
  unmeasuredSportSessions: number;
  observationCount: number;
}
const peName = /\b(?:school\s*)?pe\b|physical education|schulsport|hochsprung|kugelstoßen/i;
const sportType = (name: string, exposure?: TrainingExposure) => exposure?.sport
  ?? (/volleyball/i.test(name) ? 'volleyball' : peName.test(name) ? 'pe' : 'other');

/** Distinct counters prevent planned or estimated sport exposure becoming measured gym work. */
export function getTrainingExposureSummary(input: {
  sessions: readonly ExposureSession[]; activities?: readonly ExposureActivity[];
  startDate: string; endDate: string;
}): TrainingExposureSummary {
  const result: TrainingExposureSummary = { completedGymContacts: 0, recordedVolleyballContacts: 0,
    recordedPeContacts: 0, estimatedSportContacts: 0, volleyballSessions: 0, peSessions: 0,
    unmeasuredSportSessions: 0, observationCount: 0 };
  const within = (date: string) => date >= input.startDate && date <= input.endDate;
  const addSport = (name: string, exposure?: TrainingExposure) => {
    const type = sportType(name, exposure);
    if (type === 'volleyball') result.volleyballSessions++;
    if (type === 'pe') result.peSessions++;
    if (type === 'other') return;
    const contacts = exposure?.hardJumpContacts;
    if (contacts === undefined) result.unmeasuredSportSessions++;
    else if (exposure?.contactSource === 'estimate') result.estimatedSportContacts += contacts;
    else if (type === 'volleyball') result.recordedVolleyballContacts += contacts;
    else result.recordedPeContacts += contacts;
    if (exposure && Object.keys(exposure).some(key => !['sport', 'hardJumpContacts', 'contactSource'].includes(key))) result.observationCount++;
  };
  // The same saved record can reach a report through multiple views; count its id once.
  const sessions = new Map(input.sessions.map(session => [session.id, session]));
  for (const session of sessions.values()) {
    if (!within(session.date) || session.status !== 'completed' || session.deletedAt != null) continue;
    if (session.kind === 'sport') addSport(session.name, session.trainingExposure);
    else if (session.kind === 'strength') result.completedGymContacts += session.exercises.reduce((sum, exercise) =>
      sum + (exercise.jumpContactsPerRep ?? 0) * exercise.logs.reduce((reps, log) =>
        reps + (log.done && typeof log.reps === 'number' && Number.isFinite(log.reps) && log.reps > 0 ? log.reps : 0), 0), 0);
  }
  const activities = new Map<string, ExposureActivity>();
  for (const record of input.activities ?? []) {
    const prior = activities.get(record.activity.id);
    if (!prior || record.version >= prior.version) activities.set(record.activity.id, record);
  }
  for (const { activity } of activities.values()) {
    if (within(activity.date) && activity.deletedAt == null) addSport(activity.name, activity.trainingExposure);
  }
  return result;
}

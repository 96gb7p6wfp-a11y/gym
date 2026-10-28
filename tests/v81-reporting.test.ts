import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createVolleyballMasterPlan, resolveMasterProgramPlan, type MasterProgramSettings } from '../src/volleyball-master-plan.ts';
import { getTrainingCadence } from '../src/training-cadence.ts';
import { getWeeklyReport } from '../src/weekly-report.ts';
import { getPerformanceSummary, getProgressionRecommendation } from '../src/performance-insights.ts';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library.ts';

const settings: MasterProgramSettings = { version: 1, revision: '8.1', startDate: '2026-10-19', matchWeeks: [] };

function completed(plan: ReturnType<typeof createVolleyballMasterPlan>[number], date: string, day: number) {
  const started = SessionSchema.parse(createSession(plan, day, date, DEFAULT_PROFILE, []));
  return SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + 15 * 60_000));
}

test('V8.1 weekly reports and cadence count four substantial non-match gym days including Sunday', () => {
  const plan = resolveMasterProgramPlan(createVolleyballMasterPlan(), settings, '2026-10-25');
  const sessions = [completed(plan[6], '2026-10-25', 6), completed(plan[5], '2026-10-24', 5)];
  const cadence = getTrainingCadence({ plan, sessions, today: '2026-10-25' });
  assert.equal(cadence.plannedGymDays, 4);
  assert.equal(cadence.completedGymDays, 1);
  assert.equal(cadence.days[5].kind, 'recovery');
  assert.equal(cadence.days[6].kind, 'gym');
  const report = getWeeklyReport({ plan, sessions, activities: [], weekStart: '2026-10-19' });
  assert.equal(report.plannedGymDays, 4);
  assert.equal(report.completedPlannedGymDays, 1);
  assert.equal(report.totals.gymDays, 1);
});

test('match primer records load without becoming a fourth gym obligation or a completed match', () => {
  const plan = resolveMasterProgramPlan(createVolleyballMasterPlan(), { ...settings, matchWeeks: [1] }, '2026-10-25');
  const primer = completed(plan[5], '2026-10-24', 5);
  const sessions = [primer];
  const cadence = getTrainingCadence({ plan, sessions, today: '2026-10-25' });
  assert.equal(cadence.plannedGymDays, 3);
  assert.equal(cadence.completedGymDays, 0);
  assert.equal(cadence.recordedActivityDays, 1);
  const report = getWeeklyReport({ plan, sessions, activities: [], weekStart: '2026-10-19' });
  assert.equal(report.plannedGymDays, 3);
  assert.equal(report.totals.gymDays, 0);
  assert.equal(report.totals.minutes, 15);
  const summary = getPerformanceSummary({ plan, sessions, today: '2026-10-25' });
  assert.equal(summary.gymSessions, 0);
  assert.equal(summary.volleyballSessions, 0, 'planned match and practice never become actual sport load');
});

test('an unfamiliar trap-bar deadlift gets technique advice before overload suggestions', () => {
  const exercise = toPlanExercise(findLibraryExercise('Trap Bar Deadlift')!);
  const suggestion = getProgressionRecommendation(exercise, [], '2026-10-25');
  assert.equal(suggestion.kind, 'quality');
  assert.equal(suggestion.title, 'Technique first');
  assert.match(suggestion.cue, /20 kg empty bar/);
  assert.match(suggestion.reason, /Replace the leg press/);
});

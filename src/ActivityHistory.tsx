import { ExtraActivities } from './ExtraActivities';
import { estimateActivity, type ActivityRecord, type ExtraActivity } from './activities';

export function ActivityHistory({ records, bodyWeight, onSave, disabled }: {
  records: ActivityRecord[];
  bodyWeight: number;
  onSave: (activity: ExtraActivity, expectedVersion: number) => Promise<void>;
  disabled: boolean;
}) {
  const dates = [...new Set(records.map(({ activity }) => activity.date))].sort().reverse();
  return (
    <section className="panel activity-history" aria-label="Extra activity history">
      <h2>Extra activity history</h2>
      <p className="small-note">Runs, rides and other activities logged alongside your weekly plan.</p>
      {!dates.length && <p className="muted">No extra activities recorded yet. Add one from Workout for the date you trained.</p>}
      {dates.map((date) => {
        const active = records.filter(({ activity }) => activity.date === date && activity.deletedAt === null);
        const calories = active.reduce((sum, { activity }) => sum + estimateActivity(activity).calories, 0);
        return (
          <details className="activity-history-day" key={date}>
            <summary>{date} · {active.length} extra {active.length === 1 ? 'activity' : 'activities'} · {Math.round(calories)} active kcal</summary>
            <ExtraActivities date={date} bodyWeight={bodyWeight} records={records} onSave={onSave} disabled={disabled} />
          </details>
        );
      })}
    </section>
  );
}

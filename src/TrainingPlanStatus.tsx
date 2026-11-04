import { useMemo } from 'react';
import { getTrainingPlanStatus } from './training-plan-status';
import './training-plan-status.css';

export function TrainingPlanStatus({ profile, today, selectedDate = today, session, showAppVersion = false }: {
  profile: Parameters<typeof getTrainingPlanStatus>[0]; today: string; selectedDate?: string;
  showAppVersion?: boolean;
  session?: { programRevision?: '8.1' | '13.1' } | null;
}) {
  const status = useMemo(() => getTrainingPlanStatus(profile, today, selectedDate), [profile, today, selectedDate]);
  return <section className="training-plan-status" aria-label="Active training plan">
    <div>{showAppVersion && <span>{status.appVersion}</span>}<strong>Plan · {status.planVersion}</strong></div>
    <p>{status.cycle}</p>
    {session && <p>Workout snapshot · {session.programRevision ? `V${session.programRevision}` : 'unversioned saved plan'}</p>}
    {status.selected && <p className="training-plan-status__preview">{status.selected}</p>}
    {status.previous && <p>Available to restore · {status.previous}</p>}
  </section>;
}

import { getProgressionRecommendation, type ProgressionContext, type ProgressionExercise, type ProgressionRecommendation } from './performance-insights';
import type { ReportSession } from './weekly-report';
import './performance-details.css';

/** A recommendation never fills or changes a workout input on its own. */
type Props = ({ recommendation: ProgressionRecommendation } | { exercise: ProgressionExercise; sessions: readonly ReportSession[]; date: string; context?: ProgressionContext }) & { onApply?: () => void };
export function ProgressionCue(props: Props) {
  const recommendation = 'recommendation' in props ? props.recommendation : getProgressionRecommendation(props.exercise, props.sessions, props.date, props.context);
  const canApply = props.onApply && ['load', 'reps'].includes(recommendation.kind) && (recommendation.kg !== undefined || recommendation.reps !== undefined);
  return <details className="progression-cue"><summary><span>{recommendation.kind === 'load' || recommendation.kind === 'reps' ? 'Suggested' : recommendation.kind === 'quality' ? 'Intent' : 'Today'}</span><strong>{recommendation.title}</strong></summary><div>
    {recommendation.history && <p className="progression-cue__history">Last session · {recommendation.history.kg == null ? 'Bodyweight' : `${recommendation.history.kg} kg`} × {recommendation.history.reps.join(', ')}<small>{recommendation.history.date}{recommendation.history.rir ? ` · RIR ${recommendation.history.rir.join(', ')}` : ' · RIR not recorded'}</small></p>}
    <p>{recommendation.cue}</p><small>{recommendation.reason}</small>{canApply && <button type="button" className="btn btn-secondary" onClick={props.onApply}>Use suggestion</button>}</div></details>;
}

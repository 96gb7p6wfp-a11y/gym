import { ChevronRight } from 'lucide-react';
import type { WorkoutPrescription } from './training-prescription';
import './workout-prescription.css';

interface WorkoutPrescriptionSummaryProps {
  prescription: WorkoutPrescription;
  onReviewProgram?: () => void;
  compact?: boolean;
}

/** A read-only explanation of this prescription, never an instruction to reset it. */
export function WorkoutPrescriptionSummary({ prescription, onReviewProgram, compact = false }: WorkoutPrescriptionSummaryProps) {
  const limitation = prescription.reasons.find(reason => reason.code.startsWith('clearance-lifting-')
    || reason.code === 'saved-preparation')
    ?? prescription.reasons.find(reason => reason.code.startsWith('clearance-impact-'));
  const otherReasons = prescription.reasons.filter(reason => reason !== limitation);

  return <section className={`workout-prescription${compact ? ' workout-prescription--compact' : ''}`} aria-label="Workout prescription">
    {limitation && <div className="workout-prescription__limitation" role="status">
      <strong>{limitation.title}</strong>
      <p>{limitation.detail}</p>
      {onReviewProgram && <button type="button" className="text-button" onClick={onReviewProgram}>Review training guidance<ChevronRight size={16} aria-hidden="true" /></button>}
    </div>}
    <details className="workout-prescription__details">
      <summary><span>Workout details<small>{prescription.label} · {prescription.workingSets} working sets</small></span><ChevronRight size={17} aria-hidden="true" /></summary>
      <dl className="workout-prescription__facts">
        <div><dt>Objective</dt><dd>{prescription.objective}</dd></div>
        <div><dt>Effort</dt><dd>{prescription.intensity}</dd></div>
        <div><dt>Duration</dt><dd>{prescription.duration}<small>{prescription.durationDetail}</small></dd></div>
        <div><dt>Progression</dt><dd>{prescription.progression}</dd></div>
        <div><dt>Plan source</dt><dd>{prescription.sourceLabel}</dd></div>
      </dl>
      <p className="workout-prescription__scope">{prescription.mandatoryExercises} planned exercises{prescription.optionalExercises ? ` · ${prescription.optionalExercises} optional. Optional work is a choice, not missed training to make up.` : '.'}</p>
      {otherReasons.length > 0 && <div className="workout-prescription__reasons" role="group" aria-label="Workout adjustments">
        {otherReasons.map(reason => <div key={reason.code}><h4>{reason.title}</h4><p>{reason.detail}</p></div>)}
      </div>}
      {prescription.changes.length > 0 && <details className="workout-prescription__changes">
        <summary>What changed<span>{prescription.changes.length} movements</span></summary>
        <ul aria-label="Prescription changes">{prescription.changes.map(change => <li key={`${change.key}-${change.kind}`}>
          <strong>{change.name}</strong>
          {change.before && <p><span>Before</span>{change.before}</p>}
          {change.after && <p><span>Now</span>{change.after}</p>}
        </li>)}</ul>
      </details>}
      {prescription.missingContext.length > 0 && <p className="workout-prescription__missing">{prescription.missingContext.join(' ')}</p>}
    </details>
  </section>;
}

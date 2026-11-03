import { useId } from 'react';
import type { TrainingExposure } from './training-exposure';
import './training-exposure.css';

const sorenessNames = { shoulderSoreness: 'Shoulder', kneeSoreness: 'Knee', achillesSoreness: 'Achilles' } as const;

/** Optional details stay collapsed during normal set logging. */
export function TrainingExposureFields({ value, onChange, defaultSport = 'volleyball', disabled = false }: {
  value?: TrainingExposure;
  onChange: (value: TrainingExposure) => void;
  defaultSport?: 'volleyball' | 'pe' | 'other';
  disabled?: boolean;
}) {
  const id = useId();
  const update = (field: keyof TrainingExposure, next: unknown) => {
    const result = { ...value, sport: value?.sport ?? defaultSport, [field]: next };
    if (next === undefined) delete result[field];
    if (field === 'hardJumpContacts' && next !== undefined && !result.contactSource) result.contactSource = 'recorded';
    onChange(result);
  };
  const numeric = (field: 'hardJumpContacts' | 'sessionRpe', raw: string) => {
    const next = raw.trim() === '' ? undefined : Number(raw);
    if (next === undefined || (Number.isFinite(next) && next >= 0
      && (field === 'hardJumpContacts' ? Number.isInteger(next) && next <= 5000 : next <= 10))) update(field, next);
  };
  return <details className="training-exposure-fields">
    <summary>Jump load & how you felt<span>Optional</span></summary>
    <fieldset disabled={disabled}>
      {defaultSport === 'other' && <label htmlFor={`${id}-sport`}>Training type<select id={`${id}-sport`} aria-label="Training type" value={value?.sport ?? defaultSport} onChange={event => update('sport', event.target.value)}><option value="other">Other activity</option><option value="volleyball">Volleyball</option><option value="pe">School PE</option></select></label>}
      <div className="training-exposure-fields__numbers">
        <label htmlFor={`${id}-contacts`}>Hard jump contacts<input id={`${id}-contacts`} type="number" inputMode="numeric" min={0} max={5000} step={1} placeholder="Not recorded" value={value?.hardJumpContacts ?? ''} onChange={event => numeric('hardJumpContacts', event.target.value)} /></label>
        <label htmlFor={`${id}-rpe`}>Session RPE · 0–10<input id={`${id}-rpe`} type="number" inputMode="decimal" min={0} max={10} step={0.5} placeholder="Not recorded" value={value?.sessionRpe ?? ''} onChange={event => numeric('sessionRpe', event.target.value)} /></label>
      </div>
      {value?.hardJumpContacts !== undefined && <label htmlFor={`${id}-source`}>Contact count<select id={`${id}-source`} aria-label="Contact count" value={value?.contactSource ?? 'recorded'} onChange={event => update('contactSource', event.target.value)}><option value="recorded">Counted during training</option><option value="estimate">Estimate · not measured</option></select></label>}
      <p>Leave contacts blank if unknown. Log each practice once; gym jumps are counted separately.</p>
      <div className="training-exposure-fields__soreness">
        {(['shoulderSoreness', 'kneeSoreness', 'achillesSoreness'] as const).map(field => <label key={field} htmlFor={`${id}-${field}`}>{sorenessNames[field]} soreness<select id={`${id}-${field}`} aria-label={`${sorenessNames[field]} soreness`} value={value?.[field] ?? ''} onChange={event => update(field, event.target.value || undefined)}><option value="">Not recorded</option><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="high">High</option></select></label>)}
      </div>
    </fieldset>
  </details>;
}

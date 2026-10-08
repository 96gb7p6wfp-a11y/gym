import { useEffect, useState } from 'react';
import './schedule.css';

export interface VolleyballSchedule {
  days: number[];
  startTime: string;
  endTime: string;
  timeZone: 'Europe/Berlin';
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function TrainingSchedule({ schedule, onSave, compact = false }: {
  schedule: VolleyballSchedule;
  onSave: (schedule: VolleyballSchedule) => Promise<void>;
  compact?: boolean;
}) {
  const [startTime, setStartTime] = useState(schedule.startTime);
  const [endTime, setEndTime] = useState(schedule.endTime);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setStartTime(schedule.startTime);
    setEndTime(schedule.endTime);
  }, [schedule.startTime, schedule.endTime]);
  return <section className="panel training-schedule" aria-label="Volleyball schedule">
    <h2>Volleyball schedule</h2>
    <p>{schedule.days.map(day => DAYS[day]).join(' and ')} · <strong>{schedule.startTime}–{schedule.endTime}</strong></p>
    <p className="small-note">Berlin time · Europe/Berlin</p>
    {!compact && <details>
      <summary>Edit training times</summary>
      <form onSubmit={async event => {
        event.preventDefault();
        if (saving) return;
        if (!startTime || !endTime || endTime <= startTime) {
          setMessage('Choose an end time after the start time.');
          return;
        }
        setSaving(true);
        setMessage('');
        try {
          await onSave({ ...schedule, startTime, endTime });
          setMessage('Training times saved.');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Training times could not be saved.');
        } finally { setSaving(false); }
      }}>
        <label className="field-label">Volleyball start time<input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} required /></label>
        <label className="field-label">Volleyball end time<input type="time" value={endTime} onChange={event => setEndTime(event.target.value)} required /></label>
        <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save volleyball times'}</button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>}
  </section>;
}

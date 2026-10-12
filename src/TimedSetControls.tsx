import { useEffect, useRef } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw, Timer } from 'lucide-react';
import './timed-set-controls.css';

export interface TimedSetTimerOptions {
  action: 'start' | 'pause' | 'reset';
  setId: string;
  /** At countdown completion, clamp the timer to the requested duration. */
  seconds?: number;
}

export interface TimedSetControlsProps {
  setId: string;
  seconds: number | null;
  target: string;
  exerciseKey: string;
  exerciseName: string;
  elapsedMs: number;
  runningSince: number | null;
  /** Pass null for a legacy timer that has no set association yet. */
  timerSetId?: string | null;
  now: number;
  editing: boolean;
  setNumber?: number;
  /** Override the duration input's accessible name when reusing these controls. */
  label?: string;
  done?: boolean;
  onSecondsChange: (seconds: number | null) => void;
  onTimer: (exerciseKey: string, options?: TimedSetTimerOptions) => void;
}

function clock(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(value / 60);
  const remainder = String(value % 60).padStart(2, '0');
  return minutes < 60 ? `${String(minutes).padStart(2, '0')}:${remainder}`
    : `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}:${remainder}`;
}

/**
 * The elapsed time supplied here belongs to this set. The owner persists the
 * timer's set ID and resets elapsed time when a different set starts.
 * Duration is the countdown target; a paused timer does not change that target.
 */
export function TimedSetControls({
  setId, seconds, target, exerciseKey, exerciseName, elapsedMs, runningSince, timerSetId,
  now, editing, setNumber = 1, label, done = false, onSecondsChange, onTimer,
}: TimedSetControlsProps) {
  const inMinutes = /\bmin(?:ute)?s?\b/i.test(target);
  const firstTarget = Number(target.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.') ?? 0);
  const preset = Math.max(1, Math.min(86400, firstTarget * (inMinutes ? 60 : 1) || 15));
  const countdown = !inMinutes && preset <= 300;
  const duration = seconds != null && seconds > 0 ? seconds : preset;
  const ownsTimer = timerSetId === undefined || timerSetId === setId;
  const running = ownsTimer && runningSince != null;
  const elapsed = ownsTimer
    ? Math.max(0, elapsedMs + (runningSince == null ? 0 : Math.max(0, now - runningSince))) : 0;
  const elapsedSeconds = elapsed / 1000;
  const complete = countdown && elapsed >= duration * 1000;
  const remaining = Math.max(0, duration - elapsedSeconds);
  const autoStopped = useRef<string | null>(null);
  const prefilledSet = useRef<string | null>(null);
  const canTime = !editing && !done;
  const inputName = label ?? `${exerciseName} set ${setNumber} ${inMinutes ? 'minutes' : 'seconds'}`;

  useEffect(() => {
    if (prefilledSet.current === setId) return;
    prefilledSet.current = setId;
    autoStopped.current = null;
    // Historical empty values stay empty until the user edits them.
    if (!editing && !done && seconds == null) onSecondsChange(preset);
  }, [setId, editing, done, seconds, preset, onSecondsChange]);

  useEffect(() => {
    if (!canTime || !countdown || !running || !complete) return;
    const finishKey = `${setId}:${runningSince}:${duration}`;
    if (autoStopped.current === finishKey) return;
    autoStopped.current = finishKey;
    // A late tick or returning from another app must not log the overshoot.
    onTimer(exerciseKey, { action: 'pause', setId, seconds: duration });
    onSecondsChange(duration);
  }, [canTime, countdown, running, complete, setId, runningSince, duration, exerciseKey, onTimer, onSecondsChange]);

  function setDuration(next: number | null) {
    if (running) return;
    autoStopped.current = null;
    if (elapsed > 0 && !editing) onTimer(exerciseKey, { action: 'reset', setId });
    onSecondsChange(next);
  }

  function toggle() {
    autoStopped.current = null;
    if (running) {
      onTimer(exerciseKey, { action: 'pause', setId });
      if (!countdown) onSecondsChange(Math.max(1, Math.round(elapsedSeconds)));
      return;
    }
    // A completed countdown starts a fresh attempt of the same set.
    if (complete) onTimer(exerciseKey, { action: 'reset', setId });
    onTimer(exerciseKey, { action: 'start', setId, ...(countdown ? { seconds: duration } : {}) });
  }

  function reset() {
    autoStopped.current = null;
    onTimer(exerciseKey, { action: 'reset', setId });
  }

  const timer = (
    <div className={`timed-set-timer${running ? ' is-running' : ''}${complete ? ' is-complete' : ''}`}>
      <div className="timed-set-timer__clock" role="timer"
        aria-label={`${countdown ? 'Time remaining' : 'Elapsed time'} for ${exerciseName}`}>
        {clock(countdown ? remaining : elapsedSeconds)}
      </div>
      <p className="timed-set-timer__status" role="status">
        {complete ? 'Time complete · confirm your set' : running ? (countdown ? 'Keep going' : 'Timer running') : elapsed > 0 ? 'Paused' : countdown ? 'Ready when you are' : 'Ready'}
      </p>
      <div className="timed-set-timer__actions">
        <button type="button" className="timed-set-timer__toggle" onClick={toggle}
          aria-label={`${running ? 'Pause' : complete ? 'Restart' : elapsed > 0 ? 'Resume' : 'Start'} timer for ${exerciseName}`}>
          {running ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {running ? 'Pause' : complete ? 'Restart' : elapsed > 0 ? 'Resume' : 'Start timer'}
        </button>
        <button type="button" className="timed-set-timer__reset" onClick={reset}
          aria-label={`Reset timer for ${exerciseName}`} disabled={!running && elapsed === 0}>
          <RotateCcw size={19} aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={`timed-set-controls${countdown ? ' timed-set-controls--short' : ' timed-set-controls--long'}`}
      data-set-id={setId} data-countdown={countdown}>
      <div className="timed-set-duration">
        <label className="timed-set-duration__label" htmlFor={`timed-duration-${exerciseKey}-${setId}`}>Duration</label>
        <div className="timed-set-duration__adjust">
          {countdown && <button type="button" onClick={() => setDuration(Math.max(1, duration - 5))}
            disabled={running} aria-label={`Decrease ${exerciseName} duration by 5 seconds`}>
            <Minus size={19} aria-hidden="true" />
          </button>}
          <div className="timed-set-duration__value">
            <input id={`timed-duration-${exerciseKey}-${setId}`} className="set-input" type="number"
              min="0" max={inMinutes ? 1440 : 86400} step={inMinutes ? '0.1' : '1'}
              inputMode={inMinutes ? 'decimal' : 'numeric'} aria-label={inputName}
              value={seconds == null ? '' : Number((seconds / (inMinutes ? 60 : 1)).toFixed(1))}
              placeholder={String(firstTarget || (inMinutes ? 1 : 15))} disabled={running}
              onChange={(event) => {
                const raw = event.target.value;
                const value = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
                setDuration(value == null || !Number.isFinite(value) ? null
                  : Math.min(86400, Math.max(0, value * (inMinutes ? 60 : 1))));
              }} />
            <span>{inMinutes ? 'min' : 'sec'}</span>
          </div>
          {countdown && <button type="button" onClick={() => setDuration(Math.min(86400, duration + 5))}
            disabled={running} aria-label={`Increase ${exerciseName} duration by 5 seconds`}>
            <Plus size={19} aria-hidden="true" />
          </button>}
        </div>
      </div>
      {canTime && (countdown ? timer : (
        <details className="timed-set-stopwatch">
          <summary><Timer size={16} aria-hidden="true" />Stopwatch</summary>
          {timer}
        </details>
      ))}
    </div>
  );
}

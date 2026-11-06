import { useEffect, useRef, useState } from 'react';
import { ReactionCueSequence, type ReactionDirection } from './reaction-cues';
import './reaction-cue.css';

/** Optional foreground practice, independent from set completion and rest audio. */
export function ReactionCue() {
  const [running, setRunning] = useState(false);
  const [direction, setDirection] = useState<ReactionDirection | null>(null);
  const [count, setCount] = useState(0);
  const [speech, setSpeech] = useState(false);
  const [message, setMessage] = useState('Four unpredictable directions, 2–4 seconds apart.');
  const [speechMessage, setSpeechMessage] = useState('');
  const mounted = useRef(true);
  const panel = useRef<HTMLElement | null>(null);
  const sequence = useRef<ReactionCueSequence | null>(null);
  const runId = useRef(0);
  const spokenRun = useRef(false);
  const speechRequested = useRef(false);
  const speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined';

  function cancelSpeech() {
    if (!speechRequested.current) return;
    speechRequested.current = false;
    try { window.speechSynthesis?.cancel(); } catch { /* Visual cues need no speech support. */ }
  }

  function speak(text: string, id: number) {
    if (!spokenRun.current || !speechAvailable) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-GB';
      utterance.onerror = () => {
        if (mounted.current && id === runId.current) setSpeechMessage('Spoken cues were unavailable. Follow the visual directions.');
      };
      speechRequested.current = true;
      window.speechSynthesis.speak(utterance);
    } catch {
      if (mounted.current && id === runId.current) setSpeechMessage('Spoken cues were unavailable. Follow the visual directions.');
    }
  }

  function stop(message = 'Practice stopped. Your workout records stay unchanged.') {
    runId.current += 1;
    sequence.current?.stop();
    cancelSpeech();
    if (mounted.current) { setRunning(false); setMessage(message); }
  }

  function start() {
    if (running) return;
    sequence.current?.stop();
    cancelSpeech();
    runId.current += 1;
    const id = runId.current;
    spokenRun.current = speech && speechAvailable;
    setDirection(null); setCount(0); setSpeechMessage(''); setRunning(true);
    setMessage('Get ready in a clear, non-slip area.');
    sequence.current = new ReactionCueSequence({
      schedule: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
      cancel: timer => window.clearTimeout(timer as number),
    }, (next, shown) => {
      if (!mounted.current || id !== runId.current) return;
      setDirection(next); setCount(shown);
      speak(next, id);
    }, () => {
      if (!mounted.current || id !== runId.current) return;
      setRunning(false);
      setMessage('Four cues shown. Log only the reactions you actually performed.');
    });
    // Requesting speech here gives supported browsers a direct user gesture.
    speak('Ready', id);
    sequence.current.start();
  }

  useEffect(() => {
    mounted.current = true;
    const hidden = () => {
      if (document.visibilityState === 'hidden') stop('Practice stopped while Setline was away. Start again when ready.');
    };
    const collapsed = (event: Event) => {
      const details = event.target;
      if (details instanceof HTMLDetailsElement && !details.open && panel.current && details.contains(panel.current)) {
        stop('Practice stopped when its details were closed.');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    document.addEventListener('toggle', collapsed, true);
    return () => {
      mounted.current = false;
      runId.current += 1;
      sequence.current?.stop();
      cancelSpeech();
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('toggle', collapsed, true);
    };
  }, []);

  return <section className="reaction-cue" ref={panel} aria-label="Optional reaction cue aid">
    <h3>Practice reaction cues</h3>
    <p>{message}</p>
    <div className="reaction-cue__direction" role="status" aria-live={speech ? 'off' : 'polite'} aria-atomic="true">
      <strong>{direction ?? 'Ready'}</strong><span>{count} / 4 cues shown</span>
    </div>
    {speechAvailable ? <label className="reaction-cue__speech"><input type="checkbox" checked={speech} disabled={running}
      onChange={event => setSpeech(event.target.checked)} />Speak directions · optional</label>
      : <p className="small-note">Device speech is unavailable here; use the visual directions.</p>}
    <button type="button" className="btn secondary full" onClick={() => running ? stop() : start()}>{running ? 'Stop cues' : 'Start 4 cues'}</button>
    {speechMessage && <p role="status">{speechMessage}</p>}
    <p className="small-note">Sound depends on this device; visual directions remain available. Keep Setline open. This aid does not measure reaction time or record completed sets.</p>
  </section>;
}

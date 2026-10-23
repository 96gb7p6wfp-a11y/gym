import * as React from 'react';
import { Check, Volume2 } from 'lucide-react';
import { DEFAULT_REST_VOLUME, type AudioDiagnostics } from './rest-audio';
import './timer-sound.css';

/** Browsers can inspect their audio engine, but only the listener can confirm sound. */
export function TimerSoundSettings({ enabled, volume = DEFAULT_REST_VOLUME, disabled = false, onChange, onVolumeChange, unlock, testSound, audioState }: {
  enabled: boolean;
  volume?: number;
  disabled?: boolean;
  onChange: (enabled: boolean) => void | Promise<unknown>;
  onVolumeChange: (volume: number) => void | Promise<unknown>;
  unlock: () => Promise<boolean>;
  testSound: (volume?: number) => Promise<boolean>;
  audioState: AudioDiagnostics;
}) {
  const [feedback, setFeedback] = React.useState('');
  const [check, setCheck] = React.useState<'idle' | 'listening' | 'heard' | 'silent'>('idle');
  const [testing, setTesting] = React.useState(false);
  const [volumeDraft, setVolumeDraft] = React.useState(volume);
  const committedVolume = React.useRef(volume);
  const savingVolume = React.useRef(false);
  React.useEffect(() => { setVolumeDraft(volume); committedVolume.current = volume; }, [volume]);
  async function commitVolume() {
    if (savingVolume.current || disabled || committedVolume.current === volumeDraft) return;
    savingVolume.current = true;
    try {
      const result = await onVolumeChange(volumeDraft);
      if (result === false) setFeedback('Volume could not be saved. Try again.');
      else committedVolume.current = volumeDraft;
    } catch { setFeedback('Volume could not be saved. Try again.'); }
    finally { savingVolume.current = false; }
  }
  function runTest() {
    if (testing) return;
    // Invoke directly in the tap handler so Safari retains user activation.
    const attempt = testSound(volumeDraft);
    setTesting(true); setFeedback(''); setCheck('idle');
    void attempt.then(started => {
      setCheck(started ? 'listening' : 'silent');
      setFeedback(started ? 'Did you hear both beeps?' : 'The alert could not start. Check the audio steps below.');
    }).catch(() => { setCheck('silent'); setFeedback('The alert could not start. Check the audio steps below.'); })
      .finally(() => setTesting(false));
  }
  const needsHelp = check === 'silent' || audioState.phase === 'blocked' || audioState.phase === 'unavailable';
  return <section className="timer-sound-settings" aria-labelledby="timer-sound-heading">
    <div className="section-header"><h3 id="timer-sound-heading">Rest timer</h3></div>
    <label className="timer-sound-toggle"><span>Timer sounds<small>{enabled ? 'On' : 'Off'}</small></span><input type="checkbox" role="switch" aria-label="Timer sounds" checked={enabled} disabled={disabled}
      onChange={event => {
        const next = event.currentTarget.checked;
        if (next) void unlock();
        setFeedback(''); setCheck('idle'); void onChange(next);
      }} /></label>
    <label className="timer-sound-volume"><span>Volume<output>{Math.round(volumeDraft * 100)}%</output></span>
      <input type="range" aria-label="Timer volume" min={0} max={1} step={0.05} value={volumeDraft} disabled={disabled}
        onChange={event => { setVolumeDraft(Number(event.target.value)); setCheck('idle'); setFeedback(''); }}
        onPointerUp={() => void commitVolume()} onKeyUp={() => void commitVolume()} onBlur={() => void commitVolume()} />
    </label>
    <p className="timer-sound-volume-note">For music, try 100% here. Your iPhone controls the overall listening volume.</p>
    <button type="button" className="btn secondary full timer-sound-test" disabled={disabled || testing} onClick={runTest}><Volume2 size={18} aria-hidden="true" />{testing ? 'Testing…' : 'Test sound'}</button>
    <p className="small-note timer-sound-feedback" role="status">{feedback}</p>
    {check === 'listening' && <div className="timer-sound-confirm" role="group" aria-label="Confirm timer sound">
      <button type="button" className="btn secondary" onClick={() => { setCheck('heard'); setFeedback('Sound confirmed by you. Keep media volume at a comfortable level.'); }}><Check size={16} aria-hidden="true" />Heard it</button>
      <button type="button" className="text-button" onClick={() => { setCheck('silent'); setFeedback('Let’s check your iPhone’s audio output.'); }}>No sound</button>
    </div>}
    {needsHelp && <div className="timer-sound-help" aria-label="Sound troubleshooting">
      {volumeDraft === 0 && <p>Raise the alert volume above zero.</p>}
      <ol><li>Raise media volume while tapping Test sound.</li><li>Check the output in Control Centre. Disconnect silent Bluetooth headphones or speakers.</li><li>If still silent, turn off Silent mode and test again. Some iOS versions route web audio differently.</li><li>Reopen Setline and tap Test sound again. Keep the app visible for the timer test.</li></ol>
      <details><summary>Audio check</summary><p>Engine: {audioState.contextState}. Playback session: {audioState.sessionType}.</p>{audioState.reason && <p>{audioState.reason}</p>}<p>Setline cannot detect your hardware volume, mute setting, or whether you heard the speaker.</p></details>
    </div>}
    <p className="small-note timer-sound-limit">Keep Setline open for alerts. iPhone can suspend sound when locked or in the background.</p>
  </section>;
}

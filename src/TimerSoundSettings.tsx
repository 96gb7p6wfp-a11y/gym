import * as React from 'react';
import { Volume2 } from 'lucide-react';
import './timer-sound.css';

export function TimerSoundSettings({ enabled, disabled = false, onChange, unlock, testSound }: {
  enabled: boolean;
  disabled?: boolean;
  onChange: (enabled: boolean) => void | Promise<unknown>;
  unlock: () => Promise<boolean>;
  testSound: () => Promise<boolean>;
}) {
  const [feedback, setFeedback] = React.useState('');
  return <section className="timer-sound-settings" aria-labelledby="timer-sound-heading">
    <div className="section-header"><h3 id="timer-sound-heading">Rest timer</h3></div>
    <label className="timer-sound-toggle"><span>Timer sounds</span><input type="checkbox" role="switch" checked={enabled} disabled={disabled}
      onChange={event => {
        const next = event.currentTarget.checked;
        if (next) void unlock().then(ready => setFeedback(ready ? '' : 'Audio is unavailable. The timer still works on screen.'));
        else setFeedback('');
        void onChange(next);
      }} /></label>
    <button type="button" className="text-button" disabled={disabled} onClick={() => {
      void testSound().then(played => setFeedback(played ? 'Sound played. Adjust your iPhone volume if needed.' : 'Audio is unavailable. Try again while Setline is open.'));
    }}><Volume2 size={18} aria-hidden="true" />Test sound</button>
    <p className="small-note">Sounds play while Setline is open and active. iPhone may silence alerts when locked or in the background.</p>
    <p className="small-note timer-sound-feedback" role="status">{feedback}</p>
  </section>;
}

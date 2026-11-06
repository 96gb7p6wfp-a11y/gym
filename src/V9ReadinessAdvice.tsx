import { useRef, useState } from 'react';
import { getV9ReadinessAdvice } from './v9-readiness';

export function V9ReadinessAdvice({ date, entries, exposures, disabled, onChoose }: {
  date: string;
  entries: Parameters<typeof getV9ReadinessAdvice>[1];
  exposures?: Parameters<typeof getV9ReadinessAdvice>[2];
  disabled?: boolean;
  onChoose: (status: 'yellow' | 'red') => Promise<boolean>;
}) {
  const advice = getV9ReadinessAdvice(date, entries, exposures);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  return <details className="training-terms" aria-label="V9 readiness recommendation">
    <summary>{advice.title}</summary><p>{advice.detail}</p>
    {advice.suggested && <button type="button" className="btn secondary full" disabled={disabled || busy}
      onClick={async () => { if (inFlight.current) return; inFlight.current = true; setBusy(true); try { await onChoose(advice.suggested!); } finally { inFlight.current = false; setBusy(false); } }}>
      {busy ? 'Saving…' : advice.suggested === 'red' ? 'Use recovery recommendation' : 'Use reduced recommendation'}
    </button>}
  </details>;
}

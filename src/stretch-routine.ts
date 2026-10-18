export interface StretchStep { key: string; name: string; target: string; cue: string; done: boolean }

const stretches: Omit<StretchStep, 'done'>[] = [
  { key: 'recovery-calf', name: 'Gastrocnemius Stretch', target: '20–30 sec / side', cue: 'Keep the back heel down and knee straight. Use a gentle hold.' },
  { key: 'recovery-hip-flexor', name: 'Hip Flexor Stretch', target: '20–30 sec / side', cue: 'Gently tuck the pelvis; keep ribs down without arching the back.' },
  { key: 'recovery-glute', name: 'Glute Stretch', target: '20–30 sec / side', cue: 'Use a comfortable figure-four position. Do not force the knee.' },
  { key: 'recovery-lat', name: 'Lat Stretch', target: '20–30 sec / side', cue: 'Reach gently and breathe. Stop if the shoulder hurts.' },
];

/** Supplement only the old empty/walk-only routine; custom steps and saved checks stay intact. */
export function getStretchRoutine(items?: readonly StretchStep[]): StretchStep[] {
  const saved = (items ?? []).map(item => ({ ...item }));
  if (saved.length && !saved.every(item => /^Easy Walk \+ Breathing$/i.test(item.name))) return saved;
  return [...saved, ...stretches.filter(step => !saved.some(item => item.key === step.key))
    .slice(0, Math.max(0, 20 - saved.length)).map(step => ({ ...step, done: false }))];
}

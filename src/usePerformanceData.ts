import { useCallback, useEffect, useRef, useState } from 'react';
import { requestLocal } from './storage';
import { PerformanceDataSchema, type JumpEntry, type PerformanceData, type PerformancePayload, type ReadinessEntry } from './performance-data';

export function usePerformanceData(enabled: boolean) {
  const [data, setData] = useState<PerformancePayload | undefined>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const latest = useRef<PerformancePayload | undefined>(undefined);
  const writing = useRef(false);
  const load = useCallback(async () => {
    try {
      const saved = await requestLocal('/api/performance') as unknown as PerformancePayload;
      const parsed = PerformanceDataSchema.parse({ jumps: saved.jumps, readiness: saved.readiness });
      latest.current = { ...parsed, version: saved.version };
      setData(latest.current); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Performance records could not load.'); }
  }, []);
  useEffect(() => { if (enabled) void load(); }, [enabled, load]);
  const save = useCallback(async (change: (current: PerformanceData) => PerformanceData) => {
    if (!latest.current) throw new Error('Your performance records are still loading. Try again.');
    if (writing.current) throw new Error('Wait for your last change to save.');
    writing.current = true; setSaving(true);
    try {
      const { version, jumps, readiness } = latest.current;
      // The transport version is not a performance field. Keep it out of the
      // strict data schema and out of transforms that spread their input.
      const next = PerformanceDataSchema.parse(change({ jumps, readiness }));
      const result = await requestLocal('/api/performance', { action: 'save', expectedVersion: version, ...next });
      latest.current = { ...next, version: result.version as number };
      setData(latest.current); setError('');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Your performance records could not save.';
      setError(message); throw new Error(message);
    } finally { writing.current = false; setSaving(false); }
  }, []);
  return {
    data, error, saving, reload: load,
    saveJump: (entry: JumpEntry) => save(current => ({ ...current, jumps: [...current.jumps.filter(jump => jump.id !== entry.id), entry] })),
    deleteJump: (id: string) => save(current => ({ ...current, jumps: current.jumps.filter(jump => jump.id !== id) })),
    saveReadiness: (entry: ReadinessEntry) => save(current => ({ ...current, readiness: [...current.readiness.filter(row => row.date !== entry.date), entry] })),
  };
}

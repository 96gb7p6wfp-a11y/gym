import type { SprintEntry } from './performance-data';

const normalized = (value?: string) => (value ?? '').trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ');

/** Distance, timing technique, start protocol and conditions must all match. */
export function sprintProtocolKey(entry: Pick<SprintEntry, 'distanceM' | 'timingMethod' | 'protocol' | 'conditions'>): string {
  return JSON.stringify([entry.distanceM, entry.timingMethod, normalized(entry.protocol), normalized(entry.conditions)]);
}

export function comparableSprintEntries(entries: readonly SprintEntry[], selected: SprintEntry, throughDate: string) {
  const key = sprintProtocolKey(selected);
  return entries.filter(entry => entry.date <= throughDate && sprintProtocolKey(entry) === key)
    .slice().sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

/** One best actual effort per date; repeated attempts are not extra sessions. */
export function sprintProgress(entries: readonly SprintEntry[], selected: SprintEntry, throughDate: string) {
  const comparable = comparableSprintEntries(entries, selected, throughDate);
  const dates = new Map<string, SprintEntry>();
  for (const entry of comparable) {
    const current = dates.get(entry.date);
    if (!current || entry.seconds < current.seconds) dates.set(entry.date, entry);
  }
  const points = [...dates.values()];
  const first = points[0] ?? null;
  const latest = points.at(-1) ?? null;
  const best = comparable.length ? comparable.reduce((a, b) => a.seconds <= b.seconds ? a : b) : null;
  return { points, attempts: comparable.length, best, latest,
    changeSeconds: first && latest && first.date !== latest.date
      ? Math.round((first.seconds - latest.seconds) * 10000) / 10000 : null };
}

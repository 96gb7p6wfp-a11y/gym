import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { filterWorkoutHistory, indexWorkoutHistory, type SearchableWorkout } from './history-search';
import './history-search.css';

const PAGE_SIZE = 40;

/** Bounded rendering keeps years of history usable without removing records. */
export default function HistorySearch<Workout extends SearchableWorkout>({ sessions, children }: {
  sessions: readonly Workout[];
  children: (sessions: Workout[]) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const input = useRef<HTMLInputElement>(null);
  const index = useMemo(() => indexWorkoutHistory(sessions), [sessions]);
  const results = useMemo(() => filterWorkoutHistory(index, query), [index, query]);
  const visible = results.slice(0, limit);
  return <section className="history-search" aria-label="Find saved workouts">
    <div className="history-search__field">
      <Search size={20} aria-hidden="true" />
      <input ref={input} type="search" aria-label="Search workouts" placeholder="Name, exercise, equipment or date"
        value={query} onChange={event => { setQuery(event.target.value); setLimit(PAGE_SIZE); }} />
      {query && <button type="button" aria-label="Clear workout search" onClick={() => { setQuery(''); setLimit(PAGE_SIZE); input.current?.focus(); }}><X size={18} aria-hidden="true" /></button>}
    </div>
    <p className="history-search__count" role="status" aria-live="polite">
      {query.trim() ? `${results.length} matching ${results.length === 1 ? 'workout' : 'workouts'} · ` : ''}
      Showing {visible.length} of {results.length}
    </p>
    {visible.length ? children(visible) : <div className="history-search__empty"><h3>No matching workouts.</h3><p>Try another name, exercise, equipment label or date. Your saved records are unchanged.</p></div>}
    {visible.length < results.length && <button type="button" className="btn secondary history-search__more"
      onClick={() => setLimit(value => value + PAGE_SIZE)}>Show more workouts</button>}
  </section>;
}

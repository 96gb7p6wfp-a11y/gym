import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { ExerciseGuideBody } from './ExerciseGuide';
import { EXERCISE_CATALOGUE, findLibraryExercise, rankAlternatives, searchExercises, type ExerciseReference, type LibraryExercise, type LibraryFilters } from './exercise-library';
import './exercise-library.css';

export interface ExerciseLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (exercise: LibraryExercise) => void;
  replacementFor?: ExerciseReference;
  title?: string;
  browseOnly?: boolean;
  confirmationLabel?: string;
}
const facets: { key: keyof LibraryFilters; label: string; values: string[] }[] = [
  { key: 'muscle', label: 'Muscle', values: [...new Set(EXERCISE_CATALOGUE.flatMap(item => item.muscles))].sort() },
  { key: 'goal', label: 'Goal', values: ['Strength', 'Hypertrophy', 'Power', 'Jump', 'Volleyball', 'Speed', 'Mobility', 'Recovery'] },
  { key: 'equipment', label: 'Equipment', values: [...new Set(EXERCISE_CATALOGUE.flatMap(item => item.equipment))].sort() },
  { key: 'movement', label: 'Movement', values: [...new Set(EXERCISE_CATALOGUE.map(item => item.movement))].sort() },
  { key: 'type', label: 'Training type', values: [...new Set(EXERCISE_CATALOGUE.map(item => item.category))].sort() },
];
const categories = ['All', 'Strength', 'Power', 'Jump', 'Upper', 'Lower', 'Core'] as const;
type Category = typeof categories[number];
function matchesCategory(item: LibraryExercise, category: Category) {
  if (category === 'All') return true;
  if (category === 'Jump') return item.category === 'Plyometric' || item.goals.includes('Jump');
  if (category === 'Upper') return item.muscles.some(muscle => ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms'].includes(muscle));
  if (category === 'Lower') return item.muscles.some(muscle => ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Tibialis', 'Adductors', 'Hip flexors'].includes(muscle));
  if (category === 'Core') return item.category === 'Core';
  return item.category === category;
}

export function ExerciseLibrarySheet({ open, onOpenChange, onSelect, replacementFor, title, browseOnly = false, confirmationLabel }: ExerciseLibrarySheetProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [category, setCategory] = useState<Category>('All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<LibraryExercise | null>(null);
  const [limit, setLimit] = useState(30);
  const body = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const selectedId = useRef<string | null>(null);
  const confirming = useRef(false);
  const replacementIdentity = replacementFor?.exerciseId ?? replacementFor?.name ?? replacementFor?.key ?? '';
  useEffect(() => {
    if (!open) return;
    setQuery(''); setFilters({}); setCategory('All'); setFiltersOpen(false); setSelected(null); setLimit(30);
    listScroll.current = 0; selectedId.current = null; confirming.current = false;
  }, [open, replacementIdentity]);
  useLayoutEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const scroller = body.current?.closest('.dialog-scroll');
      if (!scroller) return;
      scroller.scrollTop = selected ? 0 : listScroll.current;
      if (!selected && selectedId.current) {
        body.current?.querySelector<HTMLButtonElement>(`button[data-exercise-id="${selectedId.current}"]`)?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, open]);
  const results = useMemo(() => searchExercises(query, filters).filter(item => matchesCategory(item, category)), [query, filters, category]);
  const alternatives = useMemo(() => replacementFor ? rankAlternatives(replacementFor) : [], [replacementIdentity, replacementFor?.name]);
  const currentId = replacementFor ? findLibraryExercise(replacementFor)?.id : undefined;
  const filtered = Boolean(query.trim() || category !== 'All' || Object.values(filters).some(Boolean));
  const suggested = filtered ? [] : alternatives;
  const suggestedIds = new Set(suggested.map(item => item.exercise.id));
  const remaining = results.filter(item => !suggestedIds.has(item.id) && item.id !== currentId);
  const filterCount = Object.values(filters).filter(Boolean).length;
  function showDetails(item: LibraryExercise) {
    listScroll.current = body.current?.closest('.dialog-scroll')?.scrollTop ?? 0;
    selectedId.current = item.id;
    setSelected(item);
  }
  function confirm() {
    if (!selected || confirming.current) return;
    confirming.current = true;
    if (!browseOnly) onSelect?.(selected);
    onOpenChange(false);
  }
  function row(item: LibraryExercise, tradeoff?: string) {
    return <li className="exercise-library__item" key={item.id}>
      <button className="exercise-library__select" type="button" data-exercise-id={item.id} aria-label={`${browseOnly ? 'View' : 'Select'} ${item.name}`} onClick={() => showDetails(item)}>
        <span className="exercise-library__row-copy"><strong>{item.name}</strong><span>{tradeoff ?? item.muscles.join(' · ')}</span></span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </li>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="app-dialog exercise-library-sheet">
      <div ref={body} className={`exercise-library__body${selected ? ' exercise-library__body--detail' : ''}`}>
        {selected ? <>
          <button type="button" className="exercise-library__back" onClick={() => setSelected(null)}><ArrowLeft size={19} aria-hidden="true" />Back</button>
          <DialogHeader className="exercise-library__detail-header">
            <DialogDescription className="exercise-library__category">{selected.category}</DialogDescription>
            <DialogTitle className="exercise-library__detail-title">{selected.name}</DialogTitle>
          </DialogHeader>
          <ExerciseGuideBody key={selected.id} exercise={{ name: selected.name, key: selected.id, mode: selected.mode, target: selected.recommendedReps }} />
          <div className="exercise-library__confirmation"><button type="button" className="btn full" onClick={confirm}>{browseOnly ? 'Done' : confirmationLabel ?? (replacementFor ? 'Replace exercise' : 'Add exercise')}</button></div>
        </> : <>
          <DialogHeader className="exercise-library__header">
            <DialogTitle className="exercise-library__title">{title ?? (browseOnly ? 'Exercises' : replacementFor ? 'Replace exercise' : 'Add exercise')}</DialogTitle>
            <DialogDescription className="sr-only">{replacementFor ? 'Find a similar movement for your workout.' : 'Search movements and open a technique guide.'}</DialogDescription>
          </DialogHeader>
          <div className="exercise-library__search"><Search size={19} aria-hidden="true" />
            <input type="search" aria-label="Search exercises" placeholder="Search exercises" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); }} autoComplete="off" autoCorrect="off" spellCheck={false} />
          </div>
          <div className="exercise-library__tools">
            <div className="exercise-library__categories" role="group" aria-label="Exercise categories">{categories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setLimit(30); }}>{value}</button>)}</div>
            <button type="button" className="exercise-library__filter-toggle" aria-label={filterCount ? `Filters, ${filterCount} active` : 'Filters'} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={18} aria-hidden="true" />{filterCount > 0 && <span>{filterCount}</span>}</button>
          </div>
          <div className="exercise-library__filters" hidden={!filtersOpen}>
            <div className="exercise-library__filter-body">
              {facets.map(facet => <details key={facet.key} className="exercise-library__facet">
                <summary>{facet.label}<span>{filters[facet.key] || 'All'}</span></summary>
                <div className="exercise-library__chips" role="group" aria-label={`Filter by ${facet.label.toLowerCase()}`}>
                  <button type="button" aria-pressed={!filters[facet.key]} onClick={() => setFilters(current => ({ ...current, [facet.key]: undefined }))}>All</button>
                  {facet.values.map(value => <button key={value} type="button" aria-pressed={filters[facet.key] === value} onClick={() => { setFilters(current => ({ ...current, [facet.key]: value })); setLimit(30); }}>{value}</button>)}
                </div>
              </details>)}
              {filterCount > 0 && <button type="button" className="exercise-library__clear" onClick={() => setFilters({})}>Clear filters</button>}
            </div>
          </div>
          {suggested.length > 0 && <section className="exercise-library__section" aria-label="Suggested alternatives"><h3>Closest alternatives</h3><ul>{suggested.map(item => row(item.exercise, item.tradeoff))}</ul></section>}
          <section className="exercise-library__section" aria-label="Exercise results">
            {(filtered || suggested.length > 0) && <h3>{filtered ? `${remaining.length} ${remaining.length === 1 ? 'exercise' : 'exercises'}` : 'All movements'}</h3>}
            {remaining.length ? <ul>{remaining.slice(0, limit).map(item => row(item))}</ul> : <p className="exercise-library__empty">No matches.<span>Try another name or clear a filter.</span></p>}
            {remaining.length > limit && <button className="exercise-library__more" type="button" onClick={() => setLimit(value => value + 30)}>Show more</button>}
          </section>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}

export default ExerciseLibrarySheet;

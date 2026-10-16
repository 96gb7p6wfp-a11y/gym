import { useEffect, useMemo, useState } from 'react';
import { Info, Search, SlidersHorizontal } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui';
import { EXERCISE_CATALOGUE, findLibraryExercise, rankAlternatives, searchExercises, type ExerciseReference, type LibraryExercise, type LibraryFilters } from './exercise-library';
import './exercise-library.css';

export interface ExerciseLibrarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (exercise: LibraryExercise) => void;
  replacementFor?: ExerciseReference;
  title?: string;
}
const facets: { key: keyof LibraryFilters; label: string; values: string[] }[] = [
  { key: 'muscle', label: 'Muscle', values: [...new Set(EXERCISE_CATALOGUE.flatMap(item => item.muscles))].sort() },
  { key: 'goal', label: 'Goal', values: ['Strength', 'Hypertrophy', 'Power', 'Jump', 'Volleyball', 'Speed', 'Mobility', 'Recovery'] },
  { key: 'equipment', label: 'Equipment', values: [...new Set(EXERCISE_CATALOGUE.flatMap(item => item.equipment))].sort() },
  { key: 'movement', label: 'Movement', values: [...new Set(EXERCISE_CATALOGUE.map(item => item.movement))].sort() },
  { key: 'type', label: 'Training type', values: [...new Set(EXERCISE_CATALOGUE.map(item => item.category))].sort() },
];

export function ExerciseLibrarySheet({ open, onOpenChange, onSelect, replacementFor, title }: ExerciseLibrarySheetProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<LibraryFilters>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);
  const replacementIdentity = replacementFor?.exerciseId ?? replacementFor?.name ?? replacementFor?.key ?? '';
  useEffect(() => {
    if (!open) return;
    setQuery(''); setFilters({}); setExpanded(null); setLimit(30);
  }, [open, replacementIdentity]);
  const results = useMemo(() => searchExercises(query, filters), [query, filters]);
  const alternatives = useMemo(() => replacementFor ? rankAlternatives(replacementFor) : [], [replacementIdentity, replacementFor?.name]);
  const currentId = replacementFor ? findLibraryExercise(replacementFor)?.id : undefined;
  const filtered = Boolean(query.trim() || Object.values(filters).some(Boolean));
  const suggested = filtered ? [] : alternatives;
  const suggestedIds = new Set(suggested.map(item => item.exercise.id));
  const remaining = results.filter(item => !suggestedIds.has(item.id) && item.id !== currentId);
  const filterCount = Object.values(filters).filter(Boolean).length;
  function select(item: LibraryExercise) { onSelect(item); onOpenChange(false); }
  function row(item: LibraryExercise, tradeoff?: string) {
    const isExpanded = expanded === item.id;
    return <li className="exercise-library__item" key={item.id}>
      <div className="exercise-library__row">
        <button className="exercise-library__select" type="button" aria-label={`Select ${item.name}`} onClick={() => select(item)}>
          <strong>{item.name}</strong>
          <span>{tradeoff ?? item.primaryBenefit}</span>
        </button>
        <button className="exercise-library__info" type="button" aria-label={`Details for ${item.name}`} aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : item.id)}><Info size={20} aria-hidden="true" /></button>
      </div>
      {isExpanded && <div className="exercise-library__details">
        <p>{item.muscles.join(' · ')}</p>
        <dl>
          <div><dt>Type</dt><dd>{item.category}</dd></div>
          <div><dt>Equipment</dt><dd>{item.equipment.join(' · ')}</dd></div>
          <div><dt>Level</dt><dd>{item.difficulty}</dd></div>
          <div><dt>Start with</dt><dd>{item.recommendedSets} × {item.recommendedReps}</dd></div>
        </dl>
        <p>{item.secondaryBenefit}</p>
        <p className="exercise-library__cue">{item.cues[0]}</p>
      </div>}
    </li>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="app-dialog exercise-library-sheet">
      <DialogHeader className="exercise-library__header">
        <DialogTitle className="exercise-library__title">{title ?? (replacementFor ? 'Replace exercise' : 'Add exercise')}</DialogTitle>
        <DialogDescription className="exercise-library__description">{replacementFor ? `Choose a similar movement for ${replacementFor.name ?? 'this exercise'}.` : 'Find a movement that fits today.'}</DialogDescription>
      </DialogHeader>
      <div className="exercise-library__search">
        <Search size={20} aria-hidden="true" />
        <input type="search" aria-label="Search exercises" placeholder="Search exercises" value={query} onChange={event => { setQuery(event.target.value); setLimit(30); }} autoComplete="off" autoCorrect="off" spellCheck={false} />
      </div>
      <details className="exercise-library__filters">
        <summary><SlidersHorizontal size={17} aria-hidden="true" /> Filters {filterCount > 0 && <span>{filterCount}</span>}</summary>
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
      </details>
      {suggested.length > 0 && <section className="exercise-library__section" aria-label="Suggested alternatives">
        <h3>Similar movements</h3>
        <ul>{suggested.map(item => row(item.exercise, item.tradeoff))}</ul>
      </section>}
      <section className="exercise-library__section" aria-label="Exercise results">
        <h3>{filtered ? `${remaining.length} ${remaining.length === 1 ? 'exercise' : 'exercises'}` : 'Exercise library'}</h3>
        {remaining.length > 0 ? <ul>{remaining.slice(0, limit).map(item => row(item))}</ul> : <p className="exercise-library__empty">No matches. Try another name or clear a filter.</p>}
        {remaining.length > limit && <button className="exercise-library__more" type="button" onClick={() => setLimit(value => value + 30)}>Show more</button>}
      </section>
    </DialogContent>
  </Dialog>;
}

export default ExerciseLibrarySheet;

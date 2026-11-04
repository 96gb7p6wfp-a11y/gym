/** The stored name is the title everywhere a whole workout is presented. */
export function workoutTitle(source: string | { name: string }): string {
  return (typeof source === 'string' ? source : source.name).trim();
}

/** Compact calendar aliases only; never use these as a workout's primary title. */
export function shortSessionName(name: string): string {
  return ({
    'Upper Power + Muscle': 'Upper Body',
    'Upper Power B': 'Upper Body',
    'Lower Strength': 'Lower Body',
    'Main Jump + Complex Lower': 'Lower + Jump',
    'Jump Technique Primer': 'Jump primer',
  } as Record<string, string>)[name] ?? name;
}

/** Display aliases only. Stored plan titles, exercise keys and history stay intact. */
export function shortSessionName(name: string): string {
  return ({
    'Upper Power + Muscle': 'Upper Body',
    'Upper Power B': 'Upper Body',
    'Lower Strength': 'Lower Body',
    'Main Jump + Complex Lower': 'Lower + Jump',
    'Jump Technique Primer': 'Jump primer',
  } as Record<string, string>)[name] ?? name;
}

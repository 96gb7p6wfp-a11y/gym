/** Setline's schedule uses Berlin calendar days, independently of device timezone. */
const berlinCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function berlinDate(value: Date | number = new Date()): string {
  const parts = berlinCalendar.formatToParts(value);
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Monday = 0. Parse calendar strings as dates, never as UTC instants at midnight. */
export function calendarDayIndex(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

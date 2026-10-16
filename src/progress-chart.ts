export interface TrendDatum { date: string; value: number }
/** Calendar spacing preserves gaps in actual recordings; no interpolation or invented observations. */
export function getTrendCoordinates(points: readonly TrendDatum[], width: number, height: number, padding = 8) {
  const values = points.filter(point => Number.isFinite(point.value));
  if (!values.length) return [];
  const times = values.map(point => new Date(`${point.date}T12:00:00Z`).getTime());
  const first = Math.min(...times), last = Math.max(...times);
  const min = Math.min(...values.map(point => point.value)), max = Math.max(...values.map(point => point.value));
  // A constant trend stays horizontal, with breathing room above and below it.
  const range = Math.max(0.5, max - min);
  const low = min - (range - (max - min)) / 2;
  return values.map((point, index) => ({
    date: point.date, value: point.value,
    x: first === last ? width / 2 : padding + (times[index] - first) / (last - first) * (width - padding * 2),
    y: height - padding - (point.value - low) / range * (height - padding * 2),
  }));
}

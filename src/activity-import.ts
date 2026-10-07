import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { ExtraActivitySchema } from './activities.ts';
import type { ActivityRecord, ExtraActivity } from './activities.ts';

export interface ImportSource {
  provider: 'strava' | 'adidas' | 'file';
  format: 'gpx' | 'tcx' | 'csv' | 'fit';
  externalId?: string;
  startedAt?: string;
  originalCalories?: number;
  fingerprint: string;
}

export interface ImportCandidate {
  activity: ExtraActivity;
  source: ImportSource;
  warnings: string[];
}

export interface ImportInput {
  date?: string;
  startedAt?: string;
  type: ExtraActivity['type'];
  name: string;
  durationMinutes: number;
  distanceKm: number | null;
  activeCalories?: number | null;
  originalCalories?: number;
  source: Pick<ImportSource, 'provider' | 'format' | 'externalId'>;
  warnings?: string[];
  notes?: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_RECORDS = 1_000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const labels: Record<ExtraActivity['type'], string> = {
  run: 'Running', cycle: 'Cycling', walk: 'Walking', swim: 'Swimming', other: 'Other activity',
};

function calendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Parse known export formats rather than accepting Date's rollover of invalid dates. */
function parseStart(value: unknown): { date: string; startedAt?: string; timezoneMissing: boolean } {
  const raw = stringValue(value).trim();
  if (calendarDate(raw)) return { date: raw, timezoneMissing: true };
  let iso = raw;
  const strava = /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(raw);
  if (strava) {
    const month = MONTHS.indexOf(strava[1].toLowerCase());
    const hour12 = Number(strava[4]);
    if (month < 0 || hour12 < 1 || hour12 > 12) throw new Error('The start date/time is invalid.');
    const hour = hour12 % 12 + (strava[7].toUpperCase() === 'PM' ? 12 : 0);
    iso = `${strava[3]}-${String(month + 1).padStart(2, '0')}-${strava[2].padStart(2, '0')}T${String(hour).padStart(2, '0')}:${strava[5]}:${strava[6] ?? '00'}`;
  }
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/i.exec(iso);
  if (!match || !calendarDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] ?? 0) > 59) {
    throw new Error('A valid start date/time is required (ISO date/time or the Strava Activity Date format).');
  }
  if (match[5] && match[5].toUpperCase() !== 'Z') {
    const offset = match[5].replace(':', '');
    if (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(3)) > 59) throw new Error('The start date timezone is invalid.');
  }
  const parsed = new Date(iso.replace(' ', 'T'));
  if (!Number.isFinite(parsed.getTime())) throw new Error('The start date/time is invalid.');
  return { date: localDate(parsed), startedAt: parsed.toISOString(), timezoneMissing: !match[5] };
}

export function inferActivityType(raw: string): ExtraActivity['type'] {
  const normalized = raw.toLowerCase().replace(/[_-]/g, ' ');
  if (/\b(run|running|jog|jogging|trailrun|trail run|virtualrun|virtual run|treadmill)\b/.test(normalized)) return 'run';
  if (/\b(cycl|cycling|cycle|bike|biking|bicycle|ride|virtualride|virtual ride|ebike|ebikeride|e bike|mountainbike|mountainbikeride|mountain bike)\b/.test(normalized)) return 'cycle';
  if (/\b(walk|walking|hike|hiking)\b/.test(normalized)) return 'walk';
  if (/\b(swim|swimming)\b/.test(normalized)) return 'swim';
  return 'other';
}

/** Provider-independent summary; timestamps/float noise are rounded for export comparison. */
export function activityFingerprint(
  startedAt: string | undefined,
  type: ExtraActivity['type'],
  durationMinutes: number,
  distanceKm: number | null,
  date = '',
): string {
  const stamp = startedAt ? new Date(Math.floor(new Date(startedAt).getTime() / 60_000) * 60_000).toISOString() : date;
  return `v1:${stamp}|${type}|${Math.round(durationMinutes)}|${distanceKm === null ? '-' : distanceKm.toFixed(1)}`;
}

export function makeImportCandidate(input: ImportInput, bodyWeightKg: number): ImportCandidate {
  if (input.source.externalId !== undefined && (!input.source.externalId.trim() || input.source.externalId.length > 120)) {
    throw new Error('The exported activity ID must contain between 1 and 120 characters.');
  }
  const start = input.startedAt ? parseStart(input.startedAt) : null;
  const date = input.date ?? start?.date;
  if (!date || !calendarDate(date)) throw new Error('A valid activity date is required; it cannot be guessed from the filename.');
  const startedAt = start?.startedAt;
  const durationMinutes = Math.round(input.durationMinutes * 1_000) / 1_000;
  const distanceKm = input.distanceKm === null ? null : Math.round(input.distanceKm * 100_000) / 100_000;
  const warnings = [...(input.warnings ?? [])];
  if (input.type === 'other') warnings.push('Activity type was not recognised. Choose the correct type before saving.');
  if (input.originalCalories !== undefined) {
    if (!Number.isFinite(input.originalCalories) || input.originalCalories < 0 || input.originalCalories > 20_000) {
      throw new Error('Exported calories must be between 0 and 20,000.');
    }
    if (input.activeCalories === undefined || input.activeCalories === null) {
      warnings.push(`The file reports ${Math.round(input.originalCalories)} kcal but does not identify active versus total energy. Setline estimates active calories instead.`);
    }
  }
  const activity = ExtraActivitySchema.safeParse({
    id: `import-${globalThis.crypto.randomUUID()}`,
    date,
    type: input.type,
    name: input.name.trim().slice(0, 100) || labels[input.type],
    durationMinutes,
    distanceKm,
    intensity: 'moderate',
    bodyWeightKg,
    watchCalories: input.activeCalories ?? null,
    notes: (input.notes ?? `Imported ${input.source.format.toUpperCase()} summary. Review the activity type, date, duration and effort before saving.`).slice(0, 1_000),
    createdAt: Date.now(),
    deletedAt: null,
  });
  if (!activity.success) {
    throw new Error(activity.error.issues.map(issue => {
      if (issue.path[0] === 'durationMinutes') return 'Duration must be between 1 and 600 minutes.';
      if (issue.path[0] === 'distanceKm') return 'Distance must be greater than 0 and no more than 300 km, or absent.';
      return `${issue.path.join('.')}: ${issue.message}`;
    }).join(' '));
  }
  const source: ImportSource = {
    ...input.source,
    ...(startedAt ? { startedAt } : {}),
    ...(input.originalCalories !== undefined ? { originalCalories: input.originalCalories } : {}),
    fingerprint: activityFingerprint(startedAt, input.type, durationMinutes, distanceKm, date),
  };
  return { activity: activity.data, source, warnings: [...new Set(warnings)] };
}

function importedSource(record: ActivityRecord): ImportSource | undefined {
  return (record.activity as ExtraActivity & { importSource?: ImportSource }).importSource;
}

/** Exact imported matches may be safely excluded from an import selection by default. */
export function findDuplicateActivity(candidate: ImportCandidate, records: ActivityRecord[]): ActivityRecord | undefined {
  return records.find(record => {
    const source = importedSource(record);
    if (!source) return false;
    // Exporters disagree about elapsed versus moving duration. The same recorded
    // start instant still identifies a re-export even when its summary differs.
    // Compare seconds rather than minutes so separately started activities are
    // not excluded merely because they began in the same minute.
    const sameStart = source.startedAt !== undefined && candidate.source.startedAt !== undefined
      && Math.floor(new Date(source.startedAt).getTime() / 1_000) === Math.floor(new Date(candidate.source.startedAt).getTime() / 1_000)
      && record.activity.type === candidate.activity.type;
    return (source.provider === candidate.source.provider && source.externalId !== undefined && source.externalId === candidate.source.externalId)
      || source.fingerprint === candidate.source.fingerprint || sameStart;
  });
}

/** A manual summary has no reliable external id/start time: flag for review, do not block it. */
export function findPossibleDuplicateActivity(candidate: ImportCandidate, records: ActivityRecord[]): ActivityRecord | undefined {
  return records.find(({ activity }) => activity.date === candidate.activity.date && activity.type === candidate.activity.type
    && Math.abs(activity.durationMinutes - candidate.activity.durationMinutes) <= 1
    && (activity.distanceKm === null && candidate.activity.distanceKm === null
      || activity.distanceKm !== null && candidate.activity.distanceKm !== null && Math.abs(activity.distanceKm - candidate.activity.distanceKm) <= 0.1));
}

type XmlNode = Record<string, unknown>;
function object(value: unknown): XmlNode { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as XmlNode : {}; }
function many(value: unknown): unknown[] { return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]; }
function stringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return stringValue(object(value)['#text']);
  return String(value);
}
function numeric(value: unknown): number | undefined {
  const raw = stringValue(value).trim();
  if (!raw || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}
function nonnegative(value: unknown, label: string): number | undefined {
  if (!stringValue(value).trim()) return undefined;
  const parsed = numeric(value);
  if (parsed === undefined || parsed < 0) throw new Error(`${label} must be a valid non-negative number.`);
  return parsed;
}
function providerFrom(raw: string): ImportSource['provider'] {
  return /strava/i.test(raw) ? 'strava' : /adidas|runtastic/i.test(raw) ? 'adidas' : 'file';
}
function descendants(node: unknown, wanted: string, result: unknown[] = []): unknown[] {
  for (const entry of many(node)) {
    const record = object(entry);
    for (const [key, value] of Object.entries(record)) {
      if (key === wanted) result.push(...many(value));
      else if (!key.startsWith('@_')) descendants(value, wanted, result);
    }
  }
  return result;
}
function haversine(points: Array<{ lat: number; lon: number }>): number | null {
  if (points.length < 2) return null;
  const radians = Math.PI / 180;
  let km = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const a = Math.sin((current.lat - previous.lat) * radians / 2) ** 2
      + Math.cos(previous.lat * radians) * Math.cos(current.lat * radians)
      * Math.sin((current.lon - previous.lon) * radians / 2) ** 2;
    km += 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }
  return km > 0 ? km : null;
}
function pointPosition(point: XmlNode, latKey: string, lonKey: string): { lat: number; lon: number } | null {
  if (!stringValue(point[latKey]).trim() && !stringValue(point[lonKey]).trim()) return null;
  const lat = numeric(point[latKey]);
  const lon = numeric(point[lonKey]);
  if (lat === undefined || lon === undefined) throw new Error('The GPS file contains incomplete or invalid coordinates.');
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('The GPS file contains invalid coordinates.');
  return { lat, lon };
}
function elapsed(times: string[]): { startedAt: string; durationMinutes: number } {
  if (times.length < 2) throw new Error('The GPS file needs a start and end timestamp to determine duration.');
  const stamps = times.map(time => {
    const parsed = parseStart(time);
    if (!parsed.startedAt) throw new Error('GPS timestamps need a time as well as a date.');
    return new Date(parsed.startedAt).getTime();
  });
  if (stamps.some((stamp, index) => index > 0 && stamp < stamps[index - 1])) throw new Error('GPS timestamps are out of order.');
  return { startedAt: new Date(stamps[0]).toISOString(), durationMinutes: (stamps[stamps.length - 1] - stamps[0]) / 60_000 };
}

function parseGpx(document: XmlNode, bodyWeightKg: number, fileName: string): ImportCandidate[] {
  const gpx = object(document.gpx);
  const tracks = many(gpx.trk);
  if (!tracks.length) throw new Error('No recorded GPX tracks were found. Routes without workout timestamps cannot be imported.');
  if (tracks.length > MAX_RECORDS) throw new Error('Import no more than 1,000 activities at a time.');
  const provider = providerFrom(`${stringValue(gpx['@_creator'])} ${fileName}`);
  return tracks.map((rawTrack, index) => {
    try {
      const track = object(rawTrack);
      const segments = many(track.trkseg);
      const times: string[] = [];
      let calculatedDistance = 0;
      let hasCalculatedDistance = false;
      for (const segment of segments) {
        const positions: Array<{ lat: number; lon: number }> = [];
        for (const rawPoint of many(object(segment).trkpt)) {
          const point = object(rawPoint);
          const position = pointPosition(point, '@_lat', '@_lon');
          if (!position) throw new Error('GPX trackpoints require valid latitude and longitude.');
          positions.push(position);
          const time = stringValue(point.time);
          if (time) times.push(time);
        }
        const distance = haversine(positions);
        if (distance !== null) { calculatedDistance += distance; hasCalculatedDistance = true; }
      }
      const timing = elapsed(times);
      const explicitMeters = descendants(track.extensions, 'DistanceMeters').map(value => nonnegative(value, 'DistanceMeters')).filter((n): n is number => n !== undefined && n > 0);
      // Garmin's GPX TrackStatsExtension Distance is explicitly defined in metres.
      for (const stats of descendants(track.extensions, 'TrackStatsExtension')) {
        const distance = nonnegative(object(stats).Distance, 'TrackStatsExtension distance');
        if (distance !== undefined && distance > 0) explicitMeters.push(distance);
      }
      const distanceKm = explicitMeters.length ? Math.max(...explicitMeters) / 1_000 : hasCalculatedDistance ? calculatedDistance : null;
      const name = stringValue(track.name) || fileName.replace(/\.gpx$/i, '') || `Track ${index + 1}`;
      const declaredType = inferActivityType(stringValue(track.type));
      const type = declaredType === 'other' ? inferActivityType(name) : declaredType;
      const calories = descendants(track.extensions, 'Calories').map(value => nonnegative(value, 'Calories')).find(n => n !== undefined);
      const activeCalories = descendants(track.extensions, 'ActiveCalories').map(value => nonnegative(value, 'Active Calories')).find(n => n !== undefined);
      return makeImportCandidate({
        ...timing, type, name, distanceKm,
        ...(calories !== undefined ? { originalCalories: calories } : {}),
        ...(activeCalories !== undefined ? { activeCalories } : {}),
        source: { provider, format: 'gpx' },
        warnings: ['GPX duration is elapsed time and can include pauses. Check the duration before saving.',
          ...(times.some(time => parseStart(time).timezoneMissing) ? ['GPX timestamps have no timezone. Check the activity date before saving.'] : []),
          ...(explicitMeters.length ? [] : ['Distance is calculated from GPS points; recording gaps and GPS noise can affect it.'])],
      }, bodyWeightKg);
    } catch (error) { throw new Error(`GPX track ${index + 1}: ${error instanceof Error ? error.message : 'Invalid activity.'}`); }
  });
}

function parseTcx(document: XmlNode, bodyWeightKg: number, fileName: string): ImportCandidate[] {
  const database = object(document.TrainingCenterDatabase);
  const activities = many(object(database.Activities).Activity);
  if (!activities.length) throw new Error('No recorded TCX activities were found.');
  if (activities.length > MAX_RECORDS) throw new Error('Import no more than 1,000 activities at a time.');
  const provider = providerFrom(`${fileName} ${JSON.stringify(database.Author ?? {})}`);
  return activities.map((rawActivity, index) => {
    try {
      const activity = object(rawActivity);
      const laps = many(activity.Lap).map(object);
      const points = laps.flatMap(lap => descendants(lap.Track, 'Trackpoint').map(object));
      const times = points.map(point => stringValue(point.Time)).filter(Boolean);
      const startText = stringValue(activity.Id) || stringValue(laps[0]?.['@_StartTime']) || times[0];
      const start = parseStart(startText);
      if (!start.startedAt) throw new Error('A TCX activity needs a valid start timestamp.');
      const lapDurations = laps.map(lap => nonnegative(lap.TotalTimeSeconds, 'Lap duration'));
      const hasLapTiming = lapDurations.length > 0 && lapDurations.every(n => n !== undefined && n >= 0);
      const durationMinutes = hasLapTiming ? lapDurations.reduce<number>((sum, n) => sum + (n ?? 0), 0) / 60 : elapsed(times).durationMinutes;
      const lapDistances = laps.map(lap => nonnegative(lap.DistanceMeters, 'Lap distance'));
      const hasLapDistance = lapDistances.length > 0 && lapDistances.every(n => n !== undefined && n >= 0);
      let distanceKm: number | null = null;
      if (hasLapDistance) {
        const metres = lapDistances.reduce<number>((sum, n) => sum + (n ?? 0), 0);
        if (metres > 0) distanceKm = metres / 1_000;
      } else {
        const cumulative = points.map(point => nonnegative(point.DistanceMeters, 'Trackpoint distance')).filter((n): n is number => n !== undefined);
        if (cumulative.length) {
          // Cumulative counters may reset on a lap. Count each increment once, never add lap totals to trackpoint totals.
          let metres = cumulative[0];
          for (let point = 1; point < cumulative.length; point++) metres += cumulative[point] >= cumulative[point - 1] ? cumulative[point] - cumulative[point - 1] : cumulative[point];
          if (metres > 0) distanceKm = metres / 1_000;
        } else {
          let calculated = 0;
          for (const lap of laps) {
            for (const track of many(lap.Track)) {
              const positions = many(object(track).Trackpoint).map(point => pointPosition(object(object(point).Position), 'LatitudeDegrees', 'LongitudeDegrees')).filter((point): point is { lat: number; lon: number } => point !== null);
              calculated += haversine(positions) ?? 0;
            }
          }
          if (calculated > 0) distanceKm = calculated;
        }
      }
      const type = inferActivityType(stringValue(activity['@_Sport']));
      const name = stringValue(activity.Name) || `${labels[type]} · ${start.date}`;
      const lapCalories = laps.map(lap => nonnegative(lap.Calories, 'Lap calories'));
      const calories = lapCalories.length && lapCalories.every(n => n !== undefined) ? lapCalories.reduce<number>((sum, n) => sum + (n ?? 0), 0) : undefined;
      const activeCalories = descendants(activity.Extensions, 'ActiveCalories').map(value => nonnegative(value, 'Active Calories')).find(n => n !== undefined);
      return makeImportCandidate({
        date: start.date, startedAt: start.startedAt, type, name, durationMinutes, distanceKm,
        ...(calories !== undefined ? { originalCalories: calories } : {}),
        ...(activeCalories !== undefined ? { activeCalories } : {}),
        source: { provider, format: 'tcx', externalId: stringValue(activity.Id) || undefined },
        warnings: [...(!hasLapTiming ? ['Duration is elapsed GPS time and can include pauses.'] : []),
          ...(start.timezoneMissing ? ['TCX has no timezone. Check the activity date before saving.'] : []),
          ...(!hasLapDistance && !points.some(point => numeric(point.DistanceMeters) !== undefined) ? ['Distance is calculated from GPS points; check it before saving.'] : [])],
        notes: `Imported TCX summary. ${stringValue(activity.Notes)}`.trim(),
      }, bodyWeightKg);
    } catch (error) { throw new Error(`TCX activity ${index + 1}: ${error instanceof Error ? error.message : 'Invalid activity.'}`); }
  });
}

/** RFC 4180 fields, including escaped quotes, commas and newlines inside quoted fields. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let afterQuote = false;
  const pushField = () => { row.push(value); value = ''; afterQuote = false; };
  const pushRow = () => {
    pushField();
    if (row.some(field => field.trim())) rows.push(row);
    row = [];
    if (rows.length > MAX_RECORDS + 1) throw new Error('Import no more than 1,000 activities at a time.');
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; afterQuote = true; }
      } else value += character;
    } else if (character === ',') pushField();
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      pushRow();
    } else if (character === '"') {
      if (value.length || afterQuote) throw new Error(`Malformed CSV quoting near row ${rows.length + 1}.`);
      quoted = true;
    } else {
      if (afterQuote && character.trim()) throw new Error(`Unexpected text after a quoted CSV field near row ${rows.length + 1}.`);
      if (!afterQuote) value += character;
    }
    if (row.length > 256) throw new Error('CSV contains too many columns.');
  }
  if (quoted) throw new Error('CSV contains an unfinished quoted field.');
  if (value.length || row.length || afterQuote) pushRow();
  return rows;
}
function normalizeHeader(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function durationValue(value: string, numericUnit: 'seconds' | 'minutes'): number | undefined {
  const numericDuration = numeric(value);
  if (numericDuration !== undefined) return numericDuration / (numericUnit === 'seconds' ? 60 : 1);
  const clock = /^(\d{1,3}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!clock || Number(clock[2]) > 59 || Number(clock[3] ?? 0) > 59) return undefined;
  return clock[3] === undefined ? Number(clock[1]) + Number(clock[2]) / 60 : Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60;
}

function parseCsv(text: string, bodyWeightKg: number, fileName: string): ImportCandidate[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('CSV needs a header and at least one activity.');
  const headers = rows[0].map(normalizeHeader);
  const find = (...aliases: string[]) => {
    for (const alias of aliases) { const index = headers.indexOf(normalizeHeader(alias)); if (index >= 0) return index; }
    return -1;
  };
  const isStrava = find('Activity ID') >= 0 && find('Activity Date') >= 0;
  const provider: ImportSource['provider'] = isStrava ? 'strava' : providerFrom(fileName);
  const dateIndex = find('Activity Date', 'Start Time', 'Start Date', 'startedAt', 'date');
  const typeIndex = find('Activity Type', 'Sport Type', 'Sport', 'type');
  const nameIndex = find('Activity Name', 'Name', 'Title');
  const movingIndex = find('Moving Time', 'Moving Time (s)', 'moving_time_seconds');
  const secondsIndex = find('Elapsed Time', 'Elapsed Time (s)', 'duration_seconds', 'Duration (s)', 'Duration Seconds');
  const minutesIndex = find('duration_minutes', 'Duration (min)', 'Duration Minutes');
  const kilometresIndex = find('Distance (km)', 'distance_km', 'Distance Kilometers', ...(isStrava ? ['Distance'] : []));
  const metresIndex = find('Distance (m)', 'distance_m', 'Distance Meters');
  const distanceIndex = find('Distance');
  const distanceUnitIndex = find('Distance Unit');
  const caloriesIndex = find('Calories', 'Total Calories', 'Energy (kcal)');
  const activeCaloriesIndex = find('Active Calories', 'Active Calories (kcal)', 'active_energy_kcal');
  const idIndex = find('Activity ID', 'id');
  const notesIndex = find('Activity Description', 'Description', 'Notes');
  if (dateIndex < 0) throw new Error('CSV needs an Activity Date, Start Time or date column. Dates are never guessed.');
  if (movingIndex < 0 && secondsIndex < 0 && minutesIndex < 0) throw new Error('CSV needs Moving Time / Elapsed Time in seconds, duration_seconds, or duration_minutes. Include the unit in other duration headers.');
  if (!isStrava && distanceIndex >= 0 && kilometresIndex < 0 && metresIndex < 0 && distanceUnitIndex < 0) {
    throw new Error('CSV Distance has no unit. Use distance_km / distance_m or add a Distance Unit column.');
  }
  const candidates: ImportCandidate[] = [];
  const errors: string[] = [];
  for (let index = 1; index < rows.length; index++) {
    try {
      const row = rows[index];
      if (row.length !== headers.length) throw new Error(`Expected ${headers.length} columns, found ${row.length}.`);
      const field = (column: number) => column < 0 ? '' : row[column].trim();
      const start = parseStart(field(dateIndex));
      const moving = durationValue(field(movingIndex), 'seconds');
      const seconds = durationValue(field(secondsIndex), 'seconds');
      const minutes = durationValue(field(minutesIndex), 'minutes');
      for (const [column, parsed] of [[movingIndex, moving], [secondsIndex, seconds], [minutesIndex, minutes]] as const) {
        if (field(column) && (parsed === undefined || parsed < 0)) throw new Error('Duration fields must contain valid non-negative seconds, minutes or clock values.');
      }
      const durationMinutes = moving !== undefined && moving > 0 ? moving : seconds !== undefined && seconds > 0 ? seconds : minutes;
      if (durationMinutes === undefined) throw new Error('A valid positive duration is required.');
      let distanceKm: number | null = null;
      let distanceRaw = '';
      if (kilometresIndex >= 0) { distanceRaw = field(kilometresIndex); distanceKm = numeric(distanceRaw) ?? null; }
      else if (metresIndex >= 0) { distanceRaw = field(metresIndex); const metres = numeric(distanceRaw); distanceKm = metres === undefined ? null : metres / 1_000; }
      else if (distanceIndex >= 0) {
        distanceRaw = field(distanceIndex);
        const distance = numeric(distanceRaw);
        const unit = field(distanceUnitIndex).toLowerCase();
        if (distanceRaw && !['m', 'meter', 'meters', 'metre', 'metres', 'km', 'kilometer', 'kilometers', 'kilometre', 'kilometres', 'mi', 'mile', 'miles'].includes(unit)) throw new Error('Distance Unit must be m, km or miles.');
        if (distance !== undefined) distanceKm = /^m(eter|etre|eters|etres)?$/.test(unit) ? distance / 1_000 : /^mi/.test(unit) ? distance * 1.609344 : distance;
      }
      if (distanceRaw && distanceKm === null) throw new Error('Distance is not a valid number.');
      // A legitimate zero-distance indoor workout has no usable distance; duration remains available.
      if (distanceKm === 0) distanceKm = null;
      const originalCalories = numeric(field(caloriesIndex));
      const activeCalories = numeric(field(activeCaloriesIndex));
      if (field(caloriesIndex) && originalCalories === undefined) throw new Error('Calories is not a valid number.');
      if (field(activeCaloriesIndex) && activeCalories === undefined) throw new Error('Active Calories is not a valid number.');
      const type = inferActivityType(field(typeIndex));
      candidates.push(makeImportCandidate({
        date: start.date, startedAt: start.startedAt, type,
        name: field(nameIndex) || `${labels[type]} · ${start.date}`,
        durationMinutes, distanceKm,
        ...(originalCalories !== undefined ? { originalCalories } : {}),
        ...(activeCalories !== undefined ? { activeCalories } : {}),
        source: { provider, format: 'csv', ...(field(idIndex) ? { externalId: field(idIndex) } : {}) },
        warnings: [...(start.timezoneMissing ? ['CSV has no timezone. Check that the date matches your activity.'] : []),
          ...(moving !== undefined && moving > 0 ? [] : ['Using elapsed duration, which can include pauses.'])],
        notes: `Imported ${provider === 'file' ? '' : `${provider} `}CSV summary. ${field(notesIndex)}`.trim(),
      }, bodyWeightKg));
    } catch (error) { errors.push(`Row ${index + 1}: ${error instanceof Error ? error.message : 'Invalid activity.'}`); }
  }
  if (errors.length) throw new Error(`Import not saved: ${errors.length} invalid CSV row${errors.length === 1 ? '' : 's'}. ${errors.slice(0, 10).join(' ')}${errors.length > 10 ? ' Check the remaining rows too.' : ''}`);
  return candidates;
}

/** Local-only import. GPS routes are reduced to summaries and never included in returned data. */
export async function parseActivityFile(file: { name: string; bytes: ArrayBuffer }, bodyWeightKg: number): Promise<ImportCandidate[]> {
  if (!file.bytes.byteLength) throw new Error('The activity file is empty.');
  if (file.bytes.byteLength > MAX_BYTES) throw new Error('Choose a file smaller than 10 MB.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'fit') {
    const { parseFitFile } = await import('./fit-import.ts');
    return parseFitFile(file.bytes, bodyWeightKg, file.name);
  }
  if (!['gpx', 'tcx', 'csv'].includes(extension ?? '')) throw new Error('Choose a GPX, TCX, FIT or CSV activity file. ZIP archives must be extracted first.');
  let decoded: string;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(file.bytes).replace(/^\uFEFF/, ''); }
  catch { throw new Error('The file is not valid UTF-8 text. Export it as UTF-8 or use GPX / TCX / FIT.'); }
  if (extension === 'csv') return parseCsv(decoded, bodyWeightKg, file.name);
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(decoded)) throw new Error('XML document types and entities are not supported. Export a plain GPX or TCX file.');
  const validation = XMLValidator.validate(decoded);
  if (validation !== true) throw new Error(`Malformed XML: ${validation.err.msg}`);
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true });
  const document = object(parser.parse(decoded));
  if (extension === 'gpx') {
    if (!document.gpx) throw new Error('The file does not contain a GPX document.');
    return parseGpx(document, bodyWeightKg, file.name);
  }
  if (!document.TrainingCenterDatabase) throw new Error('The file does not contain a TCX document.');
  return parseTcx(document, bodyWeightKg, file.name);
}

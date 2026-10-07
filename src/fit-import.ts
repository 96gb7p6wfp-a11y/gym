import { Decoder, Stream, type SessionMesg } from '@garmin/fitsdk';
import { inferActivityType, makeImportCandidate } from './activity-import.ts';
import type { ImportCandidate } from './activity-import.ts';

const MAX_FIT_BYTES = 10 * 1024 * 1024;

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function asDate(value: unknown): Date | undefined {
  // The decoder is explicitly configured to return FIT date-times as Date objects.
  return value instanceof Date && Number.isFinite(value.getTime()) ? value : undefined;
}

function sessionCandidate(session: SessionMesg, bodyWeightKg: number, fileName: string): ImportCandidate {
  const warnings: string[] = [];
  let seconds = positiveNumber(session.totalTimerTime);
  if (seconds === undefined) {
    seconds = positiveNumber(session.totalElapsedTime);
    if (seconds === undefined) throw new Error('This FIT session has no valid duration. Export a complete activity file.');
    warnings.push('Timer duration is missing; elapsed time is used and may include pauses.');
  }

  let start = asDate(session.startTime);
  if (!start) {
    const end = asDate(session.timestamp);
    const elapsed = positiveNumber(session.totalElapsedTime);
    if (end && elapsed !== undefined) {
      start = new Date(end.getTime() - elapsed * 1000);
      warnings.push('The start time is estimated from the recorded end time and elapsed duration.');
    }
  }
  if (!start) throw new Error('This FIT session has no valid start time. Export a complete activity file.');

  const sport = typeof session.sport === 'string' ? session.sport : '';
  const type = inferActivityType(sport);
  const names = { run: 'Running', cycle: 'Cycling', walk: 'Walking', swim: 'Swimming', other: 'Imported activity' };
  if (type === 'other') warnings.push('The activity type was not recognised. Check it before importing.');
  const distanceMeters = positiveNumber(session.totalDistance);
  const originalCalories = typeof session.totalCalories === 'number'
    && Number.isFinite(session.totalCalories) && session.totalCalories >= 0 ? session.totalCalories : undefined;

  // Session totals already include their laps/records. Adding those again would double-count.
  // FIT total_calories does not reliably distinguish active from total energy, so it is
  // preserved as source metadata, never as a watch-reported active-calorie override.
  return makeImportCandidate({
    startedAt: start.toISOString(),
    type,
    name: names[type],
    durationMinutes: seconds / 60,
    distanceKm: distanceMeters === undefined ? null : distanceMeters / 1000,
    activeCalories: null,
    originalCalories,
    source: { provider: /adidas|runtastic/i.test(fileName) ? 'adidas' : /strava/i.test(fileName) ? 'strava' : 'file', format: 'fit' },
    warnings,
    notes: `Imported from ${fileName.slice(0, 180)}.`,
  }, bodyWeightKg);
}

/** Decode complete, checksum-valid FIT activity files locally using Garmin's official SDK. */
export async function parseFitFile(bytes: ArrayBuffer, bodyWeightKg: number, fileName: string): Promise<ImportCandidate[]> {
  if (bytes.byteLength > MAX_FIT_BYTES) throw new Error('FIT files must be 10 MB or smaller.');
  if (bytes.byteLength < 14) throw new Error('This is not a complete FIT file.');

  let decoded: ReturnType<Decoder['read']>;
  try {
    const decoder = new Decoder(Stream.fromArrayBuffer(bytes));
    if (!decoder.isFIT()) throw new Error('This file is not a FIT activity file.');
    // The SDK integrity check permits trailing bytes (for concatenated FIT streams),
    // but those bytes would not have been checked by that first-file CRC. A single
    // uploaded activity export must exactly match its advertised header/data/CRC size.
    const header = new DataView(bytes);
    const advertisedSize = header.getUint8(0) + header.getUint32(4, true) + 2;
    if (advertisedSize !== bytes.byteLength) {
      throw new Error('The FIT file is damaged or incomplete (file size mismatch). Export a single activity file again.');
    }
    if (!decoder.checkIntegrity()) throw new Error('The FIT file is damaged or incomplete (checksum or file size mismatch). Export it again.');
    decoded = decoder.read({
      applyScaleAndOffset: true,
      convertTypesToStrings: true,
      convertDateTimesToDates: true,
      expandSubFields: false,
      expandComponents: false,
      mergeHeartRates: false,
      includeUnknownData: false,
    });
  } catch (error) {
    if (error instanceof Error && /FIT/.test(error.message)) throw error;
    throw new Error('The FIT file could not be decoded. Export a complete activity file again.');
  }
  if (decoded.errors.length) throw new Error('The FIT file contains invalid activity data. Export it again.');
  const sessions = decoded.messages.sessionMesgs ?? [];
  if (!sessions.length) throw new Error('No completed activities were found in this FIT file. Choose an activity export, rather than a route or workout plan.');
  if (sessions.length > 500) throw new Error('This FIT file contains too many sessions. Import at most 500 activities at a time.');
  return sessions.map((session) => sessionCandidate(session, bodyWeightKg, fileName));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { Decoder, Encoder, Profile, Stream, type FileIdMesg, type LapMesg, type RecordMesg, type SessionMesg } from '@garmin/fitsdk';
import { parseFitFile } from '../src/fit-import.ts';
import { parseActivityFile } from '../src/activity-import.ts';

const START = new Date('2026-10-06T08:30:00Z');

function activityFile(sessions: SessionMesg[], includeLap = false): ArrayBuffer {
  const encoder = new Encoder();
  const fileId: FileIdMesg = {
    type: 'activity', manufacturer: 'development', product: 1, timeCreated: START,
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  if (includeLap) {
    const lap: LapMesg = {
      startTime: START, totalTimerTime: 1800, totalElapsedTime: 2100,
      totalDistance: 5000, totalCalories: 390,
    };
    encoder.onMesg(Profile.MesgNum.LAP, lap);
    const record: RecordMesg = { timestamp: START, distance: 5000 };
    encoder.onMesg(Profile.MesgNum.RECORD, record);
  }
  for (const session of sessions) encoder.onMesg(Profile.MesgNum.SESSION, session);
  const bytes = encoder.close();
  // Every fixture is a real SDK-encoded binary with a verified CRC, not a mocked decoder.
  assert.equal(new Decoder(Stream.fromByteArray(bytes)).checkIntegrity(), true);
  return Uint8Array.from(bytes).buffer;
}

function running(overrides: Partial<SessionMesg> = {}): SessionMesg {
  return {
    sport: 'running', startTime: START, timestamp: new Date(START.getTime() + 2100_000),
    totalTimerTime: 1800, totalElapsedTime: 2100, totalDistance: 5000, totalCalories: 390,
    ...overrides,
  };
}

test('FIT imports timer duration and distance in app units and preserves ambiguous calories as metadata', async () => {
  const [candidate] = await parseFitFile(activityFile([running()]), 75, 'strava-activity.fit');
  assert.equal(candidate.activity.type, 'run');
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.equal(candidate.activity.distanceKm, 5);
  assert.equal(candidate.activity.bodyWeightKg, 75);
  assert.equal(candidate.activity.watchCalories, null);
  assert.equal(candidate.source.originalCalories, 390);
  assert.equal(candidate.source.startedAt, START.toISOString());
  assert.equal(candidate.source.provider, 'strava');
  assert.equal(candidate.source.format, 'fit');
  assert.ok(candidate.warnings.some((warning) => /calori|energy/i.test(warning)));
});

test('the shared activity entry point dispatches FIT binaries through its lazy decoder', async () => {
  const [candidate] = await parseActivityFile({ name: 'ACTIVITY.FIT', bytes: activityFile([running()]) }, 75);
  assert.equal(candidate.activity.type, 'run');
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.equal(candidate.activity.distanceKm, 5);
  assert.equal(candidate.source.format, 'fit');
});

test('FIT session totals are not summed with laps or cumulative record distance', async () => {
  const [candidate] = await parseFitFile(activityFile([running()], true), 75, 'activity.fit');
  assert.equal(candidate.activity.distanceKm, 5);
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.equal(candidate.source.originalCalories, 390);
});

test('FIT multisport sessions become distinct activities with their own totals', async () => {
  const cyclingStart = new Date('2026-10-06T09:30:00Z');
  const candidates = await parseFitFile(activityFile([
    running(),
    { sport: 'cycling', startTime: cyclingStart, totalTimerTime: 3600, totalElapsedTime: 3660, totalDistance: 25000 },
    { sport: 'swimming', startTime: new Date('2026-10-06T11:00:00Z'), totalTimerTime: 900, totalDistance: 750 },
    { sport: 'walking', startTime: new Date('2026-10-06T12:00:00Z'), totalTimerTime: 1200, totalDistance: 1200 },
  ]), 75, 'adidas-activities.fit');
  assert.deepEqual(candidates.map(({ activity }) => activity.type), ['run', 'cycle', 'swim', 'walk']);
  assert.deepEqual(candidates.map(({ activity }) => activity.distanceKm), [5, 25, 0.75, 1.2]);
  assert.deepEqual(candidates.map(({ activity }) => activity.durationMinutes), [30, 60, 15, 20]);
  assert.equal(candidates[1].source.startedAt, cyclingStart.toISOString());
  assert.equal(new Set(candidates.map(({ source }) => source.fingerprint)).size, 4);
});

test('FIT elapsed-time fallback is visible and does not pretend pauses were removed', async () => {
  const [candidate] = await parseFitFile(activityFile([running({ totalTimerTime: undefined })]), 75, 'activity.fit');
  assert.equal(candidate.activity.durationMinutes, 35);
  assert.ok(candidate.warnings.some((warning) => /elapsed time.*pauses/i.test(warning)));
});

test('FIT missing start uses valid end minus elapsed time with an explicit warning', async () => {
  const [candidate] = await parseFitFile(activityFile([running({ startTime: undefined })]), 75, 'activity.fit');
  assert.equal(candidate.source.startedAt, START.toISOString());
  assert.ok(candidate.warnings.some((warning) => /start time is estimated/i.test(warning)));
});

test('FIT re-export file names do not change the duplicate fingerprint', async () => {
  const bytes = activityFile([running()]);
  const [first] = await parseFitFile(bytes, 75, 'strava-export.fit');
  const [second] = await parseFitFile(bytes, 82, 'renamed.fit');
  assert.equal(first.source.fingerprint, second.source.fingerprint);
});

test('FIT unsupported sports remain editable other activities with a warning', async () => {
  const [candidate] = await parseFitFile(activityFile([running({ sport: 'rowing' })]), 75, 'activity.fit');
  assert.equal(candidate.activity.type, 'other');
  assert.ok(candidate.warnings.some((warning) => /type.*not recognised/i.test(warning)));
});

test('FIT unknown or zero distance remains absent rather than inventing a route distance', async () => {
  const [candidate] = await parseFitFile(activityFile([running({ totalDistance: 0, totalCalories: undefined })]), 75, 'activity.fit');
  assert.equal(candidate.activity.distanceKm, null);
  assert.equal(candidate.source.originalCalories, undefined);
  assert.equal(candidate.activity.watchCalories, null);
});

test('FIT non-activity files containing no completed sessions are rejected', async () => {
  await assert.rejects(parseFitFile(activityFile([]), 75, 'route.fit'), /No completed activities/);
});

test('FIT corrupt data CRC is rejected before decoding, never bypassed', async () => {
  const corrupted = new Uint8Array(activityFile([running()]));
  corrupted[corrupted.length - 1] ^= 1;
  await assert.rejects(parseFitFile(corrupted.buffer, 75, 'activity.fit'), /checksum|damaged/i);
});

test('FIT truncation and unadvertised trailing data fail integrity validation', async () => {
  const bytes = new Uint8Array(activityFile([running()]));
  await assert.rejects(parseFitFile(bytes.slice(0, -5).buffer, 75, 'activity.fit'), /incomplete|size mismatch/i);
  const trailing = new Uint8Array(bytes.length + 1);
  trailing.set(bytes);
  await assert.rejects(parseFitFile(trailing.buffer, 75, 'activity.fit'), /size mismatch/i);
});

test('FIT invalid header, empty and oversized input are rejected', async () => {
  const wrongHeader = new Uint8Array(activityFile([running()]));
  wrongHeader[8] = 0;
  await assert.rejects(parseFitFile(wrongHeader.buffer, 75, 'activity.fit'), /not.*FIT/i);
  await assert.rejects(parseFitFile(new ArrayBuffer(0), 75, 'empty.fit'), /complete FIT/i);
  await assert.rejects(parseFitFile(new ArrayBuffer(10 * 1024 * 1024 + 1), 75, 'large.fit'), /10 MB/i);
});

test('FIT sessions without usable times are rejected rather than stored with invented values', async () => {
  await assert.rejects(parseFitFile(activityFile([running({ totalTimerTime: undefined, totalElapsedTime: undefined })]), 75, 'activity.fit'), /valid duration/i);
  await assert.rejects(parseFitFile(activityFile([running({ startTime: undefined, timestamp: undefined })]), 75, 'activity.fit'), /valid start time/i);
});

test('FIT import validates body weight and app activity duration limits', async () => {
  await assert.rejects(parseFitFile(activityFile([running()]), 0, 'activity.fit'));
  await assert.rejects(parseFitFile(activityFile([running({ totalTimerTime: 60 * 601 })]), 75, 'activity.fit'));
});

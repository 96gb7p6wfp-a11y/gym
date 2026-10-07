import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activityFingerprint, findDuplicateActivity, findPossibleDuplicateActivity,
  inferActivityType, makeImportCandidate, parseActivityFile,
} from '../src/activity-import.ts';
import type { ActivityRecord } from '../src/activities.ts';

function file(name: string, text: string): { name: string; bytes: ArrayBuffer } {
  const encoded = new TextEncoder().encode(text);
  return { name, bytes: encoded.buffer as ArrayBuffer };
}

const gpxTrack = (name = '5 km run', seconds = 1_800, latitude = 0) => `<trk><name>${name}</name><type>Running</type><trkseg>
  <trkpt lat="${latitude}" lon="0"><time>2026-10-07T10:00:00Z</time></trkpt>
  <trkpt lat="${latitude}" lon="0.04496608"><time>2026-10-07T10:${String(Math.floor(seconds / 60)).padStart(2, '0')}:00Z</time></trkpt>
  </trkseg></trk>`;
const tcxLap = (distance: number, duration: number, points = '') => `<Lap StartTime="2026-10-07T10:00:00Z"><TotalTimeSeconds>${duration}</TotalTimeSeconds><DistanceMeters>${distance}</DistanceMeters><Calories>125</Calories><Track>${points}</Track></Lap>`;

test('GPX measures a run locally from GPS and retains no route or coordinates', async () => {
  const [candidate] = await parseActivityFile(file('adidas-run.gpx', `<gpx creator="runtastic">${gpxTrack()}</gpx>`), 80);
  assert.equal(candidate.activity.type, 'run');
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.ok(Math.abs(candidate.activity.distanceKm! - 5) < 0.01);
  assert.equal(candidate.activity.bodyWeightKg, 80);
  assert.equal(candidate.activity.watchCalories, null);
  assert.equal(candidate.source.provider, 'adidas');
  assert.equal(candidate.source.startedAt, '2026-10-07T10:00:00.000Z');
  assert.match(candidate.warnings.join(' '), /elapsed time.*pauses/);
  assert.doesNotMatch(JSON.stringify(candidate), /04496608|trkpt|latitude|longitude/);
});

test('GPX namespaces, multiple tracks and segment boundaries do not create imaginary connecting distance', async () => {
  const xml = `<g:gpx xmlns:g="urn:gpx" creator="Strava"><g:trk><g:name>Morning Ride</g:name><g:type>Cycling</g:type>
  <g:trkseg><g:trkpt lat="0" lon="0"><g:time>2026-10-07T10:00:00Z</g:time></g:trkpt><g:trkpt lat="0" lon="0.01"><g:time>2026-10-07T10:10:00Z</g:time></g:trkpt></g:trkseg>
  <g:trkseg><g:trkpt lat="45" lon="10"><g:time>2026-10-07T10:20:00Z</g:time></g:trkpt><g:trkpt lat="45" lon="10.01"><g:time>2026-10-07T10:30:00Z</g:time></g:trkpt></g:trkseg></g:trk>
  ${gpxTrack('Evening run').replaceAll('<trk', '<g:trk').replaceAll('</trk', '</g:trk').replaceAll('<name>', '<g:name>').replaceAll('</name>', '</g:name>').replaceAll('<type>', '<g:type>').replaceAll('</type>', '</g:type>').replaceAll('<time>', '<g:time>').replaceAll('</time>', '</g:time>')}</g:gpx>`;
  const candidates = await parseActivityFile(file('export.gpx', xml), 75);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].activity.type, 'cycle');
  assert.ok(candidates[0].activity.distanceKm! > 1.8 && candidates[0].activity.distanceKm! < 2);
  assert.equal(candidates[0].source.provider, 'strava');
});

test('GPX explicit distance is preferred and ambiguous total calories do not become active calories', async () => {
  const xml = `<gpx>${gpxTrack().replace('</trk>', '<extensions><DistanceMeters>5100</DistanceMeters><Calories>450</Calories></extensions></trk>')}</gpx>`;
  const [candidate] = await parseActivityFile(file('run.gpx', xml), 80);
  assert.equal(candidate.activity.distanceKm, 5.1);
  assert.equal(candidate.source.originalCalories, 450);
  assert.equal(candidate.activity.watchCalories, null);
  assert.match(candidate.warnings.join(' '), /active versus total/);
});

test('GPX declared sport takes priority over an ambiguous workout title', async () => {
  const [candidate] = await parseActivityFile(file('commute.gpx', `<gpx>${gpxTrack('Run to the shops').replace('<type>Running</type>', '<type>Cycling</type>')}</gpx>`), 80);
  assert.equal(candidate.activity.type, 'cycle');
});

test('GPS imports reject malformed coordinates and summary values instead of silently dropping them', async () => {
  for (const replacement of ['lat="bad"', 'lat=""', 'lat="NaN"']) {
    await assert.rejects(parseActivityFile(file('run.gpx', `<gpx>${gpxTrack().replace('lat="0"', replacement)}</gpx>`), 80), /invalid coordinates/);
  }
  await assert.rejects(parseActivityFile(file('run.gpx', `<gpx>${gpxTrack().replace('lat="0" lon="0"', '')}</gpx>`), 80), /require valid latitude/);
  await assert.rejects(parseActivityFile(file('run.gpx', `<gpx>${gpxTrack().replace('</trk>', '<extensions><DistanceMeters>invalid</DistanceMeters></extensions></trk>')}</gpx>`), 80), /DistanceMeters must be/);
  await assert.rejects(parseActivityFile(file('run.tcx', `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-10-07T10:00:00Z</Id>${tcxLap(5_000, -60)}</Activity></Activities></TrainingCenterDatabase>`), 80), /Lap duration must be/);
});

test('TCX sums declared lap duration/distance once, not lap plus cumulative trackpoint distance', async () => {
  const points = '<Trackpoint><DistanceMeters>0</DistanceMeters></Trackpoint><Trackpoint><DistanceMeters>2500</DistanceMeters></Trackpoint>';
  const [candidate] = await parseActivityFile(file('strava.tcx', `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-10-07T10:00:00Z</Id>${tcxLap(2500, 900, points)}${tcxLap(2500, 900, points.replace('>0<', '>2500<').replace('>2500<', '>5000<'))}</Activity></Activities></TrainingCenterDatabase>`), 80);
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.equal(candidate.activity.distanceKm, 5);
  assert.equal(candidate.source.originalCalories, 250);
  assert.equal(candidate.activity.watchCalories, null);
  assert.equal(candidate.source.externalId, '2026-10-07T10:00:00Z');
});

test('TCX namespaced cumulative distance and elapsed fallback work without lap totals', async () => {
  const [candidate] = await parseActivityFile(file('bike.tcx', `<t:TrainingCenterDatabase xmlns:t="urn:tcx"><t:Activities><t:Activity Sport="Biking"><t:Id>2026-10-07T10:00:00Z</t:Id><t:Lap><t:Track>
  <t:Trackpoint><t:Time>2026-10-07T10:00:00Z</t:Time><t:DistanceMeters>0</t:DistanceMeters></t:Trackpoint>
  <t:Trackpoint><t:Time>2026-10-07T10:15:00Z</t:Time><t:DistanceMeters>5000</t:DistanceMeters></t:Trackpoint>
  <t:Trackpoint><t:Time>2026-10-07T10:30:00Z</t:Time><t:DistanceMeters>10000</t:DistanceMeters></t:Trackpoint>
  </t:Track></t:Lap></t:Activity></t:Activities></t:TrainingCenterDatabase>`), 70);
  assert.equal(candidate.activity.type, 'cycle');
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.equal(candidate.activity.distanceKm, 10);
  assert.match(candidate.warnings.join(' '), /elapsed.*pauses/);
});

test('Strava CSV handles BOM, duplicate export headers, quoted commas, multiline notes and moving seconds', async () => {
  const csv = '\uFEFFActivity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Activity Description,Moving Time,Distance,Calories\r\n123,"Oct 7, 2026, 10:00:00 AM","Run, by the river",Run,2100,5.2,"Line one\nLine two ""easy""",1800,5200,400\r\n';
  const [candidate] = await parseActivityFile(file('activities.csv', csv), 80);
  assert.equal(candidate.activity.name, 'Run, by the river');
  assert.equal(candidate.activity.durationMinutes, 30);
  assert.equal(candidate.activity.distanceKm, 5.2);
  assert.equal(candidate.source.provider, 'strava');
  assert.equal(candidate.source.externalId, '123');
  assert.match(candidate.activity.notes, /Line one\nLine two "easy"/);
  assert.match(candidate.warnings.join(' '), /no timezone/);
  assert.equal(candidate.activity.watchCalories, null);
});

test('generic CSV requires explicit distance/duration units and converts miles, metres and clock values', async () => {
  const candidates = await parseActivityFile(file('adidas.csv', 'date,type,name,Duration (s),Distance,Distance Unit\n2026-10-07,Running,Park,00:30:00,3.1,miles\n2026-10-08,Biking,Bike,3600,20000,m\n'), 80);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].activity.durationMinutes, 30);
  assert.ok(Math.abs(candidates[0].activity.distanceKm! - 4.9889664) < 0.00001);
  assert.equal(candidates[1].activity.distanceKm, 20);
  await assert.rejects(parseActivityFile(file('export.csv', 'date,type,duration_minutes,Distance\n2026-10-07,Run,30,5'), 80), /Distance has no unit/);
  await assert.rejects(parseActivityFile(file('export.csv', 'date,type,Duration,distance_km\n2026-10-07,Run,30,5'), 80), /Include the unit/);
});

test('only a specifically labelled active-calorie field becomes a watch reading', async () => {
  const [candidate] = await parseActivityFile(file('export.csv', 'date,type,duration_minutes,distance_km,Calories,Active Calories\n2026-10-07,Run,30,5,500,400'), 80);
  assert.equal(candidate.activity.watchCalories, 400);
  assert.equal(candidate.source.originalCalories, 500);
  assert.doesNotMatch(candidate.warnings.join(' '), /active versus total/);
});

test('invalid CSV rows are reported together with their row numbers and never partially returned', async () => {
  await assert.rejects(parseActivityFile(file('export.csv', 'date,type,duration_minutes,distance_km\n2026-10-07,Run,30,5\n2026-02-30,Run,20,3\n2026-10-07,Run,601,5\n2026-10-07,Bike,30,301'), 80), /3 invalid CSV rows.*Row 3:.*Row 4:.*Row 5:/);
});

test('CSV malformed explicit moving duration does not silently fall back to elapsed duration', async () => {
  await assert.rejects(parseActivityFile(file('export.csv', 'date,type,Moving Time,Elapsed Time,distance_km\n2026-10-07,Run,invalid,1800,5'), 80), /Duration fields must contain/);
});

test('unknown sports stay Other with a review warning, never guessed to be running', async () => {
  const [candidate] = await parseActivityFile(file('run.csv', 'date,type,duration_minutes,distance_km\n2026-10-07,Rowing,30,'), 80);
  assert.equal(candidate.activity.type, 'other');
  assert.equal(candidate.activity.distanceKm, null);
  assert.match(candidate.warnings.join(' '), /not recognised.*correct type/);
  assert.equal(inferActivityType('VirtualRun'), 'run');
  assert.equal(inferActivityType('EBikeRide'), 'cycle');
});

test('dates honor the device timezone and explicit offsets while invalid dates/times are rejected', async () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
  try {
    const [candidate] = await parseActivityFile(file('export.csv', 'date,type,duration_minutes\n2026-10-06T23:30:00Z,Run,30'), 80);
    assert.equal(candidate.activity.date, '2026-10-07');
    assert.equal(candidate.source.startedAt, '2026-10-06T23:30:00.000Z');
    const [local] = await parseActivityFile(file('export.csv', 'date,type,duration_minutes\n"Oct 7, 2026, 12:30:00 AM",Run,30'), 80);
    assert.equal(local.activity.date, '2026-10-07');
    assert.match(local.warnings.join(' '), /no timezone/);
    for (const date of ['2026-02-30T10:00:00Z', '2026-10-07T24:00:00Z', '2026-10-07T10:99:00Z', 'yesterday', '']) {
      await assert.rejects(parseActivityFile(file('export.csv', `date,type,duration_minutes\n${date},Run,30`), 80), /Row 2/);
    }
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test('fingerprint tolerates export float noise and strict duplicates require import provenance', () => {
  const first = makeImportCandidate({ startedAt: '2026-10-07T10:00:10Z', type: 'run', name: 'Run', durationMinutes: 30, distanceKm: 5.001, source: { provider: 'strava', format: 'gpx' } }, 80);
  const second = makeImportCandidate({ startedAt: '2026-10-07T10:00:11Z', type: 'run', name: 'Different name', durationMinutes: 30.002, distanceKm: 5.004, source: { provider: 'file', format: 'tcx' } }, 80);
  const record: ActivityRecord = { activity: { ...first.activity, importSource: first.source }, version: 1 };
  assert.equal(first.source.fingerprint, second.source.fingerprint);
  assert.equal(findDuplicateActivity(second, [record]), record);
  const manual = { activity: first.activity, version: 1 };
  assert.equal(findDuplicateActivity(second, [manual]), undefined);
  assert.equal(findPossibleDuplicateActivity(second, [manual]), manual);
  assert.equal(activityFingerprint(undefined, 'run', 30, null, '2026-10-07'), 'v1:2026-10-07|run|30|-');
});

test('provider external IDs and deleted imports prevent a duplicate reimport', () => {
  const source = { provider: 'strava' as const, format: 'csv' as const, externalId: '123' };
  const first = makeImportCandidate({ date: '2026-10-07', type: 'run', name: 'Run', durationMinutes: 30, distanceKm: 5, source }, 80);
  const second = makeImportCandidate({ date: '2026-10-08', type: 'run', name: 'Edited run', durationMinutes: 35, distanceKm: 5.2, source }, 80);
  const deleted = { activity: { ...first.activity, deletedAt: Date.now(), importSource: first.source }, version: 1 };
  assert.equal(findDuplicateActivity(second, [deleted]), deleted);
});

test('cross-format imports with the same start time match despite elapsed versus moving totals', () => {
  const first = makeImportCandidate({ startedAt: '2026-10-07T10:00:10Z', type: 'run', name: 'Run', durationMinutes: 30, distanceKm: 5, source: { provider: 'strava', format: 'csv' } }, 80);
  const second = makeImportCandidate({ startedAt: '2026-10-07T12:00:10+02:00', type: 'run', name: 'Run', durationMinutes: 35, distanceKm: 5.1, source: { provider: 'file', format: 'gpx' } }, 80);
  const deleted: ActivityRecord = { activity: { ...first.activity, importSource: first.source, deletedAt: Date.now() }, version: 1 };
  assert.notEqual(first.source.fingerprint, second.source.fingerprint);
  assert.equal(findDuplicateActivity(second, [deleted]), deleted);
  const later = makeImportCandidate({ startedAt: '2026-10-07T10:00:30Z', type: 'run', name: 'Other run', durationMinutes: 35, distanceKm: 5.1, source: { provider: 'file', format: 'gpx' } }, 80);
  assert.equal(findDuplicateActivity(later, [deleted]), undefined);
  const cycle = makeImportCandidate({ startedAt: '2026-10-07T10:00:10Z', type: 'cycle', name: 'Ride', durationMinutes: 35, distanceKm: 5.1, source: { provider: 'file', format: 'gpx' } }, 80);
  assert.equal(findDuplicateActivity(cycle, [deleted]), undefined);
});

test('deleted manual summaries remain possible matches for review rather than blocked imported duplicates', () => {
  const candidate = makeImportCandidate({ date: '2026-10-07', type: 'run', name: 'Run', durationMinutes: 30, distanceKm: 5, source: { provider: 'file', format: 'gpx' } }, 80);
  const deleted: ActivityRecord = { activity: { ...candidate.activity, deletedAt: Date.now() }, version: 1 };
  assert.equal(findDuplicateActivity(candidate, [deleted]), undefined);
  assert.equal(findPossibleDuplicateActivity(candidate, [deleted]), deleted);
});

test('timezone-free GPS timestamps explicitly warn that the imported date needs review', async () => {
  const [gpx] = await parseActivityFile(file('run.gpx', `<gpx>${gpxTrack().replaceAll('00Z', '00')}</gpx>`), 80);
  assert.match(gpx.warnings.join(' '), /no timezone/);
  const [tcx] = await parseActivityFile(file('run.tcx', `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-10-07T10:00:00</Id>${tcxLap(5_000, 1_800)}</Activity></Activities></TrainingCenterDatabase>`), 80);
  assert.match(tcx.warnings.join(' '), /no timezone/);
});

test('XML declarations/entities, malformed XML, invalid coordinates and out-of-order timestamps are rejected', async () => {
  await assert.rejects(parseActivityFile(file('bad.gpx', '<!DOCTYPE gpx [<!ENTITY data SYSTEM "file:///secret">]><gpx/>'), 80), /entities are not supported/);
  await assert.rejects(parseActivityFile(file('bad.gpx', '<gpx><trk></gpx>'), 80), /Malformed XML/);
  await assert.rejects(parseActivityFile(file('bad.gpx', `<gpx>${gpxTrack().replace('lat="0"', 'lat="100"')}</gpx>`), 80), /invalid coordinates/);
  await assert.rejects(parseActivityFile(file('bad.gpx', `<gpx>${gpxTrack().replace('10:30:00', '09:30:00')}</gpx>`), 80), /out of order/);
  await assert.rejects(parseActivityFile(file('route.gpx', '<gpx><rte><name>Planned route</name></rte></gpx>'), 80), /Routes without workout timestamps/);
});

test('empty, unsupported, oversized, non-UTF8 and record-heavy imports fail visibly', async () => {
  await assert.rejects(parseActivityFile(file('empty.gpx', ''), 80), /empty/);
  await assert.rejects(parseActivityFile(file('archive.zip', 'zip'), 80), /ZIP archives must be extracted/);
  await assert.rejects(parseActivityFile({ name: 'export.csv', bytes: new ArrayBuffer(10 * 1024 * 1024 + 1) }, 80), /smaller than 10 MB/);
  await assert.rejects(parseActivityFile({ name: 'export.csv', bytes: new Uint8Array([0xff]).buffer }, 80), /not valid UTF-8/);
  await assert.rejects(parseActivityFile(file('export.csv', 'date,duration_minutes\n' + '2026-10-07,30\n'.repeat(1_001)), 80), /no more than 1,000/);
  await assert.rejects(parseActivityFile(file('export.csv', 'date,duration_minutes,name\n2026-10-07,30,"unfinished'), 80), /unfinished quoted/);
});

test('duration and distance guards remain enforced for parsed summaries and shared FIT inputs', () => {
  const base = { date: '2026-10-07', type: 'run' as const, name: 'Run', durationMinutes: 30, distanceKm: 5, source: { provider: 'file' as const, format: 'fit' as const } };
  for (const durationMinutes of [0, 0.5, 601, NaN, Infinity]) assert.throws(() => makeImportCandidate({ ...base, durationMinutes }, 80), /Duration/);
  for (const distanceKm of [-1, 0, 301, NaN, Infinity]) assert.throws(() => makeImportCandidate({ ...base, distanceKm }, 80), /Distance/);
  assert.throws(() => makeImportCandidate({ ...base, originalCalories: -1 }, 80), /calories/);
  assert.throws(() => makeImportCandidate({ ...base, source: { ...base.source, externalId: 'x'.repeat(121) } }, 80), /activity ID/);
});

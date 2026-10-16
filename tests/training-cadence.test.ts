import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { getTrainingCadence } from '../src/training-cadence.ts';
import { getTrendCoordinates } from '../src/progress-chart.ts';

function session(date: string, kind: 'strength' | 'sport' | 'recovery' = 'strength') {
  const started = createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []);
  return SessionSchema.parse({
    ...stopSessionTimers(started, 'completed', started.startedAt + 1000), kind,
    name: kind === 'sport' ? 'Volleyball' : 'Training',
  });
}

test('weekly cadence counts unique completed gym dates and allows a shifted workout day', () => {
  const monday = session('2026-10-12');
  const saturday = session('2026-10-17');
  const result = getTrainingCadence({ sessions: [monday, { ...monday, id: crypto.randomUUID() }, saturday], plan: DEFAULT_PROFILE.plan, today: '2026-10-18' });
  assert.deepEqual(result.completedGymDates, ['2026-10-12', '2026-10-17']);
  assert.equal(result.completedGymDays, 2);
  assert.equal(result.plannedGymDays, 4);
  assert.equal(result.days[5].kind, 'recovery');
  assert.equal(result.days[5].status, 'complete', 'training on a shifted recovery day remains recorded');
});

test('cadence excludes active, deleted, future and other-week logs without turning recovery into a broken streak', () => {
  const active = { ...session('2026-10-12'), status: 'active' as const };
  const deleted = { ...session('2026-10-14'), deletedAt: Date.now() };
  const result = getTrainingCadence({ sessions: [active, deleted, session('2026-10-18'), session('2026-10-05')], plan: DEFAULT_PROFILE.plan, today: '2026-10-16' });
  assert.equal(result.completedGymDays, 0);
  assert.equal(result.days[5].status, 'recovery');
  assert.equal(result.days[6].status, 'future');
  assert.equal(result.days[4].isToday, true);
  assert.ok(result.days.every(day => !['missed', 'failed'].includes(day.status)));
});

test('sport and gym stay separate and optional extras do not inflate the recommended gym target', () => {
  const plan = structuredClone(DEFAULT_PROFILE.plan);
  plan[1].extraSession = { ...plan[0], name: 'Extra Upper' };
  const result = getTrainingCadence({ sessions: [session('2026-10-13', 'sport'), session('2026-10-13')], plan, today: '2026-10-16' });
  assert.equal(result.plannedGymDays, 4);
  assert.equal(result.completedGymDays, 1);
  assert.equal(result.volleyballDays, 1);
  assert.equal(result.recordedActivityDays, 1);
  assert.equal(result.days[1].hasGym, true);
});

test('an optional technique primer records activity without crediting an entire gym day', () => {
  const primer = { ...session('2026-10-13'), name: '  Jump   Technique Primer  ' };
  const onlyPrimer = getTrainingCadence({ sessions: [primer], plan: DEFAULT_PROFILE.plan, today: '2026-10-16' });
  assert.equal(onlyPrimer.plannedGymDays, 4);
  assert.equal(onlyPrimer.completedGymDays, 0);
  assert.equal(onlyPrimer.recordedActivityDays, 1);
  assert.equal(onlyPrimer.days[1].hasActivity, true);
  const extraUpper = getTrainingCadence({ sessions: [primer, { ...session('2026-10-13'), name: 'Extra Upper' }], plan: DEFAULT_PROFILE.plan, today: '2026-10-16' });
  assert.equal(extraUpper.completedGymDays, 1);
  const plan = structuredClone(DEFAULT_PROFILE.plan);
  plan[0].name = 'Jump Technique Primer';
  assert.equal(getTrainingCadence({ sessions: [primer], plan, today: '2026-10-16' }).completedGymDays, 1, 'a deliberately planned primary session takes precedence');
});

test('calendar-based cadence stays correct across a daylight-saving boundary and a selected prior week', () => {
  const result = getTrainingCadence({ sessions: [session('2026-10-25')], plan: DEFAULT_PROFILE.plan, today: '2026-11-02', weekStart: '2026-10-25' });
  assert.equal(result.weekStart, '2026-10-19');
  assert.deepEqual(result.dates, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.equal(result.completedGymDays, 1);
});

test('progress charts space real observations by calendar date instead of inventing equal gaps', () => {
  const result = getTrendCoordinates([{ date: '2026-10-01', value: 60 }, { date: '2026-10-02', value: 61 }, { date: '2026-10-11', value: 62 }], 120, 80, 10);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(point => point.x), [10, 20, 110]);
  assert.equal(result[0].y, 70);
  assert.equal(result[2].y, 10);
  assert.deepEqual(getTrendCoordinates([], 120, 80), []);
});

test('constant and single recorded values stay finite and horizontal without an artificial upward trend', () => {
  const result = getTrendCoordinates([{ date: '2026-10-01', value: 64 }, { date: '2026-10-11', value: 64 }], 120, 80, 10);
  assert.deepEqual(result.map(point => point.y), [40, 40]);
  const single = getTrendCoordinates([{ date: '2026-10-01', value: 64 }], 120, 80, 10);
  assert.equal(single[0].x, 60);
  assert.equal(single[0].y, 40);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { berlinDate, calendarDayIndex } from '../src/calendar-date.ts';

test('Berlin days change at local midnight in summer and winter', () => {
  assert.equal(berlinDate(new Date('2026-10-22T21:59:59Z')), '2026-10-22');
  assert.equal(berlinDate(new Date('2026-10-22T22:00:00Z')), '2026-10-23');
  assert.equal(berlinDate(new Date('2026-10-31T22:59:59Z')), '2026-10-31');
  assert.equal(berlinDate(new Date('2026-10-31T23:00:00Z')), '2026-11-01');
  assert.equal(berlinDate(Date.parse('2026-12-31T23:00:00Z')), '2027-01-01');
});

test('DST clock changes keep the Berlin calendar day and weekday stable', () => {
  for (const instant of ['2026-03-29T00:59:59Z', '2026-03-29T01:00:00Z']) {
    assert.equal(berlinDate(new Date(instant)), '2026-03-29');
  }
  for (const instant of ['2026-10-25T00:59:59Z', '2026-10-25T01:00:00Z']) {
    assert.equal(berlinDate(new Date(instant)), '2026-10-25');
  }
  assert.equal(calendarDayIndex('2026-10-22'), 3);
  assert.equal(calendarDayIndex('2026-10-24'), 5);
  assert.equal(calendarDayIndex('2026-11-01'), 6);
  assert.equal(calendarDayIndex('2027-02-01'), 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkoutHistory, indexWorkoutHistory, searchWorkoutHistory } from '../src/history-search.ts';
import { performanceFixture } from './v16-performance-fixture.ts';

test('history searches saved names, dates, exercise and equipment without changing original records or order', () => {
  const records = [
    { id:'new', date:'2026-11-02', name:'Upper B — Athletic Physique + Spike Power', exercises:[{ name:'Chest Press', equipmentLabel:'Technogym' }] },
    { id:'middle', date:'2026-10-30', name:'Full Body', exercises:[{ name:'Dumbbell Row' }] },
    { id:'old', date:'2026-10-28', name:'Strength café', exercises:[{ name:'Chest Press', equipmentLabel:'Matrix' }] },
  ];
  const original = structuredClone(records);
  assert.deepEqual(searchWorkoutHistory(records, 'CHEST 2026'), [records[0],records[2]]);
  assert.deepEqual(searchWorkoutHistory(records, 'press technogym'), [records[0]]);
  assert.deepEqual(searchWorkoutHistory(records, 'cafe'), [records[2]]);
  assert.deepEqual(searchWorkoutHistory(records, '  '), records);
  assert.deepEqual(searchWorkoutHistory(records, 'squat'), []);
  assert.deepEqual(filterWorkoutHistory(indexWorkoutHistory(records), '2026-10-30 row'), [records[1]]);
  assert.deepEqual(records, original);
  assert.equal(searchWorkoutHistory(records, 'matrix')[0],records[2]);
});

test('a cached history index handles 10,000 completed sets without dropping matching older records', () => {
  const records = Array.from({ length:500 },(_,index) => ({ id:`history-${index}`, date:'2026-10-19', name:index === 499 ? 'Older targeted workout' : 'Gym workout',
    exercises:Array.from({ length:5 },() => ({ name:'Chest Press' })), completedSets:20 }));
  const index = indexWorkoutHistory(records);
  assert.equal(records.reduce((sum,record) => sum+record.completedSets,0),10_000);
  assert.equal(filterWorkoutHistory(index,'targeted')[0],records[499]);
  assert.equal(filterWorkoutHistory(index,'press').length,500);
});

test('stress fixtures contain the requested completed sets and keep a distinct unfinished snapshot on the app calendar', () => {
  for (const completedSets of [1000,5000,10000] as const) {
    const fixture = performanceFixture(completedSets,new Date('2026-11-03T23:30:00Z'));
    assert.equal(fixture.today,'2026-11-04');
    const completed = fixture.state.sessions.filter(record => record.session.status === 'completed');
    assert.equal(completed.length,completedSets/20);
    assert.equal(completed.reduce((count,record) => count+record.session.exercises.reduce((sets,exercise) => sets+exercise.logs.filter(log => log.done).length,0),0),completedSets);
    const active = fixture.state.sessions.filter(record => record.session.status === 'active');
    assert.equal(active.length,1);
    assert.equal(active[0].session.id,fixture.activeId);
    assert.equal(active[0].session.exercises.flatMap(exercise => exercise.logs).some(log => log.done),false);
  }
});

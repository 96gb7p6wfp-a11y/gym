import assert from 'node:assert/strict';
import test from 'node:test';
import { ReactionCueSequence, type ReactionDirection } from '../src/reaction-cues.ts';

function fixture(randomValues = [.1, .1, .9, .8, .3, .6, .7, .2]) {
  const pending = new Map<number, () => void>();
  const delays: number[] = [], cues: { direction: ReactionDirection; count: number }[] = [];
  let next = 0, sample = 0, finishes = 0;
  const sequence = new ReactionCueSequence({
    schedule(callback, delay) { pending.set(++next, callback); delays.push(delay); return next; },
    cancel(id) { pending.delete(id as number); },
  }, (direction, count) => cues.push({ direction, count }), () => { finishes += 1; },
  () => randomValues[sample++ % randomValues.length]);
  function tick() {
    const entry = pending.entries().next().value;
    assert.ok(entry, 'one next cue is scheduled');
    pending.delete(entry[0]); entry[1]();
  }
  return { sequence, pending, delays, cues, tick, finishes: () => finishes };
}

test('reaction practice has exactly four independently sampled directions with bounded waits and no duplicate start', () => {
  const run = fixture();
  assert.equal(run.sequence.start(), true);
  assert.equal(run.sequence.start(), false);
  assert.equal(run.pending.size, 1);
  for (let index = 0; index < 4; index++) run.tick();
  assert.deepEqual(run.cues, [
    { direction: 'Left', count: 1 }, { direction: 'Right', count: 2 },
    { direction: 'Right', count: 3 }, { direction: 'Left', count: 4 },
  ]);
  assert.ok(run.delays.every(delay => delay >= 2000 && delay < 4000));
  assert.equal(run.finishes(), 1);
  assert.equal(run.pending.size, 0);
  assert.equal(run.sequence.stop(), false);
});

test('stop cancels the scheduled cue and stale callbacks cannot resume a stopped or restarted sequence', () => {
  const run = fixture();
  run.sequence.start(); run.tick();
  const stale = run.pending.values().next().value!;
  assert.equal(run.sequence.stop(), true);
  assert.equal(run.pending.size, 0);
  stale();
  assert.equal(run.cues.length, 1);
  assert.equal(run.finishes(), 0);
  assert.equal(run.sequence.start(), true);
  stale();
  assert.equal(run.cues.length, 1, 'a callback from the previous run cannot write into a new run');
  run.tick();
  assert.equal(run.cues[1].count, 1, 'a deliberate new run starts its own cue counter');
  run.sequence.stop();
  assert.equal(run.pending.size, 0);
});

test('a cancellation while delivering a direction cannot enqueue more cues or claim completion', () => {
  let scheduled: (() => void) | undefined, finishes = 0, cancellations = 0;
  const sequence = new ReactionCueSequence({
    schedule(callback) { scheduled = callback; return 1; },
    cancel() { cancellations += 1; },
  }, () => { sequence.stop(); }, () => { finishes += 1; }, () => .5);
  sequence.start();
  const callback = scheduled!; scheduled = undefined;
  callback();
  assert.equal(scheduled, undefined);
  assert.equal(finishes, 0);
  assert.equal(cancellations, 0, 'the fired timer was already removed before cancellation');
});

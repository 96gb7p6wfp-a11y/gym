import test from 'node:test';
import assert from 'node:assert/strict';
import { RestAlertTimer, RestChime, createRestChimeSamples, type RestCompletion } from '../src/rest-audio.ts';

function harness() {
  let now = 1_000;
  let visible = true;
  let count = 0;
  let sequence = 0;
  const pending = new Map<number, { due: number; fn: () => void }>();
  const completed: RestCompletion[] = [];
  const timer = new RestAlertTimer({
    now: () => now, visible: () => visible,
    schedule: (fn, delay) => { const id = ++sequence; pending.set(id, { due: now + delay, fn }); return id; },
    cancel: handle => { pending.delete(handle as number); },
    play: async () => { count += 1; return true; },
    onComplete: result => completed.push(result),
  });
  return {
    timer, completed, pending,
    count: () => count,
    advance: async (milliseconds: number) => {
      now += milliseconds;
      for (const [id, job] of [...pending]) if (job.due <= now) { pending.delete(id); job.fn(); }
      await Promise.resolve(); await Promise.resolve();
    },
    visibility: (next: boolean) => { visible = next; timer.visibilityChanged(); },
  };
}

test('rest deadline alerts once, even when the browser executes its callback late', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  await h.advance(4_999);
  assert.equal(h.count(), 0);
  await h.advance(800);
  assert.equal(h.count(), 1);
  assert.deepEqual(h.completed, [{ audible: true, resumed: false }]);
  h.timer.update(6_000, true);
  h.timer.visibilityChanged();
  await h.advance(20_000);
  assert.equal(h.count(), 1);
  assert.equal(h.completed.length, 1);
});

test('skip rest cancels a pending sound and a later timer gets its own alert', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.update(null, true);
  assert.equal(h.pending.size, 0);
  await h.advance(10_000);
  assert.equal(h.count(), 0);
  assert.equal(h.completed.length, 0);
  h.timer.update(12_000, true);
  await h.advance(1_000);
  assert.equal(h.count(), 1);
});

test('adding and subtracting rest changes the deadline without old callbacks alerting', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.update(21_000, true);
  await h.advance(5_000);
  assert.equal(h.count(), 0);
  assert.equal(h.pending.size, 1);
  h.timer.update(6_000, true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.count(), 1);
  assert.equal(h.pending.size, 0);
  await h.advance(30_000);
  assert.equal(h.count(), 1);
});

test('disabled sound still completes the timer without scheduling audio', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.update(6_000, false);
  await h.advance(5_000);
  assert.equal(h.count(), 0);
  assert.deepEqual(h.completed, [{ audible: false, resumed: false }]);
});

test('background suspension does not drift and overdue rest resolves silently on return', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.visibility(false);
  assert.equal(h.pending.size, 0);
  await h.advance(80_000);
  assert.equal(h.count(), 0);
  assert.equal(h.completed.length, 0);
  h.visibility(true);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(h.completed, [{ audible: false, resumed: true }]);
  assert.equal(h.count(), 0);
  h.visibility(true);
  assert.equal(h.completed.length, 1);
});

test('returning before the deadline schedules only the remaining real time', async () => {
  const h = harness();
  h.timer.update(21_000, true);
  h.visibility(false);
  await h.advance(15_000);
  h.visibility(true);
  await h.advance(4_999);
  assert.equal(h.count(), 0);
  await h.advance(1);
  assert.equal(h.count(), 1);
});

test('unmount clears pending sound and suppresses stale asynchronous completion', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.dispose();
  await h.advance(5_000);
  assert.equal(h.count(), 0);
  assert.equal(h.completed.length, 0);
});


class AudioProbe {
  static contexts: AudioProbe[] = [];
  state = 'suspended'; currentTime = 0; sampleRate = 48_000; destination = {};
  resumes = 0;
  sources: { buffer: { length: number; duration: number; data: Float32Array } | null; started: boolean; onended: null | (() => void); connect: () => void; disconnect: () => void; start: () => void }[] = [];
  gains: number[] = [];
  constructor() { AudioProbe.contexts.push(this); }
  async resume() { this.resumes++; this.state = 'running'; }
  addEventListener() {}
  createBuffer(_channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length); return { length, duration: length / sampleRate, data, getChannelData: () => data };
  }
  createBufferSource() {
    const source = { buffer: null as null | { length: number; duration: number; data: Float32Array }, started: false, onended: null as null | (() => void), connect() {}, disconnect() {}, start() { source.started = true; } };
    this.sources.push(source); return source;
  }
  createGain() { return { gain: { setValueAtTime: (value: number) => { this.gains.push(value); } }, connect() {}, disconnect() {} }; }
  alerts() { return this.sources.filter(source => source.started && (source.buffer?.duration ?? 0) > 0.1); }
}
async function audioFixture(run: (audio: RestChime, session: { type: string }, assigned: string[]) => Promise<void>) {
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let type = 'ambient'; const assigned: string[] = [];
  const session = { get type() { return type; }, set type(value) { type = value; assigned.push(value); } };
  AudioProbe.contexts = [];
  try {
    Object.defineProperty(globalThis, 'window', { value: { AudioContext: AudioProbe }, configurable: true });
    Object.defineProperty(globalThis, 'navigator', { value: { audioSession: session }, configurable: true });
    await run(new RestChime(), session, assigned);
  } finally {
    if (windowBefore) Object.defineProperty(globalThis, 'window', windowBefore); else Reflect.deleteProperty(globalThis, 'window');
    if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
  }
}

test('the stronger double-beep sustains audible energy without clipping at common device sample rates', () => {
  for (const rate of [44_100, 48_000]) {
    const data = createRestChimeSamples(rate);
    const section = (from: number, to: number) => data.slice(Math.floor(from * rate), Math.floor(to * rate));
    const peak = (from: number, to: number) => section(from, to).reduce((top, n) => Math.max(top, Math.abs(n)), 0);
    const rms = (from: number, to: number) => Math.sqrt(section(from, to).reduce((sum, n) => sum + n * n, 0) / section(from, to).length);
    assert.ok(data.length / rate < 1, 'the complete alert remains brief');
    for (const [start, end] of [[0.04, 0.34], [0.54, 0.84]]) {
      assert.ok(peak(start, end) > 0.94);
      assert.ok(rms(start, end) > 0.68, 'sustained loudness, rather than a single high peak');
    }
    assert.equal(peak(0.41, 0.51), 0, 'two recognizable pulses with a silent gap');
    assert.ok(peak(0, 0.98) <= 0.961, 'headroom remains below the clipping limit');
    assert.ok(data.every(Number.isFinite));
    assert.equal(data[0], 0); assert.equal(data.at(-1), 0);
  }
});

test('a real gesture primes audio synchronously without beeping or taking over the music session', async () => {
  await audioFixture(async (audio, session, assigned) => {
    assert.equal(await audio.play(), false);
    assert.equal(audio.getSnapshot().phase, 'blocked');
    const unlocking = audio.unlock();
    const context = AudioProbe.contexts[0];
    assert.equal(context.sources.length, 1, 'Source must start before the resume promise settles.');
    assert.equal(context.sources[0].started, true);
    assert.equal(context.sources[0].buffer!.length, 1);
    assert.equal(await unlocking, true);
    assert.equal(context.alerts().length, 0);
    assert.equal(session.type, 'ambient');
    assert.deepEqual(assigned, []);
  });
});

test('regression: timer playback recovers a previously unlocked interrupted or suspended context', async () => {
  await audioFixture(async audio => {
    await audio.unlock(); const context = AudioProbe.contexts[0];
    for (const state of ['interrupted', 'suspended']) {
      context.state = state;
      const resumes = context.resumes;
      assert.equal(await audio.play(), true);
      assert.equal(context.resumes, resumes + 1);
    }
    assert.equal(context.alerts().length, 2);
    assert.ok(context.alerts().every(source => source.buffer!.data.some(value => value !== 0)));
    assert.equal(audio.getSnapshot().phase, 'playing');
  });
});

test('Test sound and automatic playback use the same local PCM and volume path', async () => {
  await audioFixture(async (audio, session, assigned) => {
    assert.equal(await audio.play({ gesture: true, volume: 0.4 }), true);
    const context = AudioProbe.contexts[0]; const first = context.alerts()[0];
    assert.equal(session.type, 'transient');
    assert.deepEqual(assigned, ['transient']);
    first.onended?.(); assert.equal(session.type, 'ambient');
    audio.setVolume(0.65);
    assert.equal(await audio.play(), true);
    assert.equal(context.alerts()[1].buffer, first.buffer);
    assert.deepEqual(context.gains, [0.4, 0.65]);
    context.alerts()[1].onended?.(); assert.equal(session.type, 'ambient');
  });
});

test('cancel while an interrupted context resumes suppresses the late beep and restores routing', async () => {
  await audioFixture(async (audio, session) => {
    await audio.unlock(); const context = AudioProbe.contexts[0]; context.state = 'interrupted';
    let resume!: () => void; context.resume = () => new Promise<void>(resolve => { resume = () => { context.state = 'running'; resolve(); }; });
    let current = true; const pending = audio.play({ shouldPlay: () => current });
    current = false; resume();
    assert.equal(await pending, false);
    assert.equal(context.alerts().length, 0);
    assert.equal(session.type, 'ambient');
  });
});

test('a rejected or stuck resume yields useful diagnostics and a bounded false result', async () => {
  await audioFixture(async audio => {
    await audio.unlock(); const context = AudioProbe.contexts[0]; context.state = 'interrupted';
    context.resume = async () => { throw new Error('NotAllowedError'); };
    assert.equal(await audio.play(), false);
    assert.equal(audio.getSnapshot().phase, 'blocked');
    assert.match(audio.getSnapshot().reason!, /resume|blocked/i);
    context.resume = () => new Promise<void>(() => {});
    const before = Date.now();
    assert.equal(await audio.play(), false);
    assert.ok(Date.now() - before < 2_000, 'Do not strand the rest timer behind an unresolved browser promise.');
    assert.equal(context.alerts().length, 0);
  });
});

test('zero volume is explicit and unsupported or readonly routing never prevents playback', async () => {
  await audioFixture(async audio => {
    await audio.unlock(); const context = AudioProbe.contexts[0];
    audio.setVolume(0);
    assert.equal(await audio.play(), false);
    assert.match(audio.getSnapshot().reason!, /volume.*zero/i);
    assert.equal(context.alerts().length, 0);
    Object.defineProperty(globalThis, 'navigator', { value: { audioSession: { get type() { return 'ambient'; }, set type(_value) { throw new Error('Unsupported'); } } }, configurable: true });
    assert.equal(await audio.play({ volume: 0.8 }), true);
    assert.equal(context.alerts().length, 1);
  });
});

test('closed audio contexts are recreated and missing Web Audio support is diagnosed', async () => {
  await audioFixture(async audio => {
    await audio.unlock(); AudioProbe.contexts[0].state = 'closed';
    assert.equal(await audio.play(), true);
    assert.equal(AudioProbe.contexts.length, 2);
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    const unsupported = new RestChime();
    assert.equal(await unsupported.unlock(), false);
    assert.equal(unsupported.getSnapshot().phase, 'unavailable');
  });
});

test('a failed source start releases its graph and notification audio session', async () => {
  await audioFixture(async (audio, session) => {
    await audio.unlock(); const context = AudioProbe.contexts[0];
    const original = context.createBufferSource.bind(context);
    context.createBufferSource = () => {
      const source = original(); source.start = () => { throw new Error('Output interrupted'); }; return source;
    };
    assert.equal(await audio.play(), false);
    assert.equal(session.type, 'ambient');
    assert.equal(audio.getSnapshot().phase, 'blocked');
    context.createBufferSource = original;
    assert.equal(await audio.play(), true);
    context.alerts().at(-1)!.onended?.();
    assert.equal(session.type, 'ambient');
  });
});

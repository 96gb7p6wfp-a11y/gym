import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { requestPwaActivation } from '../src/pwa-update.ts';

test('activation requires an acknowledged update rather than treating an ignored legacy message as success', async () => {
  let requested: unknown;
  const confirmed = await requestPwaActivation({ postMessage(message, ports) {
    requested = message;
    (ports[0] as MessagePort).postMessage({ accepted: true });
  } });
  assert.deepEqual(requested, { type: 'SETLINE_ACTIVATE_UPDATE' });
  assert.equal(confirmed.accepted, true);
  const ignored = await requestPwaActivation({ postMessage() {} }, 10);
  assert.equal(ignored.accepted, false);
  assert.match(ignored.reason!, /Close all Setline windows/);
  const blocked = await requestPwaActivation({ postMessage(_message, ports) {
    (ports[0] as MessagePort).postMessage({ accepted: false, reason: 'Close other Setline windows before updating.' });
  } });
  assert.equal(blocked.accepted, false);
  assert.match(blocked.reason!, /other Setline/);
});

test('generated worker downloads quietly and activates only after an explicit single-window update request', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'setline-update-'));
  try {
    writeFileSync(path.join(directory, 'index.html'), '<!doctype html><title>Setline test</title>');
    writeFileSync(path.join(directory, 'app.js'), 'window.setline = true;');
    execFileSync(process.execPath, ['scripts/finalize-web.mjs', directory], { cwd: process.cwd(), stdio: 'pipe' });
    const listeners = new Map<string, (event: any) => void>();
    let skipped = 0, downloaded = 0;
    let windows = [{ id: 'installed-app' }];
    vm.runInNewContext(readFileSync(path.join(directory, 'service-worker.js'), 'utf8'), {
      self: {
        addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
        clients: { matchAll: async () => windows },
        skipWaiting: async () => { skipped++; },
      },
      caches: { open: async () => ({ addAll: async () => { downloaded++; } }), delete: async () => true },
      Request: class extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, 'https://setline.test'), init); } }, URL, Response,
    });
    let pending: Promise<void> | undefined;
    listeners.get('install')!({ waitUntil: (promise: Promise<void>) => { pending = promise; } });
    await pending;
    assert.equal(downloaded, 1);
    assert.equal(skipped, 0, 'download cannot interrupt an older open workout');
    let result: any;
    const event = () => ({ data: { type: 'SETLINE_ACTIVATE_UPDATE' },
      ports: [{ postMessage: (message: unknown) => { result = message; } }],
      waitUntil: (promise: Promise<void>) => { pending = promise; } });
    windows = [{ id: 'installed-app' }, { id: 'another-workout-tab' }];
    listeners.get('message')!(event()); await pending;
    assert.equal(result.accepted, false);
    assert.equal(skipped, 0, 'another window retains the old cache until it closes');
    windows = [{ id: 'installed-app' }];
    listeners.get('message')!(event()); await pending;
    assert.equal(result.accepted, true);
    assert.equal(skipped, 1);
    listeners.get('message')!({ data: { type: 'unrelated' } });
    assert.equal(skipped, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('registration checks again after foreground return without silently activating an update', async () => {
  const events = new Map<string, () => void>();
  const registrationEvents = new Map<string, () => void>();
  let updateChecks = 0;
  let configuration: unknown;
  let now = 1_000_000;
  let primed = 0;
  const document = { visibilityState: 'visible', addEventListener: (name: string, handler: () => void) => events.set(name, handler) };
  const registration = {
    waiting: null,
    update: async () => { updateChecks++; },
    addEventListener: (name: string, handler: () => void) => registrationEvents.set(name, handler),
  };
  vm.runInNewContext(readFileSync('public/register-sw.js', 'utf8'), {
    navigator: { onLine: true, serviceWorker: { register: async (_url: string, options: unknown) => { configuration = options; return registration; } } },
    document,
    window: { isSecureContext: true, addEventListener: (name: string, handler: () => void) => events.set(name, handler), dispatchEvent: () => { primed++; } },
    Date: { now: () => now }, Event, console,
  });
  events.get('load')!(); await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(JSON.parse(JSON.stringify(configuration)), { scope: '/', updateViaCache: 'none' });
  events.get('visibilitychange')!(); await Promise.resolve(); await Promise.resolve();
  assert.equal(updateChecks, 1);
  events.get('pageshow')!(); await Promise.resolve();
  assert.equal(updateChecks, 1, 'foreground events are throttled');
  now += 61_000;
  document.visibilityState = 'hidden'; events.get('visibilitychange')!(); await Promise.resolve();
  assert.equal(updateChecks, 1);
  document.visibilityState = 'visible'; events.get('visibilitychange')!(); await Promise.resolve(); await Promise.resolve();
  assert.equal(updateChecks, 2);
  assert.equal(primed, 0, 'no ready event is invented without a waiting worker');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

type NetworkState = 'online' | 'offline' | 'hanging' | 'server-error';
const ORIGIN = 'https://setline.test';

function installedWorker() {
  const directory = mkdtempSync(path.join(tmpdir(), 'setline-offline-navigation-'));
  writeFileSync(path.join(directory, 'index.html'), '<main>Cached Setline app</main>');
  writeFileSync(path.join(directory, 'offline.html'), '<main>Install Setline while online</main>');
  writeFileSync(path.join(directory, 'app.js'), 'window.setline = true;');
  execFileSync(process.execPath, ['scripts/finalize-web.mjs', directory], { cwd: process.cwd(), stdio: 'pipe' });

  const listeners = new Map<string, (event: any) => void>();
  const entries = new Map<string, Map<string, Response>>();
  const calls: string[] = [];
  let network: NetworkState = 'online';
  const pathname = (request: Request | string) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).pathname;

  vm.runInNewContext(readFileSync(path.join(directory, 'service-worker.js'), 'utf8'), {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (name: string, handler: (event: any) => void) => listeners.set(name, handler),
    },
    caches: {
      open: async (name: string) => {
        if (!entries.has(name)) entries.set(name, new Map());
        const cached = entries.get(name)!;
        return {
          addAll: async (requests: Request[]) => {
            for (const request of requests) {
              const key = pathname(request);
              cached.set(key, new Response(key === '/index.html' ? '<main>Cached Setline app</main>'
                : key === '/offline.html' ? '<main>Install Setline while online</main>' : 'shell asset'));
            }
          },
          match: async (request: Request | string) => cached.get(pathname(request))?.clone(),
        };
      },
      delete: async (name: string) => entries.delete(name),
    },
    fetch: (request: { url: string }) => {
      calls.push(request.url);
      if (network === 'hanging') return new Promise<Response>(() => {});
      if (network === 'offline') return Promise.reject(new Error('Offline test network'));
      if (network === 'server-error') return Promise.resolve(new Response('Unavailable', { status: 503 }));
      return Promise.resolve(new Response('<main>Fresh network document</main>'));
    },
    Request: class extends Request {
      constructor(input: string, init?: RequestInit) { super(new URL(input, ORIGIN), init); }
    },
    URL, Response,
  });

  return {
    calls,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
    setNetwork: (state: NetworkState) => { network = state; },
    install: async () => {
      let pending: Promise<void> | undefined;
      listeners.get('install')!({ waitUntil: (promise: Promise<void>) => { pending = promise; } });
      await pending;
    },
    removeCachedShell: () => {
      for (const cache of entries.values()) cache.delete('/index.html');
    },
    navigate: (route = '/') => {
      let pending: Promise<Response> | undefined;
      listeners.get('fetch')!({
        request: { method: 'GET', mode: 'navigate', url: new URL(route, ORIGIN).href },
        respondWith: (promise: Promise<Response>) => { pending = promise; },
      });
      return pending ?? null;
    },
    unintercepted: (url: string, method = 'GET') => {
      let intercepted = false;
      listeners.get('fetch')!({
        request: { method, mode: 'navigate', url },
        respondWith: () => { intercepted = true; },
      });
      return !intercepted;
    },
  };
}

test('a previously installed Setline opens from cache without contacting a hanging network', async () => {
  const worker = installedWorker();
  try {
    await worker.install();
    worker.setNetwork('hanging');
    const response = await Promise.race([
      worker.navigate('/train?session=saved')!,
      new Promise<'timeout'>(resolve => setTimeout(() => resolve('timeout'), 150)),
    ]);
    assert.notEqual(response, 'timeout', 'navigation must not await a hanging network');
    assert.equal(await (response as Response).text(), '<main>Cached Setline app</main>');
    assert.deepEqual(worker.calls, [], 'a cached navigation must make zero network calls');
    assert.equal(await (await worker.navigate('/')!)?.text(), '<main>Cached Setline app</main>');
    assert.deepEqual(worker.calls, []);
  } finally { worker.dispose(); }
});

test('first navigation without an installed shell still works online', async () => {
  const worker = installedWorker();
  try {
    assert.equal(await (await worker.navigate('/')!)?.text(), '<main>Fresh network document</main>');
    assert.equal(worker.calls.length, 1);
  } finally { worker.dispose(); }
});

test('an incomplete shell shows the offline fallback rather than a blank page', async () => {
  const worker = installedWorker();
  try {
    await worker.install();
    worker.removeCachedShell();
    worker.setNetwork('offline');
    assert.equal(await (await worker.navigate('/')!)?.text(), '<main>Install Setline while online</main>');
    assert.equal(worker.calls.length, 1, 'network is only attempted when the app shell is missing');
    worker.setNetwork('server-error');
    assert.equal(await (await worker.navigate('/')!)?.text(), '<main>Install Setline while online</main>');
  } finally { worker.dispose(); }
});

test('a never-installed offline visit fails explicitly; other origins and writes are untouched', async () => {
  const worker = installedWorker();
  try {
    worker.setNetwork('offline');
    const response = await worker.navigate('/');
    assert.equal(response?.status, 503);
    assert.match(await response!.text(), /Reconnect once/);
    assert.equal(worker.unintercepted('https://another.example/'), true);
    assert.equal(worker.unintercepted(ORIGIN + '/', 'POST'), true);
  } finally { worker.dispose(); }
});

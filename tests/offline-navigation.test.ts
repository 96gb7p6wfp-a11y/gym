import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  mkdirSync(path.join(directory, 'assets'));
  writeFileSync(path.join(directory, 'assets', 'Progress-lazy.js'), 'export const chart = true;');
  writeFileSync(path.join(directory, 'assets', 'Workout-lazy.js'), 'export const workout = true;');
  execFileSync(process.execPath, ['scripts/finalize-web.mjs', directory], { cwd: process.cwd(), stdio: 'pipe' });

  const listeners = new Map<string, (event: any) => void>();
  const entries = new Map<string, Map<string, Response>>();
  const calls: string[] = [];
  const timeoutDelays: number[] = [];
  const installPaths: string[] = [];
  const oldCache = 'setline-pwa-older-verified-build';
  entries.set(oldCache, new Map([['/index.html', new Response('Previous verified shell')]]));
  let network: NetworkState = 'online';
  let cacheDenied = false, matchDenied = false, installFailed = false, cleanupDenied = false;
  let claimed = 0;
  let aborted = false;
  const pathname = (request: Request | string) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).pathname;

  vm.runInNewContext(readFileSync(path.join(directory, 'service-worker.js'), 'utf8'), {
    self: {
      location: { origin: ORIGIN },
      addEventListener: (name: string, handler: (event: any) => void) => listeners.set(name, handler),
      clients: { claim: async () => { claimed++; } },
    },
    caches: {
      open: async (name: string) => {
        if (cacheDenied) throw new Error('Isolated cache access denied');
        if (!entries.has(name)) entries.set(name, new Map());
        const cached = entries.get(name)!;
        return {
          addAll: async (requests: Request[]) => {
            for (const request of requests) {
              const key = pathname(request);
              installPaths.push(key);
              cached.set(key, new Response(key === '/index.html' ? '<main>Cached Setline app</main>'
                : key === '/offline.html' ? '<main>Install Setline while online</main>' : 'shell asset'));
              if (installFailed) throw new Error('Isolated interrupted shell installation');
            }
          },
          match: async (request: Request | string) => {
            if (matchDenied) throw new Error('Isolated cache read denied');
            return cached.get(pathname(request))?.clone();
          },
        };
      },
      delete: async (name: string) => entries.delete(name),
      keys: async () => {
        if (cleanupDenied) throw new Error('Isolated cache listing denied');
        return [...entries.keys()];
      },
    },
    fetch: (request: { url: string }, options?: { signal?: AbortSignal }) => {
      calls.push(request.url);
      options?.signal?.addEventListener('abort', () => { aborted = true; });
      if (network === 'hanging') return new Promise<Response>(() => {});
      if (network === 'offline') return Promise.reject(new Error('Offline test network'));
      if (network === 'server-error') return Promise.resolve(new Response('Unavailable', { status: 503 }));
      return Promise.resolve(new Response('<main>Fresh network document</main>'));
    },
    Request: class extends Request {
      constructor(input: string, init?: RequestInit) { super(new URL(input, ORIGIN), init); }
    },
    URL, Response, AbortController,
    setTimeout: (callback: () => void, delay: number) => {
      timeoutDelays.push(delay);
      return setTimeout(callback, Math.min(delay, 20));
    },
    clearTimeout,
  });

  return {
    calls, timeoutDelays, installPaths, entries, oldCache,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
    setNetwork: (state: NetworkState) => { network = state; },
    setCacheDenied: (value: boolean) => { cacheDenied = value; },
    setMatchDenied: (value: boolean) => { matchDenied = value; },
    failInstall: () => { installFailed = true; },
    denyCleanup: () => { cleanupDenied = true; },
    getClaimed: () => claimed,
    getAborted: () => aborted,
    install: async () => {
      let pending: Promise<void> | undefined;
      listeners.get('install')!({ waitUntil: (promise: Promise<void>) => { pending = promise; } });
      await pending;
    },
    removeCachedShell: () => {
      for (const [name, cache] of entries) if (name !== oldCache) cache.delete('/index.html');
    },
    navigate: (route = '/') => {
      let pending: Promise<Response> | undefined;
      listeners.get('fetch')!({
        request: { method: 'GET', mode: 'navigate', url: new URL(route, ORIGIN).href },
        respondWith: (promise: Promise<Response>) => { pending = promise; },
      });
      return pending ?? null;
    },
    asset: async (route = '/app.js') => {
      let pending: Promise<Response> | undefined;
      listeners.get('fetch')!({ request: new Request(new URL(route, ORIGIN)),
        respondWith: (promise: Promise<Response>) => { pending = promise; } });
      return pending ? await pending : null;
    },
    activate: async () => {
      let pending: Promise<void> | undefined;
      listeners.get('activate')!({ waitUntil: (promise: Promise<void>) => { pending = promise; } });
      await pending;
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
    assert.deepEqual(worker.timeoutDelays, [], 'a verified shell does not wait for a fallback timeout either');
  } finally { worker.dispose(); }
});

test('critical lazily loaded routes belong to the same atomic offline shell', async () => {
  const worker = installedWorker();
  try {
    await worker.install();
    assert.ok(worker.installPaths.includes('/assets/Progress-lazy.js'));
    assert.ok(worker.installPaths.includes('/assets/Workout-lazy.js'));
    worker.setNetwork('offline');
    assert.equal(await (await worker.asset('/assets/Progress-lazy.js'))!.text(), 'shell asset');
    assert.equal(await (await worker.asset('/assets/Workout-lazy.js'))!.text(), 'shell asset');
    assert.equal(worker.calls.length, 0);
  } finally { worker.dispose(); }
});

test('interrupted installation removes only the incomplete new generation and retains the old verified shell', async () => {
  const worker = installedWorker();
  try {
    worker.failInstall();
    await assert.rejects(worker.install(), /interrupted shell/);
    assert.deepEqual([...worker.entries.keys()], [worker.oldCache]);
    assert.equal(await worker.entries.get(worker.oldCache)!.get('/index.html')!.text(), 'Previous verified shell');
    assert.equal(worker.getClaimed(), 0);
  } finally { worker.dispose(); }
});

test('cache denial falls back to online documents and critical JavaScript without blank worker errors', async () => {
  const worker = installedWorker();
  try {
    worker.setCacheDenied(true);
    await assert.rejects(worker.install(), /cache access denied/);
    assert.equal(await (await worker.navigate('/')!)?.text(), '<main>Fresh network document</main>');
    assert.equal(await (await worker.asset())?.text(), '<main>Fresh network document</main>');
    worker.setNetwork('offline');
    assert.equal((await worker.navigate('/'))?.status, 503);
    assert.equal((await worker.asset())?.type, 'error');
  } finally { worker.dispose(); }
});

test('a cache match error cannot prevent an otherwise-online critical asset response', async () => {
  const worker = installedWorker();
  try {
    await worker.install();
    worker.setMatchDenied(true);
    assert.equal((await worker.asset())?.status, 200);
    assert.equal(worker.calls.length, 1);
  } finally { worker.dispose(); }
});

test('missing-shell recovery is bounded and aborts a hanging connection rather than hiding offline instructions', async () => {
  const worker = installedWorker();
  try {
    await worker.install(); worker.removeCachedShell(); worker.setNetwork('hanging');
    assert.equal(await (await worker.navigate('/')!)?.text(), '<main>Install Setline while online</main>');
    assert.deepEqual(worker.timeoutDelays, [3000]);
    assert.equal(worker.getAborted(), true);
  } finally { worker.dispose(); }
});

test('activation cleanup retains unrelated caches and cannot block claiming when CacheStorage becomes denied', async () => {
  const worker = installedWorker();
  try {
    await worker.install();
    worker.entries.set('another-app-cache', new Map());
    await worker.activate();
    assert.equal(worker.entries.has(worker.oldCache), false);
    assert.equal(worker.entries.has('another-app-cache'), true);
    assert.equal(worker.getClaimed(), 1);
    worker.denyCleanup();
    await worker.activate();
    assert.equal(worker.getClaimed(), 2);
  } finally { worker.dispose(); }
});

test('worker-only changes produce a different cache generation even when every built asset is identical', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'setline-worker-generation-'));
  try {
    const source = readFileSync('scripts/finalize-web.mjs', 'utf8');
    const versions: string[] = [];
    for (const [name, suffix] of [['before', ''], ['after', '\n// Isolated worker logic revision\n']] as const) {
      const directory = path.join(root, name); mkdirSync(directory);
      writeFileSync(path.join(directory, 'index.html'), '<main>Identical Setline</main>');
      writeFileSync(path.join(directory, 'app.js'), 'window.app = true;');
      const generator = path.join(root, `${name}.mjs`); writeFileSync(generator, source + suffix);
      execFileSync(process.execPath, [generator, directory], { stdio: 'pipe' });
      versions.push(readFileSync(path.join(directory, 'service-worker.js'), 'utf8').match(/const CACHE_NAME = CACHE_PREFIX \+ "([a-f\d]+)"/)![1]);
    }
    assert.notEqual(versions[0], versions[1]);
  } finally { rmSync(root, { recursive: true, force: true }); }
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

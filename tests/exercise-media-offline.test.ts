import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

function workerHarness() {
  const directory = mkdtempSync(path.join(tmpdir(), 'setline-optional-media-'));
  writeFileSync(path.join(directory, 'index.html'), '<title>Isolated Setline worker test</title>');
  writeFileSync(path.join(directory, 'app.js'), '/* isolated app shell */');
  mkdirSync(path.join(directory, 'exercise-media'));
  for (let index = 0; index < 30; index++) writeFileSync(path.join(directory, `exercise-media/approved-${index}.webp`), `QA media ${index}`);
  writeFileSync(path.join(directory, 'exercise-media/too-large.webp'), Buffer.alloc(256_001));
  writeFileSync(path.join(directory, 'exercise-media/LICENSE.md'), 'Isolated permission metadata');
  execFileSync(process.execPath, ['scripts/finalize-web.mjs', directory], { stdio: 'pipe' });
  const listeners = new Map<string, (event: any) => void>();
  const cacheEntries = new Map<string, Map<string, Response>>();
  const downloaded: string[] = [], network: string[] = [];
  let offline = false, denyCache = false, failPut = false;
  const key = (request: Request | string) => typeof request === 'string' ? new URL(request, 'https://setline.test').href : request.url;
  vm.runInNewContext(readFileSync(path.join(directory, 'service-worker.js'), 'utf8'), {
    self: { location: { origin: 'https://setline.test' }, addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener) },
    caches: { open: async (name: string) => {
      if (denyCache) throw new Error('Isolated browser cache access denied');
      if (!cacheEntries.has(name)) cacheEntries.set(name, new Map());
      const entries = cacheEntries.get(name)!;
      return {
        addAll: async (requests: Request[]) => { downloaded.push(...requests.map(request => request.url)); },
        match: async (request: Request | string) => entries.get(key(request))?.clone(),
        put: async (request: Request, response: Response) => { if (failPut) throw new Error('Isolated quota limit'); entries.set(key(request), response.clone()); },
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        delete: async (request: Request) => entries.delete(key(request)),
      };
    }, delete: async (name: string) => cacheEntries.delete(name) },
    fetch: async (request: Request) => {
      network.push(request.url);
      if (offline) throw new Error('Isolated offline network');
      return new Response('QA image response', { headers: { 'content-type': 'image/webp' } });
    },
    Request: class extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, 'https://setline.test'), init); } }, URL, Response,
  });
  return {
    downloaded, network, cacheEntries,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
    setOffline: (value: boolean) => { offline = value; },
    setCacheDenied: (value: boolean) => { denyCache = value; },
    setPutFailure: (value: boolean) => { failPut = value; },
    install: async () => { let pending: Promise<void> | undefined; listeners.get('install')!({ waitUntil: (promise: Promise<void>) => { pending = promise; } }); await pending; },
    request: async (pathname: string) => {
      let pending: Promise<Response> | undefined;
      listeners.get('fetch')!({ request: new Request(new URL(pathname, 'https://setline.test')), respondWith: (promise: Promise<Response>) => { pending = promise; } });
      return pending ? await pending : null;
    },
  };
}

test('installing the offline app downloads its shell without any optional media or license files', async () => {
  const worker = workerHarness();
  try {
    await worker.install();
    assert.deepEqual(worker.downloaded.map(url => new URL(url).pathname).sort(), ['/app.js', '/index.html']);
    assert.equal(worker.network.length, 0);
    assert.equal([...worker.cacheEntries.keys()].some(name => name.endsWith('-media')), false);
  } finally { worker.dispose(); }
});

test('only a known small same-origin image is cached after actual use, then remains available offline', async () => {
  const worker = workerHarness();
  try {
    await worker.install();
    const first = await worker.request('/exercise-media/approved-0.webp');
    assert.equal(first?.status, 200);
    assert.equal(worker.network.length, 1);
    worker.setOffline(true);
    assert.equal(await (await worker.request('/exercise-media/approved-0.webp'))?.text(), 'QA image response');
    assert.equal(worker.network.length, 1, 'a cached diagram needs no new request');
    assert.equal(await worker.request('/exercise-media/too-large.webp'), null, 'oversized media is not retained by the worker');
    assert.equal(await worker.request('/exercise-media/not-in-build.webp'), null);
    assert.equal(await worker.request('https://outside.example/exercise-media/approved-0.webp'), null);
    assert.equal(await worker.request('/exercise-media/LICENSE.md'), null);
  } finally { worker.dispose(); }
});

test('on-demand media cache evicts older entries at its 24-file limit without changing the shell cache', async () => {
  const worker = workerHarness();
  try {
    await worker.install();
    const shellName = [...worker.cacheEntries.keys()][0];
    for (let index = 0; index < 30; index++) assert.equal((await worker.request(`/exercise-media/approved-${index}.webp`))?.status, 200);
    const media = [...worker.cacheEntries.entries()].find(([name]) => name.endsWith('-media'))![1];
    assert.equal(media.size, 24);
    assert.equal(media.has('https://setline.test/exercise-media/approved-0.webp'), false);
    assert.equal(media.has('https://setline.test/exercise-media/approved-29.webp'), true);
    assert.ok(worker.cacheEntries.has(shellName));
    assert.equal(worker.cacheEntries.get(shellName)!.size, 0, 'optional images never enter the shell cache');
  } finally { worker.dispose(); }
});

test('media quota failures and denied CacheStorage still return the online image', async () => {
  const worker = workerHarness();
  try {
    await worker.install(); worker.setPutFailure(true);
    assert.equal((await worker.request('/exercise-media/approved-0.webp'))?.status, 200);
    worker.setCacheDenied(true);
    assert.equal((await worker.request('/exercise-media/approved-1.webp'))?.status, 200);
    assert.equal(worker.network.length, 2);
  } finally { worker.dispose(); }
});

test('an uncached offline image fails independently so the guide can fall back without blocking app requests', async () => {
  const worker = workerHarness();
  try {
    await worker.install(); worker.setOffline(true);
    const response = await worker.request('/exercise-media/approved-2.webp');
    assert.equal(response?.type, 'error');
    assert.equal(worker.cacheEntries.size, 2);
    assert.equal(worker.downloaded.length, 2, 'the installed app shell remains intact');
  } finally { worker.dispose(); }
});

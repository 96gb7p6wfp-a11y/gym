import { createServer, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** Read-only localhost fixture server. Hanging/failing requests are scoped to
 * this ephemeral test origin; no production URL or personal store is accepted. */
export async function nativeOfflineServer() {
  const root = path.resolve(process.cwd(), 'dist');
  const requests: string[] = [], held = new Set<ServerResponse>();
  let hangDocuments = false, brokenInstall = false, failedAssets = 0, brokenWorkerServed = 0;
  const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.webp': 'image/webp', '.avif': 'image/avif' };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    requests.push(url.pathname);
    if (hangDocuments && (url.pathname === '/' || url.pathname === '/train' || url.pathname === '/index.html')) {
      held.add(response); response.on('close', () => held.delete(response)); return;
    }
    if (brokenInstall && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js')) {
      failedAssets++; response.writeHead(404); response.end('Isolated interrupted install'); return;
    }
    let filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (filename !== root && !filename.startsWith(root + path.sep)) { response.writeHead(400); response.end(); return; }
    try {
      try { if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html'); }
      catch { if (!path.extname(url.pathname)) filename = path.join(root, 'index.html'); }
      let content = await readFile(filename);
      if (url.pathname === '/service-worker.js' && url.searchParams.has('broken-install')) {
        brokenWorkerServed++;
        content = Buffer.from(content.toString().replace(/const CACHE_NAME = CACHE_PREFIX \+ "[a-f\d]+";/,
          'const CACHE_NAME = CACHE_PREFIX + "native-test-incomplete";'));
      }
      response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store', 'Service-Worker-Allowed': '/' });
      response.end(content);
    } catch { response.writeHead(404); response.end('Isolated missing asset'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not create isolated offline fixture server');
  return {
    origin: `http://127.0.0.1:${address.port}`, requests,
    hang: () => { hangDocuments = true; },
    breakInstall: () => { brokenInstall = true; },
    repair: () => { brokenInstall = false; },
    failures: () => ({ failedAssets, brokenWorkerServed }),
    close: async () => {
      for (const response of held) response.destroy();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

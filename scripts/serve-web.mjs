import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../dist/', import.meta.url)));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/vnd.microsoft.icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};
const isWithinRoot = (filename) => filename === root || filename.startsWith(root + path.sep);

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }
  try {
    const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    if (!pathname.startsWith('/') || pathname.includes('\0') || pathname.includes('\\')) {
      response.writeHead(400);
      response.end('Invalid path');
      return;
    }
    let filename = path.resolve(root, '.' + pathname);
    if (!isWithinRoot(filename)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    try {
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    } catch (error) {
      // Match Vercel's SPA fallback while allowing missing assets to return 404.
      if ((error.code === 'ENOENT' || error.code === 'ENOTDIR') && !path.extname(pathname)) {
        filename = path.join(root, 'index.html');
      } else {
        throw error;
      }
    }
    filename = await realpath(filename);
    if (!isWithinRoot(filename)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': body.length,
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const status = error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500;
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(status === 404 ? 'Not found' : status === 400 ? 'Invalid path' : 'Unable to serve file');
  }
}).listen(port, host, () => console.log(`Serving Setline on ${host}:${port}`));

import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('./dist/', import.meta.url)));
if (!(await stat(resolve(root, 'index.html'))).isFile()) throw new Error('Missing production build');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.map': 'application/json', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
};
function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Service-Worker-Allowed', '/');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return reply(res, 405, 'Method not allowed');
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    if (pathname === '/healthz') return reply(res, 200, 'ok');
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) {
      return reply(res, 404, 'Not found');
    }
    const candidate = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!candidate.startsWith(root + sep)) return reply(res, 404, 'Not found');
    const target = await realpath(candidate);
    if (!target.startsWith(root + sep)) return reply(res, 404, 'Not found');
    const info = await stat(target);
    if (!info.isFile()) return reply(res, 404, 'Not found');
    const immutable = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(pathname);
    res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.setHeader('Content-Type', types[extname(target).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.writeHead(200);
    if (req.method === 'HEAD') return res.end();
    await pipeline(createReadStream(target), res);
  } catch (err) {
    if (res.headersSent) return res.destroy();
    const missing = err?.code === 'ENOENT' || err?.code === 'ENOTDIR' || err instanceof URIError;
    reply(res, missing ? 404 : 500, missing ? 'Not found' : 'Internal server error');
  }
}).listen(Number(process.env.PORT || 8080), '0.0.0.0');

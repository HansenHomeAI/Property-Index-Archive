import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { createServer } from 'node:http';
function parseRootArg(argv) {
  const idx = argv.indexOf('--root');
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

const root = resolve(parseRootArg(process.argv) || process.cwd());
const host = process.env.SERVER_HOST || '127.0.0.1';
const initialPort = Number.parseInt(process.env.SERVER_PORT || '4173', 10);
const maxPort = Number.parseInt(process.env.SERVER_PORT_MAX || String(initialPort + 20), 10);
const floorTransformPath = resolve(root, 'exports', 'canyon-vista-floor-plan-transform.json');
const floorplanCubesPath = resolve(root, 'assets', 'canyon-vista-floorplan-cubes.json');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp'
};

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function send500(res, error) {
  res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`Server error\n${error.message}`);
}


function resolvePath(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  return join(root, safePath);
}

function createAppServer() {
  return createServer((req, res) => {
    try {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

      if (req.method === 'POST' && pathname === '/__codex/canyon-vista-floor-plan-transform') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 100_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const transform = payload.transform && typeof payload.transform === 'object' ? payload.transform : payload;
            const clean = {
              version: 1,
              property: 'canyon-vista',
              saved_at: new Date().toISOString(),
              transform: {
                centerX: Number(transform.centerX),
                centerY: Number(transform.centerY || 0),
                centerZ: Number(transform.centerZ),
                rotationDeg: Number(transform.rotationDeg || 0),
                scale: Number(transform.scale || 1),
                scaleX: Number(transform.scaleX || 1),
                scaleZ: Number(transform.scaleZ || 1),
                flipX: !!transform.flipX
              }
            };
            if (!Number.isFinite(clean.transform.centerX) || !Number.isFinite(clean.transform.centerZ)) {
              throw new Error('Invalid floor-plan transform');
            }
            mkdirSync(resolve(root, 'exports'), { recursive: true });
            writeFileSync(floorTransformPath, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, path: 'exports/canyon-vista-floor-plan-transform.json' }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: error.message }));
          }
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/__codex/canyon-vista-floorplan-cubes') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 5_000_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body || '{}');
            const clean = {
              version: 1,
              property: 'canyon-vista',
              saved_at: new Date().toISOString(),
              levels: Array.isArray(payload.levels) ? payload.levels : []
            };
            if (!clean.levels.length) throw new Error('No stack levels to save');
            mkdirSync(resolve(root, 'assets'), { recursive: true });
            writeFileSync(floorplanCubesPath, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, path: 'assets/canyon-vista-floorplan-cubes.json' }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: error.message }));
          }
        });
        return;
      }

      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method not allowed');
        return;
      }

      const filePath = resolvePath(req.url || '/');
      if (!filePath.startsWith(root)) {
        send404(res);
        return;
      }

      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        send404(res);
        return;
      }

      const type = mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Cache-Control': 'no-store'
      });
      createReadStream(filePath).pipe(res);
    } catch (error) {
      send500(res, error);
    }
  });
}

async function listenWithFallback() {
  for (let port = initialPort; port <= maxPort; port += 1) {
    const server = createAppServer();
    const result = await new Promise((resolvePromise) => {
      server.once('error', (error) => resolvePromise({ ok: false, error, server }));
      server.once('listening', () => resolvePromise({ ok: true, port, server }));
      server.listen(port, host);
    });

    if (result.ok) {
      console.log(`Canyon Vista server running at http://${host}:${result.port}`);
      process.on('SIGINT', () => result.server.close(() => process.exit(0)));
      await new Promise(() => {});
    }

    if (result.error && result.error.code === 'EADDRINUSE') {
      continue;
    }

    throw result.error;
  }

  throw new Error(`No open port found between ${initialPort} and ${maxPort}.`);
}

listenWithFallback().catch((error) => {
  console.error(error);
  process.exit(1);
});

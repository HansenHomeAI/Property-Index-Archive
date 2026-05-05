import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = process.cwd();
const port = Number(process.argv[2] || 8000);
const host = "127.0.0.1";
const floorTransformPath = path.resolve(root, "Canyon-Vista", "exports", "canyon-vista-floor-plan-transform.json");
const floorplanCubesPath = path.resolve(root, "Canyon-Vista", "assets", "canyon-vista-floorplan-cubes.json");

const types = {
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url || "/", `http://${host}`).pathname);

    if (req.method === "POST" && pathname === "/__codex/canyon-vista-floor-plan-transform") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 100_000) req.destroy();
      });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          const transform = payload.transform && typeof payload.transform === "object" ? payload.transform : payload;
          const clean = {
            version: 1,
            property: "canyon-vista",
            saved_at: new Date().toISOString(),
            transform: {
              centerX: Number(transform.centerX),
              centerY: Number(transform.centerY || 0),
              centerZ: Number(transform.centerZ),
              rotationDeg: Number(transform.rotationDeg || 0),
              scale: Number(transform.scale || 1),
              scaleX: Number(transform.scaleX || 1),
              scaleZ: Number(transform.scaleZ || 1),
              flipX: !!transform.flipX,
            },
          };

          if (!Number.isFinite(clean.transform.centerX) || !Number.isFinite(clean.transform.centerZ)) {
            throw new Error("Invalid floor-plan transform");
          }

          fs.mkdirSync(path.dirname(floorTransformPath), { recursive: true });
          fs.writeFileSync(floorTransformPath, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, path: path.relative(root, floorTransformPath) }));
        } catch (error) {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
      return;
    }

    if (req.method === "POST" && pathname === "/__codex/canyon-vista-floorplan-cubes") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 5_000_000) req.destroy();
      });
      req.on("end", () => {
        try {
          const payload = JSON.parse(body || "{}");
          const clean = {
            version: 1,
            property: "canyon-vista",
            saved_at: new Date().toISOString(),
            levels: Array.isArray(payload.levels) ? payload.levels : [],
          };
          if (!clean.levels.length) throw new Error("No stack levels to save");
          fs.mkdirSync(path.dirname(floorplanCubesPath), { recursive: true });
          fs.writeFileSync(floorplanCubesPath, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: true, path: path.relative(root, floorplanCubesPath) }));
        } catch (error) {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
      return;
    }

    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      res.end("Method not allowed");
      return;
    }

    let filePath = path.resolve(root, `.${pathname}`);

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "content-type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, host, () => {
    console.log(`Serving ${root} at http://${host}:${port}/`);
  });

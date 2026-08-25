#!/usr/bin/env node
/**
 * Tiny static file server for the Iran WebRTC diagnostic.
 * Serves only this directory. Not part of the Next.js / Netlify app.
 */
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function safeJoin(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return resolved;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end("Method Not Allowed");
    return;
  }

  const filePath = safeJoin(req.url || "/");
  if (!filePath) {
    res.writeHead(400);
    res.end("Bad path");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": type,
      "Cache-Control": ext === ".json" ? "no-store" : "no-cache",
    };
    if (req.method === "HEAD") {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    const body = await fs.readFile(filePath);
    res.writeHead(200, headers);
    res.end(body);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(500);
    res.end("Server error");
  }
});

server.listen(port, host, () => {
  const shown = host === "0.0.0.0" ? "127.0.0.1" : host;
  process.stdout.write(
    `Iran WebRTC diagnostic listening on http://${shown}:${port}/\n` +
      `Bind: ${host}:${port}  (set HOST / PORT to override)\n`,
  );
});

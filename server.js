const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4173;
const ROOT = path.join(__dirname, "public");
const FALLBACK = path.join(__dirname, "data", "floor.json");
const UPSTREAM = "https://testnet.obol.sh/api/floor";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendFallback(res) {
  fs.readFile(FALLBACK, (err, body) => {
    if (err) return send(res, 502, JSON.stringify({ error: "floor unavailable" }), "application/json; charset=utf-8");
    send(res, 200, body, "application/json; charset=utf-8");
  });
}

function proxyFloor(res) {
  const req = https.get(
    UPSTREAM,
    { headers: { Accept: "application/json", "User-Agent": "obol-floor-clone" } },
    (up) => {
      const chunks = [];
      up.on("data", (chunk) => chunks.push(chunk));
      up.on("end", () => {
        if (up.statusCode !== 200) return sendFallback(res);
        send(res, 200, Buffer.concat(chunks), "application/json; charset=utf-8");
      });
    }
  );
  req.setTimeout(8000, () => req.destroy());
  req.on("error", () => sendFallback(res));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/api/floor") return proxyFloor(res);

  const rel = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return send(res, 403, "forbidden", "text/plain; charset=utf-8");

  fs.readFile(file, (err, body) => {
    if (err) return send(res, 404, "not found", "text/plain; charset=utf-8");
    send(res, 200, body, TYPES[path.extname(file)] || "application/octet-stream");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("obol floor clone http://127.0.0.1:" + PORT);
});

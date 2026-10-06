import http from "node:http";

const PORT = parseInt(process.env.PORT || "3301", 10);
const VERSION = "v2";

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version: VERSION, uptime: process.uptime() }));
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`PM2 Sample App ${VERSION}\n`);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found\n");
});

server.listen(PORT, () => {
  console.log(`[sample-pm2-app] ${VERSION} listening on http://localhost:${PORT}`);
});

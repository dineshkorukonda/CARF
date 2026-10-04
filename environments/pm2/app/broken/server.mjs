import http from "node:http";

const PORT = parseInt(process.env.PORT || "3301", 10);
const VERSION = "v2-broken";

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    // Intentionally unhealthy: returns 500 Internal Server Error
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", version: VERSION, error: "Database connection failed" }));
    return;
  }

  if (req.url === "/") {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`PM2 Sample App ${VERSION} - ERROR\n`);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found\n");
});

server.listen(PORT, () => {
  console.log(`[sample-pm2-app] ${VERSION} (broken) listening on http://localhost:${PORT}`);
});

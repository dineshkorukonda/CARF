import http from "node:http";

const PORT = parseInt(process.env.PORT || "8080", 10);
const VERSION = "v2-broken";

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz") {
    // Intentionally unhealthy: returns 500 error
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", version: VERSION, error: "Critical component initialization failure" }));
    return;
  }

  if (req.url === "/") {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(`Docker Sample App ${VERSION} - FAILING\n`);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found\n");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[sample-docker-app] ${VERSION} (broken) listening on port ${PORT}`);
});

import http from "node:http";

const PORT = parseInt(process.env.PORT || "3000", 10);
let failMode = process.env.FAIL_MODE || "normal"; // "normal" | "500" | "crash" | "slow"
const version = process.env.APP_VERSION || process.env.COMMIT_SHA || "1.0.0";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/health") {
    if (failMode === "crash") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "crashing" }));
      process.exit(1);
    }

    if (failMode === "500") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", error: "Simulated 500 failure", version }));
      return;
    }

    if (failMode === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", version, uptime: process.uptime() }));
    return;
  }

  if (url.pathname === "/fail-mode" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (data.mode) {
          failMode = data.mode;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "updated", failMode }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name: "demo-target-app", version, failMode }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(PORT, () => {
  console.log(`[demo-target-app] Listening on port ${PORT} (version: ${version}, failMode: ${failMode})`);
});

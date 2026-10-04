import { exec as execCallback } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { PM2Adapter } from "../../src/adapters/pm2.js";

const shellExec = promisify(execCallback);

/** Opt-in real runtime test. A private PM2_HOME isolates all commands from existing apps. */
describe.skipIf(process.env.CARF_TEST_REAL_PM2 !== "1")("real PM2 git rollback", () => {
  it("discovers an app, detects HTTP failure, and restores the previous commit with verified health", async () => {
    const root = (await mkdtemp(join(tmpdir(), "carf-pm2-test-"))).replaceAll("\\", "/");
    const runtimeEnv: NodeJS.ProcessEnv = { ...process.env, PM2_HOME: `${root}/pm2-home` };
    const exec = (command: string) => shellExec(command, { env: runtimeEnv, cwd: root, timeout: 25_000 });
    const appPath = `${root}/app.cjs`;
    const portPath = `${root}/port.txt`;
    const source = (status: number) => `const http = require('node:http'); const fs = require('node:fs'); const server = http.createServer((req,res)=>{res.writeHead(${status});res.end('release-${status}');}); server.listen(Number(process.env.PORT || 0), '127.0.0.1', ()=>fs.writeFileSync(${JSON.stringify(portPath)}, String(server.address().port)));`;
    try {
      await exec("git init");
      await exec("git config user.email test@carf.local");
      await exec("git config user.name CARF-Test");
      await writeFile(appPath, source(200));
      await exec("git add app.cjs");
      await exec('git commit -m "test: healthy release"');
      const previousSha = (await exec("git rev-parse HEAD")).stdout.trim();
      await writeFile(appPath, source(500));
      await exec("git add app.cjs");
      await exec('git commit -m "test: unhealthy release"');
      await exec(`pm2 start ${appPath} --name MixedCaseApp`);
      const { readFile } = await import("node:fs/promises");
      let port = "";
      for (let attempt = 0; attempt < 50; attempt++) {
        try { port = (await readFile(portPath, "utf8")).trim(); } catch { /* Wait for app readiness. */ }
        if (port) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(port).not.toBe("");
      // Keep the same port when PM2 reloads the process.
      runtimeEnv.PORT = port;
      await exec("pm2 restart MixedCaseApp --update-env");
      const adapter = new PM2Adapter(previousSha, { exec, layout: "git", cwd: root, target: "MIXEDCASEAPP", healthUrl: `http://127.0.0.1:${port}`, startupGraceSeconds: 15 });
      const discovery = await adapter.discover();
      expect(discovery.connected).toBe(true);
      expect(discovery.processes.map((process) => process.name)).toEqual(["MixedCaseApp"]);
      expect((await adapter.checkHealth()).httpErrorRate).toBe(1);
      const result = await adapter.rollbackWithVerification();
      expect(result.rollbackVerified).toBe(true);
      expect((await exec("git rev-parse HEAD")).stdout.trim()).toBe(previousSha);
      expect((await fetch(`http://127.0.0.1:${port}`)).status).toBe(200);
    } finally {
      await exec("pm2 kill").catch(() => undefined);
    }
  }, 90_000);
});

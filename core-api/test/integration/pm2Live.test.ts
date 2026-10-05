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
  it("builds and deploys an exact revision, detects HTTP failure, and rebuilds the actual previous deployment", async () => {
    const root = (await mkdtemp(join(tmpdir(), "carf-pm2-test-"))).replaceAll("\\", "/");
    const runtimeEnv: NodeJS.ProcessEnv = { ...process.env, PM2_HOME: `${root}/pm2-home` };
    const exec = (command: string) => shellExec(command, { env: runtimeEnv, cwd: root, timeout: 25_000 });
    const appPath = `${root}/app.cjs`;
    const sourcePath = `${root}/source.cjs`;
    const portPath = `${root}/port.txt`;
    const source = (status: number) => `const http = require('node:http'); const fs = require('node:fs'); const server = http.createServer((req,res)=>{res.writeHead(${status});res.end('release-${status}');}); server.listen(Number(process.env.PORT || 0), '127.0.0.1', ()=>fs.writeFileSync(${JSON.stringify(portPath)}, String(server.address().port)));`;
    try {
      await exec("git init");
      await exec("git config user.email test@carf.local");
      await exec("git config user.name CARF-Test");
      await writeFile(sourcePath, source(200));
      await writeFile(`${root}/build.cjs`, "require('node:fs').copyFileSync('source.cjs', 'app.cjs');");
      await writeFile(`${root}/.gitignore`, "app.cjs\nport.txt\npm2-home/\norigin.git/\n");
      await exec("git add source.cjs build.cjs .gitignore");
      await exec('git commit -m "test: healthy release"');
      const previousSha = (await exec("git rev-parse HEAD")).stdout.trim();
      // An intermediate commit never ran on the host; rollback must skip it.
      await writeFile(sourcePath, source(503));
      await exec("git add source.cjs");
      await exec('git commit -m "test: skipped release"');
      const undeployedParent = (await exec("git rev-parse HEAD")).stdout.trim();
      await writeFile(sourcePath, source(500));
      await exec("git add source.cjs");
      await exec('git commit -m "test: unhealthy release"');
      const failedSha = (await exec("git rev-parse HEAD")).stdout.trim();
      await exec(`git clone --bare . ${root}/origin.git`);
      await exec(`git remote add origin ${root}/origin.git`);
      await exec(`git checkout ${previousSha}`);
      await exec("node build.cjs");
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
      const adapter = new PM2Adapter(undeployedParent, { exec, layout: "git", cwd: root, buildCommand: "node build.cjs", target: "MIXEDCASEAPP", healthUrl: `http://127.0.0.1:${port}`, startupGraceSeconds: 15 });
      const discovery = await adapter.discover();
      expect(discovery.connected).toBe(true);
      expect(discovery.processes.map((process) => process.name)).toEqual(["MixedCaseApp"]);
      expect(await adapter.getCurrentRevision()).toBe(previousSha);
      await adapter.applyRelease(failedSha);
      for (let attempt = 0; attempt < 50; attempt++) {
        try { if ((await fetch(`http://127.0.0.1:${port}`)).status === 500) break; } catch { /* Wait for reload. */ }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect((await adapter.checkHealth()).httpErrorRate).toBe(1);
      // Actions reconstructs the adapter from the persisted rollback baseline.
      const recovery = new PM2Adapter(previousSha, { exec, layout: "git", cwd: root, buildCommand: "node build.cjs", target: "MIXEDCASEAPP", healthUrl: `http://127.0.0.1:${port}`, startupGraceSeconds: 15 });
      expect(await recovery.getCurrentRevision(false)).toBe(failedSha);
      const result = await recovery.rollbackWithVerification();
      expect(result.rollbackVerified).toBe(true);
      expect((await exec("git rev-parse HEAD")).stdout.trim()).toBe(previousSha);
      expect((await fetch(`http://127.0.0.1:${port}`)).status).toBe(200);
    } finally {
      await exec("pm2 kill").catch(() => undefined);
    }
  }, 90_000);
});

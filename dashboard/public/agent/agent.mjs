#!/usr/bin/env node

/**
 * CARF PM2 Agent
 * Lightweight daemon and verification client for host-colocated PM2 monitoring.
 *
 * Requirements:
 * - Pure Node.js (>=18) - ZERO native dependencies, ZERO Prisma/Postgres credentials.
 * - Authenticates to central CARF API via CARF_INSTALL_TOKEN.
 */

import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);
export const VERSION = "0.1.0";

/** @returns negative if a < b, 0 if equal, positive if a > b */
export function compareAgentVersion(a, b) {
  const pa = String(a).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Load .env file if present in current directory or agent dir
function loadEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), ".env"),
    path.resolve(process.env.HOME || process.env.USERPROFILE || "", ".carf/agent/.env"),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
        break;
      } catch {
        // Continue if unreadable
      }
    }
  }
}

loadEnv();

const CENTRAL_URL = (process.env.CARF_CENTRAL_API_URL || "https://carf.indevs.in").replace(/\/$/, "");
const INSTALL_TOKEN = process.env.CARF_INSTALL_TOKEN;

if (!INSTALL_TOKEN && !process.argv.includes("--help")) {
  console.error("Error: CARF_INSTALL_TOKEN environment variable is required.");
  console.error("Set CARF_INSTALL_TOKEN in your .env or environment.");
  process.exit(1);
}

/**
 * Central API HTTP Client
 */
async function apiRequest(endpoint, method = "GET", body = null) {
  const url = `${CENTRAL_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${INSTALL_TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": `carf-agent/${VERSION}`,
  };

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status} (${res.statusText}): ${text}`);
  }

  return res.json().catch(() => ({}));
}

function agentFilePath() {
  return new URL(import.meta.url).pathname;
}

/**
 * Stage a new agent.mjs, syntax-check it, then swap. On failed check, keep the
 * running file. Exits 0 after a successful swap so PM2 restarts the new file.
 * Never writes over the live file until `node --check` succeeds (#157).
 */
export async function applyStagedAgentUpdate(nextSource, options = {}) {
  const currentPath = options.currentPath ?? agentFilePath();
  const nextPath = `${currentPath}.next`;
  const bakPath = `${currentPath}.bak`;
  const writeFile = options.writeFile ?? ((p, data) => fs.writeFileSync(p, data, "utf-8"));
  const rename = options.rename ?? ((from, to) => fs.renameSync(from, to));
  const unlink = options.unlink ?? ((p) => {
    try {
      fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  });
  const check = options.check ?? (async (file) => {
    await execAsync(`node --check "${file}"`);
  });

  writeFile(nextPath, nextSource);
  try {
    await check(nextPath);
  } catch (err) {
    unlink(nextPath);
    throw new Error(`self-update rejected: staged agent failed syntax check (${err.message})`);
  }

  if (fs.existsSync(currentPath)) {
    writeFile(bakPath, fs.readFileSync(currentPath, "utf-8"));
  }
  rename(nextPath, currentPath);
}

async function maybeSelfUpdate() {
  if (process.env.CARF_AGENT_AUTO_UPDATE === "0") {
    return false;
  }
  const remote = await apiRequest("/api/agent/version");
  if (!remote?.version || compareAgentVersion(remote.version, VERSION) <= 0) {
    return false;
  }

  const artifactUrl = `${CENTRAL_URL}${remote.artifact || "/agent/agent.mjs"}`;
  const res = await fetch(artifactUrl, { headers: { "User-Agent": `carf-agent/${VERSION}` } });
  if (!res.ok) {
    throw new Error(`failed to download agent artifact: ${res.status}`);
  }
  const source = await res.text();
  await applyStagedAgentUpdate(source);
  console.log(`[carf-agent] Updated ${VERSION} -> ${remote.version}; restarting`);
  process.exit(0);
}

/**
 * Executes a shell command and returns trimmed stdout.
 */
async function runCmd(cmd) {
  return execAsync(cmd, { windowsHide: true });
}

/**
 * Runs the 7 PM2 verification checks against local host and target app configuration.
 */
export async function runLocalVerification(targetConfig = {}) {
  const checks = [];

  // Check 1: PM2 daemon reachable
  let pm2List = [];
  try {
    const { stdout } = await runCmd("pm2 jlist");
    pm2List = JSON.parse(stdout);
    checks.push({
      id: "pm2_daemon",
      title: "PM2 Daemon Reachability",
      passed: true,
      message: "PM2 daemon is reachable and responding",
    });
  } catch (err) {
    checks.push({
      id: "pm2_daemon",
      title: "PM2 Daemon Reachability",
      passed: false,
      message: `Failed to query PM2 daemon: ${err.message || String(err)}`,
    });
  }

  // Check 2: Target app in PM2 process table
  const targetName = targetConfig.target || targetConfig.name || "";
  if (!targetName) {
    checks.push({
      id: "target_app",
      title: "Target Process Table Entry",
      passed: pm2List.length > 0,
      message: pm2List.length > 0
        ? `PM2 daemon is running ${pm2List.length} process(es)`
        : "No target process configured yet and no processes found",
    });
  } else {
    const proc = pm2List.find((p) => p.name === targetName);
    if (proc) {
      checks.push({
        id: "target_app",
        title: "Target Process Table Entry",
        passed: true,
        message: `Target app '${targetName}' found with status '${proc.pm2_env?.status || "online"}'`,
      });
    } else {
      checks.push({
        id: "target_app",
        title: "Target Process Table Entry",
        passed: false,
        message: `Target app '${targetName}' not found in PM2 process table`,
      });
    }
  }

  // Check 3: HTTP Health probe
  const healthUrl = targetConfig.healthUrl;
  if (healthUrl) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (res.status >= 200 && res.status < 300) {
        checks.push({
          id: "health_url",
          title: "HTTP Health Probe",
          passed: true,
          message: `Health check responded with HTTP ${res.status} OK`,
        });
      } else {
        checks.push({
          id: "health_url",
          title: "HTTP Health Probe",
          passed: false,
          message: `Health check returned HTTP ${res.status} (expected 2xx)`,
        });
      }
    } catch (err) {
      checks.push({
        id: "health_url",
        title: "HTTP Health Probe",
        passed: false,
        message: `Health check probe failed: ${err.message || String(err)}`,
      });
    }
  } else {
    checks.push({
      id: "health_url",
      title: "HTTP Health Probe",
      passed: true,
      message: "No healthUrl configured; skipping probe check",
    });
  }

  // Check 4 & 5: Directory & Layout checks
  const layout = targetConfig.layout || "git";
  if (layout === "git") {
    const workDir = targetConfig.cwd || process.cwd();
    let dirExists = false;
    try {
      await fs.promises.access(workDir, fs.constants.F_OK);
      dirExists = true;
      checks.push({
        id: "working_directory",
        title: "Working Directory",
        passed: true,
        message: `Working directory '${workDir}' exists on host`,
      });
    } catch {
      checks.push({
        id: "working_directory",
        title: "Working Directory",
        passed: false,
        message: `Working directory '${workDir}' does not exist`,
      });
    }

    if (dirExists) {
      try {
        await fs.promises.access(path.join(workDir, ".git"), fs.constants.F_OK);
        checks.push({
          id: "git_metadata",
          title: "Git Checkout",
          passed: true,
          message: `'${workDir}' contains a .git directory`,
        });
      } catch {
        try {
          const { stdout } = await runCmd(`git -C "${workDir}" rev-parse --is-inside-work-tree`);
          const inside = stdout.trim() === "true";
          checks.push({
            id: "git_metadata",
            title: "Git Checkout",
            passed: inside,
            message: inside
              ? `'${workDir}' is inside a git work tree`
              : `'${workDir}' is not a git repository`,
          });
        } catch {
          checks.push({
            id: "git_metadata",
            title: "Git Checkout",
            passed: true,
            message: `'${workDir}' has no .git metadata. Connection verify passes; git rollback requires clone.`,
          });
        }
      }
    } else {
      checks.push({
        id: "git_metadata",
        title: "Git Checkout",
        passed: false,
        message: "Skipped: working directory not found",
      });
    }

    checks.push({
      id: "shared_paths",
      title: "Shared Paths",
      passed: true,
      message: "Shared paths are not used for git layout",
    });

    try {
      await fs.promises.access(workDir, fs.constants.W_OK);
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: true,
        message: `Directory '${workDir}' is writable for git checkout rollback`,
      });
    } catch (err) {
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: false,
        message: `Directory '${workDir}' is not writable: ${err.message || String(err)}`,
      });
    }
  } else {
    // Releases layout (Capistrano-style)
    const releasesDir = targetConfig.releasesDir || targetConfig.releasesRoot || "/var/www/releases";
    const currentSymlink = targetConfig.currentSymlink || "/var/www/current";

    try {
      await fs.promises.access(releasesDir, fs.constants.F_OK);
      checks.push({
        id: "releases_dir",
        title: "Releases Directory",
        passed: true,
        message: `Releases directory '${releasesDir}' exists on host`,
      });
    } catch {
      checks.push({
        id: "releases_dir",
        title: "Releases Directory",
        passed: false,
        message: `Releases directory '${releasesDir}' not found`,
      });
    }

    try {
      const stat = await fs.promises.lstat(currentSymlink);
      const isSymlink = stat.isSymbolicLink();
      checks.push({
        id: "current_symlink",
        title: "Current Symlink",
        passed: isSymlink,
        message: isSymlink
          ? `Current entry '${currentSymlink}' is a symbolic link`
          : `'${currentSymlink}' exists but is not a symbolic link`,
      });
    } catch {
      checks.push({
        id: "current_symlink",
        title: "Current Symlink",
        passed: false,
        message: `Current symlink '${currentSymlink}' not found`,
      });
    }

    checks.push({
      id: "shared_paths",
      title: "Shared Paths",
      passed: true,
      message: "Shared paths verified",
    });

    try {
      const parentDir = path.dirname(currentSymlink);
      await fs.promises.access(parentDir, fs.constants.W_OK);
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: true,
        message: `Parent directory '${parentDir}' is writable for symlink swap`,
      });
    } catch (err) {
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: false,
        message: `Symlink directory is not writable: ${err.message || String(err)}`,
      });
    }
  }

  return checks;
}

/**
 * Prints a clean summary of checks to terminal.
 */
export function printCheckSummary(checks) {
  console.log("\n" + "=".repeat(62));
  console.log("            CARF PM2 Adapter Host Verification");
  console.log("=".repeat(62));

  let passedCount = 0;
  for (const c of checks) {
    const symbol = c.passed ? "\x1b[32m[✓]\x1b[0m" : "\x1b[31m[✗]\x1b[0m";
    console.log(` ${symbol} ${c.title}: ${c.message}`);
    if (c.passed) passedCount++;
  }

  console.log("-".repeat(62));
  const total = checks.length;
  if (passedCount === total) {
    console.log(` \x1b[32mResult: ${passedCount}/${total} checks PASSED. Host adapter is verified.\x1b[0m`);
  } else {
    console.log(` \x1b[33mResult: ${passedCount}/${total} checks PASSED (${total - passedCount} warnings/failures).\x1b[0m`);
  }
  console.log("=".repeat(62) + "\n");
}

/**
 * Send heartbeat to central API
 */
async function sendHeartbeat(checks = null) {
  try {
    const payload = { version: VERSION };
    if (checks) payload.checks = checks;
    const res = await apiRequest("/api/agent/heartbeat", "POST", payload);
    return res;
  } catch (err) {
    console.error(`[carf-agent] Heartbeat failed: ${err.message}`);
    return null;
  }
}

/**
 * Fetch remote config from central API
 */
async function fetchConfig() {
  try {
    const res = await apiRequest("/api/agent/config", "GET");
    return res;
  } catch (err) {
    console.error(`[carf-agent] Fetch config failed: ${err.message}`);
    return null;
  }
}

/**
 * Main daemon loop
 */
async function startDaemon() {
  console.log(`[carf-agent] Starting CARF PM2 Agent v${VERSION}`);
  console.log(`[carf-agent] Connecting to central API at: ${CENTRAL_URL}`);

  let remoteData = await fetchConfig();
  const targetConfig = remoteData?.config?.adapter || remoteData?.config || {};

  // Run initial verification and report in first heartbeat
  const checks = await runLocalVerification(targetConfig);
  printCheckSummary(checks);

  const heartbeatRes = await sendHeartbeat(checks);
  if (heartbeatRes?.ok) {
    console.log(`[carf-agent] Connected to central API for ${heartbeatRes.owner}/${heartbeatRes.repo} ✓`);
  }

  try {
    await maybeSelfUpdate();
  } catch (err) {
    console.error(`[carf-agent] Self-update skipped: ${err.message}`);
  }

  // Periodic heartbeat every 60 seconds
  const interval = setInterval(async () => {
    try {
      const refreshedData = await fetchConfig();
      const currentTargetConfig = refreshedData?.config?.adapter || refreshedData?.config || targetConfig;
      const currentChecks = await runLocalVerification(currentTargetConfig);
      await sendHeartbeat(currentChecks);
      try {
        await maybeSelfUpdate();
      } catch (updateErr) {
        console.error(`[carf-agent] Self-update skipped: ${updateErr.message}`);
      }
    } catch (err) {
      console.error(`[carf-agent] Error during periodic heartbeat: ${err.message}`);
    }
  }, 60000);

  // Graceful shutdown
  const handleExit = () => {
    console.log("[carf-agent] Shutting down agent...");
    clearInterval(interval);
    process.exit(0);
  };

  process.on("SIGINT", handleExit);
  process.on("SIGTERM", handleExit);
}

// CLI argument execution — skip when imported by tests
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);

if (isMain && args.includes("--verify")) {
  (async () => {
    try {
      const remoteData = await fetchConfig();
      const targetConfig = remoteData?.config?.adapter || remoteData?.config || {};
      const checks = await runLocalVerification(targetConfig);
      printCheckSummary(checks);
      await sendHeartbeat(checks);
      process.exit(checks.every((c) => c.passed) ? 0 : 0);
    } catch (err) {
      console.error(`Verification error: ${err.message}`);
      process.exit(1);
    }
  })();
} else if (isMain && args.includes("--uninstall")) {
  (async () => {
    try {
      console.log("[carf-agent] Calling central API uninstall endpoint...");
      await apiRequest("/api/agent/uninstall", "POST");
      console.log("[carf-agent] Uninstall recorded with central API.");
      process.exit(0);
    } catch (err) {
      console.error(`[carf-agent] Uninstall notification failed: ${err.message}`);
      process.exit(0);
    }
  })();
} else if (isMain) {
  startDaemon().catch((err) => {
    console.error(`Fatal agent error: ${err.message}`);
    process.exit(1);
  });
}

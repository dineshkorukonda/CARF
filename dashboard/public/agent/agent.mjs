#!/usr/bin/env node

/**
 * CARF Host Agent
 * Lightweight daemon and verification client for host-colocated deployment monitoring.
 *
 * Requirements:
 * - Pure Node.js (>=18) - ZERO native dependencies, ZERO database credentials.
 * - Authenticates to central CARF API via CARF_INSTALL_TOKEN.
 * - Standardized exclusively on PM2 background process management.
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

function getEnvPaths() {
  const agentDir = path.dirname(new URL(import.meta.url).pathname);
  return [
    path.resolve(agentDir, ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.env.HOME || process.env.USERPROFILE || "", ".carf/agent/.env"),
  ];
}

// Load .env file if present in agent dir or current directory
export function loadEnv() {
  for (const envPath of getEnvPaths()) {
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
            if (val) {
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

let CENTRAL_URL = (process.env.CARF_CENTRAL_API_URL || "https://carf.indevs.in").replace(/\/$/, "");
let INSTALL_TOKEN = process.env.CARF_INSTALL_TOKEN || "";

/**
 * Save install token to .env file
 */
export function saveTokenToEnv(token, centralUrl = null) {
  const targetDir = path.resolve(process.env.HOME || process.env.USERPROFILE || "", ".carf/agent");
  if (!fs.existsSync(targetDir)) {
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch {
      // ignore
    }
  }
  const envPath = fs.existsSync(targetDir) ? path.join(targetDir, ".env") : path.resolve(process.cwd(), ".env");
  const targetUrl = centralUrl || CENTRAL_URL;

  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
    if (/CARF_INSTALL_TOKEN=/.test(content)) {
      content = content.replace(/CARF_INSTALL_TOKEN=.*/, `CARF_INSTALL_TOKEN=${token}`);
    } else {
      content += `\nCARF_INSTALL_TOKEN=${token}\n`;
    }
    if (centralUrl && /CARF_CENTRAL_API_URL=/.test(content)) {
      content = content.replace(/CARF_CENTRAL_API_URL=.*/, `CARF_CENTRAL_API_URL=${targetUrl}`);
    } else if (centralUrl) {
      content += `CARF_CENTRAL_API_URL=${targetUrl}\n`;
    }
  } else {
    content = `CARF_INSTALL_TOKEN=${token}\nCARF_CENTRAL_API_URL=${targetUrl}\n`;
  }

  fs.writeFileSync(envPath, content, { mode: 0o600 });
  process.env.CARF_INSTALL_TOKEN = token;
  INSTALL_TOKEN = token;
  if (centralUrl) {
    process.env.CARF_CENTRAL_API_URL = targetUrl;
    CENTRAL_URL = targetUrl;
  }
}

/**
 * Central API HTTP Client
 */
async function apiRequest(endpoint, method = "GET", body = null) {
  if (!INSTALL_TOKEN) {
    throw new Error("CARF_INSTALL_TOKEN is not configured.");
  }
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

/**
 * Checks for a newer agent version from central API. If present, stages the
 * download, validates syntax, and swaps the running file.
 */
export async function maybeSelfUpdate() {
  if (!INSTALL_TOKEN) return false;
  try {
    const meta = await apiRequest("/api/agent/version");
    if (!meta?.version) return false;
    if (compareAgentVersion(meta.version, VERSION) <= 0) {
      return false;
    }
    console.log(`[carf-agent] New version available: v${meta.version} (current: v${VERSION}). Downloading update...`);
    const codeRes = await fetch(`${CENTRAL_URL}/agent/agent.mjs`, {
      headers: { "User-Agent": `carf-agent/${VERSION}` },
    });
    if (!codeRes.ok) {
      throw new Error(`Download failed: HTTP ${codeRes.status}`);
    }
    const newSource = await codeRes.text();
    await applyStagedAgentUpdate(newSource);
    console.log(`[carf-agent] Successfully self-updated to v${meta.version}. Exiting so PM2 restarts with new code.`);
    process.exit(0);
  } catch (err) {
    console.error(`[carf-agent] Staged self-update failed: ${err.message}`);
    return false;
  }
}

async function runCmd(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { stdout, stderr };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message,
      error: err,
    };
  }
}

/**
 * Detects whether PM2 is available on this host.
 */
export async function detectProcessManager() {
  try {
    const { stdout } = await runCmd("pm2 jlist");
    const list = JSON.parse(stdout);
    return { type: "pm2", available: true, list };
  } catch {
    // PM2 not found or not running
  }

  return { type: "generic", available: false, list: [] };
}

/**
 * Runs verification checks against local host and target app configuration.
 */
export async function runLocalVerification(targetConfig = {}) {
  const checks = [];
  const pm = await detectProcessManager();

  // Check 1: PM2 Daemon Reachability
  if (pm.type === "pm2" && pm.available) {
    checks.push({
      id: "pm2_daemon",
      title: "PM2 Daemon Reachability",
      passed: true,
      message: `PM2 daemon is reachable and responding (${pm.list.length} active process(es))`,
    });
  } else {
    checks.push({
      id: "pm2_daemon",
      title: "PM2 Daemon Reachability",
      passed: false,
      message: "PM2 daemon is not reachable or not running on host",
    });
  }

  // Check 2: Target app in PM2 process table
  const targetName = targetConfig.target || targetConfig.name || "";
  if (pm.type === "pm2") {
    if (!targetName) {
      checks.push({
        id: "target_app",
        title: "Target Process Table Entry",
        passed: pm.list.length > 0,
        message: pm.list.length > 0
          ? `PM2 daemon is running ${pm.list.length} process(es)`
          : "PM2 daemon reachable; no target processes configured yet",
      });
    } else {
      const proc = pm.list.find((p) => p.name === targetName);
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
  } else {
    checks.push({
      id: "target_app",
      title: "Target Process Table Entry",
      passed: false,
      message: "Cannot inspect process table: PM2 daemon is offline",
    });
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
        message: `Releases directory '${releasesDir}' does not exist on host`,
      });
    }

    try {
      const lstat = await fs.promises.lstat(currentSymlink);
      const isSymlink = lstat.isSymbolicLink();
      checks.push({
        id: "current_symlink",
        title: "Current Symlink",
        passed: isSymlink,
        message: isSymlink
          ? `Current symlink '${currentSymlink}' is valid`
          : `'${currentSymlink}' exists but is not a symbolic link`,
      });
    } catch {
      checks.push({
        id: "current_symlink",
        title: "Current Symlink",
        passed: false,
        message: `Current symlink '${currentSymlink}' does not exist`,
      });
    }

    try {
      await fs.promises.access(releasesDir, fs.constants.W_OK);
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: true,
        message: `Releases directory '${releasesDir}' is writable for atomic symlink rollback`,
      });
    } catch (err) {
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: false,
        message: `Releases directory '${releasesDir}' is not writable: ${err.message || String(err)}`,
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
  console.log("            CARF Host PM2 Verification");
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
  if (!INSTALL_TOKEN) return null;
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
  if (!INSTALL_TOKEN) return null;
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
  console.log(`[carf-agent] Starting CARF Host Agent v${VERSION}`);

  if (!INSTALL_TOKEN) {
    console.log(`[carf-agent] Notice: CARF_INSTALL_TOKEN is not configured.`);
    console.log(`[carf-agent] Running in local standby mode under PM2.`);
    console.log(`[carf-agent] To connect this server to your CARF dashboard:`);
    console.log(`[carf-agent]   node ${agentFilePath()} --token=<your_token>`);
    console.log(`[carf-agent]   Or set CARF_INSTALL_TOKEN in ~/.carf/agent/.env`);
  } else {
    console.log(`[carf-agent] Connecting to central API at: ${CENTRAL_URL}`);
  }

  let remoteData = await fetchConfig();
  const targetConfig = remoteData?.config?.adapter || remoteData?.config || {};

  // Run initial verification
  const checks = await runLocalVerification(targetConfig);
  printCheckSummary(checks);

  if (INSTALL_TOKEN) {
    const heartbeatRes = await sendHeartbeat(checks);
    if (heartbeatRes?.ok) {
      console.log(`[carf-agent] Connected to central API for ${heartbeatRes.owner}/${heartbeatRes.repo} ✓`);
    }

    try {
      await maybeSelfUpdate();
    } catch (err) {
      console.error(`[carf-agent] Self-update skipped: ${err.message}`);
    }
  }

  // Periodic loop: heartbeats if connected, or re-checking .env if in standby
  const interval = setInterval(async () => {
    try {
      if (!INSTALL_TOKEN) {
        loadEnv();
        if (process.env.CARF_INSTALL_TOKEN) {
          INSTALL_TOKEN = process.env.CARF_INSTALL_TOKEN;
          console.log("[carf-agent] Detected CARF_INSTALL_TOKEN! Connecting to central API...");
        } else {
          return;
        }
      }

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

// Check for --token or -t
const tokenArgMatch = args.find((a) => a.startsWith("--token="))?.slice(8) ||
  (args.indexOf("-t") !== -1 ? args[args.indexOf("-t") + 1] : null);

if (isMain && (args.includes("--help") || args.includes("-h"))) {
  console.log(`
CARF Host Agent v${VERSION}
Managed PM2 daemon for host deployment rollback monitoring.

Usage:
  node agent.mjs [options]

Options:
  --token=<token>, -t <token>   Set or update CARF install token and connect
  --verify                      Run preflight verification checks against PM2
  --uninstall                   Notify central API and revoke agent connection
  --help, -h                    Show this help message
`);
  process.exit(0);
} else if (isMain && tokenArgMatch) {
  saveTokenToEnv(tokenArgMatch);
  console.log(`[carf-agent] ✓ Install token saved to environment.`);
  (async () => {
    try {
      const pm = await detectProcessManager();
      if (pm.type === "pm2" && pm.available) {
        console.log(`[carf-agent] Restarting PM2 process 'carf-agent' to apply token...`);
        await runCmd("pm2 restart carf-agent --update-env");
        console.log(`[carf-agent] ✓ PM2 process updated and running.`);
      } else {
        console.log(`[carf-agent] Starting agent daemon with new token...`);
        await startDaemon();
      }
    } catch (err) {
      console.error(`[carf-agent] Error applying token: ${err.message}`);
    }
  })();
} else if (isMain && args.includes("--verify")) {
  (async () => {
    try {
      let targetConfig = {};
      if (INSTALL_TOKEN) {
        const remoteData = await fetchConfig();
        targetConfig = remoteData?.config?.adapter || remoteData?.config || {};
      }
      const checks = await runLocalVerification(targetConfig);
      printCheckSummary(checks);
      if (INSTALL_TOKEN) {
        await sendHeartbeat(checks);
      }
      process.exit(checks.every((c) => c.passed) ? 0 : 0);
    } catch (err) {
      console.error(`Verification error: ${err.message}`);
      process.exit(1);
    }
  })();
} else if (isMain && args.includes("--uninstall")) {
  (async () => {
    try {
      if (INSTALL_TOKEN) {
        console.log("[carf-agent] Calling central API uninstall endpoint...");
        await apiRequest("/api/agent/uninstall", "POST");
        console.log("[carf-agent] Uninstall recorded with central API.");
      }
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

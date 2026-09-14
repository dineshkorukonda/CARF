import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Auto-load .env file if running directly under Node in production
try {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignore if already loaded or not found
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  githubAppId: () => requireEnv("GITHUB_APP_ID"),
  githubAppPrivateKey: () => normalizePrivateKey(requireEnv("GITHUB_APP_PRIVATE_KEY")),
  githubWebhookSecret: () => requireEnv("GITHUB_WEBHOOK_SECRET"),
  /** Only required when .carf.yml configures adapter.kind: "gitops" -- see GitOpsAdapter. */
  argoCdBaseUrl: () => requireEnv("ARGOCD_BASE_URL"),
  argoCdAuthToken: () => requireEnv("ARGOCD_AUTH_TOKEN"),
};

import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env.js";

// Every secret core-api needs comes through here. The value of failing loudly at startup is
// that a missing variable never turns into a confusing downstream error -- an unsigned JWT
// or an unverifiable webhook -- so the "throws, and names the variable" behaviour is worth
// pinning.

const LAZY_VARS = [
  ["GITHUB_APP_ID", () => env.githubAppId()],
  ["GITHUB_APP_PRIVATE_KEY", () => env.githubAppPrivateKey()],
  ["GITHUB_WEBHOOK_SECRET", () => env.githubWebhookSecret()],
  ["ARGOCD_BASE_URL", () => env.argoCdBaseUrl()],
  ["ARGOCD_AUTH_TOKEN", () => env.argoCdAuthToken()],
] as const;

const saved = new Map<string, string | undefined>();

function setEnv(name: string, value: string | undefined): void {
  if (!saved.has(name)) saved.set(name, process.env[name]);
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  saved.clear();
});

describe("env", () => {
  it.each(LAZY_VARS)("%s is returned when set", (name, read) => {
    setEnv(name, "a-configured-value");

    expect(read()).toBe("a-configured-value");
  });

  it.each(LAZY_VARS)("%s throws by name when missing", (name, read) => {
    setEnv(name, undefined);

    expect(read).toThrow(`Missing required environment variable: ${name}`);
  });

  // An empty string is as unusable as an absent one -- an empty webhook secret would verify
  // every signature against "" rather than failing.
  it.each(LAZY_VARS)("%s throws when set to an empty string", (name, read) => {
    setEnv(name, "");

    expect(read).toThrow(`Missing required environment variable: ${name}`);
  });

  // These two are only needed when .carf.yml selects adapter.kind "gitops", so they must
  // stay lazy: reading them at import time would make every deployment require ArgoCD
  // credentials it may have no use for.
  it("does not read the ArgoCD variables until they are called", () => {
    setEnv("ARGOCD_BASE_URL", undefined);
    setEnv("ARGOCD_AUTH_TOKEN", undefined);

    expect(() => env.githubAppId).not.toThrow();
    expect(typeof env.argoCdBaseUrl).toBe("function");
  });

  it("defaults the port to 3001", () => {
    // `port` is resolved once at module load, so this pins the resolved value rather than
    // re-reading PORT. The default is what CI, the .env.example and the dashboard's
    // CORE_API_BASE_URL all assume.
    expect(env.port).toBe(3001);
  });
});

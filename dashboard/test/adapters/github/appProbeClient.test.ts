import { describe, it, expect, vi } from "vitest";
import {
  fetchAppDetails,
  listAppInstallations,
  runGithubAppProbe,
  type AppProbeEnv,
} from "../../../src/adapters/github/appProbeClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";
import { generateKeyPairSync } from "crypto";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("appProbeClient", () => {
  describe("fetchAppDetails", () => {
    it("fetches app metadata from GitHub API", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 12345,
          slug: "carf-cp",
          name: "CARF Continuous Protection",
          owner: { login: "carf-dev", type: "Organization" },
          permissions: { contents: "read", metadata: "read", pull_requests: "read" },
          events: ["push", "pull_request"],
        }),
      });

      const app = await fetchAppDetails("fake-jwt", mockFetch as unknown as FetchFn);
      expect(app.id).toBe(12345);
      expect(app.slug).toBe("carf-cp");
      expect(app.name).toBe("CARF Continuous Protection");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/app",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer fake-jwt" }),
        })
      );
    });

    it("throws when GitHub API returns an error", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Bad credentials",
      });

      await expect(fetchAppDetails("invalid-jwt", mockFetch as unknown as FetchFn)).rejects.toThrow(
        /GitHub app details fetch failed \(status 401\)/
      );
    });
  });

  describe("listAppInstallations", () => {
    it("lists installations registered on GitHub for the app", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 998877,
            account: { login: "dineshkorukonda", type: "User" },
            repository_selection: "selected",
            html_url: "https://github.com/settings/installations/998877",
          },
        ],
      });

      const installations = await listAppInstallations("fake-jwt", mockFetch as unknown as FetchFn);
      expect(installations).toHaveLength(1);
      expect(installations[0]?.id).toBe(998877);
      expect(installations[0]?.account?.login).toBe("dineshkorukonda");
    });
  });

  describe("runGithubAppProbe", () => {
    it("passes all stages when credentials and GitHub APIs respond positively", async () => {
      const env: AppProbeEnv = {
        appId: "12345",
        appSlug: "carf-cp",
        privateKey: privateKey,
        coreApiBaseUrl: "https://api.carf.indevs.in",
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://api.github.com/app") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 12345,
              slug: "carf-cp",
              name: "CARF Continuous Protection",
              owner: { login: "dineshkorukonda", type: "User" },
              permissions: { contents: "read", metadata: "read" },
              events: ["push"],
            }),
          };
        }
        if (url === "https://api.github.com/app/installations") {
          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 554433,
                account: { login: "dineshkorukonda", type: "User" },
                repository_selection: "selected",
              },
            ],
          };
        }
        if (url.includes("/access_tokens")) {
          return {
            ok: true,
            status: 201,
            json: async () => ({ token: "ghs_test123", expires_at: "2026-09-13T16:00:00Z" }),
          };
        }
        if (url.startsWith("https://api.github.com/installation/repositories")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              repositories: [
                { id: 1, name: "CARF", full_name: "dineshkorukonda/CARF", owner: { login: "dineshkorukonda" }, default_branch: "main" },
              ],
            }),
          };
        }
        if (url === "https://api.carf.indevs.in/health") {
          return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
        }
        return { ok: false, status: 404 };
      });

      const report = await runGithubAppProbe({
        env,
        localInstallationIds: ["554433"],
        fetchFn: mockFetch as unknown as FetchFn,
      });

      expect(report.overallStatus).toBe("healthy");
      expect(report.checks.credentials.status).toBe("ok");
      expect(report.checks.githubApp.status).toBe("ok");
      expect(report.checks.githubApp.appSlug).toBe("carf-cp");
      expect(report.checks.installations.status).toBe("ok");
      expect(report.checks.installations.totalOnGithub).toBe(1);
      expect(report.checks.tokenAndRepos.status).toBe("ok");
      expect(report.checks.tokenAndRepos.accessibleRepos).toContain("dineshkorukonda/CARF");
    });

    it("detects slug mismatch between env and GitHub", async () => {
      const env: AppProbeEnv = {
        appId: "12345",
        appSlug: "carf-cp",
        privateKey: privateKey,
      };

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url === "https://api.github.com/app") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              id: 12345,
              slug: "carf-rollback-app",
              name: "CARF",
              owner: { login: "dineshkorukonda", type: "User" },
              permissions: {},
              events: [],
            }),
          };
        }
        return { ok: true, status: 200, json: async () => [] };
      });

      const report = await runGithubAppProbe({
        env,
        localInstallationIds: [],
        fetchFn: mockFetch as unknown as FetchFn,
      });

      expect(report.checks.githubApp.status).toBe("warning");
      expect(report.checks.githubApp.slugMismatch).toBe(true);
      expect(report.checks.githubApp.message).toContain("carf-rollback-app");
    });

    it("handles missing or invalid private key gracefully", async () => {
      const env: AppProbeEnv = {
        appId: "12345",
        appSlug: "carf-cp",
        privateKey: "not-a-real-pem-key",
      };

      const report = await runGithubAppProbe({
        env,
        localInstallationIds: [],
        fetchFn: vi.fn() as unknown as FetchFn,
      });

      expect(report.overallStatus).toBe("failed");
      expect(report.checks.credentials.status).toBe("error");
      expect(report.checks.credentials.message).toMatch(/JWT/i);
    });
  });
});

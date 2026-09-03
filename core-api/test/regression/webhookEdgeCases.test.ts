import { describe, expect, it, vi } from "vitest";
import { parseWebhookPayload } from "../../src/adapters/github/webhookPayload.js";
import { acquireDiff } from "../../src/adapters/github/diffAcquisition.js";
import type { GitHubApiClient } from "../../src/adapters/github/githubApiClient.js";

describe("Regression: Webhook Edge Cases & Safe Diff Acquisition", () => {
  it("ignores branch deletion events with zero head SHA or deleted: true", () => {
    const deletedPushPayload = {
      ref: "refs/heads/feature-branch",
      before: "6dcb09b5b57875f334f61aebed695e2e4193db5e",
      after: "0000000000000000000000000000000000000000",
      deleted: true,
      repository: {
        name: "widgets",
        owner: { name: "acme" },
      },
      installation: { id: 12345 },
    };

    const target = parseWebhookPayload("push", deletedPushPayload);
    expect(target).toBeNull();
  });

  it("handles renamed files by fetching baseSha content using previous_filename", async () => {
    const getContentCalls: Array<{ path: string; ref: string }> = [];

    const mockGithubClient: GitHubApiClient = {
      compareCommits: vi.fn(async () => ({
        files: [
          {
            filename: "src/renamedService.ts",
            status: "renamed" as const,
            previous_filename: "src/originalService.ts",
          },
        ],
      })),
      getContent: vi.fn(async (_owner, _repo, path, ref) => {
        getContentCalls.push({ path, ref });
        if (path === "src/originalService.ts" && ref === "base123") {
          return "export class Service { version = 1; }";
        }
        if (path === "src/renamedService.ts" && ref === "head456") {
          return "export class Service { version = 2; }";
        }
        throw { status: 404 };
      }),
    };

    const diff = await acquireDiff(
      mockGithubClient,
      "acme",
      "widgets",
      "base123",
      "head456",
      "token-xyz"
    );

    expect(diff).toHaveLength(1);
    expect(diff[0]?.path).toBe("src/renamedService.ts");
    expect(diff[0]?.before).toContain("version = 1");
    expect(diff[0]?.after).toContain("version = 2");

    // Verified that baseSha lookup used the previous filename, avoiding 404s
    const baseCall = getContentCalls.find((c) => c.ref === "base123");
    expect(baseCall?.path).toBe("src/originalService.ts");

    const headCall = getContentCalls.find((c) => c.ref === "head456");
    expect(headCall?.path).toBe("src/renamedService.ts");
  });
});

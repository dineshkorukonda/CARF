import { describe, expect, it } from "vitest";
import { parseWebhookPayload } from "../../../src/adapters/github/webhookPayload.js";

const pushPayload = {
  before: "abc111",
  after: "def222",
  repository: { name: "CARF", owner: { login: "dineshkorukonda" } },
  installation: { id: 12345 },
};

const pullRequestPayload = {
  action: "synchronize",
  pull_request: {
    base: { sha: "base111" },
    head: { sha: "head222" },
  },
  repository: { name: "CARF", owner: { login: "dineshkorukonda" } },
  installation: { id: 67890 },
};

describe("parseWebhookPayload", () => {
  it("extracts owner/repo/baseSha/headSha/installationId from a push payload", () => {
    const result = parseWebhookPayload("push", pushPayload);
    expect(result).toEqual({
      owner: "dineshkorukonda",
      repo: "CARF",
      baseSha: "abc111",
      headSha: "def222",
      installationId: "12345",
      event: "push",
    });
  });

  it("extracts owner/repo/baseSha/headSha/installationId from a pull_request payload", () => {
    const result = parseWebhookPayload("pull_request", pullRequestPayload);
    expect(result).toEqual({
      owner: "dineshkorukonda",
      repo: "CARF",
      baseSha: "base111",
      headSha: "head222",
      installationId: "67890",
      event: "pull_request",
    });
  });

  it("returns null for an unsupported event type", () => {
    expect(parseWebhookPayload("issues", pushPayload)).toBeNull();
  });

  it("returns null when installation is missing (app not installed / non-App webhook)", () => {
    const { installation, ...withoutInstallation } = pushPayload;
    expect(parseWebhookPayload("push", withoutInstallation)).toBeNull();
  });

  it("returns null when a push payload is missing required fields", () => {
    expect(parseWebhookPayload("push", { installation: { id: 1 } })).toBeNull();
  });

  it("returns null when a pull_request payload is missing required fields", () => {
    expect(parseWebhookPayload("pull_request", { installation: { id: 1 } })).toBeNull();
  });
});

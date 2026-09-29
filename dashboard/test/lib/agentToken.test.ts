import { describe, it, expect } from "vitest";
import { generateInstallToken, hashInstallToken, verifyInstallToken } from "../../src/lib/agentToken";
import { deriveAgentStatus, getAgentBadgeVariant } from "../../src/lib/repoStatusDerivation";

describe("agentToken", () => {
  it("generates a random install token prefixed with carf_inst_", () => {
    const { token, hash, prefix } = generateInstallToken();
    expect(token).toMatch(/^carf_inst_[a-f0-9]{48}$/);
    expect(hash).toHaveLength(64); // SHA-256
    expect(prefix).toBe(token.slice(0, 14));
  });

  it("hashes identically for the same input", () => {
    const token = "carf_inst_1234567890abcdef1234567890abcdef1234567890abcdef";
    const hash1 = hashInstallToken(token);
    const hash2 = hashInstallToken(token);
    expect(hash1).toBe(hash2);
    expect(verifyInstallToken(token, hash1)).toBe(true);
  });

  it("fails verification for altered or invalid tokens", () => {
    const { token, hash } = generateInstallToken();
    expect(verifyInstallToken(token + "x", hash)).toBe(false);
    expect(verifyInstallToken("wrong_token", hash)).toBe(false);
    expect(verifyInstallToken("", hash)).toBe(false);
  });
});

describe("deriveAgentStatus", () => {
  const baseTime = new Date("2026-09-29T12:00:00Z").getTime();

  it("returns revoked if agentRevoked is true", () => {
    const status = deriveAgentStatus({
      agentRevoked: true,
      agentLastHeartbeat: new Date(baseTime),
      now: baseTime,
    });
    expect(status).toBe("revoked");
  });

  it("returns never-installed if agentLastHeartbeat is null or undefined", () => {
    expect(deriveAgentStatus({ agentLastHeartbeat: null, now: baseTime })).toBe("never-installed");
    expect(deriveAgentStatus({ agentLastHeartbeat: undefined, now: baseTime })).toBe("never-installed");
  });

  it("returns online if heartbeat was within 5 minutes", () => {
    // 2 minutes ago
    const status = deriveAgentStatus({
      agentLastHeartbeat: new Date(baseTime - 2 * 60 * 1000),
      now: baseTime,
    });
    expect(status).toBe("online");
  });

  it("returns offline if heartbeat was older than 5 minutes", () => {
    // 6 minutes ago
    const status = deriveAgentStatus({
      agentLastHeartbeat: new Date(baseTime - 6 * 60 * 1000),
      now: baseTime,
    });
    expect(status).toBe("offline");
  });

  it("returns appropriate badge styling", () => {
    expect(getAgentBadgeVariant("online").label).toBe("Agent Online");
    expect(getAgentBadgeVariant("offline").label).toBe("Agent Offline");
    expect(getAgentBadgeVariant("revoked").label).toBe("Agent Revoked");
    expect(getAgentBadgeVariant("never-installed").label).toBe("Agent Not Installed");
  });
});

import { describe, expect, it } from "vitest";
import { GET } from "../../src/app/api/agent/version/route";
import { AGENT_RELEASE_VERSION } from "../../src/lib/agentVersion";

describe("GET /api/agent/version", () => {
  it("returns the published agent version without requiring a token", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(AGENT_RELEASE_VERSION);
    expect(body.artifact).toBe("/agent/agent.mjs");
  });
});

import { expect, it, vi } from "vitest";
vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: async () => ({ id: "user" }) }));
import { POST } from "../../src/app/api/rollout/intervention/route";

it("does not pretend a fabricated health report executed a manual intervention", async () => {
  const response = await POST();
  expect(response.status).toBe(410);
  expect((await response.json()).error).toContain("rollout-specific");
});

import { expect, it } from "vitest";
import { localRuntimeAllowed } from "../../src/auth/localRuntime.js";

it("requires an explicit operator binding before any installation may control the local host", () => {
  expect(localRuntimeAllowed("tenant", "")).toBe(false);
  expect(localRuntimeAllowed("tenant", "other")).toBe(false);
  expect(localRuntimeAllowed(null, "tenant")).toBe(false);
  expect(localRuntimeAllowed("tenant", "tenant")).toBe(true);
});

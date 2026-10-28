import { expect, it } from "vitest";
import * as dashboard from "../../src/lib/capabilities";
import * as backend from "../../../core-api/src/capabilities/resolver";
it("uses the backend implementation for every setup preview", () => {
  expect(dashboard.resolveCapabilities).toBe(backend.resolveCapabilities);
  expect(dashboard.resolveFromLegacy).toBe(backend.resolveFromLegacy);
  for (const integration of backend.DEPLOYMENT_INTEGRATIONS) {
    for (const runtime of backend.RUNTIME_ADAPTERS) {
      expect(dashboard.resolveCapabilities(integration, runtime)).toEqual(backend.resolveCapabilities(integration, runtime));
    }
  }
});

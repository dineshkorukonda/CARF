import { expect, it } from "vitest";
import { buildRuntimeAdapter, dockerDeploymentImage } from "../../src/adapters/runtimeFactory.js";
import { DockerAdapter } from "../../src/adapters/docker.js";
import { PM2Adapter } from "../../src/adapters/pm2.js";

it("uses the same runtime kind for deployment, recovery, and manual rollback", () => {
  expect(buildRuntimeAdapter({ kind: "docker", target: "api", composeFile: "compose.yml" }, "image:old")).toBeInstanceOf(DockerAdapter);
  expect(buildRuntimeAdapter({ kind: "pm2", target: "api" }, "old-sha")).toBeInstanceOf(PM2Adapter);
});
it("requires Docker images tied to the requested commit", () => {
  expect(dockerDeploymentImage("registry/app:{sha}", "abc")).toBe("registry/app:abc");
  expect(dockerDeploymentImage("registry/app:abc", "abc")).toBe("registry/app:abc");
  expect(() => dockerDeploymentImage("registry/app:latest", "abc")).toThrow("exact commit SHA");
});

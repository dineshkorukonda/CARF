import { describe, expect, it, vi } from "vitest";
import { InstallationTokenClient } from "../../../src/adapters/github/installationTokenClient.js";
import type {
  InstallationTokenExchangeClient,
  JwtSigner,
} from "../../../src/adapters/github/installationTokenClient.js";

function setup(expiresInMs = 60 * 60 * 1000) {
  const exchangeClient: InstallationTokenExchangeClient = {
    createInstallationToken: vi.fn().mockResolvedValue({
      token: "ghs_installationtoken",
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    }),
  };
  const jwtSigner: JwtSigner = { sign: vi.fn().mockReturnValue("app-jwt") };
  const client = new InstallationTokenClient(exchangeClient, jwtSigner, "app-id", "private-key");
  return { exchangeClient, jwtSigner, client };
}

describe("InstallationTokenClient", () => {
  it("returns a valid token for an installation", async () => {
    const { client } = setup();
    const token = await client.getInstallationToken("12345");
    expect(token).toBe("ghs_installationtoken");
  });

  it("caches the token across repeated calls, exchanging only once", async () => {
    const { client, exchangeClient } = setup();
    await client.getInstallationToken("12345");
    await client.getInstallationToken("12345");
    await client.getInstallationToken("12345");
    expect(exchangeClient.createInstallationToken).toHaveBeenCalledTimes(1);
  });

  it("refreshes transparently once the cached token is near expiry", async () => {
    const { client, exchangeClient } = setup(30_000); // expires in 30s, inside the refresh buffer
    await client.getInstallationToken("12345");
    await client.getInstallationToken("12345");
    expect(exchangeClient.createInstallationToken).toHaveBeenCalledTimes(2);
  });

  it("caches per-installation independently", async () => {
    const { client, exchangeClient } = setup();
    await client.getInstallationToken("aaa");
    await client.getInstallationToken("bbb");
    await client.getInstallationToken("aaa");
    expect(exchangeClient.createInstallationToken).toHaveBeenCalledTimes(2);
  });

  it("signs a fresh App JWT for each exchange call, never reusing a bare PAT", async () => {
    const { client, jwtSigner, exchangeClient } = setup(30_000);
    await client.getInstallationToken("12345");
    await client.getInstallationToken("12345");
    expect(jwtSigner.sign).toHaveBeenCalledTimes(2);
    expect(jwtSigner.sign).toHaveBeenCalledWith("app-id", "private-key");
    expect(exchangeClient.createInstallationToken).toHaveBeenCalledWith("12345", "app-jwt");
  });
});

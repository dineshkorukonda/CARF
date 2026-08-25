import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerGithubStatusRoute } from "../../src/routes/githubStatus.js";
import type { JwtSigner } from "../../src/adapters/github/installationTokenClient.js";
import type { AppInfoClient, Installation } from "../../src/adapters/github/appInfoClient.js";

class FakeJwtSigner implements JwtSigner {
  sign(appId: string, privateKey: string): string {
    return `jwt-for-${appId}-${privateKey}`;
  }
}

class FakeAppInfoClient implements AppInfoClient {
  constructor(
    private readonly installations: Installation[] = [],
    private readonly error?: unknown
  ) {}

  async listInstallations(): Promise<Installation[]> {
    if (this.error) throw this.error;
    return this.installations;
  }
}

describe("GET /v1/github/status", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("returns connected: true with the app's installations when GitHub accepts the App JWT", async () => {
    app = Fastify();
    await registerGithubStatusRoute(app, {
      appId: "12345",
      privateKey: "fake-pem",
      jwtSigner: new FakeJwtSigner(),
      appInfoClient: new FakeAppInfoClient([{ id: 1, account: "dineshkorukonda" }]),
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/github/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      connected: true,
      installationCount: 1,
      installations: [{ id: 1, account: "dineshkorukonda" }],
    });
  });

  it("returns connected: false with an error message when GitHub rejects the credentials", async () => {
    app = Fastify();
    await registerGithubStatusRoute(app, {
      appId: "12345",
      privateKey: "wrong-pem",
      jwtSigner: new FakeJwtSigner(),
      appInfoClient: new FakeAppInfoClient([], { status: 401, message: "Bad credentials" }),
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/github/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      connected: false,
      error: "Bad credentials",
    });
  });

  it("returns connected: false when required env vars are missing and no options are injected", async () => {
    app = Fastify();
    const originalAppId = process.env.GITHUB_APP_ID;
    delete process.env.GITHUB_APP_ID;

    await registerGithubStatusRoute(app);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/github/status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      connected: false,
      error: "Missing required environment variable: GITHUB_APP_ID",
    });

    if (originalAppId === undefined) delete process.env.GITHUB_APP_ID;
    else process.env.GITHUB_APP_ID = originalAppId;
  });

  it("sets Access-Control-Allow-Origin: * so any adopter's web frontend can call it cross-origin", async () => {
    app = Fastify();
    await registerGithubStatusRoute(app, {
      appId: "12345",
      privateKey: "fake-pem",
      jwtSigner: new FakeJwtSigner(),
      appInfoClient: new FakeAppInfoClient([]),
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/github/status" });

    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });
});

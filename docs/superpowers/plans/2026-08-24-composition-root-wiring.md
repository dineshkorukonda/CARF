# Composition Root Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Workflow (overrides the sub-skill's default branch/PR handling):** This
> is ONE cohesive unit of wiring, not independently mergeable increments —
> a webhook that classifies but can't respond, or responds but can't
> branch on mode, is not a usable intermediate state. Unlike a
> multi-issue/multi-PR plan:
> 1. Create a single branch off `main` before Task 1:
>    `git checkout -b composition-root/webhook-wiring origin/main`.
> 2. Work every task on this one branch. Commit locally after each task
>    (as each task's own step directs) — these are checkpoints for
>    iterating, not the final history.
> 3. After Task 9 (final verification) passes, **squash every local
>    commit into exactly one** (Task 10), open **one** GitHub issue via
>    `gh issue create` describing the full scope, then **one** PR via `gh
>    pr create` with a body containing `Closes #<issue-number>`.
> 4. Confirm the `core-api CI` workflow passes on the PR before treating
>    this as done. Do not merge — leave that to the user.
> Do not add a "Co-Authored-By: Claude" trailer to any commit.

**Goal:** Wire core-api's existing, independently-tested pieces (webhook
receiver, classifier, threshold engine, persistence, `.carf.yml` loader,
Standalone adapters) into one live path: a real webhook POST triggers
signature verification → diff acquisition → classification → threshold
computation → persistence → an HTTP response, and, in Standalone mode
with a Kubernetes adapter, an additional asynchronous rollback-monitoring
loop.

**Architecture:** Three real GitHub App adapters (JWT signing, token
exchange, REST API client — currently only interfaces exist) feed a new
`webhookOrchestrator.ts` composition root, which calls the existing
`processCommit()` (gaining `baseSha`/`installationId`/`classificationRules`
parameters) and then branches on `.carf.yml`'s `mode`. `buildApp()` gains
an optional `webhook` option (mirroring its existing `threshold` option);
`index.ts` becomes the sole place that loads `.carf.yml` once and wires
real singletons together.

**Tech Stack:** TypeScript (strict, `exactOptionalPropertyTypes`),
Fastify, `jsonwebtoken` (new dependency — synchronous RS256 signing, not
`jose`, to match the existing synchronous `JwtSigner` interface), global
`fetch` (Node 22, no new HTTP dependency), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-24-composition-root-design.md`

## Global Constraints

- Docker Compose adapter support for the Standalone loop kickoff is out
  of scope. `DockerComposeAdapter` requires a `previousImageTag: string`
  constructor argument that `.carf.yml`'s `AdapterSchema` (`{ kind,
  target }`) has no field for. `adapter.kind: "dockerCompose"` in
  Standalone mode logs an error and skips the loop; `processCommit`'s
  classify/persist result still succeeds. A follow-up issue (Task 10)
  tracks the schema extension.
- The Standalone loop idempotency guard (`activeLoops` `Set<string>` in
  `webhookOrchestrator.ts`) is process-local and best-effort only — it
  does not survive a process restart and does not protect against more
  than one core-api instance running concurrently. This is a documented,
  deliberate limitation, not an oversight.
- `.carf.yml` is loaded once at process startup (`index.ts`). No
  hot-reload.
- No retry/backoff logic beyond GitHub's own webhook redelivery is
  built. A thrown error during the awaited portion of
  `handleWebhookCommit` (diff acquisition, classification, DB writes)
  propagates uncaught to Fastify's default error handler → 500 → GitHub
  redelivers on its own schedule.
- `pipeline.ts` and `classifier/`/`threshold/` stay pure (no new I/O
  beyond what already exists) — every new parameter added to
  `processCommit()` is optional, plain data, defaulting to today's exact
  behavior.
- `jsonwebtoken`, not `jose`: `installationTokenClient.ts`'s `JwtSigner`
  interface is synchronous (`sign(appId, privateKey): string`, no
  `Promise`) and its only consumer calls it unawaited. `jose`'s signing
  API is async and would require changing that already-tested interface
  — out of scope. `jsonwebtoken`'s `jwt.sign(...)` returns a string
  synchronously when called without a callback.
- `exactOptionalPropertyTypes` is on (see `tsconfig.json`) — any type
  with an optional field that may be explicitly assigned `undefined`
  (e.g. `installationId`) must declare it as `field?: T | undefined`,
  not just `field?: T`, or assignment fails to typecheck.
- All new adapters (`RealJwtSigner`, `RealInstallationTokenExchangeClient`,
  `HttpGithubApiClient`) take an injectable function (`fetch`, matching
  the existing `ExecFn` convention in `kubectl.ts`/`dockerCompose.ts`) so
  tests never hit the network.

---

## Task 1: `jsonwebtoken` dependency + `RealJwtSigner`

**Files:**
- Modify: `core-api/package.json` (add `jsonwebtoken` + `@types/jsonwebtoken`)
- Create: `core-api/src/adapters/github/realJwtSigner.ts`
- Test: `core-api/test/adapters/github/realJwtSigner.test.ts`

**Interfaces:**
- Consumes: `type JwtSigner` from `./installationTokenClient.js` (existing).
- Produces: `class RealJwtSigner implements JwtSigner` — consumed by
  Task 4 (`client.ts`).

- [ ] **Step 1: Add the `jsonwebtoken` dependency**

```bash
git checkout -b composition-root/webhook-wiring origin/main
cd core-api && npm install jsonwebtoken@^9.0.2 && npm install -D @types/jsonwebtoken@^9.0.7
```

- [ ] **Step 2: Write the failing test**

Create `core-api/test/adapters/github/realJwtSigner.test.ts`:

```ts
import { generateKeyPairSync } from "node:crypto";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { RealJwtSigner } from "../../../src/adapters/github/realJwtSigner.js";

// Real RSA keypair, generated once per test file — no network, no mocking of
// jsonwebtoken itself, so this test exercises the real signing/verification round trip.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("RealJwtSigner", () => {
  it("returns a JWT string synchronously (matches the JwtSigner interface, no Promise)", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);
    expect(typeof token).toBe("string");
  });

  it("signs with RS256 and sets iss to the given App ID, verifiable with the matching public key", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);

    const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    expect(typeof payload).toBe("object");
    expect((payload as jwt.JwtPayload).iss).toBe("app-123");
  });

  it("sets an expiry roughly 10 minutes out", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);

    const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThan(nowSeconds + 9 * 60);
    expect(payload.exp).toBeLessThanOrEqual(nowSeconds + 10 * 60 + 5);
  });

  it("rejects verification against a different keypair (proves it actually signs with the given private key)", () => {
    const signer = new RealJwtSigner();
    const token = signer.sign("app-123", privateKey);

    const { publicKey: otherPublicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    expect(() => jwt.verify(token, otherPublicKey, { algorithms: ["RS256"] })).toThrow();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/adapters/github/realJwtSigner.test.ts`
Expected: FAIL — `Cannot find module '../../../src/adapters/github/realJwtSigner.js'`

- [ ] **Step 4: Implement `RealJwtSigner`**

Create `core-api/src/adapters/github/realJwtSigner.ts`:

```ts
import jwt from "jsonwebtoken";
import type { JwtSigner } from "./installationTokenClient.js";

// GitHub caps App JWTs at 10 minutes; matches installationTokenClient.ts's own
// REFRESH_BUFFER_MS comment about tokens needing a safety margin before expiry.
const APP_JWT_EXPIRES_IN = "10m";

/**
 * Real `JwtSigner`: signs a GitHub App JWT (RS256, `iss` = App ID, ~10 minute expiry)
 * from the App's PEM-encoded private key. Synchronous, matching the `JwtSigner`
 * interface's contract — `jsonwebtoken`'s `sign()` returns a string directly when called
 * without a callback.
 */
export class RealJwtSigner implements JwtSigner {
  sign(appId: string, privateKey: string): string {
    return jwt.sign({}, privateKey, {
      algorithm: "RS256",
      issuer: appId,
      expiresIn: APP_JWT_EXPIRES_IN,
    });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/adapters/github/realJwtSigner.test.ts`
Expected: PASS (4 cases)

- [ ] **Step 6: Run lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit (local checkpoint — will be squashed later)**

```bash
git add core-api/package.json core-api/package-lock.json \
  core-api/src/adapters/github/realJwtSigner.ts \
  core-api/test/adapters/github/realJwtSigner.test.ts
git commit -m "feat(core-api): add RealJwtSigner (RS256, jsonwebtoken)"
```

---

## Task 2: Shared fetch types + `RealInstallationTokenExchangeClient`

**Files:**
- Create: `core-api/src/adapters/github/fetchTypes.ts`
- Create: `core-api/src/adapters/github/realInstallationTokenExchangeClient.ts`
- Test: `core-api/test/adapters/github/realInstallationTokenExchangeClient.test.ts`

**Interfaces:**
- Produces: `interface MinimalFetchResponse`, `type FetchFn` from
  `fetchTypes.js` — consumed by this task and Task 3
  (`httpGithubApiClient.ts`).
- Consumes: `type InstallationTokenExchangeClient` from
  `./installationTokenClient.js` (existing); `type HttpError` from
  `./githubApiClient.js` (existing).
- Produces: `class RealInstallationTokenExchangeClient implements
  InstallationTokenExchangeClient` — consumed by Task 4 (`client.ts`).

- [ ] **Step 1: Write the failing test**

Create `core-api/test/adapters/github/realInstallationTokenExchangeClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { RealInstallationTokenExchangeClient } from "../../../src/adapters/github/realInstallationTokenExchangeClient.js";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes.js";

function fakeFetch(response: { ok: boolean; status: number; json?: unknown; text?: string }): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
    text: async () => response.text ?? "",
  });
}

describe("RealInstallationTokenExchangeClient", () => {
  it("POSTs to the installation access_tokens endpoint with the App JWT as a Bearer token", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      status: 201,
      json: { token: "ghs_abc123", expires_at: "2026-01-01T00:10:00Z" },
    });
    const client = new RealInstallationTokenExchangeClient(fetchFn);

    await client.createInstallationToken("999", "app-jwt-token");

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/999/access_tokens",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer app-jwt-token",
          Accept: "application/vnd.github+json",
        }),
      })
    );
  });

  it("maps the response's token and expires_at (snake_case) to { token, expiresAt }", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      status: 201,
      json: { token: "ghs_abc123", expires_at: "2026-01-01T00:10:00Z" },
    });
    const client = new RealInstallationTokenExchangeClient(fetchFn);

    const result = await client.createInstallationToken("999", "app-jwt-token");

    expect(result).toEqual({ token: "ghs_abc123", expiresAt: "2026-01-01T00:10:00Z" });
  });

  it("throws an HttpError-shaped object on a non-2xx response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 401, text: "Bad credentials" });
    const client = new RealInstallationTokenExchangeClient(fetchFn);

    await expect(client.createInstallationToken("999", "bad-jwt")).rejects.toMatchObject({
      status: 401,
      message: "Bad credentials",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/adapters/github/realInstallationTokenExchangeClient.test.ts`
Expected: FAIL — `Cannot find module '../../../src/adapters/github/realInstallationTokenExchangeClient.js'`

- [ ] **Step 3: Implement the shared fetch types**

Create `core-api/src/adapters/github/fetchTypes.ts`:

```ts
/**
 * Minimal structural subset of the global `Response` type that
 * RealInstallationTokenExchangeClient/HttpGithubApiClient actually use. Real global
 * `fetch()` satisfies this structurally (it returns the full `Response`), so the
 * default parameter can just be `fetch` — tests inject a smaller fake without
 * implementing the entire `Response` interface.
 */
export interface MinimalFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<MinimalFetchResponse>;
```

- [ ] **Step 4: Implement `RealInstallationTokenExchangeClient`**

Create `core-api/src/adapters/github/realInstallationTokenExchangeClient.ts`:

```ts
import type { HttpError } from "./githubApiClient.js";
import type { InstallationTokenExchangeClient } from "./installationTokenClient.js";
import type { FetchFn } from "./fetchTypes.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Real `InstallationTokenExchangeClient`: exchanges a signed App JWT for a short-lived
 * installation access token via GitHub's REST API. `fetchFn` is injectable (defaults to
 * global `fetch`) so tests never hit the network — same DI convention as `ExecFn` in
 * `kubectl.ts`/`dockerCompose.ts`.
 */
export class RealInstallationTokenExchangeClient implements InstallationTokenExchangeClient {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async createInstallationToken(installationId: string, appJwt: string): Promise<{ token: string; expiresAt: string }> {
    const response = await this.fetchFn(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw { status: response.status, message } satisfies HttpError;
    }

    const body = (await response.json()) as { token: string; expires_at: string };
    return { token: body.token, expiresAt: body.expires_at };
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/adapters/github/realInstallationTokenExchangeClient.test.ts`
Expected: PASS (3 cases)

- [ ] **Step 6: Run lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core-api/src/adapters/github/fetchTypes.ts \
  core-api/src/adapters/github/realInstallationTokenExchangeClient.ts \
  core-api/test/adapters/github/realInstallationTokenExchangeClient.test.ts
git commit -m "feat(core-api): add RealInstallationTokenExchangeClient"
```

---

## Task 3: `HttpGithubApiClient`

**Files:**
- Create: `core-api/src/adapters/github/httpGithubApiClient.ts`
- Test: `core-api/test/adapters/github/httpGithubApiClient.test.ts`

**Interfaces:**
- Consumes: `type GitHubApiClient`, `type CompareFile`, `type
  CompareResult`, `type HttpError` from `./githubApiClient.js`
  (existing); `type FetchFn` from `./fetchTypes.js` (Task 2).
- Produces: `class HttpGithubApiClient implements GitHubApiClient` —
  consumed by Task 4 (`client.ts`).

- [ ] **Step 1: Write the failing test**

Create `core-api/test/adapters/github/httpGithubApiClient.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { HttpGithubApiClient } from "../../../src/adapters/github/httpGithubApiClient.js";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes.js";

function fakeFetch(response: { ok: boolean; status: number; json?: unknown; text?: string }): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
    text: async () => response.text ?? "",
  });
}

describe("HttpGithubApiClient", () => {
  describe("compareCommits", () => {
    it("GETs the compare endpoint with Bearer auth and maps files to { filename, status }", async () => {
      const fetchFn = fakeFetch({
        ok: true,
        status: 200,
        json: { files: [{ filename: "src/foo.ts", status: "modified" }, { filename: "README.md", status: "added" }] },
      });
      const client = new HttpGithubApiClient(fetchFn);

      const result = await client.compareCommits("acme", "widgets", "base123", "head456", "token-abc");

      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme/widgets/compare/base123...head456",
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
      );
      expect(result).toEqual({
        files: [
          { filename: "src/foo.ts", status: "modified" },
          { filename: "README.md", status: "added" },
        ],
      });
    });

    it("treats a missing files array as no changed files", async () => {
      const fetchFn = fakeFetch({ ok: true, status: 200, json: {} });
      const client = new HttpGithubApiClient(fetchFn);

      const result = await client.compareCommits("acme", "widgets", "base123", "head456", "token-abc");

      expect(result).toEqual({ files: [] });
    });

    it("throws an HttpError-shaped object on a non-2xx response", async () => {
      const fetchFn = fakeFetch({ ok: false, status: 404, text: "No common ancestor" });
      const client = new HttpGithubApiClient(fetchFn);

      await expect(client.compareCommits("acme", "widgets", "x", "y", "token-abc")).rejects.toMatchObject({
        status: 404,
        message: "No common ancestor",
      });
    });
  });

  describe("getContent", () => {
    it("GETs the contents endpoint and base64-decodes the response", async () => {
      const decoded = "export const a = 1;\n";
      const fetchFn = fakeFetch({
        ok: true,
        status: 200,
        json: { content: Buffer.from(decoded, "utf-8").toString("base64"), encoding: "base64" },
      });
      const client = new HttpGithubApiClient(fetchFn);

      const result = await client.getContent("acme", "widgets", "src/foo.ts", "head456", "token-abc");

      expect(result).toBe(decoded);
      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme/widgets/contents/src/foo.ts?ref=head456",
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
      );
    });

    it("percent-encodes each path segment independently, preserving directory slashes", async () => {
      const fetchFn = fakeFetch({
        ok: true,
        status: 200,
        json: { content: Buffer.from("x", "utf-8").toString("base64"), encoding: "base64" },
      });
      const client = new HttpGithubApiClient(fetchFn);

      await client.getContent("acme", "widgets", "src/my file.ts", "head456", "token-abc");

      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme/widgets/contents/src/my%20file.ts?ref=head456",
        expect.anything()
      );
    });

    it("rejects with an HttpError carrying status 404, matching diffAcquisition.ts's isNotFound() check", async () => {
      const fetchFn = fakeFetch({ ok: false, status: 404, text: "Not Found" });
      const client = new HttpGithubApiClient(fetchFn);

      await expect(client.getContent("acme", "widgets", "missing.ts", "head456", "token-abc")).rejects.toMatchObject({
        status: 404,
      });
    });

    it("throws a plain Error if the response encoding isn't base64 (defensive — GitHub always returns base64 for file content today)", async () => {
      const fetchFn = fakeFetch({ ok: true, status: 200, json: { content: "x", encoding: "none" } });
      const client = new HttpGithubApiClient(fetchFn);

      await expect(client.getContent("acme", "widgets", "src/foo.ts", "head456", "token-abc")).rejects.toThrow(
        /unexpected encoding/
      );
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/adapters/github/httpGithubApiClient.test.ts`
Expected: FAIL — `Cannot find module '../../../src/adapters/github/httpGithubApiClient.js'`

- [ ] **Step 3: Implement `HttpGithubApiClient`**

Create `core-api/src/adapters/github/httpGithubApiClient.ts`:

```ts
import type { CompareFile, CompareResult, GitHubApiClient, HttpError } from "./githubApiClient.js";
import type { FetchFn } from "./fetchTypes.js";

const GITHUB_API_BASE = "https://api.github.com";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Real `GitHubApiClient`: wraps GitHub's REST API using an installation token from
 * `installationTokenClient.ts`. `fetchFn` is injectable (defaults to global `fetch`) so
 * `diffAcquisition.ts`'s tests (and this class's own tests) never hit the network.
 *
 * `compareCommits` reads a single page only — GitHub's compare endpoint returns up to
 * 300 changed files with no pagination on this endpoint; a commit touching more files
 * than that sees a truncated diff. Documented limitation, not handled here.
 */
export class HttpGithubApiClient implements GitHubApiClient {
  constructor(private readonly fetchFn: FetchFn = fetch) {}

  async compareCommits(owner: string, repo: string, base: string, head: string, token: string): Promise<CompareResult> {
    const response = await this.fetchFn(`${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${base}...${head}`, {
      headers: authHeaders(token),
    });

    if (!response.ok) {
      const message = await response.text();
      throw { status: response.status, message } satisfies HttpError;
    }

    const body = (await response.json()) as { files?: Array<{ filename: string; status: string }> };
    const files: CompareFile[] = (body.files ?? []).map((f) => ({
      filename: f.filename,
      status: f.status as CompareFile["status"],
    }));
    return { files };
  }

  async getContent(owner: string, repo: string, path: string, ref: string, token: string): Promise<string> {
    const encodedPath = encodePathSegments(path);
    const response = await this.fetchFn(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`,
      { headers: authHeaders(token) }
    );

    if (!response.ok) {
      const message = await response.text();
      throw { status: response.status, message } satisfies HttpError;
    }

    const body = (await response.json()) as { content: string; encoding: string };
    if (body.encoding !== "base64") {
      throw new Error(`getContent: unexpected encoding "${body.encoding}" for ${path}@${ref}`);
    }
    return Buffer.from(body.content, "base64").toString("utf-8");
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/adapters/github/httpGithubApiClient.test.ts`
Expected: PASS (8 cases)

- [ ] **Step 5: Run lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core-api/src/adapters/github/httpGithubApiClient.ts \
  core-api/test/adapters/github/httpGithubApiClient.test.ts
git commit -m "feat(core-api): add HttpGithubApiClient"
```

---

## Task 4: `client.ts` singleton wiring

**Files:**
- Create: `core-api/src/adapters/github/client.ts`
- Test: `core-api/test/adapters/github/client.test.ts`

**Interfaces:**
- Consumes: `RealJwtSigner` (Task 1), `RealInstallationTokenExchangeClient`
  (Task 2), `HttpGithubApiClient` (Task 3), `InstallationTokenClient`
  (existing), `env` (existing, `core-api/src/config/env.ts`).
- Produces: `const githubApiClient: GitHubApiClient`,
  `function getInstallationTokenClient(): InstallationTokenClient` —
  consumed by Task 8 (`index.ts`).

- [ ] **Step 1: Write the failing test**

Create `core-api/test/adapters/github/client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

describe("adapters/github/client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("importing the module does not throw even without GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY set", async () => {
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    await expect(import("../../../src/adapters/github/client.js")).resolves.toBeDefined();
  });

  it("exports a githubApiClient usable without any env vars set", async () => {
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    const { githubApiClient } = await import("../../../src/adapters/github/client.js");
    expect(githubApiClient).toBeDefined();
    expect(typeof githubApiClient.compareCommits).toBe("function");
  });

  it("getInstallationTokenClient() throws when GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY are missing (lazy validation, only on call)", async () => {
    vi.stubEnv("GITHUB_APP_ID", "");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    const { getInstallationTokenClient } = await import("../../../src/adapters/github/client.js");
    expect(() => getInstallationTokenClient()).toThrow(/GITHUB_APP_ID/);
  });

  it("getInstallationTokenClient() returns the same cached instance across calls when env vars are set", async () => {
    vi.stubEnv("GITHUB_APP_ID", "app-123");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "fake-key-not-parsed-until-signing");
    const { getInstallationTokenClient } = await import("../../../src/adapters/github/client.js");
    const first = getInstallationTokenClient();
    const second = getInstallationTokenClient();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd core-api && npx vitest run test/adapters/github/client.test.ts`
Expected: FAIL — `Cannot find module '../../../src/adapters/github/client.js'`

- [ ] **Step 3: Implement `client.ts`**

Create `core-api/src/adapters/github/client.ts`:

```ts
import { env } from "../../config/env.js";
import { HttpGithubApiClient } from "./httpGithubApiClient.js";
import { InstallationTokenClient } from "./installationTokenClient.js";
import { RealInstallationTokenExchangeClient } from "./realInstallationTokenExchangeClient.js";
import { RealJwtSigner } from "./realJwtSigner.js";

/**
 * Real GitHubApiClient singleton. Needs no env vars at construction time (the
 * installation token is supplied per-call), so it's safe to construct eagerly at module
 * load — importing this module never fails just because env vars aren't set.
 */
export const githubApiClient = new HttpGithubApiClient();

let cachedInstallationTokenClient: InstallationTokenClient | undefined;

/**
 * Lazily constructs the real InstallationTokenClient on first call, not at module load —
 * mirrors src/db/client.ts's lazy-validation convention (see its comment) so importing
 * this module stays safe in test/CI environments without GITHUB_APP_ID/
 * GITHUB_APP_PRIVATE_KEY set. Only calling this function (not importing the module)
 * requires those env vars.
 */
export function getInstallationTokenClient(): InstallationTokenClient {
  if (!cachedInstallationTokenClient) {
    cachedInstallationTokenClient = new InstallationTokenClient(
      new RealInstallationTokenExchangeClient(),
      new RealJwtSigner(),
      env.githubAppId(),
      env.githubAppPrivateKey()
    );
  }
  return cachedInstallationTokenClient;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd core-api && npx vitest run test/adapters/github/client.test.ts`
Expected: PASS (4 cases)

- [ ] **Step 5: Run lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core-api/src/adapters/github/client.ts core-api/test/adapters/github/client.test.ts
git commit -m "feat(core-api): add real GitHub App client singleton (lazy)"
```

---

## Task 5: `processCommit()` gains `baseSha`/`installationId`/`classificationRules`

**Files:**
- Modify: `core-api/src/pipeline.ts`
- Modify: `core-api/test/pipeline.test.ts`

**Interfaces:**
- Consumes: `type UserPatternRule` from `./classifier/tier1.js`
  (existing, from the `.carf.yml` project).
- Produces: `ProcessCommitOptions` gains `baseSha?: string | undefined`,
  `installationId?: string | undefined`, `classificationRules?:
  UserPatternRule[]` — consumed by Task 6 (`webhookOrchestrator.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `core-api/test/pipeline.test.ts`, inside the existing
`describe("processCommit", ...)` block, after the last test (the
`"accepts a custom ThresholdConfig override"` test, just before the
block's closing `});`):

```ts
  it("persists real baseSha and installationId when provided", async () => {
    await processCommit("sha-audit", "acme/widgets", [CODE_TS], {
      prismaClient: fake,
      baseSha: "base-sha-real",
      installationId: "inst-999",
    });

    const commitRow = [...fake.commits.values()][0]!;
    expect(commitRow.baseSha).toBe("base-sha-real");
    expect(commitRow.installationId).toBe("inst-999");
  });

  it("defaults baseSha to \"\" and installationId to undefined when not provided (today's exact behavior)", async () => {
    await processCommit("sha-default", "acme/widgets", [CODE_TS], { prismaClient: fake });

    const commitRow = [...fake.commits.values()][0]!;
    expect(commitRow.baseSha).toBe("");
    expect(commitRow.installationId).toBeUndefined();
  });

  it("threads classificationRules through to classifyCommit, changing classification outcome", async () => {
    // README.md alone classifies as "unclassified" under the hardcoded rules -> would
    // normally throw NoSignalError (see the earlier "throws NoSignalError" test above).
    // A user rule reclassifying it as "config" gives classifyCommit() real signal.
    const result = await processCommit("sha-rules", "acme/widgets", [README], {
      prismaClient: fake,
      classificationRules: [{ type: "config", patterns: ["README.md"] }],
    });

    expect(fake.changeVectorUpsertCalls).toBe(1);
    expect(result.activeTypes).toEqual(["config"]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd core-api && npx vitest run test/pipeline.test.ts`
Expected: FAIL — TS error (extra options `baseSha`/`installationId`/
`classificationRules` not assignable to `ProcessCommitOptions`), or a
runtime assertion failure if TS doesn't error (the new fields would be
silently ignored by the current implementation).

- [ ] **Step 3: Update `FakePrismaClient` in the test file**

In `core-api/test/pipeline.test.ts`, update `FakeCommitRow` and the
`commit.upsert` fake's `create` parameter type to accept the new field
(find and replace these two spots):

```ts
interface FakeCommitRow {
  id: string;
  owner: string;
  repo: string;
  sha: string;
  baseSha: string;
  installationId?: string | undefined;
}
```

```ts
  commit = {
    upsert: async (args: {
      where: { owner_repo_sha: { owner: string; repo: string; sha: string } };
      create: { owner: string; repo: string; sha: string; baseSha: string; installationId?: string | undefined };
      update: Record<string, never>;
    }) => {
```

- [ ] **Step 4: Implement the change in `pipeline.ts`**

Add the import at the top of `core-api/src/pipeline.ts`:

```ts
import type { UserPatternRule } from "./classifier/tier1.js";
```

Update the `PipelinePrismaClient` interface's `commit.upsert` `create`
type:

```ts
export interface PipelinePrismaClient {
  commit: {
    upsert(args: {
      where: { owner_repo_sha: { owner: string; repo: string; sha: string } };
      create: { owner: string; repo: string; sha: string; baseSha: string; installationId?: string | undefined };
      update: Record<string, never>;
    }): Promise<{ id: string }>;
  };
  // ...changeVector, threshold unchanged
```

Update `ProcessCommitOptions`:

```ts
export interface ProcessCommitOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: PipelinePrismaClient;
  /** Threshold engine tuning; defaults to DEFAULT_CONFIG (src/threshold/engine.ts). */
  thresholdConfig?: ThresholdConfig;
  /** Real base SHA from a webhook payload. Defaults to "" (today's exact prior behavior)
   *  when not supplied — see the removed TODO this replaces in the function's old doc
   *  comment. */
  baseSha?: string | undefined;
  /** Real GitHub App installation ID from a webhook payload. Omitted (undefined) by
   *  default, matching the Commit model's nullable installationId column. */
  installationId?: string | undefined;
  /** User classification rules (from .carf.yml), checked before Tier 1's hardcoded
   *  rules — mirrors the identical option already threaded through
   *  evaluation/runHarness.ts's RunEvaluationOptions. Defaults to none. */
  classificationRules?: UserPatternRule[];
}
```

In `processCommit`'s body, change:

```ts
  const vector = classifyCommit(changedFiles);
```

to:

```ts
  const vector = classifyCommit(changedFiles, undefined, options.classificationRules ?? []);
```

and change the `commit.upsert` call's `create` payload:

```ts
  const commit = await prismaClient.commit.upsert({
    where: { owner_repo_sha: { owner, repo: repoName, sha } },
    create: { owner, repo: repoName, sha, baseSha: options.baseSha ?? "", installationId: options.installationId },
    update: {},
  });
```

Finally, update the function's doc comment: replace the line

```
 * @param changedFiles Files touched by the commit, each with before/after content.
```

with:

```
 * @param changedFiles Files touched by the commit, each with before/after content.
 * @param options.baseSha Real base SHA from a webhook payload; defaults to "".
 * @param options.installationId Real GitHub App installation ID; omitted by default.
 * @param options.classificationRules .carf.yml classification.rules, checked before
 *   Tier 1's hardcoded rules; defaults to none.
```

and remove the now-outdated comment above the `commit.upsert` call that
begins `// baseSha isn't provided by this function's signature (see issue #11)...` —
delete that whole comment block, since a real caller now exists.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd core-api && npx vitest run test/pipeline.test.ts`
Expected: PASS (all cases, including every pre-existing test — the new
parameters are additive and default to today's exact behavior)

- [ ] **Step 6: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add core-api/src/pipeline.ts core-api/test/pipeline.test.ts
git commit -m "feat(core-api): thread baseSha/installationId/classificationRules through processCommit"
```

---

## Task 6: `webhookOrchestrator.ts` — the composition root

**Files:**
- Create: `core-api/src/webhookOrchestrator.ts`
- Test: `core-api/test/webhookOrchestrator.test.ts`

**Interfaces:**
- Consumes: `type GitHubApiClient` (`./adapters/github/githubApiClient.js`),
  `type InstallationTokenClient`
  (`./adapters/github/installationTokenClient.js`), `type DeployTarget`
  (`./adapters/github/webhookPayload.js`), `acquireDiff`
  (`./adapters/github/diffAcquisition.js`), `KubectlAdapter`
  (`./adapters/kubectl.js`), `runStandaloneLoop`, `type RollbackAdapter`
  (`./adapters/rollbackAdapter.js`), `type CarfConfig`
  (`./config/carfConfigSchema.js`), `mergeThresholdConfig`
  (`./config/mergeThresholdConfig.js`), `processCommit`, `NoSignalError`,
  `type PipelinePrismaClient` (`./pipeline.js`, Task 5) — all existing
  except `processCommit`'s new options from Task 5.
- Produces: `interface OrchestratorLogger`, `interface
  WebhookOrchestratorDeps`, `async function handleWebhookCommit(target:
  DeployTarget, deps: WebhookOrchestratorDeps): Promise<void>` —
  consumed by Task 8 (`index.ts`).

- [ ] **Step 1: Write the failing tests**

Create `core-api/test/webhookOrchestrator.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { handleWebhookCommit, type WebhookOrchestratorDeps } from "../src/webhookOrchestrator.js";
import type { DeployTarget } from "../src/adapters/github/webhookPayload.js";
import type { GitHubApiClient } from "../src/adapters/github/githubApiClient.js";
import type { InstallationTokenClient } from "../src/adapters/github/installationTokenClient.js";
import type { PipelinePrismaClient } from "../src/pipeline.js";
import type { RollbackAdapter } from "../src/adapters/rollbackAdapter.js";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

function fakeGithubApiClient(): GitHubApiClient {
  return {
    compareCommits: vi.fn().mockResolvedValue({
      files: [{ filename: "src/foo.ts", status: "modified" }],
    }),
    getContent: vi.fn().mockResolvedValue("export const a = 1;\n"),
  };
}

function fakeInstallationTokenClient(): InstallationTokenClient {
  return { getInstallationToken: vi.fn().mockResolvedValue("token-abc") } as unknown as InstallationTokenClient;
}

class FakePrismaClient implements PipelinePrismaClient {
  commits = new Map<string, { id: string }>();

  commit = {
    upsert: vi.fn(async (args: { where: { owner_repo_sha: { owner: string; repo: string; sha: string } } }) => {
      const key = `${args.where.owner_repo_sha.owner}/${args.where.owner_repo_sha.repo}/${args.where.owner_repo_sha.sha}`;
      const existing = this.commits.get(key);
      if (existing) return existing;
      const row = { id: key };
      this.commits.set(key, row);
      return row;
    }),
  };
  changeVector = { upsert: vi.fn().mockResolvedValue(undefined) };
  threshold = { upsert: vi.fn().mockResolvedValue(undefined) };
}

const target: DeployTarget = {
  owner: "acme",
  repo: "widgets",
  baseSha: "base123",
  headSha: "head456",
  installationId: "inst-1",
};

function baseDeps(overrides: Partial<WebhookOrchestratorDeps> = {}): WebhookOrchestratorDeps {
  return {
    githubApiClient: fakeGithubApiClient(),
    installationTokenClient: fakeInstallationTokenClient(),
    carfConfig: undefined,
    logger: { info: vi.fn(), error: vi.fn() },
    prismaClient: new FakePrismaClient(),
    ...overrides,
  };
}

// setImmediate runs after all pending microtasks -- guarantees a fire-and-forget
// .then()/.catch()/.finally() chain has had a chance to run before we assert on it.
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleWebhookCommit", () => {
  it("classifies and persists via processCommit even with no .carf.yml (carfConfig undefined)", async () => {
    const deps = baseDeps({ carfConfig: undefined });
    await handleWebhookCommit(target, deps);
    expect((deps.prismaClient as FakePrismaClient).commit.upsert).toHaveBeenCalledTimes(1);
  });

  it("Augment mode (explicit) persists and stops -- never calls the loop runner", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({ carfConfig: { mode: "augment" }, standaloneLoopRunner });
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).not.toHaveBeenCalled();
  });

  it("no mode set (undefined carfConfig.mode) behaves like Augment -- stops after persisting", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({ carfConfig: {}, standaloneLoopRunner });
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).not.toHaveBeenCalled();
  });

  it("Standalone + adapter.kind kubernetes kicks off the loop runner without awaiting it", async () => {
    const standaloneLoopRunner = vi.fn().mockResolvedValue({ rolledBack: false });
    const fakeAdapter: RollbackAdapter = { checkHealth: vi.fn(), rollback: vi.fn() };
    const rollbackAdapterFactory = vi.fn().mockReturnValue(fakeAdapter);
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } },
      standaloneLoopRunner,
      rollbackAdapterFactory,
    });

    await handleWebhookCommit(target, deps);
    await flushMicrotasks();

    expect(rollbackAdapterFactory).toHaveBeenCalledWith("my-deployment");
    expect(standaloneLoopRunner).toHaveBeenCalledTimes(1);
    const call = standaloneLoopRunner.mock.calls[0]!;
    expect(call[0]).toBe("head456"); // sha
    expect(call[1]).toBe(fakeAdapter);
    expect(call[3]).toBe("my-deployment"); // target string
  });

  it("Standalone + missing adapter logs an error and does not call the loop runner (persistence already succeeded)", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({ carfConfig: { mode: "standalone" }, standaloneLoopRunner });

    await handleWebhookCommit(target, deps);

    expect(standaloneLoopRunner).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: undefined }),
      expect.stringContaining("unsupported")
    );
    expect((deps.prismaClient as FakePrismaClient).commit.upsert).toHaveBeenCalledTimes(1);
  });

  it("Standalone + adapter.kind dockerCompose logs an error and does not call the loop runner", async () => {
    const standaloneLoopRunner = vi.fn();
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "dockerCompose", target: "web" } },
      standaloneLoopRunner,
    });

    await handleWebhookCommit(target, deps);

    expect(standaloneLoopRunner).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ adapter: { kind: "dockerCompose", target: "web" } }),
      expect.stringContaining("unsupported")
    );
  });

  it("skips a second loop kickoff for the same commit while the first is still running (idempotency guard)", async () => {
    let resolveLoop!: (value: { rolledBack: boolean }) => void;
    const loopPromise = new Promise<{ rolledBack: boolean }>((resolve) => {
      resolveLoop = resolve;
    });
    const standaloneLoopRunner = vi.fn().mockReturnValue(loopPromise);
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } },
      standaloneLoopRunner,
    });

    await handleWebhookCommit(target, deps); // first delivery -- starts the loop
    await handleWebhookCommit(target, deps); // redelivery while the loop is still "running"

    expect(standaloneLoopRunner).toHaveBeenCalledTimes(1);

    resolveLoop({ rolledBack: false });
    await flushMicrotasks();

    // Guard cleared after completion -- a third delivery starts a fresh loop.
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).toHaveBeenCalledTimes(2);
  });

  it("a rejected loop runner does not propagate out of handleWebhookCommit, and clears the guard afterward", async () => {
    const standaloneLoopRunner = vi
      .fn()
      .mockRejectedValueOnce(new Error("kubectl not found"))
      .mockResolvedValueOnce({ rolledBack: false });
    const deps = baseDeps({
      carfConfig: { mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } },
      standaloneLoopRunner,
    });

    await expect(handleWebhookCommit(target, deps)).resolves.toBeUndefined();
    await flushMicrotasks();

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      expect.stringContaining("standalone rollback loop failed")
    );

    // Guard was cleared in .finally() -- a second delivery starts a fresh loop, not skipped.
    await handleWebhookCommit(target, deps);
    expect(standaloneLoopRunner).toHaveBeenCalledTimes(2);
  });

  it("a NoSignalError from processCommit is a clean no-op, not a thrown failure, and is logged", async () => {
    const githubApiClient: GitHubApiClient = {
      compareCommits: vi.fn().mockResolvedValue({ files: [{ filename: "README.md", status: "modified" }] }),
      getContent: vi.fn().mockResolvedValue("docs only, no recognized file type\n"),
    };
    const deps = baseDeps({ githubApiClient });

    await expect(handleWebhookCommit(target, deps)).resolves.toBeUndefined();
    expect(deps.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ sha: "head456" }),
      expect.stringContaining("no classification signal")
    );
  });

  it("any other error from processCommit propagates uncaught", async () => {
    const prismaClient: PipelinePrismaClient = {
      commit: { upsert: vi.fn().mockRejectedValue(new Error("db unavailable")) },
      changeVector: { upsert: vi.fn() },
      threshold: { upsert: vi.fn() },
    };
    const deps = baseDeps({ prismaClient });

    await expect(handleWebhookCommit(target, deps)).rejects.toThrow("db unavailable");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd core-api && npx vitest run test/webhookOrchestrator.test.ts`
Expected: FAIL — `Cannot find module '../src/webhookOrchestrator.js'`

- [ ] **Step 3: Implement `webhookOrchestrator.ts`**

Create `core-api/src/webhookOrchestrator.ts`:

```ts
import { acquireDiff } from "./adapters/github/diffAcquisition.js";
import type { GitHubApiClient } from "./adapters/github/githubApiClient.js";
import type { InstallationTokenClient } from "./adapters/github/installationTokenClient.js";
import type { DeployTarget } from "./adapters/github/webhookPayload.js";
import { KubectlAdapter } from "./adapters/kubectl.js";
import { runStandaloneLoop } from "./adapters/loop.js";
import type { RollbackAdapter } from "./adapters/rollbackAdapter.js";
import type { CarfConfig } from "./config/carfConfigSchema.js";
import { mergeThresholdConfig } from "./config/mergeThresholdConfig.js";
import { NoSignalError, processCommit, type PipelinePrismaClient } from "./pipeline.js";

export interface OrchestratorLogger {
  info(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export interface WebhookOrchestratorDeps {
  githubApiClient: GitHubApiClient;
  installationTokenClient: InstallationTokenClient;
  /** Loaded once at startup (index.ts). undefined means no .carf.yml -- all defaults. */
  carfConfig: CarfConfig | undefined;
  logger: OrchestratorLogger;
  prismaClient?: PipelinePrismaClient;
  /** Testable seam; defaults to `(target) => new KubectlAdapter()`. */
  rollbackAdapterFactory?: (target: string) => RollbackAdapter;
  /** Testable seam; defaults to the real runStandaloneLoop. */
  standaloneLoopRunner?: typeof runStandaloneLoop;
}

// Process-local only. Guards against GitHub's webhook redelivery starting a second
// concurrent Standalone rollback loop for the same commit. Does NOT survive a process
// restart and does NOT protect against more than one core-api instance running at once
// -- see docs/superpowers/specs/2026-08-24-composition-root-design.md, section 2
// ("Explicitly out of scope"). Deferred until there's real multi-instance pressure.
const activeLoops = new Set<string>();

function loopKey(owner: string, repo: string, sha: string): string {
  return `${owner}/${repo}@${sha}`;
}

/**
 * Composition root for a validated webhook DeployTarget: exchanges the installation ID
 * for a token, fetches the diff from GitHub, runs it through processCommit() (classify +
 * persist + compute threshold), then branches on .carf.yml's `mode`:
 *   - Augment (or no mode / no .carf.yml at all): stops here. GET /v1/threshold
 *     (src/routes/threshold.ts) serves the persisted result separately.
 *   - Standalone with adapter.kind "kubernetes": additionally kicks off
 *     runStandaloneLoop() in the background (not awaited -- the loop can run for the
 *     full threshold window, up to DEFAULT_CONFIG's largest baseWindow, which would hang
 *     the webhook's HTTP response if awaited).
 *   - Standalone with any other/missing adapter (including dockerCompose, whose
 *     .carf.yml schema has no source for the previousImageTag DockerComposeAdapter
 *     requires -- see the design spec's "Explicitly out of scope"): logs an error and
 *     skips the loop. processCommit()'s result has already persisted successfully --
 *     this is a partial success, not a failure of the webhook itself.
 */
export async function handleWebhookCommit(target: DeployTarget, deps: WebhookOrchestratorDeps): Promise<void> {
  const token = await deps.installationTokenClient.getInstallationToken(target.installationId);
  const changedFiles = await acquireDiff(
    deps.githubApiClient,
    target.owner,
    target.repo,
    target.baseSha,
    target.headSha,
    token
  );

  const repoSlug = `${target.owner}/${target.repo}`;
  let result;
  try {
    result = await processCommit(target.headSha, repoSlug, changedFiles, {
      prismaClient: deps.prismaClient,
      baseSha: target.baseSha,
      installationId: target.installationId,
      thresholdConfig: mergeThresholdConfig(deps.carfConfig?.threshold),
      classificationRules: deps.carfConfig?.classification?.rules ?? [],
    });
  } catch (error) {
    if (error instanceof NoSignalError) {
      deps.logger.info(
        { sha: target.headSha, fileCount: changedFiles.length },
        "no classification signal, skipping threshold"
      );
      return;
    }
    throw error;
  }

  const carfConfig = deps.carfConfig;
  if (carfConfig?.mode !== "standalone") {
    return;
  }

  const adapterConfig = carfConfig.adapter;
  if (!adapterConfig || adapterConfig.kind !== "kubernetes") {
    deps.logger.error(
      { adapter: adapterConfig },
      "standalone mode configured but adapter is missing or unsupported (only kubernetes is wired today)"
    );
    return;
  }

  const key = loopKey(target.owner, target.repo, target.headSha);
  if (activeLoops.has(key)) {
    deps.logger.info({ key }, "standalone loop already running for this commit, skipping redelivery");
    return;
  }
  activeLoops.add(key);

  const buildAdapter = deps.rollbackAdapterFactory ?? (() => new KubectlAdapter());
  const adapter = buildAdapter(adapterConfig.target);
  const loopRunner = deps.standaloneLoopRunner ?? runStandaloneLoop;

  void loopRunner(target.headSha, adapter, result, adapterConfig.target)
    .catch((error: unknown) => {
      deps.logger.error({ error, key }, "standalone rollback loop failed");
    })
    .finally(() => {
      activeLoops.delete(key);
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd core-api && npx vitest run test/webhookOrchestrator.test.ts`
Expected: PASS (10 cases)

- [ ] **Step 5: Run lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core-api/src/webhookOrchestrator.ts core-api/test/webhookOrchestrator.test.ts
git commit -m "feat(core-api): add webhookOrchestrator composition root"
```

---

## Task 7: `buildApp()` gains a `webhook` option

**Files:**
- Modify: `core-api/src/app.ts`
- Modify: `core-api/test/smoke/server.test.ts`

**Interfaces:**
- Consumes: `type GithubWebhookRouteOptions`,
  `registerGithubWebhookRoute` from `./routes/githubWebhook.js`
  (existing, unchanged).
- Produces: `BuildAppOptions` gains `webhook?: GithubWebhookRouteOptions`
  — consumed by Task 8 (`index.ts`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `core-api/test/smoke/server.test.ts` with:

```ts
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { describe, expect, it, afterEach, vi } from "vitest";
import { buildApp } from "../../src/app.js";

const webhookSecret = "test-secret";

function sign(body: string): string {
  return "sha256=" + crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
}

describe("server smoke test", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("boots and responds 200 {status: ok} on GET /healthz", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("does not register POST /webhooks/github when the webhook option is omitted", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "POST", url: "/webhooks/github", payload: "{}" });

    expect(response.statusCode).toBe(404);
  });

  it("registers POST /webhooks/github and invokes onValidWebhook when the webhook option is provided", async () => {
    const onValidWebhook = vi.fn();
    app = buildApp({ webhook: { webhookSecret, onValidWebhook } });
    await app.ready();

    const body = JSON.stringify({
      before: "abc111",
      after: "def222",
      repository: { name: "widgets", owner: { login: "acme" } },
      installation: { id: 12345 },
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": sign(body),
      },
      payload: body,
    });

    expect(response.statusCode).toBe(202);
    expect(onValidWebhook).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd core-api && npx vitest run test/smoke/server.test.ts`
Expected: FAIL — the two new tests fail (404 test may pass already since
the route was never registered; the 202 test fails with TS error on
`webhook` not being a valid `BuildAppOptions` key, or a 404 at runtime)

- [ ] **Step 3: Implement the change in `app.ts`**

Replace the full contents of `core-api/src/app.ts`:

```ts
import Fastify from "fastify";
import { registerThresholdRoute, type ThresholdRouteOptions } from "./routes/threshold.js";
import { registerGithubWebhookRoute, type GithubWebhookRouteOptions } from "./routes/githubWebhook.js";

export interface BuildAppOptions {
  threshold?: ThresholdRouteOptions;
  webhook?: GithubWebhookRouteOptions;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));

  void registerThresholdRoute(app, options.threshold);
  if (options.webhook) {
    void registerGithubWebhookRoute(app, options.webhook);
  }

  return app;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd core-api && npx vitest run test/smoke/server.test.ts`
Expected: PASS (3 cases)

- [ ] **Step 5: Run the full core-api test suite and lint/typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add core-api/src/app.ts core-api/test/smoke/server.test.ts
git commit -m "feat(core-api): buildApp() registers the GitHub webhook route when configured"
```

---

## Task 8: `index.ts` real startup wiring

**Files:**
- Modify: `core-api/src/index.ts`

**Interfaces:**
- Consumes: `buildApp` (Task 7), `loadCarfConfig`
  (`./config/carfConfig.js`, existing), `githubApiClient`,
  `getInstallationTokenClient` (`./adapters/github/client.js`, Task 4),
  `handleWebhookCommit` (`./webhookOrchestrator.js`, Task 6), `env`
  (existing).
- Produces: nothing consumed by later tasks — this is the final
  composition point.

No test file: `index.ts` is a live-`.listen()` startup entrypoint, same
category as `evaluation/run.ts`'s `main()` (see the `.carf.yml` plan's
Task 5, which explicitly left `run.ts` untested for the same reason —
it's a thin composition of already-tested pieces, and it isn't
practically injectable/exported for testing without changing what the
file is for). Verified instead by `npm run typecheck` (Step 2 below) and
by Task 6/Task 7's coverage of everything `index.ts` calls.

- [ ] **Step 1: Implement the change in `index.ts`**

Replace the full contents of `core-api/src/index.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { loadCarfConfig } from "./config/carfConfig.js";
import { githubApiClient, getInstallationTokenClient } from "./adapters/github/client.js";
import { handleWebhookCommit } from "./webhookOrchestrator.js";

// Fail closed: an invalid .carf.yml crashes startup rather than silently falling back to
// defaults -- inherited from src/config/carfConfig.ts's documented contract (see
// docs/superpowers/specs/2026-08-24-carf-yml-config-design.md).
const carfConfig = loadCarfConfig();
const installationTokenClient = getInstallationTokenClient();

// Declared before assignment so the onValidWebhook closure below can reference `app.log`
// -- it's only ever invoked later, on a real incoming request, by which point `app` is
// assigned. Standard self-referencing-closure pattern; safe despite the apparent
// ordering.
let app: FastifyInstance;

app = buildApp({
  webhook: {
    webhookSecret: env.githubWebhookSecret(),
    onValidWebhook: (target) =>
      handleWebhookCommit(target, {
        githubApiClient,
        installationTokenClient,
        carfConfig,
        logger: app.log,
      }),
  },
});

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
```

- [ ] **Step 2: Run typecheck**

Run: `cd core-api && npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `cd core-api && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add core-api/src/index.ts
git commit -m "feat(core-api): wire real startup — load .carf.yml, build real GitHub client, register webhook"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full core-api test suite, lint, and typecheck**

Run: `cd core-api && npm run lint && npm run typecheck && npm test`
Expected: PASS, every test file green (no regressions in
`pipeline.test.ts`, `harness.test.ts`, or any other existing suite)

- [ ] **Step 2: Confirm `git status` is clean and review the full diff against `main`**

```bash
git status
git diff origin/main...HEAD --stat
```

Expected: only the files touched by Tasks 1-8 appear; no stray files
(e.g. accidental `node_modules` changes beyond `package-lock.json`, no
leftover debug code).

---

## Task 10: Squash, issue, PR

**Files:** none (git/GitHub operations only)

- [ ] **Step 1: Squash all local commits into one**

```bash
git fetch origin main
git reset --soft origin/main
git status
```

Expected: `git status` shows all of Tasks 1-8's files staged, no working
tree changes lost (soft reset keeps everything staged).

- [ ] **Step 2: Create the single commit**

```bash
git commit -m "feat(core-api): wire the composition root — webhook to classify/threshold/mode branch

Connects the previously-independent pieces (webhook receiver, Tier 1/2
classifier, threshold engine, persistence, .carf.yml loader, Standalone
adapters) into one live path: a real GitHub webhook POST now triggers
signature verification -> diff acquisition -> classification -> threshold
computation -> persistence -> an HTTP response, and, in Standalone mode
with a Kubernetes adapter, an additional asynchronous rollback-monitoring
loop.

Adds real GitHub App adapters (RealJwtSigner via jsonwebtoken,
RealInstallationTokenExchangeClient, HttpGithubApiClient) since only
interfaces existed before. processCommit() gains baseSha/installationId/
classificationRules. New webhookOrchestrator.ts is the composition root;
buildApp() gains a webhook option; index.ts wires real singletons at
startup.

Docker Compose adapter support for the Standalone loop is explicitly out
of scope (schema gap -- see the design spec); a follow-up issue tracks it."
```

- [ ] **Step 3: Push the branch**

```bash
git push -u origin composition-root/webhook-wiring
```

- [ ] **Step 4: Open the GitHub issue**

```bash
gh issue create --repo dineshkorukonda/CARF \
  --title "core-api: wire the composition root — webhook to classify/threshold/mode branch" \
  --body "$(cat <<'EOF'
Wires core-api's independently-tested pieces into one live path. Today
nothing in app.ts/index.ts calls the webhook receiver, classifier,
threshold engine, persistence, and Standalone adapters in sequence on a
real incoming webhook -- this issue closes that gap.

Design: docs/superpowers/specs/2026-08-24-composition-root-design.md
Plan: docs/superpowers/plans/2026-08-24-composition-root-wiring.md

Scope:
- Real GitHub App adapters (JWT signing via jsonwebtoken, installation
  token exchange, a fetch-based GitHubApiClient) -- only interfaces
  existed before this.
- processCommit() gains baseSha/installationId/classificationRules
  (additive, existing behavior unchanged when omitted).
- New webhookOrchestrator.ts composition root: diff acquisition ->
  processCommit() -> mode branch (Augment stops after persisting;
  Standalone with adapter.kind "kubernetes" additionally kicks off
  runStandaloneLoop() in the background, guarded against redelivery by a
  process-local idempotency Set).
- buildApp() gains a webhook option; index.ts becomes the real startup
  composition point (loads .carf.yml once, fail-closed on an invalid
  file).

Explicitly out of scope: Docker Compose adapter support for the
Standalone loop (DockerComposeAdapter needs a previousImageTag that
.carf.yml's schema has no field for -- follow-up issue tracks the schema
extension), durable/multi-instance idempotency, retry/backoff beyond
GitHub's own redelivery, .carf.yml hot-reload.

Acceptance criteria:
- [ ] Real GitHub App adapters implemented and unit-tested (no network
  in tests)
- [ ] processCommit() threads baseSha/installationId/classificationRules
- [ ] webhookOrchestrator.ts implements the full sequence + mode branch +
  idempotency guard, unit-tested
- [ ] buildApp()/index.ts wire everything together for real
- [ ] npm run lint && npm run typecheck && npm test pass
- [ ] core-api CI passes on the PR
EOF
)"
```

Record the returned issue number as `<ISSUE_NUMBER>` for the next step.

- [ ] **Step 5: Open the PR**

```bash
gh pr create --repo dineshkorukonda/CARF --base main --head composition-root/webhook-wiring \
  --title "core-api: wire the composition root — webhook to classify/threshold/mode branch" \
  --assignee dineshkorukonda \
  --body "$(cat <<'EOF'
Closes #<ISSUE_NUMBER>

Wires core-api's independently-tested pieces into one live path. See the
issue and docs/superpowers/specs/2026-08-24-composition-root-design.md
for the full design and rationale (real GitHub App adapters, the
webhookOrchestrator.ts composition root, mode-branch/idempotency
semantics, and what's explicitly deferred).

One commit -- this is a single cohesive unit of wiring, not independently
mergeable increments; a webhook that classifies but can't respond, or
responds but can't branch on mode, isn't a usable intermediate state.

## Test plan
- [x] All new adapters (RealJwtSigner, RealInstallationTokenExchangeClient,
  HttpGithubApiClient) unit-tested with injected fetch, no network
- [x] processCommit()'s new options covered in pipeline.test.ts
- [x] webhookOrchestrator.ts covered end-to-end: Augment stops after
  persisting, Standalone kicks off the loop, unsupported adapter logs and
  skips (persistence still succeeds), redelivery doesn't double-start the
  loop, a rejected loop doesn't crash the process and clears the guard,
  NoSignalError is a clean no-op
- [x] buildApp() webhook registration covered in the smoke test
- [x] npm run lint && npm run typecheck && npm test — all pass
EOF
)"
```

Before running this command, replace `<ISSUE_NUMBER>` in the `Closes
#<ISSUE_NUMBER>` line inside the body with the actual issue number
returned by Step 4.

- [ ] **Step 6: Confirm CI passes**

```bash
gh pr checks <PR_NUMBER> --repo dineshkorukonda/CARF
```

Wait for `core-api CI` (build/lint-and-typecheck/test) to report `pass`.
If it fails, fix the issue, commit the fix as a new commit on the same
branch (do not force-push over the single squashed commit unless you
also re-squash), push, and re-check. Do not merge — leave that to the
user.

- [ ] **Step 7: File the Docker Compose follow-up issue**

The squash commit message (Step 2) and the design spec both reference a
follow-up issue for extending `.carf.yml`'s schema to support the
Standalone loop with `adapter.kind: "dockerCompose"`. File it so that
reference isn't dangling:

```bash
gh issue create --repo dineshkorukonda/CARF \
  --title ".carf.yml: extend AdapterSchema to support Docker Compose in the Standalone loop" \
  --body "$(cat <<'EOF'
DockerComposeAdapter (core-api/src/adapters/dockerCompose.ts) requires a
previousImageTag: string constructor argument -- .carf.yml's
AdapterSchema ({ kind, target }) has no field to source it from.
KubectlAdapter doesn't have this problem because kubectl rollout undo
tracks revision history itself; Docker Compose has no equivalent, so
something has to tell it what to roll back to.

Filed per docs/superpowers/specs/2026-08-24-composition-root-design.md
("Explicitly out of scope") -- webhookOrchestrator.ts
(core-api/src/webhookOrchestrator.ts) currently logs an error and skips
the Standalone loop entirely for adapter.kind: \"dockerCompose\".

Needs a design decision, not just an implementation: either add a new
.carf.yml field (e.g. adapter.previousImageTag), or document/adopt a
convention (e.g. \"image tag equals base SHA\") and derive it from the
webhook payload's baseSha instead. Whichever is chosen, update
CarfConfigSchema (core-api/src/config/carfConfigSchema.ts),
.carf.example.yml, and webhookOrchestrator.ts's adapter-kind branch.
EOF
)"
```

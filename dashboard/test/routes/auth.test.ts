import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "../../src/lib/session";

// Next.js App Router route handlers are plain async functions, so they can be imported and
// called with a real NextRequest. That exercises the true request path -- form parsing,
// validation, redirect target and cookie flags -- with no running server and no database.
// dashboard/CLAUDE.md excludes these from *unit* tests for needing Next.js/a DB; this is
// the integration layer .agents/rules/coding.md asks for, and it needs neither.

const BASE_URL = "http://localhost:3000";
const SESSION_SECRET = "test-session-secret";

interface FakeAccount {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface FakeToken {
  id: string;
  tokenHash: string;
  accountId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

class FakePrisma {
  accounts: FakeAccount[] = [];
  tokens: FakeToken[] = [];
  private nextId = 1;

  account = {
    findUnique: async (args: { where: { email?: string; id?: string } }) =>
      this.accounts.find(
        (a) => (args.where.email !== undefined && a.email === args.where.email) ||
          (args.where.id !== undefined && a.id === args.where.id)
      ) ?? null,
    create: async (args: { data: { email: string; passwordHash: string } }) => {
      const row: FakeAccount = { id: `account-${this.nextId++}`, createdAt: new Date(), ...args.data };
      this.accounts.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: { passwordHash: string } }) => {
      const row = this.accounts.find((a) => a.id === args.where.id);
      if (!row) throw new Error(`no account ${args.where.id}`);
      Object.assign(row, args.data);
      return row;
    },
  };

  passwordResetToken = {
    create: async (args: { data: { tokenHash: string; accountId: string; expiresAt: Date } }) => {
      const row: FakeToken = { id: `token-${this.nextId++}`, usedAt: null, ...args.data };
      this.tokens.push(row);
      return row;
    },
    findUnique: async (args: { where: { tokenHash: string } }) =>
      this.tokens.find((t) => t.tokenHash === args.where.tokenHash) ?? null,
    update: async (args: { where: { id: string }; data: { usedAt: Date } }) => {
      const row = this.tokens.find((t) => t.id === args.where.id);
      if (!row) throw new Error(`no token ${args.where.id}`);
      Object.assign(row, args.data);
      return row;
    },
    deleteMany: async (args: { where: { accountId: string } }) => {
      this.tokens = this.tokens.filter((t) => t.accountId !== args.where.accountId);
      return { count: 0 };
    },
  };
}

let db = new FakePrisma();
const sendPasswordResetEmail = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    baseUrl: () => BASE_URL,
    sessionSecret: () => SESSION_SECRET,
  },
}));

vi.mock("../../src/lib/prisma", () => ({
  get prisma() {
    return db;
  },
}));

vi.mock("../../src/lib/mailer", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmail(...args),
}));

const { POST: login } = await import("../../src/app/api/auth/login/route");
const { POST: logout } = await import("../../src/app/api/auth/logout/route");
const { POST: signup } = await import("../../src/app/api/auth/signup/route");
const { POST: forgotPassword } = await import("../../src/app/api/auth/forgot-password/route");
const { POST: resetPassword } = await import("../../src/app/api/auth/reset-password/route");

function formRequest(path: string, fields: Record<string, string>): NextRequest {
  return new NextRequest(`${BASE_URL}${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

/** Redirect target without the origin, so assertions read like the route's own source. */
function location(response: Response): string {
  return new URL(response.headers.get("location")!).pathname + new URL(response.headers.get("location")!).search;
}

let knownHash: string;

beforeAll(async () => {
  // One bcrypt hash reused across the suite -- hashing at 12 rounds costs ~400ms a call.
  knownHash = await bcrypt.hash("correct-horse", 12);
});

beforeEach(() => {
  db = new FakePrisma();
  sendPasswordResetEmail.mockReset();
  sendPasswordResetEmail.mockResolvedValue(undefined);
});

function seedAccount(email = "user@example.com"): FakeAccount {
  const row: FakeAccount = { id: "account-1", email, passwordHash: knownHash, createdAt: new Date() };
  db.accounts.push(row);
  return row;
}

describe("POST /api/auth/login", () => {
  it("redirects to /dashboard and sets a verifiable session cookie on correct credentials", async () => {
    seedAccount();

    const response = await login(formRequest("/api/auth/login", {
      email: "user@example.com",
      password: "correct-horse",
    }));

    expect(location(response)).toBe("/dashboard");
    const cookie = response.cookies.get(SESSION_COOKIE_NAME)!;
    expect(verifySessionCookieValue(SESSION_SECRET, cookie.value)).toEqual({ accountId: "account-1" });
  });

  // Losing any one of these flags is a silent, invisible security regression: the session
  // cookie becomes readable by scripts, sendable over plaintext, or attachable to a
  // cross-site request.
  it("sets the session cookie httpOnly, secure, sameSite=lax and path-scoped to /", async () => {
    seedAccount();

    const response = await login(formRequest("/api/auth/login", {
      email: "user@example.com",
      password: "correct-horse",
    }));

    const cookie = response.cookies.get(SESSION_COOKIE_NAME)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
  });

  it("rejects a wrong password without setting a session cookie", async () => {
    seedAccount();

    const response = await login(formRequest("/api/auth/login", {
      email: "user@example.com",
      password: "wrong-password",
    }));

    expect(location(response)).toBe("/login?error=invalid_credentials");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  // Same redirect for both cases, so the response can't be used to test whether an email
  // is registered.
  it("gives an unknown email the identical response to a wrong password", async () => {
    const response = await login(formRequest("/api/auth/login", {
      email: "nobody@example.com",
      password: "anything",
    }));

    expect(location(response)).toBe("/login?error=invalid_credentials");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it("normalises the submitted email, so case and stray spaces still match", async () => {
    seedAccount("user@example.com");

    const response = await login(formRequest("/api/auth/login", {
      email: "  USER@Example.COM  ",
      password: "correct-horse",
    }));

    expect(location(response)).toBe("/dashboard");
  });

  it("treats a missing password field as a failed sign-in rather than crashing", async () => {
    seedAccount();

    const response = await login(formRequest("/api/auth/login", { email: "user@example.com" }));

    expect(location(response)).toBe("/login?error=invalid_credentials");
  });
});

describe("POST /api/auth/signup", () => {
  it("creates an account, redirects to /dashboard and signs the new user in", async () => {
    const response = await signup(formRequest("/api/auth/signup", {
      email: "new@example.com",
      password: "long-enough-password",
    }));

    expect(location(response)).toBe("/dashboard");
    expect(db.accounts).toHaveLength(1);
    const cookie = response.cookies.get(SESSION_COOKIE_NAME)!;
    expect(verifySessionCookieValue(SESSION_SECRET, cookie.value)).toEqual({ accountId: db.accounts[0]!.id });
  });

  it("never stores the password in plaintext", async () => {
    await signup(formRequest("/api/auth/signup", {
      email: "new@example.com",
      password: "long-enough-password",
    }));

    expect(db.accounts[0]!.passwordHash).not.toBe("long-enough-password");
    expect(await bcrypt.compare("long-enough-password", db.accounts[0]!.passwordHash)).toBe(true);
  });

  it("rejects a password under 8 characters without creating an account", async () => {
    const response = await signup(formRequest("/api/auth/signup", {
      email: "new@example.com",
      password: "short",
    }));

    expect(location(response)).toBe("/signup?error=invalid_input");
    expect(db.accounts).toHaveLength(0);
  });

  it("rejects an empty email without creating an account", async () => {
    const response = await signup(formRequest("/api/auth/signup", {
      email: "   ",
      password: "long-enough-password",
    }));

    expect(location(response)).toBe("/signup?error=invalid_input");
    expect(db.accounts).toHaveLength(0);
  });

  it("reports a taken email instead of creating a second account for it", async () => {
    seedAccount("taken@example.com");

    const response = await signup(formRequest("/api/auth/signup", {
      email: "taken@example.com",
      password: "long-enough-password",
    }));

    expect(location(response)).toBe("/signup?error=email_taken");
    expect(db.accounts).toHaveLength(1);
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("redirects to /login and clears the session cookie", async () => {
    const response = await logout();

    expect(location(response)).toBe("/login");
    const cookie = response.cookies.get(SESSION_COOKIE_NAME);
    expect(cookie?.value).toBe("");
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("issues a token and emails a link containing it for a known address", async () => {
    seedAccount();

    const response = await forgotPassword(formRequest("/api/auth/forgot-password", {
      email: "user@example.com",
    }));

    expect(location(response)).toBe("/forgot-password?sent=1");
    expect(db.tokens).toHaveLength(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [to, resetUrl] = sendPasswordResetEmail.mock.calls[0]!;
    expect(to).toBe("user@example.com");
    expect(resetUrl).toMatch(new RegExp(`^${BASE_URL}/reset-password\\?token=[0-9a-f]{64}$`));
  });

  // The stored value must be a hash, never the token that went out in the email.
  it("stores only a hash, never the raw token that was emailed", async () => {
    seedAccount();

    await forgotPassword(formRequest("/api/auth/forgot-password", { email: "user@example.com" }));

    const emailedToken = new URL(sendPasswordResetEmail.mock.calls[0]![1] as string).searchParams.get("token")!;
    expect(db.tokens[0]!.tokenHash).not.toBe(emailedToken);
    expect(db.tokens[0]!.tokenHash).toHaveLength(64);
  });

  it("gives an unknown address the same redirect, and sends no mail", async () => {
    const response = await forgotPassword(formRequest("/api/auth/forgot-password", {
      email: "nobody@example.com",
    }));

    expect(location(response)).toBe("/forgot-password?sent=1");
    expect(db.tokens).toHaveLength(0);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("gives an empty submission the same redirect", async () => {
    const response = await forgotPassword(formRequest("/api/auth/forgot-password", { email: "" }));

    expect(location(response)).toBe("/forgot-password?sent=1");
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  // A broken SMTP config must not turn into a 500, because the absence of an error for
  // other addresses would itself reveal which ones have an account.
  it("still redirects normally when the mail send fails", async () => {
    seedAccount();
    sendPasswordResetEmail.mockRejectedValue(new Error("SMTP unreachable"));
    // The route logs the failure on purpose; silence it so the suite's output stays clean.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await forgotPassword(formRequest("/api/auth/forgot-password", {
      email: "user@example.com",
    }));

    expect(location(response)).toBe("/forgot-password?sent=1");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

describe("POST /api/auth/reset-password", () => {
  /** Runs the real forgot-password route, then returns the token from the emailed link --
   *  so these tests exercise the same token the user would actually receive. */
  async function issueToken(): Promise<string> {
    await forgotPassword(formRequest("/api/auth/forgot-password", { email: "user@example.com" }));
    return new URL(sendPasswordResetEmail.mock.calls[0]![1] as string).searchParams.get("token")!;
  }

  it("sets the new password and redirects to /login?reset=1", async () => {
    seedAccount();
    const token = await issueToken();

    const response = await resetPassword(formRequest("/api/auth/reset-password", {
      token,
      password: "brand-new-password",
    }));

    expect(location(response)).toBe("/login?reset=1");
    expect(await bcrypt.compare("brand-new-password", db.accounts[0]!.passwordHash)).toBe(true);
  });

  it("rejects a garbage token and leaves the password unchanged", async () => {
    seedAccount();

    const response = await resetPassword(formRequest("/api/auth/reset-password", {
      token: "not-a-real-token",
      password: "brand-new-password",
    }));

    expect(location(response)).toBe("/reset-password?error=invalid_token");
    expect(db.accounts[0]!.passwordHash).toBe(knownHash);
  });

  it("refuses to reuse a token that has already been redeemed", async () => {
    seedAccount();
    const token = await issueToken();
    await resetPassword(formRequest("/api/auth/reset-password", { token, password: "first-new-password" }));

    const second = await resetPassword(formRequest("/api/auth/reset-password", {
      token,
      password: "second-new-password",
    }));

    expect(location(second)).toBe("/reset-password?error=invalid_token");
    expect(await bcrypt.compare("first-new-password", db.accounts[0]!.passwordHash)).toBe(true);
  });

  it("rejects an expired token", async () => {
    seedAccount();
    const token = await issueToken();
    db.tokens[0]!.expiresAt = new Date(Date.now() - 1000);

    const response = await resetPassword(formRequest("/api/auth/reset-password", {
      token,
      password: "brand-new-password",
    }));

    expect(location(response)).toBe("/reset-password?error=invalid_token");
    expect(db.accounts[0]!.passwordHash).toBe(knownHash);
  });

  // The token is carried back in the redirect so the user can retry without re-requesting
  // a link, and it must not have been spent by the rejected attempt.
  it("rejects a short password, keeps the token usable, and carries it back", async () => {
    seedAccount();
    const token = await issueToken();

    const response = await resetPassword(formRequest("/api/auth/reset-password", {
      token,
      password: "short",
    }));

    expect(location(response)).toBe(`/reset-password?token=${token}&error=invalid_password`);
    expect(db.tokens[0]!.usedAt).toBeNull();
  });

  it("rejects a missing token without touching any account", async () => {
    seedAccount();

    const response = await resetPassword(formRequest("/api/auth/reset-password", {
      password: "brand-new-password",
    }));

    expect(location(response)).toBe("/reset-password?error=invalid_token");
    expect(db.accounts[0]!.passwordHash).toBe(knownHash);
  });
});

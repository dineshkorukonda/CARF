import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const userFindUnique = vi.fn();

vi.mock("../../src/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (args: unknown) => userFindUnique(args),
    },
  },
}));

const { getCurrentAccount } = await import("../../src/lib/auth");

const USER = {
  id: "user-1",
  email: "someone@example.com",
  name: "Someone",
  image: "https://avatar.example.com",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  accounts: [
    {
      id: "acc-1",
      provider: "github",
      providerAccountId: "12345678",
    },
  ],
};

describe("getCurrentAccount", () => {
  beforeEach(() => {
    authMock.mockReset();
    userFindUnique.mockReset();
  });

  it("returns the user account for an active Auth.js session", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "someone@example.com",
      },
    });
    userFindUnique.mockResolvedValue(USER);

    const account = await getCurrentAccount();
    expect(account).toEqual({
      id: "user-1",
      email: "someone@example.com",
      name: "Someone",
      image: "https://avatar.example.com",
      githubId: "12345678",
      createdAt: USER.createdAt,
    });
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      include: { accounts: true },
    });
  });

  it("returns null when no session exists, without querying the database", async () => {
    authMock.mockResolvedValue(null);

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when user ID in session is missing", async () => {
    authMock.mockResolvedValue({ user: {} });

    await expect(getCurrentAccount()).resolves.toBeNull();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when session user does not exist in database", async () => {
    authMock.mockResolvedValue({ user: { id: "missing-user" } });
    userFindUnique.mockResolvedValue(null);

    await expect(getCurrentAccount()).resolves.toBeNull();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/account/password/route";
import * as authModule from "../../src/auth";
import * as prismaModule from "../../src/lib/prisma";
import { hashPassword } from "../../src/lib/password";

describe("POST /api/account/password", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    vi.spyOn(authModule, "auth").mockResolvedValue(null as unknown as ReturnType<typeof authModule.auth> extends Promise<infer T> ? T : never);

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "password123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when new password is too short", async () => {
    vi.spyOn(authModule, "auth").mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    } as unknown as { user: { id: string }; expires: string });

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "short" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sets a new password when user had no password before", async () => {
    vi.spyOn(authModule, "auth").mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    } as unknown as { user: { id: string }; expires: string });

    vi.spyOn(prismaModule.prisma.user, "findUnique").mockResolvedValue({
      id: "usr_123",
      passwordHash: null,
    } as unknown as { id: string; passwordHash: string | null });

    const updateSpy = vi.spyOn(prismaModule.prisma.user, "update").mockResolvedValue({
      id: "usr_123",
    } as unknown as { id: string; email: string; name: string | null; emailVerified: Date | null; image: string | null; passwordHash: string | null; createdAt: Date; updatedAt: Date });

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "brand-new-secure-password" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_123" },
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      })
    );
  });

  it("rejects when current password is wrong on password change", async () => {
    const existingHash = hashPassword("correct-old-password");

    vi.spyOn(authModule, "auth").mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    } as unknown as { user: { id: string }; expires: string });

    vi.spyOn(prismaModule.prisma.user, "findUnique").mockResolvedValue({
      id: "usr_123",
      passwordHash: existingHash,
    } as unknown as { id: string; passwordHash: string | null });

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "wrong-old-password", newPassword: "brand-new-secure-password" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

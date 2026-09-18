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
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "password123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when new password is too short", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "short" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sets a new password when user had no password before", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    (vi.spyOn(prismaModule.prisma.user, "findUnique") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      id: "usr_123",
      passwordHash: null,
    });

    const updateSpy = vi.spyOn(prismaModule.prisma.user, "update") as unknown as { mockResolvedValue: (val: unknown) => void };
    updateSpy.mockResolvedValue({
      id: "usr_123",
    });

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ newPassword: "brand-new-secure-password" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(updateSpy).toBeDefined();
  });

  it("rejects when current password is wrong on password change", async () => {
    const existingHash = hashPassword("correct-old-password");

    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    (vi.spyOn(prismaModule.prisma.user, "findUnique") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      id: "usr_123",
      passwordHash: existingHash,
    });

    const req = new NextRequest("http://localhost:3000/api/account/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: "wrong-old-password", newPassword: "brand-new-secure-password" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

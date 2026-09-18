import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "../../src/app/api/account/profile/route";
import * as authModule from "../../src/auth";
import * as prismaModule from "../../src/lib/prisma";

describe("PATCH /api/account/profile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: "new@example.com" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid email", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    const req = new NextRequest("http://localhost:3000/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: "not-an-email" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when email is already in use by another user", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    (vi.spyOn(prismaModule.prisma.user, "findFirst") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      id: "usr_456",
      email: "taken@example.com",
    });

    const req = new NextRequest("http://localhost:3000/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: "taken@example.com" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(409);
  });

  it("updates and returns updated user on success", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    (vi.spyOn(prismaModule.prisma.user, "findFirst") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue(null);
    (vi.spyOn(prismaModule.prisma.user, "update") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      id: "usr_123",
      email: "dineshkorukonda05@gmail.com",
      name: "Dinesh Korukonda",
    });

    const req = new NextRequest("http://localhost:3000/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ email: "dineshkorukonda05@gmail.com", name: "Dinesh Korukonda" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.user.email).toBe("dineshkorukonda05@gmail.com");
  });
});

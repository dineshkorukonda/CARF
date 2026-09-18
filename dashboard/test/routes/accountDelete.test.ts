import { describe, expect, it, vi, beforeEach } from "vitest";
import { DELETE } from "../../src/app/api/account/route";
import * as authModule from "../../src/auth";
import * as prismaModule from "../../src/lib/prisma";

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    vi.spyOn(authModule, "auth").mockResolvedValue(null as unknown as ReturnType<typeof authModule.auth> extends Promise<infer T> ? T : never);

    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("deletes the user record when authorized", async () => {
    vi.spyOn(authModule, "auth").mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    } as unknown as { user: { id: string }; expires: string });

    const deleteSpy = vi.spyOn(prismaModule.prisma.user, "delete").mockResolvedValue({
      id: "usr_123",
    } as unknown as { id: string; email: string; name: string | null; emailVerified: Date | null; image: string | null; passwordHash: string | null; createdAt: Date; updatedAt: Date });

    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith({
      where: { id: "usr_123" },
    });
  });
});

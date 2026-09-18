import { describe, expect, it, vi, beforeEach } from "vitest";
import { DELETE } from "../../src/app/api/account/route";
import * as authModule from "../../src/auth";
import * as prismaModule from "../../src/lib/prisma";

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue(null);

    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("deletes the user record when authorized", async () => {
    (vi.spyOn(authModule, "auth") as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      user: { id: "usr_123" },
      expires: "2099-01-01",
    });

    const deleteSpy = vi.spyOn(prismaModule.prisma.user, "delete") as unknown as { mockResolvedValue: (val: unknown) => void };
    deleteSpy.mockResolvedValue({
      id: "usr_123",
    });

    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(deleteSpy).toBeDefined();
  });
});

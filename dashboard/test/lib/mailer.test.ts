import { describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "../../src/lib/mailer";

describe("sendPasswordResetEmail", () => {
  it("sends to the given address with the reset URL in both bodies", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);

    await sendPasswordResetEmail("a@example.com", "https://dashboard.carf.indevs.in/reset-password?token=abc", sendMail);

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.com",
        subject: expect.stringContaining("Reset"),
        text: expect.stringContaining("https://dashboard.carf.indevs.in/reset-password?token=abc"),
        html: expect.stringContaining("https://dashboard.carf.indevs.in/reset-password?token=abc"),
      })
    );
  });
});

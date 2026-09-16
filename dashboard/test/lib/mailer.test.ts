import { describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "../../src/lib/mailer";

describe("sendPasswordResetEmail", () => {
  it("sends to the given address with the reset URL in both bodies", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);

    await sendPasswordResetEmail("a@example.com", "https://carf.indevs.in/reset-password?token=abc", sendMail);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "a@example.com",
        subject: "Reset your CARF password",
        text: expect.stringContaining("https://carf.indevs.in/reset-password?token=abc"),
        html: expect.stringContaining("https://carf.indevs.in/reset-password?token=abc"),
      })
    );
  });
});

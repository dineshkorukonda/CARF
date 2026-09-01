import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { createPasswordResetToken } from "../../../../lib/passwordReset";
import { sendPasswordResetEmail } from "../../../../lib/mailer";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (email) {
    const issued = await createPasswordResetToken(prisma, email);
    if (issued) {
      const resetUrl = new URL(`/reset-password?token=${issued.token}`, env.baseUrl()).toString();
      // Best-effort: a broken SMTP config shouldn't turn into a 500 that reveals (via its
      // absence for other emails) whether this address has an account.
      try {
        await sendPasswordResetEmail(email, resetUrl);
      } catch (err) {
        console.error("Failed to send password reset email", err);
      }
    }
  }

  // Same redirect regardless of whether `email` matched an account -- see
  // createPasswordResetToken's doc comment.
  return NextResponse.redirect(new URL("/forgot-password?sent=1", env.baseUrl()));
}

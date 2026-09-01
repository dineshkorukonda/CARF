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
      // Started, deliberately not awaited. Awaiting made the response time depend on the
      // mail server, so a known address answered measurably slower than an unknown one --
      // an enumeration side channel that defeated the identical redirect below. The
      // .catch keeps a broken SMTP config from becoming an unhandled rejection.
      void sendPasswordResetEmail(email, resetUrl).catch((err) => {
        console.error("Failed to send password reset email", err);
      });
    }
  }

  // Same redirect regardless of whether `email` matched an account -- see
  // createPasswordResetToken's doc comment.
  return NextResponse.redirect(new URL("/forgot-password?sent=1", env.baseUrl()));
}

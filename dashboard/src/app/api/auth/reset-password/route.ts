import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { resetPasswordWithToken } from "../../../../lib/passwordReset";
import { prisma } from "../../../../lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.redirect(
      new URL(`/reset-password?token=${encodeURIComponent(token)}&error=invalid_password`, env.baseUrl())
    );
  }

  // Redeeming the token and storing the password happen in one transaction, so a failure
  // cannot burn the user's only link while leaving the password unchanged.
  const reset = await resetPasswordWithToken(prisma, token, password);
  if (!reset) {
    return NextResponse.redirect(new URL("/reset-password?error=invalid_token", env.baseUrl()));
  }

  return NextResponse.redirect(new URL("/login?reset=1", env.baseUrl()));
}

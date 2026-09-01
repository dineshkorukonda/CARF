import { NextRequest, NextResponse } from "next/server";
import { env } from "../../../../config/env";
import { redeemPasswordResetToken } from "../../../../lib/passwordReset";
import { updatePassword } from "../../../../lib/accountService";
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

  const redeemed = await redeemPasswordResetToken(prisma, token);
  if (!redeemed) {
    return NextResponse.redirect(new URL("/reset-password?error=invalid_token", env.baseUrl()));
  }

  await updatePassword(prisma, redeemed.accountId, password);

  return NextResponse.redirect(new URL("/login?reset=1", env.baseUrl()));
}

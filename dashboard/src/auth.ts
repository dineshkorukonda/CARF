import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./lib/prisma";
import { authConfig } from "./auth.config";

if (!process.env.AUTH_URL && process.env.DASHBOARD_BASE_URL) {
  process.env.AUTH_URL = process.env.DASHBOARD_BASE_URL;
}
if (!process.env.NEXTAUTH_URL && process.env.DASHBOARD_BASE_URL) {
  process.env.NEXTAUTH_URL = process.env.DASHBOARD_BASE_URL;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET,
});


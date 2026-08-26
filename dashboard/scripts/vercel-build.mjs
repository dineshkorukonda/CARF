// Vercel prefers this script over `build` automatically. Migrations only run for the
// production build -- preview builds (every PR/branch) don't have (and shouldn't have)
// access to the production DATABASE_URL, and running `migrate deploy` from an arbitrary
// branch's preview build against the shared prod database would be unsafe regardless.
import { execSync } from "node:child_process";

const isProduction = process.env.VERCEL_ENV === "production";

if (isProduction) {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}

execSync("npx next build", { stdio: "inherit" });

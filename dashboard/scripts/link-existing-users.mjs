import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== CARF Migration: Inspect Existing Users ===");

  const users = await prisma.user.findMany({
    include: {
      accounts: true,
      installations: true,
    },
  });

  console.log(`Found ${users.length} user(s) in the database.\n`);

  if (users.length === 0) {
    console.log("No users found in database. New users will sign in with GitHub directly.");
    return;
  }

  for (const user of users) {
    console.log(`- User ID: ${user.id}`);
    console.log(`  Email: ${user.email ?? "(none)"}`);
    console.log(`  Linked Installations: ${user.installations.length}`);
    console.log(`  Linked OAuth Accounts: ${user.accounts.length}`);

    if (user.accounts.length > 0) {
      console.log(`  -> Status: Already linked to GitHub (providerAccountId: ${user.accounts.map(a => a.providerAccountId).join(", ")})`);
    } else if (user.email) {
      console.log(`  -> Status: Pending GitHub sign-in. When signing in via GitHub with ${user.email}, Auth.js will match on email and link installations automatically.`);
    } else {
      console.log(`  -> Status: No email. User will need to re-link installations after signing in.`);
    }
    console.log();
  }
}

main()
  .catch((e) => {
    console.error("Error inspecting users:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

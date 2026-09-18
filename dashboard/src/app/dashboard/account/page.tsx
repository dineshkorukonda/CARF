import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { getCurrentAccount } from "../../../lib/auth";
import { signOut } from "../../../auth";

export default async function AccountPage() {
  // middleware/layout already redirects to /login if there's no session.
  const account = (await getCurrentAccount())!;

  const memberSince = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(account.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 p-8">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Account</p>
        <h1 className="mt-1 text-2xl font-semibold">Account settings</h1>
      </div>

      <div className="flex items-center gap-4 rounded-sm border border-border bg-card p-5">
        {account.image ? (
          <Image
            src={account.image}
            alt={account.name ?? account.email}
            width={56}
            height={56}
            className="rounded-full border border-border"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
            {(account.name || account.email || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold text-foreground">{account.name ?? "GitHub User"}</h2>
          <p className="text-xs text-muted-foreground">{account.email}</p>
          {account.githubId && (
            <p className="mt-0.5 text-xs font-mono text-muted-foreground">GitHub ID: {account.githubId}</p>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Authentication</p>
        <div className="mt-3 grid grid-cols-2 gap-px border border-border bg-border">
          <div className="bg-background px-6 py-5">
            <div className="text-sm font-medium">GitHub OAuth (CARF App)</div>
            <div className="mt-1.5 text-xs text-muted-foreground">Identity Provider</div>
          </div>
          <div className="bg-background px-6 py-5">
            <div className="text-sm font-medium">{memberSince}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">Member since</div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Session</p>
        <p className="mt-1 text-sm text-muted-foreground">Sign out of your CARF dashboard session on this device.</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-4"
        >
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { getCurrentAccount } from "../../../lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_password: "New password must be at least 8 characters.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  // layout.tsx already redirects to /login if there's no session.
  const account = (await getCurrentAccount())!;
  const { error, saved } = await searchParams;

  const memberSince = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(account.createdAt);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-10 p-8">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Account</p>
        <h1 className="mt-1 text-2xl font-semibold">Account settings</h1>
      </div>

      {error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERROR_MESSAGES[error] ?? "Something went wrong."}
        </p>
      )}
      {saved && (
        <p className="rounded-sm bg-primary/10 px-3 py-2 text-sm text-primary">Password updated.</p>
      )}

      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Profile</p>
        <div className="mt-3 grid grid-cols-2 gap-px border border-border bg-border">
          <div className="bg-background px-6 py-5">
            <div className="text-sm font-medium">{account.email}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">Email</div>
          </div>
          <div className="bg-background px-6 py-5">
            <div className="text-sm font-medium">{memberSince}</div>
            <div className="mt-1.5 text-xs text-muted-foreground">Member since</div>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Change password</p>
        <p className="mt-1 text-sm text-muted-foreground">You&apos;ll stay signed in on this device.</p>
        <form action="/api/account/change-password" method="POST" className="mt-4 flex flex-col gap-4">
          <div className="flex max-w-xs flex-col gap-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              name="newPassword"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>
          <Button type="submit" variant="outline" className="self-start">
            Update password
          </Button>
        </form>
      </div>
    </main>
  );
}

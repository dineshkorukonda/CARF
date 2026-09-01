import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { AuthVisualPanel } from "../../../components/AuthVisualPanel";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "That reset link is invalid or has expired. Request a new one.",
  invalid_password: "Enter a password of at least 8 characters.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight">
            <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-semibold text-background">
              CARF
            </span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>

            {error && (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? "Something went wrong."}
              </p>
            )}

            {!token ? (
              <p className="mt-6 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Missing reset token — use the link from your email, or{" "}
                <a href="/forgot-password" className="font-medium underline underline-offset-4">
                  request a new one
                </a>
                .
              </p>
            ) : (
              <form action="/api/auth/reset-password" method="POST" className="mt-6 flex flex-col gap-4">
                <input type="hidden" name="token" value={token} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    name="password"
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="mt-2 w-full">
                  Reset password
                </Button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <a href="/login" className="font-medium text-foreground underline underline-offset-4">
                Back to sign in
              </a>
            </p>
          </div>
        </div>
      </div>

      <AuthVisualPanel />
    </main>
  );
}

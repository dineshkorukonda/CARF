import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { AuthVisualPanel } from "../../../components/AuthVisualPanel";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

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
            <h1 className="text-2xl font-semibold">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your account email and we&apos;ll send a reset link.
            </p>

            {sent ? (
              <p className="mt-6 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                If that email has a CARF account, a reset link is on its way — check your
                inbox. The link expires in 30 minutes.
              </p>
            ) : (
              <form action="/api/auth/forgot-password" method="POST" className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" name="email" placeholder="you@example.com" required />
                </div>
                <Button type="submit" className="mt-2 w-full">
                  Send reset link
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

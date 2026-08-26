import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { AuthVisualPanel } from "../../../components/AuthVisualPanel";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Enter a valid email and a password of at least 8 characters.",
  email_taken: "An account with that email already exists.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
            <h1 className="text-2xl font-semibold">Create your CARF account</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage rollback configuration for your repos.</p>

            {error && (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? "Something went wrong."}
              </p>
            )}

            <form action="/api/auth/signup" method="POST" className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" name="email" placeholder="you@example.com" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
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
                Sign up
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="/login" className="font-medium text-foreground underline underline-offset-4">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>

      <AuthVisualPanel />
    </main>
  );
}

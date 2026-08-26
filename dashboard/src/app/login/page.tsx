import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Incorrect email or password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-6 py-16">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in to CARF</CardTitle>
          <CardDescription>Manage rollback configuration for your repos.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {ERROR_MESSAGES[error] ?? "Something went wrong."}
            </p>
          )}
          <form action="/api/auth/login" method="POST" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" placeholder="you@example.com" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="mt-2 w-full">
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No account yet?{" "}
            <a href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Sign up
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

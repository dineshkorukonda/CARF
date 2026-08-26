import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

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
    <main className="max-w-[420px] mx-auto px-6 py-24">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to CARF</CardTitle>
          <CardDescription>Manage rollback configuration for your repos.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-4">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}
          <form action="/api/auth/login" method="POST" className="flex flex-col gap-3">
            <input
              type="email"
              name="email"
              placeholder="Email"
              required
              className="border rounded-md px-3 py-2 text-sm"
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              required
              className="border rounded-md px-3 py-2 text-sm"
            />
            <Button type="submit">Sign in</Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4">
            No account yet? <a href="/signup" className="underline">Sign up</a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

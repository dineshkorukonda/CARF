import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

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
    <main className="max-w-[420px] mx-auto px-6 py-24">
      <Card>
        <CardHeader>
          <CardTitle>Create your CARF account</CardTitle>
          <CardDescription>Manage rollback configuration for your repos.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-4">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}
          <form action="/api/auth/signup" method="POST" className="flex flex-col gap-3">
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
              placeholder="Password (min 8 characters)"
              required
              minLength={8}
              className="border rounded-md px-3 py-2 text-sm"
            />
            <Button type="submit">Sign up</Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4">
            Already have an account? <a href="/login" className="underline">Sign in</a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

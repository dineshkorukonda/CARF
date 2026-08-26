import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Login request expired or was tampered with. Please try again.",
  oauth_failed: "GitHub sign-in failed. Please try again.",
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
          <CardDescription>Connect your GitHub account to manage rollback configuration.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && <p className="text-sm text-destructive">{ERROR_MESSAGES[error] ?? "Something went wrong."}</p>}
          <Button render={<a href="/api/auth/github/start" />}>Sign in with GitHub</Button>
        </CardContent>
      </Card>
    </main>
  );
}

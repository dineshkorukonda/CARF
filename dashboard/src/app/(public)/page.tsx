import { redirect } from "next/navigation";
import { getCurrentAccount } from "../../lib/auth";
import { Button } from "../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export default async function HomePage() {
  const account = await getCurrentAccount();
  if (account) redirect("/dashboard");

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-10 px-6 py-24 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
          Automatic rollback for risky commits
        </h1>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          Connect a repo, set your classification and threshold rules, and let CARF watch
          deploys so you don&apos;t have to.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Button size="lg" render={<a href="/signup" />}>
            Get started
          </Button>
          <Button size="lg" variant="outline" render={<a href="/login" />}>
            Sign in
          </Button>
        </div>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Classify</CardTitle>
            <CardDescription>Every commit is scored by change type and complexity.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Threshold</CardTitle>
            <CardDescription>Risky changes get a tighter rollback window automatically.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Roll back</CardTitle>
            <CardDescription>Standalone mode acts on your infra directly, no pipeline glue needed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}

import Link from "next/link";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { ThemeToggle } from "../../../components/ThemeToggle";
import { AuthVisualPanel } from "../../../components/AuthVisualPanel";
import { signIn } from "../../../auth";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin: "Error starting GitHub authorization. Please try again.",
  OAuthCallback: "Error during GitHub callback. Please try again.",
  OAuthCreateAccount: "Could not create user account. Please try again.",
  EmailCreateAccount: "Could not link account with this email. Please try again.",
  Callback: "Authentication callback failed. Please try again.",
  OAuthAccountNotLinked: "An account with this email already exists. Please verify your email or link your account.",
  default: "Unable to sign in with GitHub. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <Image src="/icon.png" alt="CARF" width={22} height={22} className="rounded-sm shrink-0" priority />
            <span>CARF</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold">Sign in to CARF</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your GitHub account to manage rollback configuration and live deployments.
            </p>

            {error && (
              <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}
              </p>
            )}

            <form
              action={async () => {
                "use server";
                await signIn("github", { redirectTo: callbackUrl ?? "/dashboard" });
              }}
              className="mt-6 flex flex-col gap-4"
            >
              <Button type="submit" className="w-full gap-2.5 py-5 text-sm font-medium">
                <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>Continue with GitHub</span>
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              By signing in, you grant access to manage CARF configurations on your authorized GitHub repositories.
            </p>
          </div>
        </div>
      </div>

      <AuthVisualPanel />
    </main>
  );
}

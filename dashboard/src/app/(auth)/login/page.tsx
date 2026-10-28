import Link from "next/link";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { AuthVisualPanel } from "../../../components/AuthVisualPanel";
import { ShieldCheck, ArrowLeft, AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Server configuration issue with GitHub App credentials. Please verify AUTH_GITHUB_ID and AUTH_GITHUB_SECRET in your environment variables.",
  AccessDenied: "Access was denied by GitHub. Please grant authorization to continue.",
  OAuthSignin: "Error starting GitHub authorization. Please try again.",
  OAuthCallback: "Error during GitHub callback. Please check your GitHub App Authorization callback URL.",
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
  const githubHref = `/api/auth/github?callbackUrl=${encodeURIComponent(callbackUrl ?? "/dashboard")}`;

  return (
    <main className="grid min-h-svh lg:grid-cols-2 bg-background selection:bg-primary/20 selection:text-primary">
      {/* Left Column: Login Form */}
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 lg:px-16">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground hover:opacity-90 transition-opacity">
            <Image src="/icon.png" alt="CARF" width={24} height={24} className="rounded-md shrink-0" priority />
            <span className="font-mono font-bold tracking-tight">CARF</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">v1.4</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to home</span>
          </Link>
        </div>

        {/* Center Card */}
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            {/* Eyebrow Label */}
            <div className="font-mono text-xs font-medium text-muted-foreground mb-3">
              Deployment Resilience Control Plane
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to CARF</h1>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Connect with your GitHub account to manage automated rollbacks, AST classification rules, and live telemetry guards.
            </p>

            {/* Error Message Alert */}
            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <p className="leading-snug">{ERROR_MESSAGES[error] ?? ERROR_MESSAGES.default}</p>
              </div>
            )}

            {/* GitHub OAuth Button */}
            <div className="mt-6">
              <Button
                render={<a href={githubHref} />}
                className="w-full gap-2.5 py-5 text-xs font-semibold shadow-xs hover:shadow-sm transition-all"
              >
                <svg className="size-4 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>Continue with GitHub</span>
              </Button>
            </div>

            {/* Security Guarantee Card */}
            <div className="mt-8 rounded-xl border border-border bg-card p-4 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-[11px] uppercase tracking-wider">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>Security &amp; Privacy First</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground text-[11px] leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">&bull;</span>
                  <span>Zero database credentials or production keys stored on host agents.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">&bull;</span>
                  <span>Fine-grained repository access scoped strictly to chosen repositories.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">&bull;</span>
                  <span>Fully auditable rollback execution and telemetry decision logs.</span>
                </li>
              </ul>
            </div>

            <p className="mt-6 text-center text-[11px] text-muted-foreground leading-relaxed">
              By continuing, you grant CARF access to inspect commit diffs and evaluate health thresholds on authorized repositories.
            </p>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-4 border-t border-border/40 font-mono">
          <span>&copy; {new Date().getFullYear()} CARF Open Source</span>
          <div className="flex items-center gap-3">
            <Link href="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/docs/integrations" className="hover:text-foreground transition-colors">
              Integrations
            </Link>
          </div>
        </div>
      </div>

      {/* Right Column: Decorative Visual Panel */}
      <AuthVisualPanel />
    </main>
  );
}

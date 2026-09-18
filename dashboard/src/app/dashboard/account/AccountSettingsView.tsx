"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  User,
  Mail,
  KeyRound,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Loader2,
} from "lucide-react";
import type { AccountRow } from "../../../lib/accountService";

interface AccountSettingsViewProps {
  initialAccount: AccountRow;
}

export function AccountSettingsView({ initialAccount }: AccountSettingsViewProps) {
  const router = useRouter();

  // Profile State
  const [name, setName] = useState(initialAccount.name ?? "");
  const [email, setEmail] = useState(initialAccount.email);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password State
  const [hasPassword, setHasPassword] = useState(Boolean(initialAccount.hasPassword));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Delete Account State
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const memberSince = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
    new Date(initialAccount.createdAt)
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileMessage({ type: "success", text: "Profile updated successfully!" });
      router.refresh();
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update profile",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters long." });
      setPasswordSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordMessage({ type: "success", text: data.message || "Password updated successfully!" });
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update password",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Please type DELETE exactly to confirm account deletion.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
      setIsDeleting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6 md:p-8">
      {/* Page Header */}
      <div>
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">Account</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your contact profile, primary email, credentials, and authentication preferences.
        </p>
      </div>

      {/* User Overview Card */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        {initialAccount.image ? (
          <Image
            src={initialAccount.image}
            alt={initialAccount.name ?? initialAccount.email}
            width={60}
            height={60}
            className="rounded-full border border-border/80 object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {(name || email || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">{name || "GitHub User"}</h2>
            <Badge variant="secondary" className="text-[11px] font-normal">
              Active
            </Badge>
          </div>
          <p className="truncate text-xs font-mono text-muted-foreground">{email}</p>
          {initialAccount.githubId && (
            <p className="mt-0.5 text-xs text-muted-foreground">GitHub User ID: #{initialAccount.githubId}</p>
          )}
        </div>
      </div>

      {/* Section 1: Edit Profile & Primary Email */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-4">
          <User className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Profile & Contact Email</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          When signing in via GitHub, your default public GitHub email was imported. You can change your primary email
          below to your preferred contact address (e.g. personal or work email).
        </p>

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="display-name" className="text-xs font-medium">
              Display Name
            </Label>
            <Input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="email-address" className="text-xs font-medium">
              Primary Email Address
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="email-address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="pr-8"
              />
              <Mail className="pointer-events-none absolute right-2.5 top-2.5 size-4 text-muted-foreground" />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Notifications, reports, and tenant ownership will be mapped to this address.
            </p>
          </div>

          {profileMessage && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                profileMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {profileMessage.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{profileMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={profileSaving} size="sm">
              {profileSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Save Profile Changes
            </Button>
          </div>
        </form>
      </section>

      {/* Section 2: Identity & Authentication Provider */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-4">
          <Shield className="size-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Authentication & Identity</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub OAuth (CARF App)</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Connected Identity Provider for repository protection.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <div className="text-xs font-medium text-foreground">{memberSince}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Account Member Since</p>
          </div>
        </div>
      </section>

      {/* Section 3: Password Management */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              {hasPassword ? "Change Password" : "Set Account Password"}
            </h2>
          </div>
          <Badge variant={hasPassword ? "secondary" : "outline"} className="text-[11px]">
            {hasPassword ? "Password Configured" : "No Password Set"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {hasPassword
            ? "Update your existing account password below. Passwords must be at least 8 characters long."
            : "You can set a password to enable direct email/password login as an alternative to GitHub OAuth."}
        </p>

        <form onSubmit={handleSavePassword} className="mt-5 space-y-4">
          {hasPassword && (
            <div>
              <Label htmlFor="current-password" className="text-xs font-medium">
                Current Password
              </Label>
              <Input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="mt-1.5"
              />
            </div>
          )}

          <div>
            <Label htmlFor="new-password" className="text-xs font-medium">
              New Password
            </Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="confirm-password" className="text-xs font-medium">
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="mt-1.5"
            />
          </div>

          {passwordMessage && (
            <div
              className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
                passwordMessage.type === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {passwordMessage.type === "success" ? (
                <CheckCircle2 className="size-4 shrink-0" />
              ) : (
                <AlertCircle className="size-4 shrink-0" />
              )}
              <span>{passwordMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={passwordSaving} size="sm">
              {passwordSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {hasPassword ? "Update Password" : "Set Password"}
            </Button>
          </div>
        </form>
      </section>

      {/* Section 4: Session & Sign Out */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-2">
          <LogOut className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">Active Session</h2>
        </div>
        <p className="text-xs text-muted-foreground">Sign out of your CARF dashboard session on this browser.</p>
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="mr-1.5 size-3.5" />
            Sign Out
          </Button>
        </div>
      </section>

      {/* Section 5: Danger Zone - Delete Account */}
      <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 dark:border-destructive/40">
        <div className="flex items-center gap-2 text-destructive">
          <Trash2 className="size-4" />
          <h2 className="text-base font-semibold">Danger Zone: Delete Account</h2>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Permanently delete your account, session records, and unlink all GitHub App installations from your profile.
          This action cannot be undone.
        </p>

        <div className="mt-5 space-y-3 rounded-lg border border-destructive/20 bg-background/80 p-4">
          <Label htmlFor="delete-confirm" className="text-xs font-medium text-foreground">
            To confirm deletion, please type <span className="font-mono font-bold text-destructive">DELETE</span> below:
          </Label>
          <Input
            id="delete-confirm"
            type="text"
            value={deleteConfirmation}
            onChange={(e) => {
              setDeleteConfirmation(e.target.value);
              setDeleteError(null);
            }}
            placeholder="Type DELETE to confirm"
            className="border-destructive/30 font-mono text-xs focus-visible:border-destructive"
          />

          {deleteError && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteConfirmation !== "DELETE" || isDeleting}
              onClick={handleDeleteAccount}
            >
              {isDeleting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Permanently Delete Account
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

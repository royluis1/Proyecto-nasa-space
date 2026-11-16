"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth/auth-provider";
import { LoginNotConfigured } from "@/components/auth/login-not-configured";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accessModeTitle, otherAccessMode, type AccessMode } from "@/lib/access-mode";

/** Unified access screen: same URL and container for both sign in and sign up. */
export default function CuentaPage() {
  const { user, loading, configured, signIn, signUp, signOut } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (configured && loading) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // Already signed in.
  if (user) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title="Your account" />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound aria-hidden className="size-5" /> Signed in
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Signed in as <strong>{user.email}</strong>. Your fields and their history are saved to your account.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/campos">Go to my fields</Link>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  router.refresh();
                }}
              >
                <LogOut aria-hidden /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const switchMode = (m: AccessMode) => {
    setMode(m);
    setError(null);
    setOk(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const r = await signIn(email, password);
        if (r.error) setError(r.error);
        else router.push("/campos");
      } else {
        const r = await signUp(email, password, name || undefined);
        if (r.error) setError(r.error);
        else if (r.needsEmailConfirm)
          setOk("We sent you an email to confirm your account. Check your inbox and then sign in.");
        else router.push("/campos");
      }
    } catch {
      setError("Could not connect. Please try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={accessModeTitle(mode)}
        description="Save your fields and their history to make decisions over time."
      />

      {!configured && <LoginNotConfigured />}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Access mode">
        <Button
          variant={mode === "signin" ? "default" : "outline"}
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => switchMode("signin")}
        >
          Already have an account? Sign in
        </Button>
        <Button
          variant={mode === "signup" ? "default" : "outline"}
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
        >
          New here? Sign up
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name (optional)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Roy" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="At least 6 characters"
              />
            </div>

            {error && <Alert tone="error">{error}</Alert>}
            {ok && <Alert tone="success">{ok}</Alert>}

            <Button type="submit" size="lg" disabled={busy || !configured} className="w-full">
              {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <button type="button" className="font-medium text-primary underline" onClick={() => switchMode(otherAccessMode(mode))}>
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button type="button" className="font-medium text-primary underline" onClick={() => switchMode(otherAccessMode(mode))}>
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}

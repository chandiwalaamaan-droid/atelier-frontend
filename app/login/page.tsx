"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { GoogleCompleteProfile } from "@/components/GoogleCompleteProfile";
import { clearAuthCache } from "@/lib/authCache";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set once Google Sign-In reports no account exists yet for that Google
  // email — swaps the card over to the "finish your profile" step instead
  // of the normal login form.
  const [googlePending, setGooglePending] = useState<{ credential: string; suggestedDisplayName: string } | null>(
    null
  );

  function goToNext() {
    clearAuthCache();
    const next = searchParams.get("next");
    router.push(next && next.startsWith("/") ? next : "/explore");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }
    // Send the user back to whatever page RequireAuth redirected them from
    // (?next=...), falling back to the dashboard if there isn't one.
    goToNext();
  }

  async function onGoogleCredential(credential: string) {
    setError("");
    setLoading(true);
    const res = await apiFetch("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Google sign-in failed.");
      return;
    }
    if (data.isNewUser) {
      setGooglePending({ credential, suggestedDisplayName: data.suggestedDisplayName || "" });
      return;
    }
    goToNext();
  }

  if (googlePending) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="stitched w-full max-w-sm rounded-2xl bg-plum/60 p-8">
          <h1 className="font-display text-2xl mb-1">Almost there</h1>
          <GoogleCompleteProfile
            credential={googlePending.credential}
            suggestedDisplayName={googlePending.suggestedDisplayName}
            onDone={goToNext}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="stitched w-full max-w-sm rounded-2xl bg-plum/60 p-8">
        <h1 className="font-display text-2xl mb-1">Welcome back</h1>
        <p className="text-sm text-parchment/60 mb-6">Log in to reach your characters.</p>

        {error && (
          <p className="mb-4 text-sm text-rose bg-rose/10 border border-rose/30 rounded px-3 py-2">{error}</p>
        )}

        <GoogleSignInButton text="signin_with" onCredential={onGoogleCredential} />

        <label className="block text-sm mb-1 text-parchment/70">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 focus-ring"
        />

        <label className="block text-sm mb-1 text-parchment/70">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-2 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 focus-ring"
        />
        <p className="mb-6 text-right">
          <Link href="/forgot-password" className="text-xs text-gold hover:underline">
            Forgot password?
          </Link>
        </p>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold text-ink py-2.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-60"
        >
          {loading ? "Logging in…" : "Log in"}
        </button>

        <p className="mt-5 text-sm text-parchment/60 text-center">
          No account yet?{" "}
          <Link href="/signup" className="text-gold hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}

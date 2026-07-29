"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { GoogleCompleteProfile } from "@/components/GoogleCompleteProfile";
import { clearAuthCache } from "@/lib/authCache";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googlePending, setGooglePending] = useState<{ credential: string; suggestedDisplayName: string } | null>(
    null
  );

  function goToExplore() {
    clearAuthCache();
    router.push("/explore");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tosAccepted) {
      setError("You must confirm you're 18+ and accept the Terms of Service to continue.");
      return;
    }
    setLoading(true);
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName, email, password, birthdate, tosAccepted }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      return;
    }
    goToExplore();
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
    goToExplore();
  }

  if (googlePending) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-void">
        <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-plum/60 to-plum-deep/80 p-8 border border-gold/20 shadow-2xl shadow-gold/5 animate-scale-in">
          <h1 className="font-display text-2xl mb-1 gradient-text">Almost there</h1>
          <GoogleCompleteProfile
            credential={googlePending.credential}
            suggestedDisplayName={googlePending.suggestedDisplayName}
            onDone={goToExplore}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-void relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.03] pointer-events-none" style={{ background: "radial-gradient(circle, #c9a227 0%, transparent 70%)" }} aria-hidden />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.03] pointer-events-none" style={{ background: "radial-gradient(circle, #b5657a 0%, transparent 70%)" }} aria-hidden />

      <form onSubmit={onSubmit} className="relative w-full max-w-sm rounded-2xl bg-gradient-to-br from-plum/60 to-plum-deep/80 p-8 border border-white/5 shadow-2xl animate-scale-in">
        <div className="text-center mb-6">
          <span className="text-3xl mb-2 block">🌸</span>
          <h1 className="font-display text-2xl gradient-text">Open your atelier</h1>
          <p className="text-sm text-parchment/50 mt-1">A few details and you're in.</p>
        </div>

        {error && (
          <p className="mb-4 text-sm text-rose bg-rose/10 border border-rose/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <GoogleSignInButton text="signup_with" onCredential={onGoogleCredential} />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/5" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-plum-deep/80 px-3 text-parchment/40">or sign up with email</span>
          </div>
        </div>

        <label className="block text-sm mb-1.5 text-parchment/60">Display name</label>
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full mb-4 rounded-xl bg-plum-deep/80 border border-white/10 px-4 py-2.5 focus-ring placeholder:text-parchment/25"
          placeholder="Your name"
        />

        <label className="block text-sm mb-1.5 text-parchment/60">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-xl bg-plum-deep/80 border border-white/10 px-4 py-2.5 focus-ring placeholder:text-parchment/25"
          placeholder="you@example.com"
        />

        <label className="block text-sm mb-1.5 text-parchment/60">Password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-1 rounded-xl bg-plum-deep/80 border border-white/10 px-4 py-2.5 focus-ring placeholder:text-parchment/25"
          placeholder="At least 8 characters"
        />
        <p className="text-xs text-parchment/40 mb-4 ml-1">At least 8 characters.</p>

        <label className="block text-sm mb-1.5 text-parchment/60">Date of birth</label>
        <input
          type="date"
          required
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full mb-2 rounded-xl bg-plum-deep/80 border border-white/10 px-4 py-2.5 focus-ring [color-scheme:dark]"
        />
        <p className="text-xs text-parchment/40 mb-4 ml-1">
          Atelier includes user-created mature content and is for adults only. You must be 18 or older.
        </p>

        <label className="flex items-start gap-2 mb-6 text-xs text-parchment/60 cursor-pointer group">
          <input
            type="checkbox"
            required
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            className="mt-0.5 focus-ring accent-gold w-4 h-4"
          />
          <span className="group-hover:text-parchment/80 transition-colors">
            I'm 18 or older and I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-gold hover:text-gold/80 transition-colors">
              Terms of Service & Content Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-gold hover:text-gold/80 transition-colors">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !tosAccepted}
          className="w-full bg-gold text-ink py-2.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-60 btn-shine shadow-lg shadow-gold/20"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="mt-5 text-sm text-parchment/50 text-center">
          Already have one?{" "}
          <Link href="/login" className="text-gold hover:text-gold/80 transition-colors font-medium">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
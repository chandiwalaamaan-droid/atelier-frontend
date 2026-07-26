"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [tosAccepted, setTosAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    router.push("/explore");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="stitched w-full max-w-sm rounded-2xl bg-plum/60 p-8">
        <h1 className="font-display text-2xl mb-1">Open your atelier</h1>
        <p className="text-sm text-parchment/60 mb-6">A few details and you're in.</p>

        {error && (
          <p className="mb-4 text-sm text-rose bg-rose/10 border border-rose/30 rounded px-3 py-2">{error}</p>
        )}

        <label className="block text-sm mb-1 text-parchment/70">Display name</label>
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full mb-4 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 focus-ring"
        />

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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-2 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 focus-ring"
        />
        <p className="text-xs text-parchment/50 mb-6">At least 8 characters.</p>

        <label className="block text-sm mb-1 text-parchment/70">Date of birth</label>
        <input
          type="date"
          required
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          className="w-full mb-2 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 focus-ring"
        />
        <p className="text-xs text-parchment/50 mb-4">
          Atelier includes user-created mature content and is for adults only. You must be 18 or older.
        </p>

        <label className="flex items-start gap-2 mb-6 text-xs text-parchment/70 cursor-pointer">
          <input
            type="checkbox"
            required
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            className="mt-0.5 focus-ring"
          />
          <span>
            I'm 18 or older and I agree to the{" "}
            <Link href="/terms" target="_blank" className="text-gold hover:underline">
              Terms of Service &amp; Content Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy" target="_blank" className="text-gold hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading || !tosAccepted}
          className="w-full bg-gold text-ink py-2.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="mt-5 text-sm text-parchment/60 text-center">
          Already have one?{" "}
          <Link href="/login" className="text-gold hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}

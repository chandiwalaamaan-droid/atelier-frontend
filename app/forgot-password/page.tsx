"use client";

import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setMessage(data.message || "If that email has an account, a reset link is on its way.");
      setSent(true);
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="stitched w-full max-w-sm rounded-2xl bg-plum/60 p-8">
        <h1 className="font-display text-2xl mb-1">Reset your password</h1>
        <p className="text-sm text-parchment/60 mb-6">
          Enter the email you signed up with and we'll send a reset link.
        </p>

        {error && (
          <p className="mb-4 text-sm text-rose bg-rose/10 border border-rose/30 rounded px-3 py-2">{error}</p>
        )}
        {sent && (
          <p className="mb-4 text-sm text-parchment/80 bg-gold/10 border border-gold/30 rounded px-3 py-2">
            {message}
          </p>
        )}

        {!sent && (
          <>
            <label className="block text-sm mb-1 text-parchment/70">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mb-6 rounded-lg bg-plum-deep border border-parchment/20 px-3 py-2 focus-ring"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-ink py-2.5 rounded-full font-medium hover:brightness-110 focus-ring disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </>
        )}

        <p className="mt-5 text-sm text-parchment/60 text-center">
          <Link href="/login" className="text-gold hover:underline">
            Back to log in
          </Link>
        </p>
      </form>
    </main>
  );
}

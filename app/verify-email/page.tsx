"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [error, setError] = useState("");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "That link is invalid or has expired.");
          setStatus("error");
          return;
        }
        setStatus("ok");
      })
      .catch(() => {
        setError("Couldn't reach the server.");
        setStatus("error");
      });
  }, [token]);

  const handleResend = async () => {
    setResendState("sending");
    setResendError("");
    try {
      const res = await apiFetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setResendError("Sign in first, then resend the link from there.");
        } else {
          setResendError(data.error || "Couldn't resend the link.");
        }
        setResendState("error");
        return;
      }
      setResendState("sent");
    } catch {
      setResendError("Couldn't reach the server.");
      setResendState("error");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="stitched w-full max-w-sm rounded-2xl bg-plum/60 p-8 text-center">
        {status === "loading" && (
          <>
            <h1 className="font-display text-2xl mb-2">Verifying…</h1>
            <p className="text-sm text-parchment/60">One moment.</p>
          </>
        )}
        {status === "ok" && (
          <>
            <h1 className="font-display text-2xl mb-2">Email verified</h1>
            <p className="text-sm text-parchment/60 mb-6">
              You're all set. You can now share characters to Discover.
            </p>
            <Link href="/dashboard" className="text-gold hover:underline text-sm">
              Go to your dashboard
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-display text-2xl mb-2">Couldn't verify</h1>
            <p className="text-sm text-parchment/60 mb-6">{error || "That link is invalid or has expired."}</p>

            {resendState === "sent" ? (
              <p className="text-sm text-gold mb-6">New link sent — check your inbox.</p>
            ) : (
              <>
                <button
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  className="w-full bg-gold text-ink py-2 rounded-full font-medium hover:brightness-110 focus-ring text-sm disabled:opacity-60 mb-2"
                >
                  {resendState === "sending" ? "Sending…" : "Resend verification email"}
                </button>
                {resendState === "error" && (
                  <p className="text-xs text-rose mb-4">{resendError}</p>
                )}
              </>
            )}

            <Link href="/dashboard" className="text-gold hover:underline text-sm">
              Back to dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { PremiumLockBadge } from "@/components/PremiumActionButton";

type Character = {
  id: string;
  name: string;
  tagline: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  accentColor: string;
  isPublic?: boolean;
};

export default function MePage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [tab, setTab] = useState<"creations" | "collect" | "gallery">("creations");

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setDisplayName(d.user?.displayName ?? "");
        setEmail(d.user?.email ?? "");
      });
    apiFetch("/api/characters")
      .then((r) => (r.ok ? r.json() : { characters: [] }))
      .then((d) => setCharacters(d.characters ?? []));
  }, []);

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const initial = (displayName || email || "?").charAt(0).toUpperCase();

  return (
    <RequireAuth>
      <AppShell>
        <div className="flex-1 overflow-y-auto px-4 md:px-10 py-8 max-w-3xl mx-auto w-full">
          <div className="flex items-start gap-4 mb-8">
            <span className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500/40 to-violet-600/40 flex items-center justify-center text-3xl font-display shrink-0">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl truncate">{displayName || "Your profile"}</h1>
              <p className="text-xs text-parchment/40 truncate">{email}</p>
              <p className="text-xs text-parchment/45 mt-2">0 followers · 0 interactions</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-1.5">
                <span aria-hidden>♛</span>
                <span className="text-xs">Lite</span>
                <PremiumLockBadge />
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-parchment/45 hover:text-rose border border-white/10 px-3 py-1.5 rounded-full focus-ring shrink-0"
            >
              Log out
            </button>
          </div>

          <div className="flex gap-6 border-b border-white/10 mb-6 text-sm">
            {(
              [
                ["creations", "Creations"],
                ["collect", "Collect 🔒"],
                ["gallery", "Gallery 🔒"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`pb-3 border-b-2 -mb-px focus-ring ${
                  tab === id ? "border-gold text-parchment" : "border-transparent text-parchment/45"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "creations" && (
            <>
              {characters === null && <p className="text-parchment/40">Loading…</p>}
              {characters?.length === 0 && (
                <p className="text-center text-parchment/45 py-12">No characters yet</p>
              )}
              <ul className="space-y-3">
                {characters?.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/chat/${c.id}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-white/5 hover:border-white/15 focus-ring"
                    >
                      <span
                        className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                        style={{ backgroundColor: `${c.accentColor}35` }}
                      >
                        {c.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={resolveMediaUrl(c.avatarUrl)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          c.avatarEmoji
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium truncate">{c.name}</span>
                        <span className="block text-xs text-parchment/45 truncate">{c.tagline}</span>
                      </span>
                      {c.isPublic && (
                        <span className="text-[10px] text-parchment/35 border border-white/10 px-2 py-0.5 rounded-full">
                          Public
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard"
                className="fixed bottom-8 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-12 flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-full font-medium shadow-lg hover:brightness-110 focus-ring"
              >
                + Create
              </Link>
            </>
          )}

          {(tab === "collect" || tab === "gallery") && (
            <div className="text-center py-16 text-parchment/45">
              <p className="mb-2">Premium feature</p>
              <p className="text-sm mb-6">Collections and gallery unlock with Atelier+ later.</p>
              <Link href="/plus" className="text-gold hover:underline text-sm">
                View membership →
              </Link>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

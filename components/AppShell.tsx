"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { EARLY_ACCESS_MESSAGE, PREMIUM_PAYMENTS_ENABLED } from "@/lib/premium";

type ChatPreview = {
  id: string;
  name: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  accentColor: string;
  lastMessagePreview?: string | null;
};

type AppShellProps = {
  children: React.ReactNode;
  /** Chat uses a tighter layout — sidebar stays, main area is flex column. */
  variant?: "default" | "chat";
};

const NAV: { href: string; label: string; icon: string; badge?: string }[] = [
  { href: "/explore", label: "Explore", icon: "⌂" },
  { href: "/plus", label: "Atelier+", icon: "♛", badge: PREMIUM_PAYMENTS_ENABLED ? undefined : "Free" },
  { href: "/wallet", label: "Wallet", icon: "◎" },
  { href: "/dashboard", label: "Studio", icon: "✦" },
  { href: "/me", label: "Me", icon: "◉" },
];

export default function AppShell({ children, variant = "default" }: AppShellProps) {
  const pathname = usePathname();
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setDisplayName(d.user?.displayName ?? ""));
    apiFetch("/api/characters")
      .then((r) => (r.ok ? r.json() : { characters: [] }))
      .then((d) => {
        const list = (d.characters ?? []) as ChatPreview[];
        const withPreview = list.filter((c) => c.lastMessagePreview);
        setChats(withPreview.slice(0, 8));
      })
      .catch(() => setChats([]));
  }, [pathname]);

  return (
    <div className="min-h-screen flex bg-void text-parchment">
      <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-white/5 bg-surface-raised">
        <Link href="/explore" className="flex items-center gap-2.5 px-5 py-5 focus-ring rounded-lg mx-2 mt-2">
          <span className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-lg">🌸</span>
          <span className="font-display text-lg tracking-wide">Atelier</span>
        </Link>

        <nav className="px-3 mt-2 space-y-0.5 flex-1">
          {NAV.map(({ href, label, icon, badge }) => {
            const active = pathname === href || (href === "/dashboard" && pathname?.startsWith("/characters"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors focus-ring ${
                  active ? "bg-white/10 text-parchment font-medium" : "text-parchment/55 hover:text-parchment hover:bg-white/5"
                }`}
              >
                <span className="w-5 text-center text-base opacity-80">{icon}</span>
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/25 text-gold border border-gold/30">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-6 pb-2 px-3">
            <p className="text-[11px] font-medium text-parchment/35 uppercase tracking-wider">Chats</p>
          </div>
          <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
            {chats.length === 0 && (
              <p className="px-3 py-2 text-xs text-parchment/35">No chats yet</p>
            )}
            {chats.map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-white/5 focus-ring ${
                  pathname === `/chat/${c.id}` ? "bg-white/8" : ""
                }`}
              >
                <span
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden text-sm"
                  style={{ backgroundColor: `${c.accentColor}35` }}
                >
                  {c.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(c.avatarUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    c.avatarEmoji
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-parchment/85 font-medium">{c.name}</span>
                  <span className="block truncate text-parchment/40">{c.lastMessagePreview}</span>
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-white/5">
          {!PREMIUM_PAYMENTS_ENABLED && (
            <p className="text-[10px] text-parchment/35 leading-snug mb-3">{EARLY_ACCESS_MESSAGE}</p>
          )}
          <p className="text-xs text-parchment/40 truncate" title={displayName}>
            {displayName || "Signed in"}
          </p>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${variant === "chat" ? "h-screen" : "min-h-screen"}`}>
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-raised">
          <Link href="/explore" className="font-display text-lg flex items-center gap-2">
            <span>🌸</span> Atelier
          </Link>
          <nav className="flex gap-1 text-xs">
            {NAV.slice(0, 4).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-2 py-1 rounded-lg ${pathname === href ? "bg-white/10" : "text-parchment/50"}`}
              >
                {label.replace("Atelier+", "+")}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

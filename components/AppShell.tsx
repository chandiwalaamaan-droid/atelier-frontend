"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, resolveMediaUrl } from "@/lib/api";
import { EARLY_ACCESS_MESSAGE, PREMIUM_PAYMENTS_ENABLED } from "@/lib/premium";
import Logo from "@/components/Logo";

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
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-white/5 bg-gradient-to-b from-surface-raised via-surface-raised to-plum-deep/40">
        <Link href="/explore" className="flex items-center gap-2.5 px-5 py-5 focus-ring rounded-lg mx-2 mt-2 group">
          <span className="w-10 h-10 rounded-full bg-gradient-to-br from-gold/30 to-gold/10 flex items-center justify-center shadow-lg shadow-gold/10 group-hover:shadow-gold/20 transition-shadow">
            <Logo size={24} />
          </span>
          <span className="font-display text-lg tracking-wide shimmer-text">Atelier</span>
        </Link>

        <nav className="px-3 mt-3 flex-1">
          <div className="space-y-0.5">
            {NAV.map(({ href, label, icon, badge }) => {
              const active = pathname === href || (href === "/dashboard" && pathname?.startsWith("/characters"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 focus-ring ${
                    active
                      ? "bg-gradient-to-r from-gold/15 to-gold/5 text-parchment font-medium border border-gold/10"
                      : "text-parchment/55 hover:text-parchment hover:bg-white/5"
                  }`}
                >
                  <span className={`w-5 text-center text-base ${active ? "text-gold" : "opacity-80"}`}>{icon}</span>
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gold/25 text-gold border border-gold/30">
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="pt-8 pb-2 px-3">
            <p className="text-[11px] font-medium text-parchment/30 uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-px bg-parchment/10" />
              Chats
              <span className="flex-1 h-px bg-parchment/10" />
            </p>
          </div>
          <div className="space-y-0.5 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
            {chats.length === 0 && (
              <p className="px-3 py-3 text-xs text-parchment/30 text-center italic">No chats yet</p>
            )}
            {chats.map((c) => (
              <Link
                key={c.id}
                href={`/chat/${c.id}`}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all duration-200 focus-ring ${
                  pathname === `/chat/${c.id}`
                    ? "bg-white/8 border border-white/5"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <span
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden text-sm ring-1 ring-white/5"
                  style={{ backgroundColor: `${c.accentColor}30` }}
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
                  <span className="block truncate text-parchment/35 leading-tight">{c.lastMessagePreview}</span>
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto">
          {!PREMIUM_PAYMENTS_ENABLED && (
            <p className="text-[10px] text-parchment/30 leading-snug mb-3 italic">{EARLY_ACCESS_MESSAGE}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold/30 to-plum/50 flex items-center justify-center text-xs">
              ◉
            </div>
            <p className="text-xs text-parchment/50 truncate" title={displayName}>
              {displayName || "Signed in"}
            </p>
          </div>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${variant === "chat" ? "h-screen" : "min-h-screen"}`}>
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-surface-raised to-plum-deep/60">
          <Link href="/explore" className="font-display text-lg flex items-center gap-2">
            <Logo size={24} />
            <span className="shimmer-text">Atelier</span>
          </Link>
          <nav className="flex gap-1 text-xs">
            {NAV.slice(0, 4).map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  pathname === href ? "bg-white/10 text-parchment" : "text-parchment/50 hover:text-parchment/80"
                }`}
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
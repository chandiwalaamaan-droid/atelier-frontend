"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedUser, fetchAndCacheUser } from "@/lib/authCache";
import HeroOrb3D from "@/components/HeroOrb3D";
import Tilt3D from "@/components/Tilt3D";
import Reveal from "@/components/Reveal";
import LiveChatPreview from "@/components/LiveChatPreview";

// Placeholder cast for logged-out visitors — there's no public/unauthenticated
// character-listing endpoint (GET /api/characters/discover requires a
// session, by design: it's filtered by isPublic/isHidden/isExplicit and
// intentionally not exposed to unauthenticated scraping/indexing). Swapping
// these for real characters would mean adding that public endpoint, which is
// a deliberate call about what's crawlable/scrapable while logged out, not
// a drop-in fix — so these stay clearly-labeled placeholders that route to
// signup (matching the rest of this page's CTAs) instead of pretending to
// open a real chat.
const FEATURED_CHARACTERS = [
  { name: "Nyra Shadow", tagline: "mysterious enchantress", emoji: "🌙", color: "#8b5cf6" },
  { name: "Evelyn Rose", tagline: "romantic poet", emoji: "🌹", color: "#b5657a" },
  { name: "Damien Black", tagline: "brooding detective", emoji: "🕵️", color: "#06b6d4" },
  { name: "Luna Voss", tagline: "celestial wanderer", emoji: "✨", color: "#c9a227" },
  { name: "Mistress Vesper", tagline: "dominatrix extraordinaire", emoji: "💋", color: "#d946ef" },
  { name: "Victor Kane", tagline: "vampire aristocrat", emoji: "🦇", color: "#8a3d54" },
];

export default function Home() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<"checking" | "authed" | "guest">("checking");

  // Who am I? (mirrors RequireAuth's cache-first check, see lib/authCache.ts)
  useEffect(() => {
    let cancelled = false;
    const cached = getCachedUser();
    if (cached?.user) {
      setAuthStatus("authed");
    } else {
      fetchAndCacheUser().then((user) => {
        if (cancelled) return;
        setAuthStatus(user ? "authed" : "guest");
      });
    }
    return () => { cancelled = true; };
  }, []);

  // Previously this branch rendered a full duplicate "Profile Settings" editor
  // right here on "/" for logged-in visitors (identical to /me's page, minus
  // the app nav) instead of taking them into the app. That meant every time
  // a signed-in user opened the site's link, they landed on a profile-editing
  // dead end with no way back in except the small "Studio" button — clicking
  // the logo/link again just reloaded the same page. "/me" already owns
  // profile editing, so signed-in visitors to "/" now go straight to the
  // real logged-in home, /explore, instead.
  useEffect(() => {
    if (authStatus === "authed") router.replace("/explore");
  }, [authStatus, router]);

  if (authStatus === "checking" || authStatus === "authed") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <p className="text-parchment/60">Loading…</p>
      </main>
    );
  }

  if (authStatus === "guest") {
    return (
      <main className="min-h-screen flex flex-col bg-void relative overflow-hidden aurora-bg">
        <div
          className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.06] pointer-events-none"
          style={{
            background: "radial-gradient(circle, #c9a227 0%, transparent 70%)",
            animation: "float 8s ease-in-out infinite",
          }}
          aria-hidden
        />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-[0.06] pointer-events-none"
          style={{
            background: "radial-gradient(circle, #b5657a 0%, transparent 70%)",
            animation: "float 8s ease-in-out infinite",
            animationDelay: "-4s",
          }}
          aria-hidden
        />
        <div
          className="absolute top-[40%] right-[15%] w-[300px] h-[300px] rounded-full opacity-[0.04] pointer-events-none"
          style={{
            background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
            animation: "float 6s ease-in-out infinite",
            animationDelay: "-2s",
          }}
          aria-hidden
        />

        <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 md:px-12 md:py-5 border-b border-white/5 backdrop-blur-sm">
          <span className="font-display text-xl tracking-wide flex items-center gap-2">
            <span className="text-lg animate-bounce-slow">🌸</span>
            <span className="shimmer-text">Rolichat</span>
          </span>
          <nav className="flex gap-2 sm:gap-3 text-xs sm:text-sm">
            <Link href="/login" className="hover:text-gold focus-ring rounded-full px-3 py-1.5 sm:px-4 sm:py-2 transition-colors hover:bg-white/5">Log in</Link>
            <Link href="/signup" className="bg-gold text-ink px-3 py-1.5 sm:px-5 sm:py-2 rounded-full font-medium hover:brightness-110 focus-ring btn-shine inline-block shadow-lg shadow-gold/20 text-xs sm:text-base">Get started</Link>
          </nav>
        </header>

        <section className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-10 px-6 md:px-12 py-16 max-w-7xl mx-auto w-full">
          <div className="floor-grid-3d" />
          <div className="relative z-10 flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-gold text-gold text-xs mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-gold animate-sparkle glow-dot text-gold" />
              a workshop for characters
            </div>

            <h1 className="font-display text-5xl md:text-7xl lg:text-7xl xl:text-8xl max-w-4xl leading-tight animate-fade-in-up">
              Give a personality a <span className="shimmer-text">voice</span>,<br />then talk to it.
            </h1>

            <p className="mt-8 max-w-xl text-parchment/60 font-body text-lg leading-relaxed animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Craft unique characters with rich personalities and backstories.
              Every character you make is <span className="text-parchment/90 font-medium">private, editable, and ready whenever you are.</span>
            </p>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Link href="/signup" className="btn-3d bg-gold text-ink px-8 py-4 rounded-full font-medium hover:brightness-110 focus-ring btn-shine text-lg inline-block">Create your first character</Link>
              <Link href="/login" className="border border-parchment/25 px-8 py-4 rounded-full font-medium hover:border-gold focus-ring transition-all hover:bg-white/5">I already have an account</Link>
            </div>

            <div className="mt-16 flex flex-wrap justify-center lg:justify-start gap-8 md:gap-16 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <div className="text-center lg:text-left">
                <p className="font-display text-3xl gradient-text">∞</p>
                <p className="text-xs text-parchment/40 mt-1">Characters</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div className="text-center lg:text-left">
                <p className="font-display text-3xl gradient-text">✦</p>
                <p className="text-xs text-parchment/40 mt-1">Private by design</p>
              </div>
              <div className="w-px h-12 bg-white/10" />
              <div className="text-center lg:text-left">
                <p className="font-display text-3xl gradient-text">AI</p>
                <p className="text-xs text-parchment/40 mt-1">Powered</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 order-1 lg:order-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <HeroOrb3D />
          </div>
        </section>

        <section className="relative z-10 px-6 md:px-12 py-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <Reveal className="order-2 lg:order-1 text-center lg:text-left">
              <p className="text-xs text-gold/60 uppercase tracking-widest mb-2">See it in action</p>
              <h2 className="font-display text-3xl md:text-4xl gradient-text mb-4">Real conversations, remembered</h2>
              <p className="text-parchment/60 leading-relaxed max-w-md mx-auto lg:mx-0">
                Every character holds onto the thread of your conversation — the details you shared, the tone you set, the story so far. This is what talking to one actually looks like.
              </p>
            </Reveal>
            <Reveal delay={100} className="order-1 lg:order-2">
              <LiveChatPreview />
            </Reveal>
          </div>
        </section>

        <section className="relative z-10 px-6 md:px-12 py-12">
          <Reveal className="text-center mb-8">
            <p className="text-xs text-gold/60 uppercase tracking-widest mb-2">Meet the cast</p>
            <h2 className="font-display text-2xl md:text-3xl gradient-text">Characters waiting for you</h2>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {FEATURED_CHARACTERS.map((char, i) => (
              <Reveal key={char.name} delay={i * 70}>
                <Link
                  href="/signup"
                  className="group cursor-pointer block"
                >
                  <Tilt3D maxTilt={10} scale={1.04} className="rounded-2xl">
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 shadow-lg shadow-black/40" style={{ background: `linear-gradient(160deg, ${char.color}30, #121218)` }}>
                      <div className="absolute inset-0 flex items-center justify-center text-5xl group-hover:scale-110 transition-transform duration-500" style={{ transform: "translateZ(30px)" }}>{char.emoji}</div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3" style={{ transform: "translateZ(20px)" }}>
                        <p className="font-display text-sm font-medium text-parchment truncate">{char.name}</p>
                        <p className="text-[10px] text-parchment/50 truncate">{char.tagline}</p>
                      </div>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ boxShadow: `inset 0 0 30px ${char.color}20` }} />
                    </div>
                  </Tilt3D>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <div className="relative z-10 mx-6 mb-12 md:mx-12 grid gap-6 grid-cols-1 md:grid-cols-3 max-w-5xl md:mx-auto">
          {[
            { n: "01", title: "Craft", body: "Name a character, describe their traits and background, and write the line they open with." },
            { n: "02", title: "Converse", body: "Chat naturally. Each character remembers your conversation with them, and only them." },
            { n: "03", title: "Iterate", body: "Edit a character's backstory any time and the next reply reflects the change." },
          ].map((step, i) => (
            <Reveal key={step.n} delay={i * 100}>
              <Tilt3D maxTilt={8} scale={1.02} className="rounded-2xl h-full">
                <div className="h-full stitched rounded-2xl bg-gradient-to-br from-plum/40 via-plum/50 to-plum-deep/60 backdrop-blur-sm px-6 py-8 border-glow-gold shadow-lg shadow-black/40">
                  <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center mb-3" style={{ transform: "translateZ(24px)" }}>
                    <span className="text-gold font-display font-bold">{step.n}</span>
                  </div>
                  <p className="font-display text-lg text-gold mb-2" style={{ transform: "translateZ(16px)" }}>{step.title}</p>
                  <p className="text-sm text-parchment/60 leading-relaxed">{step.body}</p>
                </div>
              </Tilt3D>
            </Reveal>
          ))}
        </div>

        <footer className="relative z-10 px-6 pb-10 md:px-12 flex flex-wrap gap-x-6 gap-y-2 text-xs text-parchment/40">
          <span>Rolichat is for adults 18+.</span>
          <Link href="/terms" className="hover:text-gold transition-colors">Terms of Service & Content Policy</Link>
          <Link href="/privacy" className="hover:text-gold transition-colors">Privacy Policy</Link>
        </footer>
      </main>
    );
  }
}

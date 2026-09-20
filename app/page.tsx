"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedUser, fetchAndCacheUser } from "@/lib/authCache";
import TiltCard from "@/components/TiltCard";
import Logo from "@/components/Logo";

import ScrollFrameSequence from "@/components/ScrollFrameSequence";

// Hover glow color per character, keyed to each character's `accent` above.
// (Previously `accent` was set on every character but never read anywhere,
// so every card showed the same gold glow regardless of its assigned tone.)
const ACCENT_GLOW: Record<string, string> = {
  violet: "rgba(139,92,246,.18)",
  rose: "rgba(181,101,122,.18)",
  cyan: "rgba(6,182,212,.18)",
  amber: "rgba(245,158,11,.18)",
};

const FEATURED_CHARACTERS = [
  {
    name: "Sukuna",
    tagline: "the king of curses",
    image: "/assets/characters/Sukuna_202608132107.jpeg",
    accent: "violet",
  },
  {
    name: "Faye Valentine",
    tagline: "sharp-tongued dreamer",
    image: "/assets/characters/Faye_Valentine_202608132107.jpeg",
    accent: "rose",
  },
  {
    name: "Satoru Gojo",
    tagline: "the strongest, casually",
    image: "/assets/characters/Satoru_Gojo_202608132107.jpeg",
    accent: "cyan",
  },
  {
    name: "Hinata Hyuga",
    tagline: "quiet strength",
    image: "/assets/characters/Hinata_Hyuga_202608132107.jpeg",
    accent: "violet",
  },
  {
    name: "Denji",
    tagline: "chaotic heart of gold",
    image: "/assets/characters/Denji_202608132107.jpeg",
    accent: "amber",
  },
  {
    name: "Yor Forger",
    tagline: "elegance with an edge",
    image: "/assets/characters/Yor_Forger_202608132107.jpeg",
    accent: "rose",
  },
];



export default function Home() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<"checking" | "authed" | "guest">("checking");

  useEffect(() => {
    let cancelled = false;
    const cached = getCachedUser();
    // Only trust the cache without a network round trip when it's both
    // present AND fresh (checked in the last 60s — see lib/authCache.ts).
    // A stale "authed" cache used to be trusted outright here, which could
    // instantly bounce someone with an expired session over to /explore
    // instead of keeping them on the (correct) logged-out landing page.
    if (cached?.user && cached.fresh) {
      setAuthStatus("authed");
    } else {
      fetchAndCacheUser().then((user) => {
        if (cancelled) return;
        setAuthStatus(user ? "authed" : "guest");
      });
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (authStatus === "authed") router.replace("/explore");
  }, [authStatus, router]);

  if (authStatus === "checking" || authStatus === "authed") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-void">
        <p className="text-parchment/60 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="landing-page relative min-h-screen overflow-x-clip bg-void text-parchment">
      <header className="landing-header fixed inset-x-0 top-0 z-50 px-4 py-3.5 sm:px-6 lg:px-10">
        <div className="landing-header-shell mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="group flex items-center gap-3 rounded-xl px-2 py-1.5 focus-ring">
            <Logo size={30} />
            <div className="leading-none">
              <span className="font-display text-[1.08rem] tracking-tight">Rolichat</span>
              <span className="ml-2 hidden text-[9px] uppercase tracking-[0.26em] text-parchment/30 sm:inline">AI roleplay</span>
            </div>
          </Link>

          <nav className="landing-nav flex items-center gap-1.5 rounded-full p-1 sm:gap-2">
            <Link href="/login" className="rounded-full px-3 py-2 text-xs text-parchment/65 transition-colors hover:bg-white/[0.06] hover:text-parchment focus-ring sm:px-4 sm:text-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn-shine btn-press rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink transition-[filter,transform] hover:brightness-95 focus-ring sm:px-5 sm:text-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[100svh]">
          <div className="pointer-events-auto mx-auto flex h-full max-w-7xl items-start px-5 pt-28 sm:items-center sm:px-8 sm:pt-0 lg:px-12">
            <div className="landing-hero-copy max-w-[36rem]">
              <div className="landing-kicker animate-fade-in-up">
                <span className="landing-kicker-dot" />
                <span>Character studio</span>
                <span className="landing-kicker-line" />
                <span className="landing-kicker-live">Live</span>
              </div>

              <h1 className="landing-hero-title mt-6 animate-fade-in-up font-display leading-[.88] tracking-[-0.06em]">
                <span className="block text-parchment">Your character</span>
                <span className="landing-gradient-text block">comes to life.</span>
              </h1>

              <p className="mt-6 max-w-lg animate-fade-in-up text-sm leading-6 text-parchment/58 sm:text-[1.02rem] sm:leading-7" style={{ animationDelay: "100ms" }}>
                Shape a personality, memory and story — then watch the character reveal itself as you move through the page.
              </p>

              <div className="mt-8 flex animate-fade-in-up flex-col gap-3 sm:flex-row" style={{ animationDelay: "160ms" }}>
                <Link href="/signup" className="landing-primary-btn btn-shine btn-press inline-flex items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-ink focus-ring">
                  Create a character
                  <span className="landing-arrow" aria-hidden>↗</span>
                </Link>
                <Link href="/explore" className="landing-secondary-btn btn-press inline-flex items-center justify-center gap-3 rounded-full px-6 py-3.5 text-sm font-medium text-parchment/80 focus-ring">
                  Explore the cast
                  <span className="text-parchment/35" aria-hidden>•</span>
                  <span className="text-[11px] text-parchment/45">24/7</span>
                </Link>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3 sm:mt-9">
                {[['Memory', 'stays with them'], ['Personality', 'shapes every reply'], ['Story', 'keeps evolving']].map(([label, detail]) => (
                  <div key={label} className="landing-mini-stat">
                    <p>{label}</p>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="landing-scroll-cue absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <div className="landing-scroll-orbit mx-auto mb-2">
              <span />
            </div>
            <p className="text-[9px] uppercase tracking-[0.34em] text-white/32">Scroll to shape</p>
          </div>
        </div>

        <ScrollFrameSequence scrollHeight="440vh" />
      </div>

      <section className="landing-proof relative z-10 px-4 py-5 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.018]">
          {[['01', 'Infinite', 'possibilities'], ['02', 'Personal', 'characters'], ['03', 'AI-powered', 'roleplay']].map(([n, title, detail], i) => (
            <div key={n} className={`landing-proof-item ${i ? 'border-l border-white/[0.07]' : ''}`}>
              <span>{n}</span>
              <div>
                <p>{title}</p>
                <small>{detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-32">
        <div className="mb-8 flex items-end justify-between gap-6 sm:mb-9">
          <div>
            <div className="section-eyebrow"><span /> The cast</div>
            <h2 className="mt-3 max-w-full font-display text-[clamp(2.1rem,8vw,3.2rem)] leading-[.98] tracking-[-0.045em]">Start with a character.</h2>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-5 text-parchment/38 sm:block">Use the cast as a starting point. Then give the story your own voice.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {FEATURED_CHARACTERS.map((char, i) => (
            <Link href="/signup" key={char.name} className="group block focus-ring rounded-2xl animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <TiltCard className="character-card premium-character-card relative aspect-[3/4] overflow-hidden rounded-[22px] border border-white/[0.08] bg-surface-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image src={char.image} alt={char.name} fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 16vw" className="object-cover transition-transform duration-[420ms] [transition-timing-function:var(--ease-out)] group-hover:scale-[1.045]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <p className="font-display text-sm leading-tight sm:text-base">{char.name}</p>
                  <p className="mt-1 truncate text-[10px] text-parchment/45">{char.tagline}</p>
                </div>
                <div
                  className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{ boxShadow: `inset 0 0 45px ${ACCENT_GLOW[char.accent] ?? "rgba(201,162,39,.16)"}` }}
                />
              </TiltCard>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section relative z-10 mx-auto max-w-7xl px-6 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="landing-process overflow-hidden rounded-[30px] border border-white/[0.08] p-7 sm:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
            <div>
              <div className="section-eyebrow"><span /> How it works</div>
              <h2 className="mt-3 max-w-md font-display text-3xl leading-[.98] tracking-[-0.04em] sm:text-5xl">Build the person. Enter the story.</h2>
            </div>
            <div className="grid gap-7 sm:grid-cols-3">
              {[
                ["01", "Craft", "Give your character a voice, personality and history."],
                ["02", "Converse", "Start a conversation and let the roleplay unfold."],
                ["03", "Evolve", "Refine your character and keep building the story."],
              ].map(([number, title, text]) => (
                <div key={number} className="landing-process-step group">
                  <div className="landing-step-number">{number}</div>
                  <div>
                    <p className="font-display text-xl transition-colors duration-200 group-hover:text-gold-light">{title}</p>
                    <p className="mt-2 text-xs leading-5 text-parchment/45">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-final relative z-10 px-6 pb-24 sm:px-8 lg:px-12">
        <div className="landing-final-card mx-auto max-w-5xl overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-10 sm:py-20">
          <div className="landing-final-glow" aria-hidden="true" />
          <div className="relative z-10">
            <div className="section-eyebrow justify-center"><span /> Your next story starts here <span /></div>
            <h2 className="mx-auto mt-4 max-w-4xl font-display text-4xl leading-[.95] tracking-[-0.05em] sm:text-6xl lg:text-7xl">Don&apos;t just chat with AI. Step into the story.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-parchment/45 sm:text-base">Create someone worth talking to, then give them a world worth staying in.</p>
            <Link href="/signup" className="landing-cta-btn btn-shine btn-press mt-8 inline-flex items-center gap-3 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-ink focus-ring">
              Start creating
              <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-[10px] text-parchment/30 sm:flex-row sm:items-center sm:justify-between">
          <span>Rolichat is for adults 18+.</span>
          <div className="flex gap-5">
            <Link href="/terms" className="transition-colors hover:text-parchment/60">Terms & Content Policy</Link>
            <Link href="/privacy" className="transition-colors hover:text-parchment/60">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

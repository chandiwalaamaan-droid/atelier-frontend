"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCachedUser, fetchAndCacheUser } from "@/lib/authCache";
import TiltCard from "@/components/TiltCard";
import Logo from "@/components/Logo";
import HeroSceneBoundary from "@/components/HeroSceneBoundary";

const HeroAuroraScene = dynamic(() => import("@/components/HeroAuroraScene"), {
  ssr: false,
});

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

const HERO_CHARACTERS = [
  { name: "Naruto", image: "/assets/characters/Naruto_Uzumaki_202608132107.jpeg", className: "hero-character hero-character-main" },
  { name: "Gojo", image: "/assets/characters/Satoru_Gojo_202608132107.jpeg", className: "hero-character hero-character-top" },
  { name: "Faye", image: "/assets/characters/Faye_Valentine_202608132107.jpeg", className: "hero-character hero-character-bottom" },
];

export default function Home() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<"checking" | "authed" | "guest">("checking");

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
    <main className="landing-page relative min-h-screen overflow-hidden bg-void text-parchment">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <HeroSceneBoundary><HeroAuroraScene /></HeroSceneBoundary>
      </div>
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] landing-vignette" />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] landing-grid" />

      <header className="relative z-20 px-5 py-4 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2.5 backdrop-blur-xl sm:px-4">
          <Link href="/" className="group flex items-center gap-3 rounded-xl px-2 py-1 focus-ring">
            <Logo size={30} />
            <div className="leading-none">
              <span className="font-display text-lg tracking-tight">Rolichat</span>
              <span className="ml-2 hidden text-[10px] uppercase tracking-[0.22em] text-parchment/35 sm:inline">AI roleplay</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login" className="rounded-full px-3 py-2 text-xs text-parchment/65 transition-colors duration-150 hover:bg-white/[0.05] hover:text-parchment focus-ring sm:px-4 sm:text-sm">
              Log in
            </Link>
            <Link href="/signup" className="btn-shine btn-press rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink shadow-[0_8px_30px_rgba(201,162,39,.18)] transition-[filter,transform] duration-150 hover:brightness-110 focus-ring sm:px-5 sm:text-sm">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-12 sm:px-8 md:pt-20 lg:grid-cols-[1.02fr_.98fr] lg:gap-16 lg:px-12 lg:pb-28 lg:pt-24">
        <div className="max-w-2xl">
          <div className="animate-fade-in-up inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-gold-light">
            <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_14px_rgba(201,162,39,.8)]" />
            Your characters. Your stories.
          </div>

          <h1 className="mt-7 max-w-3xl animate-fade-in-up font-display text-[3.6rem] leading-[.94] tracking-[-0.045em] sm:text-6xl md:text-7xl lg:text-[5.8rem]" style={{ animationDelay: "60ms" }}>
            <span className="text-parchment">Meet someone</span>
            <br />
            <span className="shimmer-text">worth talking to.</span>
          </h1>

          <p className="mt-7 max-w-xl animate-fade-in-up text-base leading-7 text-parchment/55 sm:text-lg" style={{ animationDelay: "120ms" }}>
            Create AI characters with their own personality, memory and story — then step inside the conversation.
          </p>

          <div className="mt-9 flex animate-fade-in-up flex-col gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Link href="/signup" className="btn-shine btn-press group inline-flex items-center justify-center gap-3 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-ink shadow-[0_16px_50px_rgba(201,162,39,.16)] transition-[filter,transform] duration-150 hover:brightness-110 focus-ring">
              Create a character
              <span aria-hidden className="text-base transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </Link>
            <Link href="/login" className="btn-press inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.025] px-6 py-3.5 text-sm font-medium text-parchment/75 backdrop-blur-sm transition-[background,border-color,transform] duration-200 hover:border-white/20 hover:bg-white/[0.06] focus-ring">
              I already have an account
            </Link>
          </div>

          <div className="mt-12 flex animate-fade-in-up flex-wrap items-center gap-x-7 gap-y-3 text-[11px] text-parchment/35" style={{ animationDelay: "240ms" }}>
            <span>01 — Create</span>
            <span className="hidden h-px w-8 bg-white/10 sm:block" />
            <span>02 — Talk</span>
            <span className="hidden h-px w-8 bg-white/10 sm:block" />
            <span>03 — Remember</span>
          </div>
        </div>

        <div className="relative mx-auto h-[470px] w-full max-w-[570px] lg:h-[560px]">
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet/10 blur-[90px]" />
          <div className="hero-character-frame absolute left-1/2 top-1/2 h-[400px] w-[min(280px,78vw)] -translate-x-1/2 -translate-y-1/2 rotate-[1deg] overflow-hidden rounded-[34px] border border-white/10 bg-surface-card/70 shadow-[0_40px_100px_rgba(0,0,0,.45)] lg:h-[470px] lg:w-[330px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image src={HERO_CHARACTERS[0].image} alt={HERO_CHARACTERS[0].name} fill priority sizes="(max-width: 1023px) min(280px, 78vw), 330px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gold-light">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Online
              </div>
              <p className="font-display text-2xl">Naruto Uzumaki</p>
              <p className="mt-1 text-xs text-parchment/50">never gives up</p>
            </div>
          </div>

          {HERO_CHARACTERS.slice(1).map((char, index) => (
            <div key={char.name} className={`${char.className} hero-character-card absolute z-10 w-[145px] overflow-hidden rounded-2xl border border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl sm:w-[165px]`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image src={char.image} alt={char.name} fill sizes="(max-width: 639px) 145px, 165px" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8">
                <p className="font-display text-sm">{char.name}</p>
              </div>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald shadow-[0_0_12px_rgba(16,185,129,.8)]" />
            </div>
          ))}

          <div className="absolute bottom-1 left-1/2 z-20 w-max max-w-[calc(100%-24px)] -translate-x-1/2 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-center text-[10px] leading-tight text-parchment/55 shadow-xl backdrop-blur-xl">
            A world of characters, one conversation away.
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/[0.06] bg-black/20 px-4 py-6 backdrop-blur-md sm:px-8 sm:py-5 lg:px-12">
        <div className="mx-auto grid max-w-7xl grid-cols-3 divide-x divide-white/[0.07]">
          <div className="min-w-0 px-2 text-center sm:px-8">
            <p className="whitespace-nowrap font-display text-[15px] leading-tight tracking-[-0.02em] sm:text-2xl">Infinite</p>
            <p className="mt-1 whitespace-nowrap text-[8px] uppercase tracking-[0.14em] text-parchment/30 sm:text-[10px] sm:tracking-[0.18em]">possibilities</p>
          </div>
          <div className="min-w-0 px-2 text-center sm:px-8">
            <p className="whitespace-nowrap font-display text-[15px] leading-tight tracking-[-0.02em] sm:text-2xl">Personal</p>
            <p className="mt-1 whitespace-nowrap text-[8px] uppercase tracking-[0.14em] text-parchment/30 sm:text-[10px] sm:tracking-[0.18em]">characters</p>
          </div>
          <div className="min-w-0 px-2 text-center sm:px-8">
            <p className="whitespace-nowrap font-display text-[15px] leading-tight tracking-[-0.025em] sm:text-2xl">AI-powered</p>
            <p className="mt-1 whitespace-nowrap text-[8px] uppercase tracking-[0.14em] text-parchment/30 sm:text-[10px] sm:tracking-[0.18em]">roleplay</p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-8 flex items-end justify-between gap-6 sm:mb-9">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-gold/65">The cast</p>
            <h2 className="max-w-full font-display text-[clamp(2rem,8vw,2.5rem)] leading-[1.04] tracking-tight sm:text-4xl">Start with a character.</h2>
          </div>
          <p className="hidden max-w-xs text-right text-xs leading-5 text-parchment/35 sm:block">Use these characters as inspiration, then make the story yours.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
          {FEATURED_CHARACTERS.map((char, i) => (
            <Link href="/signup" key={char.name} className="group block focus-ring rounded-2xl animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <TiltCard className="character-card relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/[0.07] bg-surface-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image src={char.image} alt={char.name} fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 16vw" className="object-cover transition-transform duration-[420ms] [transition-timing-function:var(--ease-out)] group-hover:scale-[1.045]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <p className="font-display text-sm leading-tight sm:text-base">{char.name}</p>
                  <p className="mt-1 truncate text-[10px] text-parchment/45">{char.tagline}</p>
                </div>
                <div className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ boxShadow: "inset 0 0 45px rgba(201,162,39,.16)" }} />
              </TiltCard>
            </Link>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-plum/45 via-surface-card/80 to-black/40 p-7 shadow-[0_30px_100px_rgba(0,0,0,.25)] sm:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-gold/70">How it works</p>
              <h2 className="mt-3 max-w-md font-display text-3xl leading-tight sm:text-4xl">Build the person. Enter the story.</h2>
            </div>
            <div className="grid gap-7 sm:grid-cols-3">
              {[
                ["01", "Craft", "Give your character a voice, personality and history."],
                ["02", "Converse", "Start a conversation and let the roleplay unfold."],
                ["03", "Evolve", "Refine your character and keep building the story."],
              ].map(([number, title, text]) => (
                <div key={number} className="group">
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-gold/70">{number}</p>
                  <p className="mt-3 font-display text-xl transition-colors duration-150 group-hover:text-gold-light">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-parchment/45">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-24 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold/65">Your next story starts here</p>
          <h2 className="mx-auto mt-3 max-w-3xl font-display text-4xl leading-[1] tracking-tight sm:text-6xl">Don&apos;t just chat with AI. Step into the story.</h2>
          <Link href="/signup" className="btn-shine btn-press mt-8 inline-flex items-center gap-3 rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-ink shadow-[0_18px_60px_rgba(201,162,39,.2)] transition-[filter,transform] duration-150 hover:brightness-110 focus-ring">
            Start creating
            <span aria-hidden>→</span>
          </Link>
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

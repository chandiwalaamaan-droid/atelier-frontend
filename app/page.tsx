import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-void relative overflow-hidden">
      {/* Animated background orbs */}
      <div
        className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #c9a227 0%, transparent 70%)",
          animation: "float 8s ease-in-out infinite",
        }}
        aria-hidden
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-[0.04] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #b5657a 0%, transparent 70%)",
          animation: "float 8s ease-in-out infinite",
          animationDelay: "-4s",
        }}
        aria-hidden
      />
      <div
        className="absolute top-[40%] right-[15%] w-[300px] h-[300px] rounded-full opacity-[0.03] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #c9a227 0%, transparent 70%)",
          animation: "float 6s ease-in-out infinite",
          animationDelay: "-2s",
        }}
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12 border-b border-white/5">
        <span className="font-display text-xl tracking-wide flex items-center gap-2">
          <span className="text-lg">🌸</span>
          <span className="gradient-text">Atelier</span>
        </span>
        <nav className="flex gap-4 text-sm">
          <Link href="/login" className="hover:text-gold focus-ring rounded px-2 py-1 transition-colors">
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-gold text-ink px-4 py-1.5 rounded-full font-medium hover:brightness-110 focus-ring btn-shine inline-block"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 md:px-12 py-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs mb-8 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-gold animate-sparkle" />
          a workshop for characters
        </div>

        <h1 className="font-display text-5xl md:text-7xl max-w-4xl leading-tight animate-fade-in-up">
          Give a personality a{" "}
          <span className="gradient-text">voice</span>,
          <br />
          then talk to it.
        </h1>

        <p className="mt-8 max-w-xl text-parchment/60 font-body text-lg leading-relaxed animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Sketch a character's traits and backstory, and Atelier brings them into a conversation.
          Every character you make is yours:{" "}
          <span className="text-parchment/80">private, editable, and ready whenever you are.</span>
        </p>

        <div className="mt-12 flex gap-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <Link
            href="/signup"
            className="bg-gold text-ink px-8 py-3.5 rounded-full font-medium hover:brightness-110 focus-ring btn-shine text-lg shadow-lg shadow-gold/20"
          >
            Create your first character
          </Link>
          <Link
            href="/login"
            className="border border-parchment/25 px-8 py-3.5 rounded-full font-medium hover:border-gold focus-ring transition-all hover:bg-white/5"
          >
            I already have an account
          </Link>
        </div>
      </section>

      <div className="relative z-10 stitched mx-6 mb-12 md:mx-12 rounded-2xl bg-gradient-to-br from-plum/40 via-plum/50 to-plum-deep/60 backdrop-blur-sm px-8 py-10 grid gap-8 md:grid-cols-3 border-glow-gold">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center mb-3">
            <span className="text-gold font-display font-bold">01</span>
          </div>
          <p className="font-display text-lg text-gold mb-2">Craft</p>
          <p className="text-sm text-parchment/60 leading-relaxed">
            Name a character, describe their traits and background, and write the line they open with.
          </p>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center mb-3">
            <span className="text-gold font-display font-bold">02</span>
          </div>
          <p className="font-display text-lg text-gold mb-2">Converse</p>
          <p className="text-sm text-parchment/60 leading-relaxed">
            Chat naturally. Each character remembers your conversation with them, and only them.
          </p>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center mb-3">
            <span className="text-gold font-display font-bold">03</span>
          </div>
          <p className="font-display text-lg text-gold mb-2">Iterate</p>
          <p className="text-sm text-parchment/60 leading-relaxed">
            Edit a character's backstory any time and the next reply reflects the change.
          </p>
        </div>
      </div>

      <footer className="relative z-10 px-6 pb-10 md:px-12 flex flex-wrap gap-x-6 gap-y-2 text-xs text-parchment/40">
        <span>Atelier is for adults 18+.</span>
        <Link href="/terms" className="hover:text-gold transition-colors">
          Terms of Service & Content Policy
        </Link>
        <Link href="/privacy" className="hover:text-gold transition-colors">
          Privacy Policy
        </Link>
      </footer>
    </main>
  );
}
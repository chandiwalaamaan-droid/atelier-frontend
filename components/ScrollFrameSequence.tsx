"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  frameCount?: number;
  framePath?: string;
  className?: string;
};

export default function ScrollFrameSequence({
  frameCount = 120,
  framePath = "/frames/ezgif-frame-",
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const currentFrameRef = useRef(-1);
  const targetFrameRef = useRef(0);
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(reduce.matches);
    update();
    reduce.addEventListener?.("change", update);
    return () => reduce.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const mobile = window.innerWidth < 768;
    const step = mobile && !reducedMotion ? 2 : 1;
    const indices = Array.from({ length: frameCount }, (_, i) => i + 1).filter((i) => i % step === 0 || i === 1 || i === frameCount);

    framesRef.current.clear();
    setLoaded(0);
    setReady(false);

    const load = async () => {
      let count = 0;
      await Promise.all(indices.map((index) => new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (cancelled) return resolve();
          framesRef.current.set(index, img);
          count += 1;
          setLoaded(count);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = `${framePath}${String(index).padStart(3, "0")}.jpg`;
      })));

      if (!cancelled) {
        setReady(true);
      }
    };

    load();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frameCount, framePath, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(targetFrameRef.current);
    };

    const draw = (requestedIndex: number) => {
      const exact = framesRef.current.get(requestedIndex);
      const frame = exact ?? findNearestLoaded(requestedIndex);
      if (!frame) return;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const scale = Math.max(width / frame.naturalWidth, height / frame.naturalHeight);
      const drawWidth = frame.naturalWidth * scale;
      const drawHeight = frame.naturalHeight * scale;
      const x = (width - drawWidth) / 2;
      const y = (height - drawHeight) / 2;
      ctx.fillStyle = "#080b0e";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(frame, x, y, drawWidth, drawHeight);
      currentFrameRef.current = requestedIndex;
    };

    const findNearestLoaded = (index: number) => {
      if (framesRef.current.size === 0) return null;
      let best: HTMLImageElement | null = null;
      let distance = Infinity;
      for (const [key, image] of framesRef.current) {
        const nextDistance = Math.abs(key - index);
        if (nextDistance < distance) {
          best = image;
          distance = nextDistance;
        }
      }
      return best;
    };

    const paint = () => {
      rafRef.current = null;
      const frame = reducedMotion ? 1 : targetFrameRef.current;
      if (frame !== currentFrameRef.current) draw(frame);
    };

    const onScroll = () => {
      if (reducedMotion) return;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(paint);

      if (!section) return;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      targetFrameRef.current = Math.round(progress * (frameCount - 1)) + 1;
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [frameCount, reducedMotion, ready]);

  const progress = ready ? loaded / (reducedMotion || (typeof window !== "undefined" && window.innerWidth < 768) ? Math.ceil(frameCount / 2) : frameCount) : 0;

  return (
    <section ref={sectionRef} className={`relative h-[400vh] ${className}`} aria-label="Character creation scroll animation">
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-[#080b0e]">
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(157,110,255,.08),transparent_31%),linear-gradient(180deg,rgba(3,5,7,.2),rgba(3,5,7,.64))]" />

        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080b0e]/90 backdrop-blur-sm">
            <div className="mb-4 h-px w-36 overflow-hidden bg-white/10">
              <div className="h-full bg-violet-300 transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Preparing your character</p>
          </div>
        )}
      </div>
    </section>
  );
}

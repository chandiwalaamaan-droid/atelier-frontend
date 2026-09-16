"use client";

import { useEffect, useRef, useState } from "react";

type ScrollFrameSequenceProps = {
  /**
   * Path prefix for frames, e.g. "/frames/product" if files are
   * /public/frames/product/0001.webp, 0002.webp, ...
   */
  basePath: string;
  /** Total number of frames in the sequence (desktop / full-res count). */
  frameCount: number;
  /** File extension of the frames. Default "webp". */
  extension?: string;
  /**
   * How the numbers are padded, e.g. 4 -> 0001.webp. Default 4.
   */
  padLength?: number;
  /**
   * Height of the scroll container in viewport units. Bigger = slower
   * scrub (more scroll distance per frame). Default 400 (i.e. 400vh).
   * Tune this first if the animation feels too fast/slow.
   */
  scrollHeightVh?: number;
  /** Optional className applied to the outer scroll container. */
  className?: string;
  /** Content rendered on top of the sticky canvas (captions, CTA, etc). */
  children?: React.ReactNode;
  /**
   * Show a subtle scroll-progress indicator (vertical track + glowing dot)
   * on the right edge of the sticky canvas, so the user knows they're
   * inside a scroll-driven section and how far through it they are.
   * Default true.
   */
  showProgress?: boolean;
};

/**
 * Apple-style scroll-linked image sequence.
 *
 * - Frames are painted onto a <canvas>, never <img> tags, so there's no
 *   layout thrash and we can control exactly what's on screen each tick.
 * - All frames are preloaded up front; a simple loading state is shown
 *   until that finishes.
 * - Scroll position within the tall wrapper is mapped to a frame index.
 *   Scrolling down increases the index (steps forward), scrolling up
 *   decreases it (steps back) — scroll is the play head.
 * - The canvas is `sticky` inside a tall (e.g. 400vh) wrapper, so it
 *   holds in place on screen while the user scrolls through the range
 *   that drives the animation.
 * - Painting happens inside requestAnimationFrame, and only when the
 *   target frame index actually changed, so a fast scroll doesn't spam
 *   redraws on every single scroll event.
 * - On mobile (<768px) we load every second frame to cut bandwidth/decoding
 *   cost, and re-map the scroll fraction onto that shorter set.
 * - If the user has prefers-reduced-motion set, we skip the animation
 *   entirely and just show one static frame.
 */
export default function ScrollFrameSequence({
  basePath,
  frameCount,
  extension = "webp",
  padLength = 4,
  scrollHeightVh = 400,
  className = "",
  children,
  showProgress = true,
}: ScrollFrameSequenceProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const targetFrameRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);
  const progressDotRef = useRef<HTMLDivElement | null>(null);
  const progressFillRef = useRef<HTMLDivElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mediaQuery.matches;

    const isMobile = window.innerWidth < 768;
    // On mobile, skip every second frame to halve decode/paint cost.
    const step = isMobile ? 2 : 1;
    const indices: number[] = [];
    for (let i = 0; i < frameCount; i += step) indices.push(i);
    // Always make sure the very last frame is included so the sequence
    // ends on the true final frame rather than an early stand-in.
    if (indices[indices.length - 1] !== frameCount - 1) {
      indices.push(frameCount - 1);
    }

    const pad = (n: number) => String(n + 1).padStart(padLength, "0");
    const urls = indices.map((i) => `${basePath}/${pad(i)}.${extension}`);

    let cancelled = false;
    let loadedCount = 0;
    const loadedImages: HTMLImageElement[] = new Array(urls.length);

    // Reduced motion: only load a single representative frame.
    const urlsToLoad = reducedMotionRef.current
      ? [urls[Math.floor(urls.length / 2)]]
      : urls;

    urlsToLoad.forEach((url, idx) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (cancelled) return;
        loadedImages[idx] = img;
        loadedCount += 1;
        setLoadProgress(Math.round((loadedCount / urlsToLoad.length) * 100));
        if (loadedCount === urlsToLoad.length) {
          imagesRef.current = loadedImages;
          setIsLoading(false);
          drawFrame(0);
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        loadedCount += 1;
        if (loadedCount === urlsToLoad.length) {
          imagesRef.current = loadedImages.filter(Boolean);
          setIsLoading(false);
        }
      };
    });

    function drawFrame(index: number) {
      const canvas = canvasRef.current;
      const img = imagesRef.current[index];
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const targetW = canvas.clientWidth * dpr;
      const targetH = canvas.clientHeight * dpr;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      // Cover-fit the frame into the canvas, keeping aspect ratio.
      const canvasRatio = canvas.width / canvas.height;
      const imgRatio = img.width / img.height;
      let drawW = canvas.width;
      let drawH = canvas.height;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        drawH = canvas.height;
        drawW = drawH * imgRatio;
        offsetX = (canvas.width - drawW) / 2;
      } else {
        drawW = canvas.width;
        drawH = drawW / imgRatio;
        offsetY = (canvas.height - drawH) / 2;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }

    // Updated directly (no React state) so progress can move every tick
    // without triggering re-renders — same reasoning as the canvas draw.
    const progressFractionRef = { current: 0 };

    function updateProgressUI() {
      if (!showProgress) return;
      const pct = Math.round(progressFractionRef.current * 100);
      if (progressFillRef.current) {
        progressFillRef.current.style.height = `${pct}%`;
      }
      if (progressDotRef.current) {
        progressDotRef.current.style.top = `${pct}%`;
      }
    }

    function renderLoop() {
      if (currentFrameRef.current !== targetFrameRef.current) {
        currentFrameRef.current = targetFrameRef.current;
        drawFrame(currentFrameRef.current);
        updateProgressUI();
      }
      rafIdRef.current = requestAnimationFrame(renderLoop);
    }

    function onScroll() {
      const wrapper = wrapperRef.current;
      if (!wrapper || reducedMotionRef.current) return;

      const rect = wrapper.getBoundingClientRect();
      const totalScrollable = wrapper.offsetHeight - window.innerHeight;
      if (totalScrollable <= 0) return;

      // Fraction of the way through the tall wrapper, clamped 0..1.
      // rect.top goes from 0 (wrapper just entered) to -totalScrollable
      // (wrapper about to leave) as the user scrolls through it.
      const scrolled = Math.min(
        Math.max(-rect.top, 0),
        totalScrollable
      );
      const fraction = scrolled / totalScrollable;
      progressFractionRef.current = fraction;

      const maxIndex = imagesRef.current.length - 1;
      const nextIndex = Math.round(fraction * maxIndex);
      targetFrameRef.current = Math.min(Math.max(nextIndex, 0), maxIndex);
      updateProgressUI();
    }

    function onResize() {
      drawFrame(currentFrameRef.current);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    rafIdRef.current = requestAnimationFrame(renderLoop);
    onScroll();

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, frameCount, extension, padLength]);

  return (
    <div
      ref={wrapperRef}
      className={`relative ${className}`}
      style={{ height: `${scrollHeightVh}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className="h-full w-full" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-void/80">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
              <p className="text-xs text-parchment/50">
                Loading animation… {loadProgress}%
              </p>
            </div>
          </div>
        )}

        {children && (
          <div className="pointer-events-none absolute inset-0 z-10">
            {children}
          </div>
        )}

        {showProgress && !isLoading && (
          <div
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 z-20 hidden h-[38%] w-px -translate-y-1/2 sm:right-6 sm:block lg:right-10"
          >
            {/* Static track */}
            <div className="h-full w-full rounded-full bg-white/10" />
            {/* Filled portion, grows top-down with scroll progress */}
            <div
              ref={progressFillRef}
              className="absolute left-0 top-0 w-full rounded-full bg-gradient-to-b from-gold/80 to-gold-light/40 transition-[height] duration-75 ease-out"
              style={{ height: "0%" }}
            />
            {/* Glowing dot marking the current position */}
            <div
              ref={progressDotRef}
              className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-light shadow-[0_0_10px_2px_rgba(232,197,71,.7)] transition-[top] duration-75 ease-out"
              style={{ top: "0%" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

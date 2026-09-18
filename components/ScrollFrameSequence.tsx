"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type Props = {
  frameCount?: number;
  framePath?: string;
  className?: string;
  scrollHeight?: string;
};

function getFrameIndices(frameCount: number, mobile: boolean, reducedMotion: boolean) {
  if (reducedMotion) return [1];
  if (!mobile) return Array.from({ length: frameCount }, (_, i) => i + 1);

  const indices = new Set<number>();
  for (let i = 1; i <= frameCount; i += 2) indices.add(i);
  indices.add(frameCount);
  return [...indices].sort((a, b) => a - b);
}

const PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  left: `${7 + ((i * 29) % 86)}%`,
  top: `${8 + ((i * 53) % 78)}%`,
  size: `${1 + (i % 3) * 0.55}px`,
  delay: `${-(i * 0.41)}s`,
  duration: `${6.5 + (i % 5) * 1.25}s`,
  drift: `${(i % 2 ? 1 : -1) * (5 + (i % 6) * 2)}px`,
  opacity: `${0.12 + (i % 5) * 0.055}`,
}));

export default function ScrollFrameSequence({
  frameCount = 120,
  framePath = "/frames-crisp/ezgif-frame-",
  className = "",
  scrollHeight = "440vh",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowCanvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const progressDotRef = useRef<HTMLSpanElement>(null);
  const framesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const drawRafRef = useRef<number | null>(null);
  const motionRafRef = useRef<number | null>(null);
  const targetFrameRef = useRef(1);
  const paintedFrameRef = useRef(0);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });
  const lastTimeRef = useRef(0);

  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setReducedMotion(media.matches);
    const updateViewport = () => setMobile(window.innerWidth < 768);
    updateMotion();
    updateViewport();

    media.addEventListener?.("change", updateMotion);
    window.addEventListener("resize", updateViewport, { passive: true });
    return () => {
      media.removeEventListener?.("change", updateMotion);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const frameIndices = useMemo(
    () => getFrameIndices(frameCount, mobile, reducedMotion),
    [frameCount, mobile, reducedMotion],
  );

  useEffect(() => {
    let cancelled = false;
    const frames = framesRef.current;
    frames.clear();
    setLoaded(0);
    setReady(false);
    paintedFrameRef.current = 0;
    targetFrameRef.current = 1;

    // Load the first and final frame first, then fill the sequence in order.
    const orderedIndices = [
      ...new Set([frameIndices[0], frameIndices[frameIndices.length - 1], ...frameIndices]),
    ];

    const concurrency = reducedMotion ? 1 : mobile ? 4 : 8;
    let cursor = 0;
    let completed = 0;

    const loadOne = (index: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = async () => {
          if (cancelled) return resolve();
          try {
            await img.decode();
          } catch {
            // The browser can still draw a successfully loaded image.
          }
          if (!cancelled) {
            frames.set(index, img);
            completed += 1;
            setLoaded(completed);
            if (index === 1) setReady(true);
          }
          resolve();
        };
        img.onerror = () => {
          completed += 1;
          if (!cancelled) setLoaded(completed);
          resolve();
        };
        img.src = `${framePath}${String(index).padStart(3, "0")}.webp`;
      });

    const worker = async () => {
      while (!cancelled) {
        const index = orderedIndices[cursor++];
        if (!index) return;
        await loadOne(index);
      }
    };

    void Promise.all(
      Array.from({ length: Math.min(concurrency, orderedIndices.length) }, worker),
    );

    return () => {
      cancelled = true;
    };
  }, [frameCount, framePath, frameIndices, mobile, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glowCanvas = glowCanvasRef.current;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!canvas || !glowCanvas || !section || !stage || !ready) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    const glowCtx = glowCanvas.getContext("2d", { alpha: true });
    if (!ctx || !glowCtx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    glowCtx.imageSmoothingEnabled = true;
    glowCtx.imageSmoothingQuality = "high";

    const resizeCanvas = () => {
      const cssWidth = Math.max(1, canvas.clientWidth);
      const cssHeight = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const backingWidth = Math.round(cssWidth * dpr);
      const backingHeight = Math.round(cssHeight * dpr);

      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      if (glowCanvas.width !== backingWidth || glowCanvas.height !== backingHeight) {
        glowCanvas.width = backingWidth;
        glowCanvas.height = backingHeight;
      }
      return { cssWidth, cssHeight, dpr };
    };

    const findNearestLoaded = (index: number) => {
      const frames = framesRef.current;
      if (frames.size === 0) return null;
      if (frames.has(index)) return frames.get(index)!;

      let nearest: HTMLImageElement | null = null;
      let distance = Number.POSITIVE_INFINITY;
      for (const [key, image] of frames) {
        const nextDistance = Math.abs(key - index);
        if (nextDistance < distance) {
          distance = nextDistance;
          nearest = image;
        }
      }
      return nearest;
    };

    const draw = (requestedIndex: number) => {
      const frame = findNearestLoaded(requestedIndex);
      if (!frame) return;
      const { cssWidth, cssHeight, dpr } = resizeCanvas();

      // The art is intentionally contained, not cover-cropped. The original
      // 1280x720 frames are kept close to native scale on desktop so the
      // character does not become soft from unnecessary enlargement.
      const imageAspect = frame.naturalWidth / frame.naturalHeight;
      let drawWidth = cssWidth;
      let drawHeight = cssWidth / imageAspect;
      if (drawHeight > cssHeight) {
        drawHeight = cssHeight;
        drawWidth = cssHeight * imageAspect;
      }

      const x = (cssWidth - drawWidth) / 2;
      const y = (cssHeight - drawHeight) / 2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#05070b";
      ctx.fillRect(0, 0, cssWidth, cssHeight);
      ctx.drawImage(frame, x, y, drawWidth, drawHeight);

      // A separate glow pass makes the luminous edge feel richer without
      // putting a blur filter over the crisp character itself.
      glowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glowCtx.clearRect(0, 0, cssWidth, cssHeight);
      glowCtx.globalAlpha = 0.9;
      glowCtx.drawImage(frame, x, y, drawWidth, drawHeight);

      paintedFrameRef.current = requestedIndex;
    };

    const paint = () => {
      drawRafRef.current = null;
      const next = reducedMotion ? 1 : targetFrameRef.current;
      if (next !== paintedFrameRef.current) draw(next);
    };

    const queuePaint = () => {
      if (drawRafRef.current == null) {
        drawRafRef.current = requestAnimationFrame(paint);
      }
    };

    const updateFromScroll = () => {
      if (reducedMotion) {
        targetFrameRef.current = 1;
        queuePaint();
        return;
      }

      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      const nextFrame = Math.min(
        frameCount,
        Math.max(1, Math.round(progress * (frameCount - 1)) + 1),
      );
      targetFrameRef.current = nextFrame;
      if (progressDotRef.current) {
        progressDotRef.current.style.top = `${progress * 100}%`;
      }
      queuePaint();
    };

    const updatePointer = (event: PointerEvent) => {
      if (reducedMotion || window.matchMedia("(pointer: coarse)").matches) return;
      const x = event.clientX / window.innerWidth - 0.5;
      const y = event.clientY / window.innerHeight - 0.5;
      pointerTargetRef.current = { x, y };
    };

    const animateMotion = (time: number) => {
      motionRafRef.current = requestAnimationFrame(animateMotion);
      if (reducedMotion) return;

      const previous = lastTimeRef.current || time;
      const delta = Math.min(32, time - previous);
      lastTimeRef.current = time;
      const current = pointerCurrentRef.current;
      const target = pointerTargetRef.current;
      const ease = 1 - Math.pow(0.0007, delta / 16.67);
      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;

      const seconds = time / 1000;
      const floatY = Math.sin(seconds * 0.78) * 5.5 + Math.sin(seconds * 0.37) * 2;
      const floatX = Math.sin(seconds * 0.52 + 1.1) * 1.4;
      const roll = Math.sin(seconds * 0.46) * 0.45;
      const tiltY = current.x * 6 + floatX;
      const tiltX = current.y * -4;
      const scale = 1.006 + Math.sin(seconds * 0.82) * 0.004;

      stage.style.transform = `translate3d(${current.x * 12}px, ${floatY + current.y * 6}px, 0) perspective(1100px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${roll}deg) scale(${scale})`;
      stage.style.setProperty("--cursor-x", `${50 + current.x * 28}%`);
      stage.style.setProperty("--cursor-y", `${50 + current.y * 24}%`);
      stage.style.setProperty("--float-angle", `${seconds * 4}deg`);
    };

    window.addEventListener("scroll", updateFromScroll, { passive: true });
    window.addEventListener("resize", updateFromScroll, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      queuePaint();
    });
    resizeObserver.observe(canvas);

    updateFromScroll();
    resizeCanvas();
    queuePaint();

    if (!reducedMotion) motionRafRef.current = requestAnimationFrame(animateMotion);

    return () => {
      window.removeEventListener("scroll", updateFromScroll);
      window.removeEventListener("resize", updateFromScroll);
      window.removeEventListener("pointermove", updatePointer);
      resizeObserver.disconnect();
      if (drawRafRef.current != null) cancelAnimationFrame(drawRafRef.current);
      if (motionRafRef.current != null) cancelAnimationFrame(motionRafRef.current);
      drawRafRef.current = null;
      motionRafRef.current = null;
    };
  }, [frameCount, ready, reducedMotion]);

  const progress = frameIndices.length ? Math.min(1, loaded / frameIndices.length) : 0;

  return (
    <section
      ref={sectionRef}
      className={`relative ${className}`}
      style={{ height: scrollHeight }}
      aria-label="Character reveal scroll animation"
    >
      <div className="hero-sequence sticky top-0 h-[100svh] min-h-screen w-full overflow-hidden">
        <div className="hero-sequence-bg absolute inset-0" aria-hidden="true" />
        <div className="hero-sequence-grid absolute inset-0" aria-hidden="true" />
        <div className="hero-sequence-aurora absolute inset-0" aria-hidden="true" />

        <div className="hero-particles absolute inset-0" aria-hidden="true">
          {PARTICLES.map((particle, i) => (
            <span
              key={i}
              className="hero-particle"
              style={
                {
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  opacity: particle.opacity,
                  animationDelay: particle.delay,
                  animationDuration: particle.duration,
                  ["--particle-drift" as string]: particle.drift,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="hero-orbit hero-orbit-one" aria-hidden="true" />
        <div className="hero-orbit hero-orbit-two" aria-hidden="true" />
        <div className="hero-sequence-halo absolute left-1/2 top-1/2" aria-hidden="true" />

        <div
          ref={stageRef}
          className="hero-sequence-stage absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="hero-sequence-art relative aspect-video w-[min(1320px,calc(100vw-32px))] max-h-[84svh]">
            <canvas ref={glowCanvasRef} className="hero-sequence-canvas-glow absolute inset-0 block h-full w-full" />
            <canvas ref={canvasRef} className="hero-sequence-canvas relative z-[2] block h-full w-full" />
            <div className="hero-sequence-light" />
            <div className="hero-sequence-sheen" />
          </div>
        </div>

        {!ready && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#05070b]">
            <div className="text-center">
              <div className="mx-auto h-11 w-11 rounded-full border border-violet-200/15 border-t-violet-200/80 animate-spin" />
              <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/45">
                Preparing your character
              </p>
              <div className="mx-auto mt-3 h-1 w-28 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-violet-200/60 transition-[width] duration-300" style={{ width: `${Math.max(6, progress * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-52 bg-gradient-to-t from-[#05070b] via-[#05070b]/40 to-transparent" />
        <div className="pointer-events-none absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,transparent_28%,rgba(2,4,8,.16)_62%,rgba(2,4,8,.66)_100%)]" />

        <div className="hero-sequence-progress absolute right-5 top-1/2 z-30 hidden -translate-y-1/2 md:block" aria-hidden="true">
          <span className="hero-progress-line" />
          <span ref={progressDotRef} className="hero-progress-dot" style={{ top: "0%" }} />
          <span className="mt-3 block text-[8px] uppercase tracking-[0.28em] text-white/25">scroll</span>
        </div>
      </div>
    </section>
  );
}

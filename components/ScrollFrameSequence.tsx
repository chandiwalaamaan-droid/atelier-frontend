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

const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  left: `${4 + ((i * 37) % 92)}%`,
  top: `${5 + ((i * 61) % 86)}%`,
  size: `${1 + (i % 3) * 0.65}px`,
  delay: `${-(i * 0.37)}s`,
  duration: `${5.5 + (i % 6) * 1.1}s`,
  drift: `${(i % 2 ? 1 : -1) * (6 + (i % 5) * 2)}px`,
  opacity: `${0.16 + (i % 5) * 0.09}`,
}));

export default function ScrollFrameSequence({
  frameCount = 120,
  framePath = "/frames-hi/ezgif-frame-",
  className = "",
  scrollHeight = "430vh",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
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

    const concurrency = reducedMotion ? 1 : mobile ? 5 : 10;
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
            // Some browsers complete decode during onload; drawing is still safe.
          }
          if (!cancelled) frames.set(index, img);
          completed += 1;
          if (!cancelled) setLoaded(completed);
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
        const index = frameIndices[cursor++];
        if (!index) return;
        await loadOne(index);
      }
    };

    const load = async () => {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, frameIndices.length) }, worker),
      );
      if (!cancelled) setReady(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [frameCount, framePath, frameIndices, mobile, reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!canvas || !section || !stage || !ready) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

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

    const resizeCanvas = () => {
      const cssWidth = Math.max(1, canvas.clientWidth);
      const cssHeight = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const backingWidth = Math.round(cssWidth * dpr);
      const backingHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      return { cssWidth, cssHeight, dpr };
    };

    const draw = (requestedIndex: number) => {
      const frame = findNearestLoaded(requestedIndex);
      if (!frame) return;
      const { cssWidth, cssHeight, dpr } = resizeCanvas();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#07090d";
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      const imageAspect = frame.naturalWidth / frame.naturalHeight;
      const viewportAspect = cssWidth / cssHeight;
      let drawWidth = cssWidth;
      let drawHeight = cssWidth / imageAspect;
      if (viewportAspect < imageAspect) {
        drawHeight = cssHeight;
        drawWidth = cssHeight * imageAspect;
      }

      const x = (cssWidth - drawWidth) / 2;
      const y = (cssHeight - drawHeight) / 2;
      ctx.drawImage(frame, x, y, drawWidth, drawHeight);
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
      targetFrameRef.current = Math.min(
        frameCount,
        Math.max(1, Math.round(progress * (frameCount - 1)) + 1),
      );
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
      const ease = 1 - Math.pow(0.0006, delta / 16.67);
      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;

      const seconds = time / 1000;
      const idleX = Math.sin(seconds * 0.72) * 0.9;
      const idleY = Math.sin(seconds * 0.54 + 0.9) * 4.5;
      const idleRotate = Math.sin(seconds * 0.62) * 0.35;
      const tiltY = current.x * 4.8 + idleX;
      const tiltX = current.y * -3.4;
      const scale = 1.018 + Math.sin(seconds * 0.78) * 0.004;

      stage.style.transform = `translate3d(${current.x * 10}px, ${idleY + current.y * 5}px, 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotateZ(${idleRotate}deg) scale(${scale})`;
      stage.style.setProperty("--cursor-x", `${50 + current.x * 22}%`);
      stage.style.setProperty("--cursor-y", `${50 + current.y * 18}%`);
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

        <div className="absolute inset-0" aria-hidden="true">
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

        <div className="hero-sequence-halo absolute left-1/2 top-1/2" aria-hidden="true" />

        <div
          ref={stageRef}
          className="hero-sequence-stage absolute inset-[-2.5%]"
          aria-hidden="true"
        >
          <canvas ref={canvasRef} className="hero-sequence-canvas block h-full w-full" />
          <div className="hero-sequence-light" />
        </div>

        {!ready && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#07090d]">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full border border-violet-200/20 border-t-violet-200/80 animate-spin" />
              <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-white/45">
                Preparing your character
              </p>
              <p className="mt-2 text-[11px] text-white/25">{Math.round(progress * 100)}% ready</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-48 bg-gradient-to-t from-[#08090c] to-transparent" />
      </div>
    </section>
  );
}

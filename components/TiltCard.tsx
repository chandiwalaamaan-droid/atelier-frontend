"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

// Pure CSS/JS tilt-on-hover: rotates the card toward the cursor in 3D and
// slides a light "glare" gradient across it, so the flat character cards
// pick up the same glossy, faceted feel as the gem in the hero scene —
// without pulling them into the WebGL scene itself.
//
// Motion notes: the live tilt-follow (while the cursor is moving) has no
// transition — it should track the pointer immediately, with zero lag.
// Only the *reset* on mouse leave gets an eased transition, using the same
// expo-out curve as the rest of the page. Pressing the card scales it down
// slightly for tactile feedback, distinct from the hover lift.
export default function TiltCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    const glare = glareRef.current;
    if (!el || !glare) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 14;
    const rotateX = (0.5 - py) * 14;
    const scale = pressed.current ? 1.0 : 1.04;
    el.style.transition = "none";
    el.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scale}, ${scale}, ${scale})`;
    el.style.boxShadow = "0 20px 45px rgba(0,0,0,0.35), 0 0 30px rgba(201,162,39,0.1)";
    glare.style.opacity = "1";
    glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.18), transparent 55%)`;
  };

  const handleMouseDown = () => {
    pressed.current = true;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform var(--duration-fast) var(--ease-out)";
    el.style.transform = "perspective(700px) scale3d(0.98, 0.98, 0.98)";
  };

  const handleMouseUp = () => {
    pressed.current = false;
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform var(--duration-fast) var(--ease-out)";
  };

  const handleMouseLeave = () => {
    pressed.current = false;
    const el = ref.current;
    const glare = glareRef.current;
    if (!el || !glare) return;
    el.style.transition = "transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)";
    el.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    el.style.boxShadow = "none";
    glare.style.opacity = "0";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ transformStyle: "preserve-3d", ...style }}
    >
      {children}
      <div
        ref={glareRef}
        className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-300"
        style={{ opacity: 0 }}
        aria-hidden
      />
    </div>
  );
}

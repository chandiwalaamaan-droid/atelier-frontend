"use client";

import { useRef } from "react";
import type { ReactNode } from "react";

// Pure CSS/JS tilt-on-hover: rotates the card toward the cursor in 3D and
// slides a light "glare" gradient across it, so the flat character cards
// pick up the same glossy, faceted feel as the gem in the hero scene —
// without pulling them into the WebGL scene itself.
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    const glare = glareRef.current;
    if (!el || !glare) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 14;
    const rotateX = (0.5 - py) * 14;
    el.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.04, 1.04, 1.04)`;
    glare.style.opacity = "1";
    glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.18), transparent 55%)`;
  };

  const handleMouseLeave = () => {
    const el = ref.current;
    const glare = glareRef.current;
    if (!el || !glare) return;
    el.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    glare.style.opacity = "0";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ transition: "transform 0.35s ease-out", transformStyle: "preserve-3d", ...style }}
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

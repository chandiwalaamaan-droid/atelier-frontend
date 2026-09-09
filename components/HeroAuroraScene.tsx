"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Three overlapping wavy ribbons in the app's gold / rose / violet palette.
// Vertices are displaced each frame with layered sine waves to read as
// slow-rolling aurora, echoing the CSS aurora-bg blobs already used
// elsewhere on the marketing pages, just rendered in actual 3D.
function AuroraLayer({
  color,
  yOffset,
  speed,
  amplitude,
  opacity,
  reduceMotion,
}: {
  color: string;
  yOffset: number;
  speed: number;
  amplitude: number;
  opacity: number;
  reduceMotion: boolean;
}) {
  const geometry = useMemo(() => new THREE.PlaneGeometry(16, 7, 48, 24), []);
  const basePositions = useMemo(
    () => (geometry.attributes.position as THREE.BufferAttribute).array.slice(),
    [geometry]
  );

  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.getElapsedTime() * speed;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = basePositions[i * 3];
      const y = basePositions[i * 3 + 1];
      const z =
        Math.sin(x * 0.45 + t) * amplitude +
        Math.cos(y * 0.35 - t * 0.7) * amplitude * 0.5;
      pos.setZ(i, z);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  });

  return (
    <mesh geometry={geometry} position={[0, yOffset, 0]} rotation={[-Math.PI / 2.5, 0, 0]}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Tilts the camera toward the cursor. Tracks the pointer via a window
// listener rather than the canvas's own pointer events, so the canvas can
// stay pointer-events: none and never intercept clicks on the real UI
// (buttons, links) stacked above it.
function CameraRig({ reduceMotion }: { reduceMotion: boolean }) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  useFrame(({ camera }) => {
    if (reduceMotion) return;
    const target = pointer.current;
    camera.position.x += (target.x * 1.4 - camera.position.x) * 0.04;
    camera.position.y += (2.2 + target.y * 0.5 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

export default function HeroAuroraScene() {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <Canvas
      camera={{ position: [0, 2.2, 8], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <CameraRig reduceMotion={!!reduceMotion} />
      <AuroraLayer color="#c9a227" yOffset={-1.1} speed={0.35} amplitude={0.9} opacity={0.16} reduceMotion={!!reduceMotion} />
      <AuroraLayer color="#b5657a" yOffset={-1.4} speed={0.5} amplitude={0.7} opacity={0.13} reduceMotion={!!reduceMotion} />
      <AuroraLayer color="#8b5cf6" yOffset={-1.7} speed={0.28} amplitude={1.1} opacity={0.1} reduceMotion={!!reduceMotion} />
    </Canvas>
  );
}

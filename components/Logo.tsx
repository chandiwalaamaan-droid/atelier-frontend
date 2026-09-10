export default function Logo({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    // Wrapped in .logo-wrap for a lively entrance animation (pop + settle) on
    // mount, plus a subtle continuous "breathing" wobble and glow pulse behind
    // it, so the logo doesn't sit dead-static. Respects prefers-reduced-motion
    // globally (see globals.css).
    <span className={`logo-wrap ${className}`}>
      {/* Plain <img>, not next/image: a fixed-size logo doesn't need responsive
      optimization, and routing it through Next's image pipeline on Netlify
      (which needs their image-optimization function working correctly)
      was showing up as a broken image icon. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="Rolichat"
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </span>
  );
}

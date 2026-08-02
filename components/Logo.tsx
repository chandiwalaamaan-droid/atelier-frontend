export default function Logo({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5d76e" />
          <stop offset="0.5" stopColor="#c9a227" />
          <stop offset="1" stopColor="#8a6d1a" />
        </linearGradient>
        <linearGradient id="logo-rose" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b5657a" />
          <stop offset="1" stopColor="#8a3d54" />
        </linearGradient>
        <radialGradient id="logo-glow" cx="24" cy="24" r="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c9a227" stopOpacity="0.3" />
          <stop offset="1" stopColor="#c9a227" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Glow background */}
      <circle cx="24" cy="24" r="22" fill="url(#logo-glow)" />

      {/* Outer ring - represents the "atelier" frame */}
      <circle cx="24" cy="24" r="20" stroke="url(#logo-gold)" strokeWidth="1.5" fill="none" opacity="0.4" />

      {/* Main mark - stylized "A" formed by two brush strokes meeting at apex */}
      {/* Left stroke */}
      <path
        d="M14 36 L24 12"
        stroke="url(#logo-gold)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right stroke */}
      <path
        d="M34 36 L24 12"
        stroke="url(#logo-rose)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* Crossbar */}
      <path
        d="M17 28 L31 28"
        stroke="url(#logo-gold)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* Sparkle dot at apex */}
      <circle cx="24" cy="12" r="2.5" fill="#f5d76e" />
      <circle cx="24" cy="12" r="4" fill="#f5d76e" opacity="0.3" />

      {/* Small accent dots */}
      <circle cx="14" cy="36" r="1.5" fill="#c9a227" opacity="0.6" />
      <circle cx="34" cy="36" r="1.5" fill="#b5657a" opacity="0.6" />
    </svg>
  );
}
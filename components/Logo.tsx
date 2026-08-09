export default function Logo({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    // Plain <img>, not next/image: a fixed-size logo doesn't need responsive
    // optimization, and routing it through Next's image pipeline on Netlify
    // (which needs their image-optimization function working correctly)
    // was showing up as a broken image icon.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Rolichat"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}

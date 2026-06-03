export function AIOrbIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer glow rings */}
      <circle cx="60" cy="60" r="55" stroke="rgba(43,123,255,0.08)" strokeWidth="1" />
      <circle cx="60" cy="60" r="46" stroke="rgba(43,123,255,0.12)" strokeWidth="1" />
      <circle cx="60" cy="60" r="37" stroke="rgba(43,123,255,0.18)" strokeWidth="1" />

      {/* Core sphere gradient */}
      <defs>
        <radialGradient id="orb-core" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="rgba(120,170,255,0.9)" />
          <stop offset="45%" stopColor="rgba(43,123,255,0.8)" />
          <stop offset="100%" stopColor="rgba(6,25,70,0.95)" />
        </radialGradient>
        <radialGradient id="orb-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(43,123,255,0.35)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Ambient glow */}
      <circle cx="60" cy="60" r="36" fill="url(#orb-glow)" />

      {/* Main sphere */}
      <circle cx="60" cy="60" r="28" fill="url(#orb-core)" />

      {/* Highlight */}
      <ellipse cx="52" cy="50" rx="9" ry="6" fill="rgba(255,255,255,0.22)" transform="rotate(-25 52 50)" />

      {/* Network nodes */}
      <circle cx="60" cy="60" r="2.5" fill="rgba(255,255,255,0.9)" />

      {/* Orbiting dots */}
      <circle cx="60" cy="25" r="3" fill="rgba(100,160,255,0.8)" />
      <circle cx="95" cy="60" r="2.5" fill="rgba(100,160,255,0.7)" />
      <circle cx="60" cy="95" r="3" fill="rgba(100,160,255,0.8)" />
      <circle cx="25" cy="60" r="2.5" fill="rgba(100,160,255,0.7)" />

      {/* Diagonal nodes */}
      <circle cx="84" cy="36" r="2" fill="rgba(150,190,255,0.6)" />
      <circle cx="36" cy="84" r="2" fill="rgba(150,190,255,0.6)" />
      <circle cx="84" cy="84" r="2" fill="rgba(150,190,255,0.5)" />
      <circle cx="36" cy="36" r="2" fill="rgba(150,190,255,0.5)" />

      {/* Connection lines */}
      <line x1="60" y1="60" x2="60" y2="28" stroke="rgba(100,160,255,0.25)" strokeWidth="1" />
      <line x1="60" y1="60" x2="92" y2="60" stroke="rgba(100,160,255,0.25)" strokeWidth="1" />
      <line x1="60" y1="60" x2="60" y2="92" stroke="rgba(100,160,255,0.25)" strokeWidth="1" />
      <line x1="60" y1="60" x2="28" y2="60" stroke="rgba(100,160,255,0.25)" strokeWidth="1" />
      <line x1="60" y1="60" x2="82" y2="38" stroke="rgba(100,160,255,0.15)" strokeWidth="0.75" />
      <line x1="60" y1="60" x2="38" y2="82" stroke="rgba(100,160,255,0.15)" strokeWidth="0.75" />
      <line x1="60" y1="60" x2="82" y2="82" stroke="rgba(100,160,255,0.15)" strokeWidth="0.75" />
      <line x1="60" y1="60" x2="38" y2="38" stroke="rgba(100,160,255,0.15)" strokeWidth="0.75" />

      {/* Small sparkles */}
      <circle cx="74" cy="20" r="1.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="100" cy="42" r="1" fill="rgba(255,255,255,0.4)" />
      <circle cx="18" cy="78" r="1.5" fill="rgba(255,255,255,0.4)" />
    </svg>
  );
}

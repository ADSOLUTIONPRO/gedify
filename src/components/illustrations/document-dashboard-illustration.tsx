export function DocumentDashboardIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 260 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Glow radial */}
      <ellipse cx="130" cy="100" rx="120" ry="90" fill="rgba(43,107,255,0.12)" />

      {/* Main document - large sheet */}
      <rect x="60" y="20" width="90" height="120" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <rect x="68" y="34" width="50" height="3" rx="1.5" fill="rgba(255,255,255,0.6)" />
      <rect x="68" y="42" width="66" height="2" rx="1" fill="rgba(255,255,255,0.25)" />
      <rect x="68" y="48" width="56" height="2" rx="1" fill="rgba(255,255,255,0.25)" />
      <rect x="68" y="54" width="62" height="2" rx="1" fill="rgba(255,255,255,0.25)" />
      <rect x="68" y="62" width="40" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      <rect x="68" y="68" width="66" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      <rect x="68" y="74" width="50" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      {/* PDF badge on document */}
      <rect x="68" y="88" width="28" height="14" rx="4" fill="rgba(239,68,68,0.8)" />
      <text x="72" y="99" fontSize="8" fill="white" fontFamily="sans-serif" fontWeight="bold">PDF</text>
      {/* Folded corner */}
      <path d="M138 20 L150 20 L138 32 Z" fill="rgba(255,255,255,0.2)" />
      <path d="M138 20 L150 20 L138 32" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />

      {/* Secondary document (back-left) */}
      <rect x="40" y="35" width="80" height="105" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />

      {/* Third document (back-right) */}
      <rect x="80" y="28" width="80" height="108" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

      {/* Chart panel (right side) */}
      <rect x="162" y="30" width="72" height="90" rx="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {/* Bar chart */}
      <rect x="172" y="82" width="10" height="24" rx="3" fill="rgba(43,123,255,0.7)" />
      <rect x="186" y="68" width="10" height="38" rx="3" fill="rgba(43,123,255,0.9)" />
      <rect x="200" y="74" width="10" height="32" rx="3" fill="rgba(43,123,255,0.6)" />
      <rect x="214" y="58" width="10" height="48" rx="3" fill="rgba(255,255,255,0.7)" />
      {/* Chart title lines */}
      <rect x="172" y="40" width="34" height="3" rx="1.5" fill="rgba(255,255,255,0.6)" />
      <rect x="172" y="48" width="50" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      <rect x="172" y="54" width="40" height="2" rx="1" fill="rgba(255,255,255,0.2)" />

      {/* Pie chart (bottom right) */}
      <circle cx="210" cy="160" r="28" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <path d="M210 160 L210 132 A28 28 0 0 1 238 160 Z" fill="rgba(43,123,255,0.8)" />
      <path d="M210 160 L238 160 A28 28 0 0 1 196.6 185 Z" fill="rgba(255,255,255,0.5)" />
      <path d="M210 160 L196.6 185 A28 28 0 0 1 210 132 Z" fill="rgba(43,123,255,0.3)" />
      <circle cx="210" cy="160" r="14" fill="rgba(6,19,38,0.9)" />

      {/* Small floating metrics */}
      <rect x="40" y="155" width="60" height="32" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <rect x="48" y="163" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      <rect x="48" y="170" width="36" height="2" rx="1" fill="rgba(255,255,255,0.2)" />
      <rect x="78" y="163" width="12" height="8" rx="2" fill="rgba(43,123,255,0.7)" />

      {/* Sparkle dots */}
      <circle cx="155" cy="22" r="2.5" fill="rgba(255,255,255,0.6)" />
      <circle cx="165" cy="145" r="1.5" fill="rgba(255,255,255,0.4)" />
      <circle cx="50" cy="30" r="2" fill="rgba(255,255,255,0.4)" />
      <circle cx="240" cy="90" r="3" fill="rgba(255,255,255,0.3)" />
      <circle cx="30" cy="130" r="1.5" fill="rgba(255,255,255,0.3)" />

      {/* Connection lines */}
      <line x1="110" y1="100" x2="162" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}

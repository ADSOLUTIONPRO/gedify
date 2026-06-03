/**
 * Mini-courbe décorative (aire dégradée) pour les widgets statistiques,
 * fidèle à la maquette. Purement visuelle : ce n'est pas une série de données.
 */
export function Sparkline({ color, className = "" }: { color: string; className?: string }) {
  const gid = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 120 36"
      preserveAspectRatio="none"
      className={`h-9 w-full ${className}`}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,30 C14,26 22,12 36,16 C50,20 58,30 72,22 C86,14 96,6 120,12 L120,36 L0,36 Z"
        fill={`url(#${gid})`}
      />
      <path
        d="M0,30 C14,26 22,12 36,16 C50,20 58,30 72,22 C86,14 96,6 120,12"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

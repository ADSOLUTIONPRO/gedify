/**
 * Logo de marque Gedify, réutilisé dans toute l'application.
 *
 * Fichiers attendus dans `public/` (à déposer) :
 * - `/gedify-logo.png` : verrouillage complet (icône dossier + mot « Gedify »).
 * - `/gedify-icon.png` : icône seule (le dossier), pour les emplacements carrés
 *   (rail, en-tête mobile, favicon…).
 *
 * On utilise une balise `<img>` (et non `next/image`) : actif local léger, mis
 * en cache, dimensions inconnues à la compilation → on pilote la taille en CSS.
 */
type BrandLogoProps = {
  /** « full » = icône + mot ; « icon » = dossier seul. */
  variant?: "full" | "icon";
  className?: string;
  alt?: string;
};

export function BrandLogo({ variant = "full", className = "h-7 w-auto", alt = "Gedify" }: BrandLogoProps) {
  const src = variant === "icon" ? "/gedify-icon.png" : "/gedify-logo.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

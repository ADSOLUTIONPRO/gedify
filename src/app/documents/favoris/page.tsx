import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Route dédiée « Favoris » → réutilise la liste documentaire filtrée
    (?tab=favoris) : même grille/tableau/filtres/pagination, pas de page
    parallèle. */
export default function DocumentsFavorisPage() {
  redirect("/documents?tab=favoris");
}

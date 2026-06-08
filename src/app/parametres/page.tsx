import { redirect } from "next/navigation";

/* Ancienne page de réglages → page UNIQUE de paramètres.
   On évite deux interfaces concurrentes (cf. /administration/parametres). */
export default function ParametresRedirect() {
  redirect("/administration/parametres");
}

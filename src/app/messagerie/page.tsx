import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messagerie — Gedify" };

/** La page /messagerie redirige vers la boîte de réception. */
export default function MessageriePage() {
  redirect("/messagerie/inbox");
}

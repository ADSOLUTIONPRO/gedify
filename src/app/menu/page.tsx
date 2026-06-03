import type { Metadata } from "next";
import Link from "next/link";
import { MobileMenu } from "@/components/mobile/mobile-menu";
import { readSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menu — GED AzServer" };

/**
 * Page Menu : dédiée à la navigation « app mobile » (< md). Sur bureau (≥ md),
 * la navigation passe par la double sidebar → simple renvoi vers l'accueil.
 */
export default async function MenuPage() {
  const session = await readSession().catch(() => null);

  return (
    <>
      <MobileMenu username={session?.username ?? null} />

      {/* Bureau (≥ md) : cette page n'a pas d'usage → renvoi accueil */}
      <div className="hidden items-center justify-center px-6 py-24 text-center md:flex">
        <div>
          <p className="text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>Menu mobile</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            Cette page est dédiée à la navigation sur smartphone. Sur ordinateur, utilisez la barre latérale.
          </p>
          <Link href="/" className="mt-4 inline-flex h-10 items-center rounded-[20px] px-5 text-[13px] font-bold text-white" style={{ background: "var(--accent)" }}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </>
  );
}

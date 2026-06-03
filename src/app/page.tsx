import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { MobileHome } from "@/components/mobile/mobile-home";
import { getDashboardData } from "@/lib/spaces/dashboard-data";
import { readSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tableau de bord — Gedify",
  description: "Synthèse personnalisable de vos espaces Gedify.",
};

function displayName(username: string | null): string {
  if (!username) return "👋";
  const base = username.includes("@") ? username.split("@")[0] : username;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export default async function Home() {
  const [data, session] = await Promise.all([getDashboardData(), readSession()]);

  return (
    <>
      {/* Bureau (≥ md) : tableau de bord complet */}
      <div className="hidden px-6 py-7 md:block lg:px-9 lg:py-9 2xl:px-12">
        <DashboardGrid data={data} userName={displayName(session?.username ?? null)} />
      </div>
      {/* Mobile (< md) : accueil « app » */}
      <MobileHome data={data} />
    </>
  );
}

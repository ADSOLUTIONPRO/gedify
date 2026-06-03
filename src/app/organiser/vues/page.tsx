import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { SavedViewsManager, type SavedViewVM } from "@/components/organiser/saved-views-manager";
import { safePaperlessCollection } from "@/lib/paperless-resources";
import { getPaperlessPublicUrl } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vues sauvegardées — Organiser" };

export default async function OrganiserVuesPage() {
  const result = await safePaperlessCollection("/api/saved_views/");
  const rows = result.ok ? result.data.results : [];
  const views: SavedViewVM[] = rows.map((v, index) => ({
    id: String(v.id ?? v.name ?? `view-${index}`),
    name: (typeof v.name === "string" && v.name) || (typeof v.title === "string" && v.title) || `Vue #${v.id}`,
    onDashboard: Boolean(v.show_on_dashboard),
    inSidebar: Boolean(v.show_in_sidebar),
    sortField: typeof v.sort_field === "string" ? v.sort_field : null,
    href: `/vues/${v.id}`,
  }));

  return (
    <SpaceLayout spaceId="documents">
      <SavedViewsManager views={views} paperlessUrl={getPaperlessPublicUrl()} />
    </SpaceLayout>
  );
}

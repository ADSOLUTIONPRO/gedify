import type { Metadata } from "next";
import { ErrorState } from "@/components/ui/error-state";
import { SpaceLayout } from "@/components/layout/space-layout";
import { OrganiserOverview, type CleanupHint } from "@/components/organiser/organiser-overview";
import type { ReferentialEntry } from "@/components/organiser/organiser-search";
import type { OrganisationActivityItem } from "@/components/organiser/recent-organisation-activity";
import { buildCleanupGroups } from "@/lib/organiser/cleanup";
import { listProjectFolders } from "@/lib/projects/project-store";
import { formatDate } from "@/lib/format";
import { getCorrespondents, getDocumentTypes, getPaperlessStatus, getTags } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Organiser — Gedify" };

export default async function OrganiserPage() {
  try {
    const [typesData, tagsData, correspondentsData, projects, status] = await Promise.all([
      getDocumentTypes(),
      getTags(),
      getCorrespondents(),
      listProjectFolders(),
      getPaperlessStatus().catch(() => null),
    ]);

    const types = typesData.results ?? [];
    const tags = tagsData.results ?? [];
    const correspondents = correspondentsData.results ?? [];
    const inboxCount = status?.statistics?.documents_inbox ?? 0;

    const groups = buildCleanupGroups({ tags, types, correspondents, projects, inboxCount });
    const cleanup: CleanupHint[] = groups.slice(0, 5).map((g) => ({ label: g.title, count: g.count, href: g.href }));

    const activity: OrganisationActivityItem[] = projects.slice(0, 5).map((p) => ({
      label: "Dossier mis à jour",
      detail: p.name,
      when: formatDate(p.updatedAt),
      href: `/dossiers/${p.id}`,
    }));

    const entries: ReferentialEntry[] = [
      ...types.map((t) => ({ label: t.name, kind: "Type", href: `/documents?document_type=${t.id}`, color: "#0B5CFF" })),
      ...tags.map((t) => ({ label: t.name, kind: "Tag", href: `/documents?tag=${t.id}`, color: t.color || "#7C3AED" })),
      ...correspondents.map((c) => ({ label: c.name, kind: "Correspondant", href: `/documents?correspondent=${c.id}`, color: "#16A34A" })),
      ...projects.map((p) => ({ label: p.name, kind: "Dossier", href: `/dossiers/${p.id}`, color: "#F97316" })),
    ];

    return (
      <SpaceLayout spaceId="organiser">
        <OrganiserOverview
          counts={{ types: typesData.count, tags: tagsData.count, correspondents: correspondentsData.count, projects: projects.length }}
          cleanup={cleanup}
          activity={activity}
          entries={entries}
        />
      </SpaceLayout>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="organiser">
        <ErrorState message={error instanceof Error ? error.message : "Erreur pendant le chargement des référentiels."} />
      </SpaceLayout>
    );
  }
}

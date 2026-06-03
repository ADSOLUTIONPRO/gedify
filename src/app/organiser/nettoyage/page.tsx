import type { Metadata } from "next";
import { ErrorState } from "@/components/ui/error-state";
import { SpaceLayout } from "@/components/layout/space-layout";
import { CleanupSuggestions } from "@/components/organiser/cleanup-suggestions";
import { buildCleanupGroups } from "@/lib/organiser/cleanup";
import { listProjectFolders } from "@/lib/projects/project-store";
import { getCorrespondents, getDocumentTypes, getPaperlessStatus, getTags } from "@/lib/paperless";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Nettoyage — Organiser" };

export default async function OrganiserNettoyagePage() {
  try {
    const [typesData, tagsData, correspondentsData, projects, status] = await Promise.all([
      getDocumentTypes(),
      getTags(),
      getCorrespondents(),
      listProjectFolders(),
      getPaperlessStatus().catch(() => null),
    ]);

    const groups = buildCleanupGroups({
      tags: tagsData.results ?? [],
      types: typesData.results ?? [],
      correspondents: correspondentsData.results ?? [],
      projects,
      inboxCount: status?.statistics?.documents_inbox ?? 0,
    });

    return (
      <SpaceLayout spaceId="organiser">
        <CleanupSuggestions groups={groups} />
      </SpaceLayout>
    );
  } catch (error) {
    return (
      <SpaceLayout spaceId="organiser">
        <ErrorState message={error instanceof Error ? error.message : "Erreur pendant l'analyse de nettoyage."} />
      </SpaceLayout>
    );
  }
}

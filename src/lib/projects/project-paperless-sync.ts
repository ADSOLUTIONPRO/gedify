import "server-only";

import { getDocument, getTags, paperlessFetch, updateDocument } from "@/lib/paperless";
import type { PaperlessTag } from "@/lib/paperless-types";
import type { ProjectFolder } from "@/lib/projects/project-types";
import { updateProject } from "@/lib/projects/project-store";

function getProjectTagName(project: Pick<ProjectFolder, "name" | "paperlessTagName">) {
  return project.paperlessTagName || `Dossier - ${project.name}`;
}

export async function ensureProjectPaperlessTag(project: ProjectFolder) {
  if (project.paperlessTagId) {
    return project;
  }

  const tagName = getProjectTagName(project);
  const tags = await getTags({ page_size: 1000 });
  const existing = tags.results.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
  const tag =
    existing ??
    (await paperlessFetch<PaperlessTag>("/api/tags/", {
      method: "POST",
      body: {
        name: tagName,
        color: project.color,
      },
    }));

  return updateProject(project.id, {
    syncWithPaperlessTag: true,
    paperlessTagId: tag.id,
    paperlessTagName: tag.name,
  });
}

export async function applyProjectPaperlessTag(project: ProjectFolder, documentIds: number[]) {
  const syncedProject = project.paperlessTagId ? project : await ensureProjectPaperlessTag(project);

  if (!syncedProject?.paperlessTagId) {
    return syncedProject;
  }

  const tagId = syncedProject.paperlessTagId;

  await Promise.allSettled(
    documentIds.map(async (documentId) => {
      const document = await getDocument(documentId);
      const tags = Array.from(new Set([...(document.tags ?? []), tagId]));
      await updateDocument(documentId, { tags });
    })
  );

  return syncedProject;
}

export async function removeProjectPaperlessTag(project: ProjectFolder, documentIds: number[]) {
  if (!project.paperlessTagId) {
    return;
  }

  await Promise.allSettled(
    documentIds.map(async (documentId) => {
      const document = await getDocument(documentId);
      const tags = (document.tags ?? []).filter((tagId) => tagId !== project.paperlessTagId);
      await updateDocument(documentId, { tags });
    })
  );
}

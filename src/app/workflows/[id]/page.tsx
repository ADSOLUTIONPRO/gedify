import { ResourceDetailView } from "@/components/paperless/resource-detail-view";
import { ResourceListView } from "@/components/paperless/resource-list-view";
import { safePaperlessCollection, safePaperlessObject } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkflowDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [workflow, actions, triggers] = await Promise.all([
    safePaperlessObject(`/api/workflows/${id}/`),
    safePaperlessCollection("/api/workflow_actions/", { workflow: id }),
    safePaperlessCollection("/api/workflow_triggers/", { workflow: id }),
  ]);

  return (
    <>
      <ResourceDetailView
        eyebrow="Workflow"
        titleFallback={`Workflow #${id}`}
        description="Détail du workflow Gedify."
        result={workflow}
        originalPath={`/workflows/${id}`}
      />
      <div className="px-4 pb-8 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-2">
          <ResourceListView
            eyebrow="Automatisation"
            title="Actions du workflow"
            description="Actions Gedify liées au workflow."
            result={actions}
            originalPath="/workflows"
            fields={[
              { key: "type", label: "Type" },
              { key: "assign_title", label: "Titre" },
              { key: "assign_tags", label: "Tags" },
            ]}
          />
          <ResourceListView
            eyebrow="Automatisation"
            title="Déclencheurs du workflow"
            description="Déclencheurs Gedify liés au workflow."
            result={triggers}
            originalPath="/workflows"
            fields={[
              { key: "type", label: "Type" },
              { key: "sources", label: "Sources" },
              { key: "filter_path", label: "Filtre" },
            ]}
          />
        </div>
      </div>
    </>
  );
}

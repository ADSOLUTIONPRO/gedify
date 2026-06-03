import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { RulesBuilder, type ExistingRule } from "@/components/organiser/rules-builder";
import { safePaperlessCollection } from "@/lib/paperless-resources";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Règles — Organiser" };

export default async function OrganiserReglesPage() {
  const result = await safePaperlessCollection("/api/workflows/");
  const rows = result.ok ? result.data.results : [];
  const existing: ExistingRule[] = rows.map((w, index) => ({
    id: String(w.id ?? w.name ?? `rule-${index}`),
    name: (typeof w.name === "string" && w.name) || `Workflow #${w.id}`,
    href: `/workflows/${w.id}`,
    enabled: w.enabled !== false,
  }));

  return (
    <SpaceLayout spaceId="organiser">
      <RulesBuilder existing={existing} workflowsHref="/workflows" />
    </SpaceLayout>
  );
}

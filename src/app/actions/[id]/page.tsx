import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ActionDetailPanel } from "@/components/actions/action-detail-panel";
import { getAction } from "@/lib/actions/action-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Action — Actions" };

type Ctx = { params: Promise<{ id: string }> };

export default async function ActionDetailPage({ params }: Ctx) {
  const { id } = await params;
  const action = await getAction(id);
  if (!action) notFound();
  return (
    <SpaceLayout spaceId="actions">
      <ActionDetailPanel action={action} />
    </SpaceLayout>
  );
}

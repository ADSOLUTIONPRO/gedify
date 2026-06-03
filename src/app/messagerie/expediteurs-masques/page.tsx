import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { HiddenSendersClient } from "@/components/messaging/hidden-senders-client";
import { listHiddenSenders } from "@/lib/messaging/hidden-senders-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expéditeurs masqués — Messagerie" };

export default async function HiddenSendersPage() {
  const senders = await listHiddenSenders();
  return (
    <SpaceLayout spaceId="messagerie">
      <HiddenSendersClient initialSenders={senders} />
    </SpaceLayout>
  );
}

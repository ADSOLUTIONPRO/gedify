import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

type CompactPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  backLink?: { href: string; label: string };
};

export function CompactPageHeader({
  title,
  description,
  eyebrow,
  actions,
  backLink,
}: CompactPageHeaderProps) {
  return (
    <PageHeader
      compact
      title={title}
      description={description}
      eyebrow={eyebrow}
      actions={actions}
      backLink={backLink}
    />
  );
}

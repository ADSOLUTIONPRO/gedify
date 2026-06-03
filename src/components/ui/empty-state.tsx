import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
};

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "rgba(11,92,255,0.08)",
          color: "var(--blue-600)",
        }}
      >
        <Icon className="h-7 w-7" strokeWidth={1.5} />
      </div>
      <p className="text-base font-extrabold" style={{ color: "var(--text-main)" }}>
        {title}
      </p>
      {description ? (
        <p
          className="mt-1.5 max-w-md text-sm leading-6"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

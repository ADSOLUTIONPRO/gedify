import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type FormCardProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FormCard({
  title,
  description,
  icon: Icon,
  footer,
  children,
  className = "",
}: FormCardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.10)] backdrop-blur ${className}`}
    >
      <div className="flex items-start gap-3 border-b border-slate-100 p-5">
        {Icon ? (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100"
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-5 py-3">{footer}</div> : null}
    </section>
  );
}

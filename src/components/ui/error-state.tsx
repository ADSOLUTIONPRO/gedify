import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  message: string;
  action?: ReactNode;
};

export function ErrorState({
  title = "Une erreur est survenue",
  message,
  action,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-200/60 bg-rose-50/60 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600"
        >
          <AlertCircle className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-rose-900">{title}</p>
          <p className="mt-1 break-words text-sm leading-6 text-rose-700">{message}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

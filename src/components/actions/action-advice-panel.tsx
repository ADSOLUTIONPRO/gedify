import Link from "next/link";
import { Info, Lightbulb, PenLine, Bell } from "lucide-react";

export type ActionAdvice = {
  id: string;
  severity: "danger" | "warning" | "info";
  title: string;
  detail: string;
};

const COLOR: Record<ActionAdvice["severity"], string> = {
  danger: "#EF4444",
  warning: "#F59E0B",
  info: "#7C3AED",
};

/** Conseils IA pour prioriser (indicatifs). Aucune exécution automatique. */
export function ActionAdvicePanel({ tips }: { tips: ActionAdvice[] }) {
  return (
    <section className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        <Lightbulb className="h-3.5 w-3.5" style={{ color: "#7C3AED" }} strokeWidth={1.75} aria-hidden="true" />
        Conseils IA
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
        <Info className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Conseils indicatifs, à vérifier selon votre situation.
      </p>
      {tips.length === 0 ? (
        <p className="mt-3 text-[13px]" style={{ color: "var(--text-muted)" }}>Rien de prioritaire pour le moment.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tips.map((t) => (
            <li key={t.id} className="rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-[13px] font-bold" style={{ color: COLOR[t.severity] }}>{t.title}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>{t.detail}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link href="/redaction/nouveau" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <PenLine className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Générer un courrier
                </Link>
                <Link href="/rappels" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <Bell className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Créer un rappel
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

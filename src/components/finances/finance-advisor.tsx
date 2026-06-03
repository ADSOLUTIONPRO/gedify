import Link from "next/link";
import { AlertTriangle, Info, PenLine, Phone, Zap } from "lucide-react";

export type AdvisorTip = {
  id: string;
  severity: "danger" | "warning" | "info";
  title: string;
  detail: string;
};

type FinanceAdvisorProps = {
  tips: AdvisorTip[];
};

const SEVERITY: Record<AdvisorTip["severity"], { color: string }> = {
  danger: { color: "#EF4444" },
  warning: { color: "#F59E0B" },
  info: { color: "#0B5CFF" },
};

/**
 * Conseiller IA indicatif : priorités déduites des dettes en retard et
 * échéances proches. Toujours « à vérifier selon votre situation ».
 */
export function FinanceAdvisor({ tips }: FinanceAdvisorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "rgba(124,58,237,0.05)" }}>
        <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--violet)" }} strokeWidth={1.75} aria-hidden="true" />
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Conseils indicatifs, à vérifier selon votre situation. Aucune action n&apos;est exécutée automatiquement.
        </p>
      </div>

      {tips.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-12 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Rien d&apos;urgent</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Pas de dette en retard ni d&apos;échéance critique détectée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tips.map((t) => {
            const s = SEVERITY[t.severity];
            return (
              <div key={t.id} className="rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
                <p className="flex items-center gap-2 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                  <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: s.color }} strokeWidth={1.75} aria-hidden="true" />
                  {t.title}
                </p>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>{t.detail}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Link href="/redaction/nouveau" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    <PenLine className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Générer courrier
                  </Link>
                  <Link href="/actions" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    <Zap className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Créer action
                  </Link>
                  <Link href="/rappels" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                    <Phone className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> Créer rappel
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

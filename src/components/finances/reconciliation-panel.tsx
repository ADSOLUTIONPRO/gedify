import { Link2 } from "lucide-react";

/**
 * Lettrage (réconciliation) — première version informative. Le lettrage relie
 * une ligne financière à un document GED/Gedify, une info IA, un paiement
 * manuel (et, à terme, une transaction bancaire). Les suggestions automatiques
 * (même montant / même correspondant / date proche) arriveront avec le
 * connecteur bancaire.
 */
export function ReconciliationPanel() {
  return (
    <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "rgba(11,92,255,0.04)" }}>
      <Link2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#0B5CFF" }} strokeWidth={1.75} aria-hidden="true" />
      <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        <strong style={{ color: "var(--text-main)" }}>Lettrage</strong> : chaque ligne peut être reliée à son
        document source (visible dans le détail). Le rapprochement automatique avec les transactions bancaires
        sera disponible avec le connecteur bancaire.
      </p>
    </div>
  );
}

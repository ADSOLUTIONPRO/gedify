import { Loader2 } from "lucide-react";
import type { DocumentStatusesVM } from "@/components/documents/types";

/**
 * Rangée compacte de badges d'état (OCR / IA xx % / Budget / Classé / À vérifier)
 * affichée sur chaque vignette de document. Couleurs alignées sur §8-9 :
 * vert ≥ 85 %, ambre 70–84 %, rouge < 70 %, gris si non analysé.
 */

type Tone = "green" | "amber" | "red" | "slate" | "accent" | "blue" | "violet";

const TONE_STYLE: Record<Tone, { bg: string; color: string }> = {
  green: { bg: "#EAF8EF", color: "#15803D" },
  amber: { bg: "#FFF4E5", color: "#B45309" },
  red: { bg: "#FEECEC", color: "#DC2626" },
  slate: { bg: "#F1F5F9", color: "#64748B" },
  accent: { bg: "var(--accent-soft)", color: "var(--accent)" },
  blue: { bg: "#E7F0FF", color: "#2563EB" },
  violet: { bg: "#F3EEFF", color: "#7C3AED" },
};

function Pill({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  const s = TONE_STYLE[tone];
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

function confidenceTone(pct: number): Tone {
  if (pct >= 85) return "green";
  if (pct >= 70) return "amber";
  return "red";
}

export function DocumentStatusBadges({
  statuses,
  busy = false,
  className,
}: {
  statuses: DocumentStatusesVM;
  /** Une analyse IA est en cours pour ce document (état temps réel). */
  busy?: boolean;
  className?: string;
}) {
  const { ocr, ai, confidencePct, budget, classified, learned, matchedLabel } = statuses;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {/* OCR */}
      {ocr === "done" ? (
        <Pill tone="green" title="OCR terminé">OCR ✓</Pill>
      ) : ocr === "low" ? (
        <Pill tone="amber" title="OCR faible — texte court">OCR faible</Pill>
      ) : (
        <Pill tone="slate" title="OCR en attente">OCR…</Pill>
      )}

      {/* IA */}
      {busy ? (
        <Pill tone="blue" title="Analyse IA en cours">
          <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" /> IA…
        </Pill>
      ) : ai === "error" ? (
        <Pill tone="red" title="Erreur d'analyse IA">IA erreur</Pill>
      ) : ai === "none" ? (
        <Pill tone="slate" title="Document non analysé">IA —</Pill>
      ) : confidencePct != null ? (
        <Pill tone={confidenceTone(confidencePct)} title={`Confiance IA ${confidencePct} %`}>IA {confidencePct} %</Pill>
      ) : (
        <Pill tone="green" title="Analyse IA terminée">IA ✓</Pill>
      )}

      {/* Modèle appris / similaire */}
      {!busy && learned === "template" ? <Pill tone="blue" title={matchedLabel ? `Classé via le modèle appris « ${matchedLabel} »` : "Classé via un modèle appris"}>Modèle appris</Pill> : null}
      {!busy && learned === "similar" ? <Pill tone="violet" title={matchedLabel ? `Similaire à « ${matchedLabel} »` : "Document similaire reconnu"}>Similaire{matchedLabel ? ` : ${matchedLabel.length > 22 ? matchedLabel.slice(0, 22) + "…" : matchedLabel}` : ""}</Pill> : null}

      {/* À vérifier */}
      {!busy && ai === "review" ? <Pill tone="amber" title="Suggestions IA à valider">À vérifier</Pill> : null}

      {/* Classé */}
      {!busy && classified ? <Pill tone="green" title="Classé automatiquement">Classé</Pill> : null}

      {/* Budget */}
      {budget === "created" ? (
        <Pill tone="accent" title="Entrée budget créée">Budget ✓</Pill>
      ) : budget === "review" ? (
        <Pill tone="amber" title="Budget à vérifier">Budget ?</Pill>
      ) : null}
    </div>
  );
}

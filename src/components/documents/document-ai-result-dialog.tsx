"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileSearch, Loader2, Pencil, ShieldCheck, X } from "lucide-react";
import { formatDetectedDate } from "@/lib/format";
import type { AiActionResult } from "@/lib/documents/document-ai";

/** Étapes affichées dans la phase de progression. */
const STEPS = [
  "Récupération du document",
  "Lecture OCR",
  "Évaluation qualité OCR",
  "Analyse OpenAI",
  "Extraction JSON",
  "Validation du JSON",
  "Mise à jour correspondant",
  "Mise à jour type",
  "Ajout des tags",
  "Classement dossier/projet",
  "Création budget",
  "Création rappel",
  "Enregistrement historique",
  "Terminé",
];

function confidencePct(c?: string): number | null {
  if (c === "high") return 90;
  if (c === "medium") return 60;
  if (c === "low") return 30;
  return null;
}
function euros(n?: number | null, currency = "EUR"): string | null {
  if (n == null) return null;
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(n); } catch { return `${n} ${currency}`; }
}

type Props = {
  open: boolean;
  loading: boolean;
  docId: number;
  result: AiActionResult | null;
  onClose: () => void;
  onOpenSheet: () => void;
};

/**
 * Popup d'analyse IA : phase **progression** (étapes animées) pendant l'appel,
 * puis **résultat** détaillé (ou diagnostic si rien de fiable n'est détecté).
 */
export function DocumentAiResultDialog({ open, loading, docId, result, onClose, onOpenSheet }: Props) {
  const [step, setStep] = useState(0);
  const [validating, setValidating] = useState(false);
  const [validateMsg, setValidateMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation de progression tant que l'analyse tourne (étapes 1→6).
  // setState différé (timers) → évite le warning « setState dans un effet ».
  useEffect(() => {
    if (!open) return;
    if (loading) {
      const reset = setTimeout(() => setStep(0), 0);
      let s = 0;
      timer.current = setInterval(() => { s = Math.min(s + 1, 5); setStep(s); }, 650);
      return () => { clearTimeout(reset); if (timer.current) clearInterval(timer.current); };
    }
    const done = setTimeout(() => setStep(STEPS.length), 0);
    return () => clearTimeout(done);
  }, [open, loading]);

  if (!open) return null;

  const data = result?.data;
  const a = data?.analysis ?? null;
  const applied = data?.applied ?? null;
  const diag = data?.diagnostics ?? null;
  const pct = confidencePct(a?.confidence ?? diag?.confidence);
  const hasInfo = Boolean(result?.ok && a && (a.summary || a.suggestedCorrespondentName || (a.suggestedTagNames?.length ?? 0) > 0 || (a.detectedAmounts?.length ?? 0) > 0));
  const needsValidation = applied?.needsValidation ?? [];
  // Raison globale du maintien en validation : extraite des raisons « à valider — … ».
  const holdReason = (() => {
    const r = Object.values(applied?.skipReasons ?? {}).find((v) => v.startsWith("à valider — "));
    return r ? r.replace("à valider — ", "") : null;
  })();

  async function applySuggestions() {
    setValidating(true);
    try {
      const res = await fetch(`/api/documents/${docId}/apply-analysis`, { method: "POST", credentials: "include" });
      const d = (await res.json().catch(() => ({}))) as { message?: string; error?: string; applied?: string[] };
      setValidateMsg(res.ok ? `Appliqué : ${(d.applied ?? []).join(", ") || "aucun champ vide"}` : (d.message || d.error || "Échec"));
    } catch {
      setValidateMsg("Échec de l'application.");
    } finally {
      setValidating(false);
    }
  }

  const stepStatus = (i: number): "done" | "current" | "wait" | "skip" => {
    if (!loading) {
      // Après coup : refléter les actions réelles pour les étapes 7→13.
      if (i <= 5) return "done";
      if (i === 6) return applied?.fieldsApplied.includes("correspondant") ? "done" : (applied && a ? "skip" : "done");
      if (i === 7) return applied?.fieldsApplied.includes("type") ? "done" : "skip";
      if (i === 8) return applied?.fieldsApplied.some((f) => f.startsWith("tags")) ? "done" : "skip";
      if (i === 9) return applied?.fieldsApplied.includes("dossier") ? "done" : "skip";
      if (i === 10) return applied && applied.budgetCreated > 0 ? "done" : "skip";
      if (i === 11) return applied?.reminderCreated ? "done" : "skip";
      return "done";
    }
    if (i < step) return "done";
    if (i === step) return "current";
    return "wait";
  };

  // Champ concerné par chaque étape « ignorable » → libellé de raison (popup).
  const STEP_FIELD: Record<number, string> = { 6: "correspondant", 7: "type", 8: "tags", 9: "dossier", 11: "rappel" };
  const skipReasonFor = (i: number): string | null => {
    if (i === 10) return applied && a ? "aucun montant à comptabiliser" : null; // budget
    const field = STEP_FIELD[i];
    return (field && applied?.skipReasons?.[field]) || null;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Analyse IA">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
      <div className="relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* En-tête */}
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>
            {loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" style={{ color: "var(--accent)" }} /> : hasInfo ? <Check className="h-[18px] w-[18px]" style={{ color: "#15803D" }} strokeWidth={2.5} /> : <AlertTriangle className="h-[18px] w-[18px]" style={{ color: "#F59E0B" }} />}
            {loading ? "Analyse IA en cours…" : "Analyse IA terminée"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Progression */}
          <ol className="space-y-1">
            {STEPS.map((label, i) => {
              const st = stepStatus(i);
              return (
                <li key={label} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: st === "done" ? "#EAF8EF" : st === "current" ? "var(--accent-soft)" : "transparent" }}>
                    {st === "done" ? <Check className="h-3.5 w-3.5" style={{ color: "#15803D" }} strokeWidth={3} />
                      : st === "current" ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--accent)" }} />
                      : st === "skip" ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--border)" }} />
                      : <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--border)" }} />}
                  </span>
                  <span style={{ color: st === "wait" || st === "skip" ? "var(--text-hint)" : "var(--text-main)", fontWeight: st === "current" ? 700 : 500 }}>
                    {label}
                    {st === "skip" ? <span style={{ color: "var(--text-hint)" }}> — ignoré{skipReasonFor(i) ? ` : ${skipReasonFor(i)}` : ""}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Résultat */}
          {!loading && hasInfo && a ? (
            <>
              <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: applied?.autoApplied ? "#EAF8EF" : "var(--accent-soft)" }}>
                <p className="text-[12px] font-bold" style={{ color: applied?.autoApplied ? "#15803D" : "var(--accent)" }}>
                  {applied?.autoApplied ? "Informations appliquées automatiquement" : "Suggestions à valider"}
                </p>
                {!applied?.autoApplied && needsValidation.length ? (
                  <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    {holdReason
                      ? `Non appliqué automatiquement (${holdReason}). Cliquez « Valider » pour remplir les champs vides.`
                      : "Champs déjà renseignés conservés. Cliquez « Valider » pour compléter les champs vides."}
                  </p>
                ) : null}
              </div>

              <dl className="space-y-1.5 text-[13px]">
                {a.summary ? <Row label="Résumé" value={a.summary} multiline /> : null}
                {a.suggestedDocumentTypeName ? <Row label="Type" value={a.suggestedDocumentTypeName} /> : null}
                {a.suggestedCorrespondentName ? <Row label="Correspondant" value={a.suggestedCorrespondentName} /> : null}
                {a.suggestedTagNames?.length ? <Row label="Tags" value={a.suggestedTagNames.join(", ")} /> : null}
                {(a.detectedDates ?? []).map((d, i) => <Row key={`d${i}`} label={d.label || "Date"} value={formatDetectedDate(d.iso)} />)}
                {(a.detectedAmounts ?? []).map((m, i) => <Row key={`m${i}`} label={m.label || "Montant"} value={euros(m.amount, m.currency) ?? "—"} />)}
                {a.financialImpact?.length ? <Row label="Budget" value={`${a.financialImpact[0].kind}${euros(a.financialImpact[0].amount, a.financialImpact[0].currency) ? ` — ${euros(a.financialImpact[0].amount, a.financialImpact[0].currency)}` : ""}`} /> : null}
                {pct != null ? <Row label="Confiance" value={`${pct} %`} /> : null}
                {diag ? <Row label="Qualité OCR" value={`${diag.ocrLength} caractères`} /> : null}
                {diag?.model ? <Row label="Modèle" value={diag.model} /> : null}
              </dl>

              {applied && (applied.fieldsApplied.length || applied.created.length || applied.budgetCreated || applied.reminderCreated) ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Actions appliquées</p>
                  <ul className="space-y-0.5 text-[12.5px]" style={{ color: "#15803D" }}>
                    {applied.fieldsApplied.map((f) => <li key={f}>✓ {f}</li>)}
                    {applied.created.map((c) => <li key={`c${c}`}>✓ Créé : {c}</li>)}
                    {applied.budgetCreated > 0 ? <li>✓ Entrée budget créée</li> : null}
                    {applied.reminderCreated ? <li>✓ Rappel créé</li> : null}
                    {applied.permisSkipped ? <li style={{ color: "var(--text-muted)" }}>• Tag « Permis de conduire » ignoré</li> : null}
                  </ul>
                </div>
              ) : null}

              {needsValidation.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>À vérifier / valider</p>
                  <p className="text-[12.5px]" style={{ color: "#B45309" }}>{needsValidation.join(", ")}</p>
                </div>
              ) : null}
            </>
          ) : null}

          {/* Cas vide / diagnostic */}
          {!loading && !hasInfo ? (
            <div className="rounded-2xl border p-3.5" style={{ borderColor: "#FDE68A", background: "#FFF4E5" }}>
              <p className="text-[13px] font-bold" style={{ color: "#B45309" }}>Analyse IA terminée, mais aucune information fiable n&apos;a été détectée.</p>
              <ul className="mt-2 space-y-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <li>OCR : {diag ? `${diag.ocrLength} caractères` : "indisponible"}</li>
                <li>Provider : {diag?.provider ?? "—"}</li>
                <li>Modèle : {diag?.model ?? "—"}</li>
                <li>Confiance : {diag?.confidence ?? "—"}</li>
                {diag?.reason ? <li>Raison probable : {diag.reason}</li> : null}
                {!result?.ok && result?.message ? <li>Détail : {result.message}</li> : null}
              </ul>
            </div>
          ) : null}

          {validateMsg ? <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>{validateMsg}</p> : null}
        </div>

        {/* Actions */}
        {!loading ? (
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-white px-5 py-3" style={{ borderColor: "var(--border)" }}>
            <button type="button" onClick={onOpenSheet} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <FileSearch className="h-4 w-4" strokeWidth={1.85} /> Voir la fiche IA
            </button>
            <Link href={`/documents/${docId}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <Pencil className="h-4 w-4" strokeWidth={1.85} /> Modifier
            </Link>
            {needsValidation.length ? (
              <button type="button" onClick={() => void applySuggestions()} disabled={validating} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "#15803D" }}>
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" strokeWidth={1.85} />} Valider
              </button>
            ) : null}
            <button type="button" onClick={onClose} className="ml-auto inline-flex h-9 items-center rounded-lg px-3 text-[12.5px] font-bold" style={{ background: "var(--accent)", color: "#fff" }}>
              Fermer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={multiline ? "" : "flex items-baseline justify-between gap-3"}>
      <dt className="text-[11.5px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</dt>
      <dd className={`text-[12.5px] font-semibold ${multiline ? "mt-0.5" : "text-right"}`} style={{ color: "var(--text-main)" }}>{value}</dd>
    </div>
  );
}

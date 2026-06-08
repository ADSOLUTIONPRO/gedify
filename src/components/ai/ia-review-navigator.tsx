"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, ListChecks, Loader2, ShieldCheck } from "lucide-react";
import type { ReviewNavigation } from "@/lib/ai/ai-navigation";

type Props = {
  analysisId: string | null;
  alreadyValidated: boolean;
  validate: { correspondentId: number | null; documentTypeId: number | null; tagIds: number[] };
  nav: ReviewNavigation;
};

/**
 * Barre de revue de la fiche IA : compteur de progression, navigation
 * précédent/suivant dans la file, et action principale « Valider et passer au
 * suivant » (validation MANUELLE via la même API que « Valider le classement »
 * — forceApply, puisque l'utilisateur a revu le document). En fin de file, état
 * clair au lieu d'une 404. Raccourcis : Ctrl/Cmd+Entrée, Alt+←/→.
 */
export function IaReviewNavigator({ analysisId, alreadyValidated, validate, nav }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  const goTo = useCallback((id: number) => {
    router.push(`/ia/document/${id}`);
  }, [router]);

  const goPrev = useCallback(() => { if (nav.previousId) goTo(nav.previousId); }, [nav.previousId, goTo]);
  const goNext = useCallback(() => { if (nav.nextId) goTo(nav.nextId); }, [nav.nextId, goTo]);

  const advance = useCallback(() => {
    if (nav.nextPendingId) goTo(nav.nextPendingId);
    else { setEnded(true); router.refresh(); }
  }, [nav.nextPendingId, goTo, router]);

  const validateAndNext = useCallback(async () => {
    if (!analysisId) { advance(); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/validate-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          analysisId,
          applyClassification: true,
          forceApply: true,
          correspondentId: validate.correspondentId ?? undefined,
          documentTypeId: validate.documentTypeId ?? undefined,
          tagIds: validate.tagIds,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        if (res.status === 401) throw new Error("Session GED expirée — reconnectez-vous.");
        throw new Error(data.message ?? data.error ?? `Échec de l'enregistrement (HTTP ${res.status}).`);
      }
      advance(); // serveur confirmé → on n'avance qu'ensuite
    } catch (e) {
      // Échec → on reste sur le document, on affiche l'erreur, rien n'est perdu.
      setError(e instanceof Error ? e.message : "Validation impossible.");
      setBusy(false);
    }
  }, [analysisId, validate, advance]);

  const primaryEnabled = !busy && (alreadyValidated ? nav.nextPendingId !== null : Boolean(analysisId));
  const primaryAction = useCallback(() => {
    if (busy) return;
    if (alreadyValidated) advance();
    else void validateAndNext();
  }, [busy, alreadyValidated, advance, validateAndNext]);

  /* ── Raccourcis clavier ──────────────────────────────────────────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!primaryEnabled) return;
        e.preventDefault();
        primaryAction();
        return;
      }
      if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        if (inField) return; // ne pas voler le déplacement par mot dans un champ
        e.preventDefault();
        if (e.key === "ArrowRight") goNext();
        else goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primaryEnabled, primaryAction, goNext, goPrev]);

  if (ended) {
    return (
      <div className="mb-6 rounded-2xl border p-5 text-center" style={{ borderColor: "var(--gedify-green-soft)", background: "var(--gedify-green-soft)" }}>
        <CheckCircle2 className="mx-auto h-7 w-7" style={{ color: "var(--gedify-green)" }} strokeWidth={1.75} aria-hidden="true" />
        <p className="mt-2 text-[14.5px] font-bold" style={{ color: "var(--text-main)" }}>
          Tous les documents de cette sélection ont été vérifiés.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Link href="/ia/documents" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-semibold text-white" style={{ background: "var(--accent)" }}>
            Retour aux documents
          </Link>
          <Link href="/ia" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3.5 text-[13px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            Vue d&apos;ensemble IA
          </Link>
          <Link href="/documents" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3.5 text-[13px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            Tous les documents
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
        {/* Compteur de progression */}
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.85} aria-hidden="true" />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
            {nav.inQueue ? <>Document {nav.position} sur {nav.total}</> : <>Hors file de revue</>}
            <span style={{ color: "var(--text-muted)" }}>
              {nav.remaining > 0 ? ` · ${nav.remaining} à vérifier` : " · file à jour"}
            </span>
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Précédent / suivant */}
          <button
            type="button"
            onClick={goPrev}
            disabled={!nav.previousId}
            title="Document précédent (Alt + ←)"
            aria-label="Document précédent"
            className="inline-flex h-9 items-center gap-1 rounded-xl border bg-white px-2.5 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Précédent</span>
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!nav.nextId}
            title="Document suivant (Alt + →)"
            aria-label="Document suivant"
            className="inline-flex h-9 items-center gap-1 rounded-xl border bg-white px-2.5 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
          >
            <span className="hidden sm:inline">Suivant</span>
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Action principale (desktop) */}
          <button
            type="button"
            onClick={primaryAction}
            disabled={!primaryEnabled}
            title={alreadyValidated ? "Passer au document suivant (Ctrl/Cmd + Entrée)" : "Valider et passer au suivant (Ctrl/Cmd + Entrée)"}
            className="hidden h-9 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50 sm:inline-flex"
            style={{ background: "var(--gedify-green)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : alreadyValidated ? <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
            {alreadyValidated ? "Passer au suivant" : "Valider et passer au suivant"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--gedify-orange-soft)", color: "var(--text-main)" }}>
          {error}
        </div>
      ) : null}

      {/* Barre principale sticky (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-white/95 p-3 backdrop-blur sm:hidden" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={primaryAction}
          disabled={!primaryEnabled}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white transition disabled:opacity-50"
          style={{ background: "var(--gedify-green)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
          {alreadyValidated ? "Document suivant" : "Valider et suivant"}
        </button>
      </div>
    </>
  );
}

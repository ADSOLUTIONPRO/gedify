"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2, ScanLine, Sparkles, type LucideIcon } from "lucide-react";
import { DocumentAiResultDialog } from "@/components/documents/document-ai-result-dialog";
import { OcrAbsentModal } from "@/components/documents/ocr-absent-modal";
import { fetchCurrentUser } from "@/lib/documents/document-quick-edit";
import { ANALYSIS_ACTIONS, logAiAction, runAiAction, type AiActionId, type AiActionResult } from "@/lib/documents/document-ai";

/** Composant simplifié : un seul bouton d'analyse + Fiche Doc + OCR. */
type ButtonId = "analyse" | "fiche" | "ocr";

type Tone = { bg: string; color: string; border: string };

const META: Record<ButtonId, { label: string; loading: string; icon: LucideIcon; tone: Tone }> = {
  analyse: { label: "Analyse IA", loading: "Analyse IA en cours…", icon: Sparkles, tone: { bg: "#F75C8D", color: "#FFFFFF", border: "#F75C8D" } },
  fiche: { label: "Fiche Doc", loading: "", icon: FileSearch, tone: { bg: "#FFFFFF", color: "#1F2937", border: "#E8DED1" } },
  ocr: { label: "Relancer OCR", loading: "OCR en cours…", icon: ScanLine, tone: { bg: "#FFF4E5", color: "#F59E0B", border: "#FFE0B2" } },
};

const DEFAULT_ORDER: ButtonId[] = ["analyse", "fiche", "ocr"];

type Props = {
  documentId: number;
  /** Ouvre la Fiche Doc en popup (le bouton « Fiche Doc » ne navigue pas). */
  onOpenSheet?: () => void;
  /** Appelé après une action réussie (rafraîchir grille / panneau). */
  onChanged?: () => void;
  /** Rétro-compatibilité — ignoré (composant simplifié à un bouton). */
  hasAnalysis?: boolean;
  /** Sous-ensemble et ordre des boutons. Défaut : analyse + fiche + ocr. */
  show?: ButtonId[];
  /** Utilisateur (historique). Sinon récupéré une fois. */
  user?: string | null;
  /** Statut OCR du document — adapte la modale (en cours vs absent). */
  ocrStatus?: "done" | "low" | "pending";
};

/**
 * Bloc « Actions IA » : bouton principal **Analyse IA** (analyse profonde
 * OpenAI cloud + advanced + application auto), plus Fiche Doc et Relancer OCR.
 * L'analyse ouvre la popup progression/résultat. Journalisation GED.
 */
export function DocumentAiActions({ documentId, onOpenSheet, onChanged, show = DEFAULT_ORDER, user, ocrStatus }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<ButtonId | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [resolvedUser, setResolvedUser] = useState<string | null>(user ?? null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Popup d'analyse (progression + résultat).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogResult, setDialogResult] = useState<AiActionResult | null>(null);
  // Modale « OCR absent » (analyse possible sans OCR).
  const [ocrModal, setOcrModal] = useState(false);

  useEffect(() => {
    if (user !== undefined) return;
    void Promise.resolve().then(async () => setResolvedUser(await fetchCurrentUser()));
  }, [user]);

  function flash(ok: boolean, message: string) {
    setFeedback({ ok, message });
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), 4000);
  }

  async function execute(action: AiActionId, opts: { allowWithoutOcr?: boolean } = {}) {
    if (busy) return;
    const isAnalysis = ANALYSIS_ACTIONS.includes(action);
    setBusy(action as ButtonId);
    setFeedback(null);
    if (isAnalysis) { setDialogResult(null); setDialogLoading(true); setDialogOpen(true); }

    const res = await runAiAction(documentId, action, opts);

    // OCR absent et analyse non explicitement autorisée → proposer le choix
    // (Lancer l'OCR / Analyser sans OCR) au lieu d'afficher une erreur.
    if (isAnalysis && res.code === "no-ocr" && !opts.allowWithoutOcr) {
      setDialogOpen(false); setDialogLoading(false); setDialogResult(null);
      setBusy(null);
      setOcrModal(true);
      return;
    }

    await logAiAction(documentId, action, res.ok, user ?? resolvedUser);
    setBusy(null);

    if (isAnalysis) { setDialogResult(res); setDialogLoading(false); }
    else flash(res.ok, res.message);

    if (res.ok) { onChanged?.(); router.refresh(); }
  }

  /** « Oui, lancer l'analyse IA » : analyse directe (sans OCR). */
  async function analyzeWithoutOcr() {
    setOcrModal(false);
    await execute("analyse", { allowWithoutOcr: true });
  }
  /** « Lancer l'OCR » : OCR puis analyse automatique (sans blocage si OCR pas prêt). */
  async function ocrThenAnalyze() {
    setOcrModal(false);
    setBusy("ocr");
    const ocr = await runAiAction(documentId, "ocr");
    await logAiAction(documentId, "ocr", ocr.ok, user ?? resolvedUser);
    setBusy(null);
    if (ocr.ok) { onChanged?.(); router.refresh(); }
    await execute("analyse", { allowWithoutOcr: true });
  }

  function onClick(id: ButtonId) {
    if (id === "fiche") { onOpenSheet?.(); return; }
    void execute(id);
  }

  // La Fiche Doc n'est affichée que si un handler de popup est fourni.
  const buttons = show.filter((id) => id !== "fiche" || Boolean(onOpenSheet));
  const primary = buttons.includes("analyse");
  const rest = buttons.filter((id) => id !== "analyse");

  return (
    <div className="space-y-2">
      {/* Bouton principal — analyse profonde OpenAI */}
      {primary ? (
        <button
          type="button"
          onClick={() => onClick("analyse")}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: META.analyse.tone.bg }}
        >
          {busy === "analyse" ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />}
          {busy === "analyse" ? META.analyse.loading : META.analyse.label}
        </button>
      ) : null}

      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {rest.map((id) => {
            const m = META[id];
            const Icon = m.icon;
            const isBusy = busy === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onClick(id)}
                disabled={busy !== null}
                className="flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12px] font-bold transition hover:opacity-90 disabled:opacity-50"
                style={{ background: m.tone.bg, color: m.tone.color, borderColor: m.tone.border }}
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />}
                <span className="truncate">{isBusy ? m.loading : m.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {feedback ? (
        <p className="text-[11.5px] font-semibold" style={{ color: feedback.ok ? "#15803D" : "#EF4444" }} role="status">
          {feedback.message}
        </p>
      ) : null}

      <DocumentAiResultDialog
        open={dialogOpen}
        loading={dialogLoading}
        docId={documentId}
        result={dialogResult}
        onClose={() => setDialogOpen(false)}
        onOpenSheet={() => { setDialogOpen(false); onOpenSheet?.(); }}
      />

      {/* Modale partagée « OCR absent / en cours » : analyse jamais bloquée. */}
      <OcrAbsentModal
        open={ocrModal}
        ocrStatus={ocrStatus}
        onLaunchOcr={() => void ocrThenAnalyze()}
        onAnalyzeAnyway={() => void analyzeWithoutOcr()}
        onClose={() => setOcrModal(false)}
      />
    </div>
  );
}

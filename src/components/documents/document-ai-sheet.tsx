"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  FileText,
  FolderPlus,
  FolderTree,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ScanText,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { AutocompleteInput, type AutocompleteSuggestion } from "@/components/ui/autocomplete-input";
import { OcrAbsentModal } from "@/components/documents/ocr-absent-modal";
import { FolderPickerField } from "@/components/folders/folder-picker-field";
import { DocumentLinks } from "@/components/documents/document-links";
import { FolderPickerModal, type FolderSelection } from "@/components/folders/folder-picker-modal";
import { CreateCalendarItemModal } from "@/components/calendar/create-calendar-item-modal";
import { DocumentFavoriteToggle } from "@/components/documents/document-favorite-toggle";
import { AmountBreakdownEditor, type BreakdownSeed } from "@/components/documents/amount-breakdown-editor";
import { DocumentSecondaryCorrespondents } from "@/components/documents/document-secondary-correspondents";
import { formatAmount, type DocumentVM } from "@/components/documents/types";
import { toDateInputValue } from "@/lib/format";
import type { AiAnalysisShape, AiDiagnostics } from "@/lib/documents/document-ai";

/** Étapes affichées pendant l'analyse. */
const STEPS = [
  "Récupération du document",
  "Lecture OCR",
  "Analyse OpenAI",
  "Extraction des informations",
  "Classement (correspondant, type, tags, dossier)",
  "Classement budget",
];

const DUE_RE = /(éch[ée]ance|limite|paiement|r[èe]glement|\bdue\b)/i;
const DOC_DATE_RE = /(document|émission|emission|facture|sign|courrier|\bdate\b)/i;
/** Dates à exclure du choix de « date du document » (naissance, historique, bien…). */
const EXCLUDE_DATE_RE = /(naiss|\bn[ée]e?\b|birth|construct|[ée]difi|cadastr|acquis|historiq|d[ée]c[èe]s|mariage|ancien)/i;

/** Choisit la date du document en évitant les dates parasites. */
function pickDocDate(dates: { label: string; iso: string }[]): string {
  const all = dates.filter((d) => d.iso);
  if (all.length === 0) return "";
  const usable = all.filter((d) => !EXCLUDE_DATE_RE.test(d.label) && !DUE_RE.test(d.label));
  const strong = usable.find((d) => DOC_DATE_RE.test(d.label));
  if (strong) return strong.iso;
  const pool = usable.length > 0 ? usable : all.filter((d) => !DUE_RE.test(d.label));
  if (pool.length === 0) return all[0].iso;
  return [...pool].sort((a, b) => (a.iso < b.iso ? 1 : -1))[0].iso;
}

function confidencePctFromBucket(c?: string): number | null {
  if (c === "high") return 90;
  if (c === "medium") return 60;
  if (c === "low") return 30;
  return null;
}

const primaryBtn = "inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[12.5px] font-bold text-white transition hover:opacity-90";
const secondaryBtn = "inline-flex h-9 items-center gap-1.5 rounded-[20px] border-[1.5px] px-3.5 text-[12.5px] font-bold transition hover:bg-[#FCFAF7] disabled:opacity-40";

type Suggestions = {
  title: string;
  summary: string;
  correspondent: string;
  type: string;
  folder: string;
  tags: string[];
  dateISO: string;
  dueISO: string;
  amountLabel: string;
  budgetLabel: string;
  confidence: string;
  confidencePct: number | null;
  ocrLength: number | null;
  provider: string | null;
  model: string | null;
  seeds: BreakdownSeed[];
  warnings: { code: string; message: string }[];
  allDates: { label: string; iso: string }[];
  appliedFields: string[];
  needsReview: boolean;
  secondaryCorrespondents: string[];
  source: string | null;
  matchedTemplate: string | null;
  similarityPct: number | null;
};

function fromVM(doc: DocumentVM): Suggestions {
  const ai = doc.ai;
  const dates = ai?.dates ?? [];
  // PRIORITÉ AUX VALEURS ACTIVES DU DOCUMENT (modifications manuelles validées)
  // sur les suggestions IA : à la réouverture, le formulaire reflète ce qui est
  // réellement enregistré, jamais l'ancienne proposition OCR/IA. Les suggestions
  // restent disponibles via « Relancer » (fromAnalysis).
  return {
    title: doc.displayTitle,
    summary: ai?.summary ?? "",
    correspondent: doc.correspondentName ?? ai?.correspondentName ?? "",
    type: doc.typeName ?? ai?.typeName ?? ai?.kind ?? "",
    folder: "",
    tags: doc.tags.length ? doc.tags.map((t) => t.name) : (ai?.tagNames ?? []),
    dateISO: doc.createdISO || pickDocDate(dates) || "",
    dueISO: doc.due?.iso ?? dates.find((d) => DUE_RE.test(d.label))?.iso ?? "",
    amountLabel: ai?.amounts?.[0]?.formatted ?? (doc.amount ? formatAmount(doc.amount.amount, doc.amount.currency) : ""),
    budgetLabel: "",
    confidence: ai?.confidence ?? "",
    confidencePct: ai?.confidencePct ?? confidencePctFromBucket(ai?.confidence ?? undefined),
    ocrLength: null,
    provider: null,
    model: null,
    seeds: (ai?.amounts ?? []).map((a) => ({ label: a.label, amount: a.amount, currency: a.currency })),
    warnings: [],
    allDates: dates.map((d) => ({ label: d.label, iso: d.iso })),
    appliedFields: ai?.appliedFields ?? [],
    needsReview: ai?.needsReview ?? false,
    secondaryCorrespondents: ai?.secondaryCorrespondentNames ?? [],
    source: ai?.source ?? null,
    matchedTemplate: ai?.matchedTemplateLabel ?? null,
    similarityPct: ai?.similarityPct ?? null,
  };
}

function fromAnalysis(a: AiAnalysisShape, diag: AiDiagnostics | null, fallbackTitle: string): Suggestions {
  const dates = a.detectedDates ?? [];
  const amt = a.detectedAmounts?.[0];
  const fin = a.financialImpact?.[0];
  return {
    title: a.suggestedTitle?.trim() || fallbackTitle,
    summary: a.summary ?? "",
    correspondent: a.suggestedCorrespondentName ?? "",
    type: a.suggestedDocumentTypeName ?? "",
    folder: a.suggestedFolderName ?? "",
    tags: a.suggestedTagNames ?? [],
    dateISO: pickDocDate(dates.map((d) => ({ label: d.label, iso: d.iso }))),
    dueISO: dates.find((d) => DUE_RE.test(d.label))?.iso ?? "",
    amountLabel: amt ? formatAmount(amt.amount, amt.currency) : "",
    budgetLabel: fin ? `${fin.kind}${fin.amount ? ` — ${formatAmount(fin.amount, fin.currency ?? "EUR")}` : ""}` : "",
    confidence: a.confidence ?? "",
    confidencePct: a.globalConfidenceScore != null ? Math.round(a.globalConfidenceScore * 100) : confidencePctFromBucket(a.confidence ?? undefined),
    ocrLength: diag?.ocrLength ?? null,
    provider: diag?.provider ?? null,
    model: diag?.model ?? null,
    seeds: (a.detectedAmounts ?? []).map((x) => ({ label: x.label, amount: x.amount, currency: x.currency })),
    warnings: a.warnings ?? [],
    allDates: dates.map((d) => ({ label: d.label, iso: d.iso })),
    appliedFields: a.appliedFields ?? [],
    needsReview: a.needsReview ?? false,
    secondaryCorrespondents: a.secondaryCorrespondentNames ?? [],
    source: a.classificationSource ?? null,
    matchedTemplate: a.matchedTemplateLabel ?? null,
    similarityPct: a.similarityScore != null ? Math.round(a.similarityScore * 100) : null,
  };
}

type Phase = "view" | "running" | "applying" | "applied" | "error";

/**
 * Popup « Fiche Doc » interactive : lance l'analyse en place (sans se fermer),
 * affiche la progression, puis les suggestions **éditables** organisées en
 * sections lisibles (grille 2-3 colonnes responsive ; titre + résumé pleine
 * largeur), permet de les appliquer au document et de répartir les montants au
 * budget. Ne se ferme que sur Fermer.
 */
export function DocumentAiSheet({ doc, onClose, onApplied }: { doc: DocumentVM; onClose: () => void; onApplied?: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("view");
  const [ocrModal, setOcrModal] = useState(false);
  const [hasAnalysis, setHasAnalysis] = useState(Boolean(doc.ai));
  const [sug, setSug] = useState<Suggestions>(() => fromVM(doc));
  const [step, setStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedFields, setAppliedFields] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  // Sélection EXPLICITE d'un dossier via l'explorateur (conserve l'id réel).
  const [folderSel, setFolderSel] = useState<FolderSelection | null>(null);

  // À l'ouverture, recharge le dossier RÉELLEMENT rattaché au document (le lien
  // est persisté côté serveur) → le sélecteur de dossier ne repart pas à vide.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${doc.id}/folder`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { folder: null }))
      .then((d: { folder?: FolderSelection | null }) => { if (!cancelled && d.folder) setFolderSel(d.folder); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [doc.id]);
  // Actions de traitement (OCR / aperçu / ajout à un dossier) — réutilisent les
  // endpoints existants ; n'altèrent pas le flux d'analyse.
  const [procBusy, setProcBusy] = useState<string | null>(null);
  const [procMsg, setProcMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [calItemOpen, setCalItemOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Animation de progression pendant l'analyse.
  useEffect(() => {
    if (phase !== "running") return;
    const reset = setTimeout(() => setStep(0), 0);
    let s = 0;
    const iv = setInterval(() => { s = Math.min(s + 1, STEPS.length - 1); setStep(s); }, 650);
    return () => { clearTimeout(reset); clearInterval(iv); };
  }, [phase]);

  async function launch(allowWithoutOcr = false) {
    setErrorMsg(null);
    setPhase("running");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch(`/api/ai/analyze-document`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id, mode: "cloud", advanced: true, autoApply: false, force: true, allowWithoutOcr }),
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { analysis?: AiAnalysisShape; diagnostics?: AiDiagnostics; message?: string; error?: string };
      // OCR absent → modale (Lancer l'OCR / Analyser sans OCR) au lieu de bloquer.
      if (res.status === 422 && data.error === "no-ocr" && !allowWithoutOcr) {
        setPhase("view");
        setOcrModal(true);
        return;
      }
      if (!res.ok || !data.analysis) {
        setErrorMsg(data.message || data.error || `Analyse impossible (${res.status}).`);
        setSug((s) => ({ ...s, ocrLength: data.diagnostics?.ocrLength ?? s.ocrLength, provider: data.diagnostics?.provider ?? s.provider, model: data.diagnostics?.model ?? s.model }));
        setPhase("error");
        return;
      }
      setSug(fromAnalysis(data.analysis, data.diagnostics ?? null, doc.displayTitle));
      setHasAnalysis(true);
      setPhase("view");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") { setPhase("view"); return; }
      setErrorMsg("Analyse impossible — réessayez.");
      setPhase("error");
    }
  }

  /** « Lancer l'OCR » : relance l'OCR puis l'analyse (jamais bloquée). */
  async function ocrThenAnalyze() {
    setOcrModal(false);
    await fetch(`/api/documents/${doc.id}/redo-ocr`, { method: "POST", credentials: "include" }).catch(() => {});
    await launch(true);
  }

  async function apply() {
    setErrorMsg(null);
    setPhase("applying");
    try {
      const res = await fetch(`/api/documents/${doc.id}/apply-analysis`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overrides: {
            correspondentName: sug.correspondent || null,
            documentTypeName: sug.type || null,
            tagNames: sug.tags,
            // Dossier choisi dans l'explorateur → id réel (prioritaire) ;
            // sinon nom suggéré (résolu/créé par chemin côté serveur).
            folderId: folderSel?.id ?? null,
            folderName: folderSel ? folderSel.path : (sug.folder || null),
            title: sug.title || null,
            created: sug.dateISO || null,
            // Persistés sur l'analyse → relus à la réouverture.
            summary: sug.summary ?? "",
            dueDate: sug.dueISO || "",
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { applied?: string[]; message?: string; error?: string };
      if (!res.ok) { setErrorMsg(data.message || data.error || "Application impossible."); setPhase("error"); return; }
      setAppliedFields(data.applied ?? []);
      setPhase("applied");
      onApplied?.();
      router.refresh();
    } catch {
      setErrorMsg("Application impossible.");
      setPhase("error");
    }
  }

  async function copySummary() {
    if (!sug.summary) return;
    try { await navigator.clipboard.writeText(sug.summary); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  }

  async function runProc(key: string, url: string, okText: string) {
    setProcBusy(key);
    setProcMsg(null);
    try {
      const res = await fetch(url, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProcMsg({ ok: true, text: okText });
      router.refresh();
    } catch (e) {
      setProcMsg({ ok: false, text: e instanceof Error ? e.message : "Action impossible." });
    } finally {
      setProcBusy(null);
    }
  }

  async function addToFolder(sel: FolderSelection) {
    setFolderModalOpen(false);
    setProcBusy("folder");
    setProcMsg(null);
    try {
      const res = await fetch(`/api/projects/${sel.id}/documents/link`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ documentIds: [doc.id] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProcMsg({ ok: true, text: `Ajouté à « ${sel.name} ».` });
      router.refresh();
    } catch (e) {
      setProcMsg({ ok: false, text: e instanceof Error ? e.message : "Association impossible." });
    } finally {
      setProcBusy(null);
    }
  }

  // Libellés conditionnels selon l'état réel (statuts dérivés du document).
  const ocrLabel = doc.statuses.ocr === "pending" ? "Lancer l'OCR" : "Relancer l'OCR";

  function addTag(name: string) {
    const t = name.trim();
    if (!t) return;
    setSug((s) => (s.tags.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : { ...s, tags: [...s.tags, t] }));
    setTagQuery("");
  }
  function removeTag(name: string) {
    setSug((s) => ({ ...s, tags: s.tags.filter((x) => x !== name) }));
  }

  const pct = sug.confidencePct;
  const busy = phase === "running" || phase === "applying";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Fiche Doc du document">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl" style={{ border: "1px solid var(--border)" }}>
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-soft)", background: "var(--bg-panel)" }}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--gedify-purple-soft)" }}>
              <Sparkles className="h-5 w-5" style={{ color: "var(--gedify-purple)" }} strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-hint)" }}>Fiche Doc du document</p>
              <h2 className="truncate text-[15px] font-extrabold leading-tight" style={{ color: "var(--gedify-navy)" }} title={doc.displayTitle}>{doc.displayTitle}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pct != null && (phase === "view" || phase === "applying") ? <ConfidenceChip pct={pct} /> : null}
            <DocumentFavoriteToggle documentId={doc.id} />
            <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5" style={{ background: "var(--bg-app)" }}>
          {/* État : analyse en cours */}
          {phase === "running" ? (
            <div className="space-y-3 rounded-2xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
              <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Analyse IA en cours…</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--accent-soft)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(((step + 1) / STEPS.length) * 100)}%`, background: "var(--accent)" }} />
              </div>
              <ol className="space-y-1">
                {STEPS.map((label, i) => {
                  const st = i < step ? "done" : i === step ? "current" : "wait";
                  return (
                    <li key={label} className="flex items-center gap-2.5 text-[12.5px]">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: st === "done" ? "#EAF8EF" : st === "current" ? "var(--accent-soft)" : "transparent" }}>
                        {st === "done" ? <Check className="h-3.5 w-3.5" style={{ color: "#15803D" }} strokeWidth={3} /> : st === "current" ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "var(--accent)" }} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--border)" }} />}
                      </span>
                      <span style={{ color: st === "wait" ? "var(--text-hint)" : "var(--text-main)", fontWeight: st === "current" ? 700 : 500 }}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {/* État : erreur */}
          {phase === "error" ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#FDE68A", background: "#FFF4E5" }}>
              <p className="flex items-center gap-2 text-[14px] font-bold" style={{ color: "#B45309" }}>
                <AlertTriangle className="h-4 w-4" strokeWidth={2} /> Analyse IA impossible
              </p>
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-main)" }}>{errorMsg}</p>
              <ul className="mt-2 space-y-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                <li>Provider : {sug.provider ?? "—"}</li>
                <li>Modèle : {sug.model ?? "—"}</li>
                <li>OCR : {sug.ocrLength != null ? `${sug.ocrLength} caractères` : "indisponible"}</li>
              </ul>
            </div>
          ) : null}

          {/* État : appliqué (succès) */}
          {phase === "applied" ? (
            <div className="rounded-2xl border p-4" style={{ borderColor: "#D6F1DE", background: "#EAF8EF" }}>
              <p className="flex items-center gap-2 text-[14px] font-bold" style={{ color: "#15803D" }}>
                <Check className="h-4 w-4" strokeWidth={2.5} /> Suggestions appliquées au document
              </p>
              {appliedFields && appliedFields.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-semibold" style={{ color: "#15803D" }}>
                  {appliedFields.map((f) => <li key={f} className="rounded-full bg-white/70 px-2 py-0.5">✓ {f}</li>)}
                </ul>
              ) : <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Aucun changement nécessaire.</p>}
            </div>
          ) : null}

          {/* État : vue / édition des suggestions */}
          {(phase === "view" || phase === "applying") ? (
            !hasAnalysis ? (
              <div className="rounded-2xl border bg-white py-10 text-center" style={{ borderColor: "var(--border)" }}>
                <Sparkles className="mx-auto mb-3 h-9 w-9" style={{ color: "var(--text-hint)" }} strokeWidth={1.5} aria-hidden="true" />
                <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Aucune analyse IA disponible</p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px]" style={{ color: "var(--text-muted)" }}>Lancez une analyse pour générer la fiche IA de ce document.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Chips d'en-tête */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {pct != null ? <ConfidenceChip pct={pct} /> : null}
                  {sug.ocrLength != null ? <Chip>OCR {sug.ocrLength} car.</Chip> : null}
                  {sug.budgetLabel ? <Chip accent>Budget : {sug.budgetLabel}</Chip> : null}
                  {sug.needsReview ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "#FFF4E5", color: "#B45309" }}>Suggestions à vérifier</span> : null}
                  {sug.appliedFields.length > 0 ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "#EAF8EF", color: "#15803D" }}>Déjà appliqué : {sug.appliedFields.join(", ")}</span> : null}
                </div>

                <SourceBanner source={sug.source} similarityPct={sug.similarityPct} matchedTemplate={sug.matchedTemplate} />

                {/* Section 1 — Identification */}
                <FicheSection icon={FileText} title="Identification du document">
                  <Field label="Titre" full>
                    <input className={inputCls} style={{ borderColor: "var(--border)" }} value={sug.title} onChange={(e) => setSug({ ...sug, title: e.target.value })} />
                  </Field>
                  <FicheGrid>
                    <Field label="Correspondant">
                      <AutocompleteInput endpoint="/api/autocomplete/correspondents" value={sug.correspondent} allowCreate placeholder="Correspondant…"
                        onChange={(v, s?: AutocompleteSuggestion) => setSug({ ...sug, correspondent: s ? s.label : v })} onCreate={(n) => setSug({ ...sug, correspondent: n })} />
                    </Field>
                    <Field label="Type de document">
                      <AutocompleteInput endpoint="/api/autocomplete/document-types" value={sug.type} allowCreate placeholder="Type…"
                        onChange={(v, s?: AutocompleteSuggestion) => setSug({ ...sug, type: s ? s.label : v })} onCreate={(n) => setSug({ ...sug, type: n })} />
                    </Field>
                  </FicheGrid>
                  <DocumentSecondaryCorrespondents documentId={doc.id} suggestions={sug.secondaryCorrespondents} />
                </FicheSection>

                {/* Section 2 — Classement */}
                <FicheSection icon={FolderTree} title="Classement automatique">
                  <Field label="Dossier / projet">
                    <FolderPickerField
                      value={folderSel}
                      allowCreate
                      onChange={(v) => { setFolderSel(v); setSug((s) => ({ ...s, folder: v ? v.name : "" })); }}
                    />
                    {!folderSel && sug.folder ? (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Suggestion IA : <span className="font-semibold" style={{ color: "var(--text-main)" }}>{sug.folder}</span> — cliquez « Parcourir… » pour choisir le dossier exact.
                      </p>
                    ) : null}
                  </Field>
                  <div>
                    <span className="mb-1 block text-[11px] font-bold" style={{ color: "var(--text-main)" }}>Tags</span>
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {sug.tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                          {t}<button type="button" onClick={() => removeTag(t)} aria-label={`Retirer ${t}`}><X className="h-3 w-3" strokeWidth={2.5} /></button>
                        </span>
                      ))}
                    </div>
                    <AutocompleteInput endpoint="/api/autocomplete/tags" value={tagQuery} allowCreate placeholder="Ajouter un tag…"
                      onChange={(v, s?: AutocompleteSuggestion) => { if (s) addTag(s.label); else setTagQuery(v); }} onCreate={(n) => addTag(n)} />
                  </div>
                </FicheSection>

                {/* Section 3 — Dates & échéances */}
                <FicheSection icon={CalendarClock} title="Dates & échéances">
                  <FicheGrid>
                    <Field label="Date du document"><input type="date" className={inputCls} style={{ borderColor: "var(--border)" }} value={toDateInputValue(sug.dateISO)} onChange={(e) => setSug({ ...sug, dateISO: e.target.value })} /></Field>
                    <Field label="Échéance"><input type="date" className={inputCls} style={{ borderColor: "var(--border)" }} value={toDateInputValue(sug.dueISO)} onChange={(e) => setSug({ ...sug, dueISO: e.target.value })} /></Field>
                    {sug.amountLabel ? <Field label="Montant principal détecté"><div className="flex h-9 items-center text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{sug.amountLabel}</div></Field> : null}
                  </FicheGrid>
                  {(() => {
                    const others = sug.allDates.filter((d) => d.iso && d.iso !== sug.dateISO && d.iso !== sug.dueISO);
                    if (others.length === 0) return null;
                    return (
                      <div className="rounded-lg border p-2" style={{ borderColor: "var(--border)", background: "#FCFAF7" }}>
                        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Autres dates détectées</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {others.map((d, i) => (
                            <li key={`${d.iso}-${i}`} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#EEF2F7", color: "#475569" }} title={d.label}>
                              {toDateInputValue(d.iso).split("-").reverse().join("/")} · {d.label}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-hint)" }}>Non utilisées comme date du document.</p>
                      </div>
                    );
                  })()}
                </FicheSection>

                {/* Section 4 — Budget & répartition des montants */}
                <FicheSection icon={Wallet} title="Budget — répartition des montants">
                  <p className="-mt-1 mb-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    Répartissez les montants détectés (principal, TVA, frais, intérêts, reste dû…). Chaque ligne « incluse » crée une entrée budget à valider.
                  </p>
                  <AmountBreakdownEditor
                    documentId={doc.id}
                    seeds={sug.seeds}
                    defaultDate={toDateInputValue(sug.dueISO || sug.dateISO)}
                    defaultCorrespondent={sug.correspondent}
                    onCreated={() => { onApplied?.(); router.refresh(); }}
                  />
                </FicheSection>

                {/* Section 5 — Résumé */}
                <FicheSection icon={Sparkles} title="Résumé IA">
                  <Field label="Résumé" full>
                    <textarea rows={3} className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} value={sug.summary} onChange={(e) => setSug({ ...sug, summary: e.target.value })} />
                  </Field>
                </FicheSection>

                {/* Section 6 — Suggestions / corrections */}
                {sug.warnings.length > 0 ? (
                  <FicheSection icon={AlertTriangle} title="Points à vérifier" tone="warning">
                    <ul className="space-y-1 text-[12px]" style={{ color: "#92400E" }}>
                      {sug.warnings.map((w, i) => <li key={`${w.code}-${i}`} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{w.message}</span></li>)}
                    </ul>
                  </FicheSection>
                ) : null}
              </div>
            )
          ) : null}

          {/* Documents liés */}
          <DocumentLinks documentId={doc.id} />
        </div>

        {/* Barre d'actions selon l'état */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
          {phase !== "running" ? (
            <div className="mr-auto flex flex-wrap items-center gap-1.5">
              <ProcBtn busy={procBusy === "ocr"} onClick={() => void runProc("ocr", `/api/documents/${doc.id}/redo-ocr`, "OCR relancé — traitement en arrière-plan.")} icon={ScanText}>{procBusy === "ocr" ? "OCR en cours…" : ocrLabel}</ProcBtn>
              <ProcBtn busy={procBusy === "preview"} onClick={() => void runProc("preview", `/api/documents/${doc.id}/regenerate-preview`, "Miniature et aperçu régénérés.")} icon={ImageIcon}>Régénérer l&apos;aperçu</ProcBtn>
              <ProcBtn busy={procBusy === "folder"} onClick={() => setFolderModalOpen(true)} icon={FolderPlus}>Ajouter à un dossier</ProcBtn>
              <ProcBtn onClick={() => setCalItemOpen(true)} icon={CalendarClock}>RDV / tâche</ProcBtn>
              {procMsg ? <span className="text-[11.5px] font-semibold" style={{ color: procMsg.ok ? "var(--gedify-green)" : "var(--danger)" }}>{procMsg.text}</span> : null}
            </div>
          ) : null}
          {phase === "running" ? (
            <>
              <span className="mr-auto flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours…</span>
              <Btn onClick={() => abortRef.current?.abort()}>Annuler</Btn>
            </>
          ) : phase === "applied" ? (
            <>
              <Link href={`/documents/${doc.id}`} onClick={onClose} className={primaryBtn} style={{ background: "var(--accent)" }}>Voir le document</Link>
              <Btn onClick={() => void launch()}><RefreshCw className="h-4 w-4" strokeWidth={2} /> Relancer</Btn>
              <Btn onClick={onClose}>Fermer</Btn>
            </>
          ) : phase === "error" ? (
            <>
              <Btn onClick={() => void launch()}><RefreshCw className="h-4 w-4" strokeWidth={2} /> Réessayer</Btn>
              <Btn onClick={onClose}>Fermer</Btn>
            </>
          ) : !hasAnalysis ? (
            <>
              <button type="button" onClick={() => void launch()} className={primaryBtn} style={{ background: "linear-gradient(135deg, #F75C8D 0%, #A855F7 54%, #7C3AED 100%)" }}><Sparkles className="h-4 w-4" strokeWidth={2} /> Lancer l&apos;analyse IA</button>
              <Btn onClick={onClose}>Fermer</Btn>
            </>
          ) : (
            <>
              <Btn onClick={() => void copySummary()} disabled={!sug.summary}>{copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={2} />}{copied ? "Copié" : "Copier le résumé"}</Btn>
              <Btn onClick={() => void launch()} disabled={busy}><RefreshCw className="h-4 w-4" strokeWidth={2} /> Relancer</Btn>
              <button type="button" onClick={() => void apply()} disabled={busy} className={`${primaryBtn} disabled:opacity-50`} style={{ background: "var(--gedify-green)" }}>
                {phase === "applying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                Enregistrer les modifications
              </button>
              <Btn onClick={onClose}>Fermer</Btn>
            </>
          )}
        </div>
      </div>

      {folderModalOpen ? (
        <FolderPickerModal currentValue={folderSel} allowCreate onSelect={(v) => void addToFolder(v)} onClose={() => setFolderModalOpen(false)} />
      ) : null}

      {/* Modale partagée « OCR absent / en cours » : l'analyse n'est jamais bloquée. */}
      <OcrAbsentModal
        open={ocrModal}
        ocrStatus={doc.statuses.ocr}
        onLaunchOcr={() => void ocrThenAnalyze()}
        onAnalyzeAnyway={() => { setOcrModal(false); void launch(true); }}
        onClose={() => setOcrModal(false)}
      />

      {calItemOpen ? (
        <CreateCalendarItemModal
          source={{ sourceType: "document", sourceId: String(doc.id), sourceLabel: doc.displayTitle, documentId: doc.id }}
          prefill={{ title: sug.title, startISO: sug.dueISO || sug.dateISO || undefined, dueISO: sug.dueISO || undefined }}
          defaultTab={sug.dueISO ? "task" : "event"}
          onClose={() => setCalItemOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ProcBtn({ icon: Icon, children, onClick, busy }: { icon: typeof ScanText; children: React.ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-8 items-center gap-1.5 rounded-[18px] border px-3 text-[12px] font-bold transition hover:bg-[var(--bg-card-soft)] disabled:opacity-50"
      style={{ borderColor: "var(--border-strong)", color: "var(--text-main)", background: "var(--surface)" }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Icon className="h-3.5 w-3.5" strokeWidth={1.85} aria-hidden="true" />}
      {children}
    </button>
  );
}

const inputCls = "h-9 w-full rounded-xl border px-3 text-[13px] outline-none focus:border-[var(--accent)]";

const SOURCE_LABEL: Record<string, string> = {
  learned_template: "modèle appris",
  similar: "similarité avec un ancien document",
  user: "validation utilisateur précédente",
  rule: "règle automatique",
  openai: "analyse OpenAI complète",
};

/** Bandeau « origine du classement » (§7). */
function SourceBanner({ source, similarityPct, matchedTemplate }: { source: string | null; similarityPct: number | null; matchedTemplate: string | null }) {
  if (!source || source === "openai") return null;
  const auto = source === "learned_template";
  const tone = auto ? { bg: "#E7F0FF", color: "#1D4ED8" } : { bg: "#F3EEFF", color: "#6D28D9" };
  return (
    <div className="rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: `${tone.color}33`, background: tone.bg }}>
      <p className="font-bold" style={{ color: tone.color }}>{auto ? "Classement appliqué automatiquement" : "Document reconnu comme similaire"}</p>
      <p className="mt-0.5" style={{ color: "var(--text-main)" }}>
        Source : <b>{SOURCE_LABEL[source] ?? source}</b>
        {similarityPct != null ? <> · Similarité <b>{similarityPct} %</b></> : null}
        {matchedTemplate ? <> · Basé sur : <b>{matchedTemplate}</b></> : null}
      </p>
    </div>
  );
}

function ConfidenceChip({ pct }: { pct: number }) {
  const tone = pct >= 85 ? { bg: "#DCFCE7", color: "#15803D" } : pct >= 70 ? { bg: "#FEF3C7", color: "#B45309" } : { bg: "#FEE2E2", color: "#DC2626" };
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: tone.bg, color: tone.color }}><span className="h-1.5 w-1.5 rounded-full bg-current" /> Confiance {pct} %</span>;
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={accent ? { background: "var(--accent-soft)", color: "var(--accent)" } : { background: "#EEF2F7", color: "#475569" }}>{children}</span>;
}

function Btn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={secondaryBtn} style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}>
      {children}
    </button>
  );
}

function FicheSection({ icon: Icon, title, tone, children }: { icon: typeof Sparkles; title: string; tone?: "warning"; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] p-4" style={{ background: tone === "warning" ? "#FFFBEB" : "#FFFFFF", border: tone === "warning" ? "1px solid #FDE68A" : "none", boxShadow: tone === "warning" ? "none" : "var(--shadow-card)" }}>
      <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color: tone === "warning" ? "#B45309" : "var(--gedify-navy)" }}>
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> {title}
      </p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FicheGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "w-full" : ""}`}>
      <span className="mb-1 block text-[11px] font-bold" style={{ color: "var(--text-main)" }}>{label}</span>
      {children}
    </label>
  );
}

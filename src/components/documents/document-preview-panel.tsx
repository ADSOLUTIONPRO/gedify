"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  Check,
  Download,
  ExternalLink,
  FolderInput,
  MoreHorizontal,
  Notebook,
  Pencil,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { AutocompleteInput, type AutocompleteSuggestion } from "@/components/ui/autocomplete-input";
import { StatusPill } from "@/components/ui/status-pill";
import { STATUS_META, type DocumentVM } from "@/components/documents/types";
import { DocumentStatusBadges } from "@/components/documents/document-status-badges";
import { DocumentSecondaryCorrespondents } from "@/components/documents/document-secondary-correspondents";
import { DocumentAiSheet } from "@/components/documents/document-ai-sheet";
import { DocumentAiActions } from "@/components/documents/document-ai-actions";
import { SignDocumentButton } from "@/components/documents/sign-document-button";
import { DocumentTagsEditor } from "@/components/documents/document-tags-editor";
import { DocumentNotesEditor } from "@/components/documents/document-notes-editor";
import { DocumentReminders } from "@/components/documents/document-reminders";
import { DocumentBudgetLine } from "@/components/documents/document-budget-line";
import { DocumentCalendarCard } from "@/components/documents/document-calendar-card";
import {
  createCorrespondent,
  createDocumentType,
  fetchCurrentUser,
  logChange,
  patchDisplayTitle,
  patchDocument,
} from "@/lib/documents/document-quick-edit";
import { toDateInputValue } from "@/lib/format";

function SectionTitle({ icon: Icon, children }: { icon: typeof Sparkles; children: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

export function DocumentPreviewPanel({ doc }: { doc: DocumentVM | null }) {
  const [user, setUser] = useState<string | null>(null);
  useEffect(() => { void fetchCurrentUser().then(setUser); }, []);

  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun document sélectionné</p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Sélectionnez un document dans la liste pour afficher son aperçu.</p>
      </div>
    );
  }

  return <QuickPanel key={doc.id} doc={doc} user={user} />;
}

/**
 * Fiche rapide éditable : en-tête sticky (titre + statut + « Voir le document »),
 * résumé, classement éditable (correspondant/type/tags/dossier/date) avec
 * autocomplétion + création, budget, IA/OCR, notes, rappels & calendrier.
 * Re-monte à chaque changement de document (`key={doc.id}`) → état réinitialisé.
 */
function QuickPanel({ doc, user }: { doc: DocumentVM; user: string | null }) {
  const router = useRouter();
  const status = STATUS_META[doc.status];

  // État d'édition local
  const [title, setTitle] = useState(doc.displayTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.displayTitle);
  const [corrName, setCorrName] = useState(doc.correspondentName ?? "");
  const [typeName, setTypeName] = useState(doc.typeName ?? "");
  const [folderName, setFolderName] = useState("");
  const [dateInput, setDateInput] = useState(toDateInputValue(doc.createdISO));

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fiche, setFiche] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(text: string) {
    setMsg(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 3500);
  }

  // ── Titre ──
  async function saveTitle() {
    const value = titleDraft.trim();
    if (!value || value === title) { setEditingTitle(false); return; }
    setBusy(true);
    flash("Enregistrement…");
    try {
      await patchDisplayTitle(doc.id, value);
      await logChange(doc.id, "Titre", title, value, user);
      setTitle(value);
      setEditingTitle(false);
      flash("Enregistré");
      router.refresh();
    } catch {
      flash("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  // ── Correspondant ──
  async function applyCorrespondent(id: number | null, name: string) {
    setBusy(true);
    flash("Enregistrement…");
    try {
      await patchDocument(doc.id, { correspondent: id });
      await logChange(doc.id, "Correspondant", doc.correspondentName, name || null, user);
      flash("Enregistré");
      router.refresh();
    } catch {
      flash("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }
  function onCorr(value: string, s?: AutocompleteSuggestion) {
    if (s) { setCorrName(s.label); void applyCorrespondent(Number(s.id), s.label); }
    else setCorrName(value);
  }
  async function onCreateCorr(name: string) {
    setBusy(true);
    flash("Création du correspondant…");
    try {
      const c = await createCorrespondent(name);
      setCorrName(c.name);
      flash("Correspondant créé");
      await applyCorrespondent(c.id, c.name);
    } catch {
      flash("Création impossible");
      setBusy(false);
    }
  }

  // ── Type ──
  async function applyType(id: number | null, name: string) {
    setBusy(true);
    flash("Enregistrement…");
    try {
      await patchDocument(doc.id, { document_type: id });
      await logChange(doc.id, "Type de document", doc.typeName, name || null, user);
      flash("Enregistré");
      router.refresh();
    } catch {
      flash("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }
  function onType(value: string, s?: AutocompleteSuggestion) {
    if (s) { setTypeName(s.label); void applyType(Number(s.id), s.label); }
    else setTypeName(value);
  }
  async function onCreateType(name: string) {
    setBusy(true);
    flash("Création du type…");
    try {
      const t = await createDocumentType(name);
      setTypeName(t.name);
      flash("Type créé");
      await applyType(t.id, t.name);
    } catch {
      flash("Création impossible");
      setBusy(false);
    }
  }

  // ── Dossier / projet ──
  async function linkFolder(projectId: string, name: string) {
    setBusy(true);
    flash("Enregistrement…");
    try {
      const res = await fetch(`/api/projects/${projectId}/documents/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ documentIds: [doc.id] }),
      });
      if (!res.ok) throw new Error();
      await logChange(doc.id, "Dossier", null, name, user);
      flash("Enregistré");
      router.refresh();
    } catch {
      flash("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }
  function onFolder(value: string, s?: AutocompleteSuggestion) {
    if (s) { setFolderName(s.label); void linkFolder(String(s.id), s.label); }
    else setFolderName(value);
  }
  async function onCreateFolder(name: string) {
    setBusy(true);
    flash("Création du dossier…");
    try {
      // Chemin « A / B / C » → crée/retrouve toute l'arborescence (feuille liée).
      const isPath = name.includes("/");
      const res = await fetch(isPath ? "/api/projects/resolve-path" : "/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(isPath ? { path: name } : { name }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { id?: string; folder?: { id: string } };
      const folderId = isPath ? data.folder?.id : data.id;
      if (!folderId) throw new Error();
      setFolderName(name);
      flash("Dossier créé");
      await linkFolder(folderId, name);
    } catch {
      flash("Création impossible");
      setBusy(false);
    }
  }

  // ── Date du document ──
  async function saveDate(value: string) {
    setDateInput(value);
    setBusy(true);
    flash("Enregistrement…");
    try {
      await patchDocument(doc.id, { created: value || null });
      await logChange(doc.id, "Date du document", doc.dateLabel, value || null, user);
      flash("Enregistré");
      router.refresh();
    } catch {
      flash("Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* ── En-tête sticky ── */}
      <div className="sticky top-0 z-20 border-b bg-white px-4 py-3" style={{ borderColor: "var(--border)" }}>
        {editingTitle ? (
          <div className="flex items-center gap-1.5">
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void saveTitle(); if (e.key === "Escape") { setEditingTitle(false); setTitleDraft(title); } }}
              className="h-9 w-full rounded-lg border px-2.5 text-[14px] font-bold outline-none focus:border-[var(--accent)]"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            />
            <button type="button" onClick={() => void saveTitle()} disabled={busy} aria-label="Enregistrer" className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: "var(--accent)" }}>
              <Check className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => { setEditingTitle(false); setTitleDraft(title); }} aria-label="Annuler" className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => { setEditingTitle(true); setTitleDraft(title); }} className="group flex w-full items-start gap-1.5 text-left">
            <h2 className="flex-1 text-[15px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>{title}</h2>
            <Pencil className="mt-1 h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}

        <div className="mt-2 flex items-center gap-2">
          <StatusPill tone={status.tone} dot>{status.label}</StatusPill>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href={doc.detailHref} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-3.5 text-[12.5px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
              Voir le document
            </Link>
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Plus d'actions" className="flex h-9 w-9 items-center justify-center rounded-lg border transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
              </button>
              {menuOpen ? (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border bg-white py-1 shadow-lg" style={{ borderColor: "var(--border)" }}>
                    <a href={doc.downloadUrl} className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-[#FCFAF7]" style={{ color: "var(--text-main)" }}>
                      <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Télécharger
                    </a>
                    {doc.paperlessUrl ? (
                      <a href={doc.paperlessUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-[#FCFAF7]" style={{ color: "var(--text-main)" }}>
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} /> Gedify
                      </a>
                    ) : null}
                    <Link href={doc.detailHref} className="flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-[#FCFAF7]" style={{ color: "var(--text-main)" }}>
                      <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} /> Ouvrir en plein écran
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <DocumentStatusBadges statuses={doc.statuses} className="mt-2" />
        {msg ? <p className="mt-1.5 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }} role="status">{msg}</p> : null}
      </div>

      <div className="space-y-5 p-4">
        {/* ── Section 1 — Résumé ── */}
        <div className="space-y-2">
          <Link href={doc.detailHref} className="flex h-32 items-center justify-center overflow-hidden rounded-xl border bg-slate-50" style={{ borderColor: "var(--border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={doc.thumbUrl} alt={title} className="h-full w-full object-contain" />
          </Link>
          <dl className="rounded-xl border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-baseline justify-between gap-3 py-1"><dt className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>Date</dt><dd className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{doc.dateLabel}</dd></div>
            {doc.sourceLabel ? <div className="flex items-baseline justify-between gap-3 py-1"><dt className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>Source</dt><dd className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{doc.sourceLabel}</dd></div> : null}
            <div className="flex items-center justify-between gap-3 py-1"><dt className="text-[11.5px] font-medium" style={{ color: "var(--text-muted)" }}>Statut</dt><dd><StatusPill tone={status.tone} dot>{status.label}</StatusPill></dd></div>
          </dl>
          {doc.ai?.summary ? (
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "#F5F3F7" }}>
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "#6E6780" }}>
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Résumé IA
              </p>
              <p className="line-clamp-3 text-[12px] leading-snug" style={{ color: "var(--text-main)" }}>{doc.ai.summary}</p>
            </div>
          ) : null}
          <SignDocumentButton documentId={doc.id} title={title} mimeType={doc.mimeType} variant="soft" />
        </div>

        {/* ── Section 2 — Classement éditable ── */}
        <div className="space-y-2.5">
          <SectionTitle icon={FolderInput}>Classement</SectionTitle>
          <Field label="Correspondant">
            <AutocompleteInput endpoint="/api/autocomplete/correspondents" value={corrName} onChange={onCorr} allowCreate onCreate={(n) => void onCreateCorr(n)} placeholder="Rechercher un correspondant…" disabled={busy} />
          </Field>
          <DocumentSecondaryCorrespondents documentId={doc.id} suggestions={doc.ai?.secondaryCorrespondentNames ?? []} />
          <Field label="Type de document">
            <AutocompleteInput endpoint="/api/autocomplete/document-types" value={typeName} onChange={onType} allowCreate onCreate={(n) => void onCreateType(n)} placeholder="Rechercher un type…" disabled={busy} />
          </Field>
          <div>
            <span className="mb-1 block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Tags</span>
            <DocumentTagsEditor
              documentId={doc.id}
              initialTags={doc.tags.filter((t): t is { id: number; name: string; color?: string; text_color?: string } => typeof t.id === "number")}
              user={user}
              onSaved={() => router.refresh()}
              onStatus={flash}
            />
          </div>
          <Field label="Dossier / projet">
            <AutocompleteInput endpoint="/api/autocomplete/projects" value={folderName} onChange={onFolder} allowCreate onCreate={(n) => void onCreateFolder(n)} placeholder="Ajouter à un dossier…" disabled={busy} />
          </Field>
          <Field label="Date du document">
            <input type="date" value={dateInput} onChange={(e) => void saveDate(e.target.value)} disabled={busy} className="h-9 w-full rounded-xl border px-3 text-xs font-medium outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
          </Field>
        </div>

        {/* ── Section 3 — Budget ── */}
        <div>
          <SectionTitle icon={Wallet}>Budget / finances</SectionTitle>
          <DocumentBudgetLine documentId={doc.id} defaultLabel={title} aiAmount={doc.amount ? { amount: doc.amount.amount, currency: doc.amount.currency } : null} />
        </div>

        {/* ── Section 4 — Actions IA ── */}
        <div>
          <SectionTitle icon={Sparkles}>Actions IA</SectionTitle>
          <DocumentAiActions
            documentId={doc.id}
            user={user}
            onOpenSheet={() => setFiche(true)}
            onChanged={() => router.refresh()}
          />
        </div>

        {/* ── Section 5 — Notes ── */}
        <div>
          <SectionTitle icon={Notebook}>Notes</SectionTitle>
          <DocumentNotesEditor documentId={doc.id} />
        </div>

        {/* ── Section 6 — Rappels / Calendrier ── */}
        <div className="space-y-3">
          <div>
            <SectionTitle icon={Bell}>Rappels</SectionTitle>
            <DocumentReminders documentId={doc.id} />
          </div>
          <div>
            <SectionTitle icon={CalendarClock}>Rendez-vous</SectionTitle>
            <DocumentCalendarCard documentId={doc.id} docTitle={title} detectedDates={doc.ai?.dates ?? []} />
          </div>
        </div>
      </div>

      {fiche ? <DocumentAiSheet doc={doc} onClose={() => setFiche(false)} onApplied={() => router.refresh()} /> : null}
    </div>
  );
}

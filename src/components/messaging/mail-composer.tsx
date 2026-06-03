"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Clock, Loader2, Minus, Paperclip, Search, Send, Upload, X } from "lucide-react";
import { RichTextEditor } from "@/components/messaging/rich-text-editor";
import { RecipientInput, type Recipient } from "@/components/messaging/recipient-input";
import { MailGedPickerPanel } from "@/components/messaging/mail-ged-picker-panel";
import {
  closeComposer,
  setComposerMinimized,
  useComposer,
  type ComposerInitial,
} from "@/lib/messaging/mail-composer-store";

/** Valeur `min` du datetime-local (maintenant, fuseau local). */
function nowLocal() {
  const d = new Date(Date.now() + 5 * 60_000);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/** Pièce jointe du composer : document GED existant ou fichier local importé. */
type Att =
  | { key: string; kind: "ged"; documentId: number; name: string }
  | { key: string; kind: "local"; name: string; filename: string; mimeType: string; contentBase64: string; gedStatus: "importing" | "imported" | "error" };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function ComposerWindow({ initial, minimized }: { initial: ComposerInitial; minimized: boolean }) {
  const [recipients, setRecipients] = useState<Recipient[]>(() =>
    initial.to ? initial.to.split(",").map((e) => ({ email: e.trim() })).filter((r) => r.email) : [],
  );
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [attachments, setAttachments] = useState<Att[]>(() =>
    (initial.attachments ?? []).map((a) => ({ key: `ged-${a.documentId}`, kind: "ged" as const, documentId: a.documentId, name: a.name })),
  );
  const [showPicker, setShowPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef(initial.bodyHtml ?? "");
  const [signatures, setSignatures] = useState<{ id: string; name: string; html: string; isDefault: boolean }[]>([]);
  const [selectedSig, setSelectedSig] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const appliedSigRef = useRef("");
  const [sender, setSender] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduledMsg, setScheduledMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const threadId = initial.threadId;
  const inReplyTo = initial.inReplyTo;
  const toStr = recipients.map((r) => r.email).join(", ");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/messaging/gmail/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d) setSender(d.email ?? d.account?.email ?? d.account?.emailAddress ?? null); })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Signatures : chargement + insertion auto de la signature par défaut sur un nouveau mail.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/messaging/signatures", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.signatures) return;
        setSignatures(d.signatures);
        if (!threadId) {
          const def = d.signatures.find((s: { isDefault: boolean }) => s.isDefault);
          if (def) {
            setSelectedSig(def.id);
            applySignature(def.html);
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hasContent() {
    return Boolean(recipients.length > 0 || subject.trim() || attachments.length > 0 || bodyRef.current.replace(/<[^>]*>/g, "").trim());
  }

  async function saveDraft() {
    if (!hasContent()) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/messaging/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          draftId: draftId ?? undefined,
          to: toStr || "brouillon@local",
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim() || "(sans objet)",
          body: bodyRef.current,
          threadId,
          inReplyTo,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({}));
      const newId = data?.draft?.id ?? data?.id ?? data?.draftId ?? null;
      if (newId) setDraftId(newId);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveDraft(), 1200);
  }

  function onBody(html: string) {
    bodyRef.current = html;
    scheduleSave();
  }

  /** Insère/remplace la signature en bas du corps (anti-doublon par bloc exact). */
  function applySignature(htmlSig: string) {
    let body = bodyRef.current;
    if (appliedSigRef.current && body.includes(appliedSigRef.current)) {
      body = body.replace(appliedSigRef.current, "");
    }
    const block = htmlSig ? `<br><br><div data-ged-sig>${htmlSig}</div>` : "";
    bodyRef.current = body + block;
    appliedSigRef.current = block;
    setEditorKey((k) => k + 1);
    scheduleSave();
  }

  function addGedDocs(docs: { documentId: number; name: string }[]) {
    setAttachments((prev) => {
      const seen = new Set(prev.flatMap((a) => (a.kind === "ged" ? [a.documentId] : [])));
      const add: Att[] = docs
        .filter((d) => !seen.has(d.documentId))
        .map((d) => ({ key: `ged-${d.documentId}`, kind: "ged", documentId: d.documentId, name: d.name }));
      return [...prev, ...add];
    });
  }

  function removeAttachment(key: string) {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  }

  /** Fichier local → joint directement au mail + import GED en arrière-plan. */
  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      const key = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let contentBase64 = "";
      try {
        contentBase64 = await fileToBase64(file);
      } catch {
        continue;
      }
      setAttachments((prev) => [
        ...prev,
        { key, kind: "local", name: file.name, filename: file.name, mimeType: file.type || "application/octet-stream", contentBase64, gedStatus: "importing" },
      ]);
      const fd = new FormData();
      fd.append("document", file);
      fetch("/api/documents/import", { method: "POST", credentials: "include", body: fd })
        .then((r) => setAttachments((prev) => prev.map((a) => (a.key === key && a.kind === "local" ? { ...a, gedStatus: r.ok ? "imported" : "error" } : a))))
        .catch(() => setAttachments((prev) => prev.map((a) => (a.key === key && a.kind === "local" ? { ...a, gedStatus: "error" } : a))));
    }
  }

  async function send() {
    if (!toStr || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: toStr,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim() || "(sans objet)",
          body: bodyRef.current,
          attachmentDocIds: attachments.flatMap((a) => (a.kind === "ged" ? [a.documentId] : [])),
          attachments: attachments.flatMap((a) =>
            a.kind === "local" ? [{ filename: a.filename, mimeType: a.mimeType, contentBase64: a.contentBase64 }] : [],
          ),
          threadId,
          inReplyTo,
          draftId: draftId ?? undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || e.error || "Envoi impossible.");
      }
      setSent(true);
      window.setTimeout(() => closeComposer(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }

  async function schedule() {
    if (!toStr || !scheduleAt || sending) return;
    setSending(true);
    setError(null);
    try {
      const iso = new Date(scheduleAt).toISOString();
      const res = await fetch("/api/messaging/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to: toStr,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim() || "(sans objet)",
          bodyHtml: bodyRef.current,
          scheduledAt: iso,
          threadId,
          inReplyTo,
          draftId: draftId ?? undefined,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Programmation impossible.");
      }
      setScheduledMsg("Envoi programmé ✓");
      window.setTimeout(() => closeComposer(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Programmation impossible.");
    } finally {
      setSending(false);
    }
  }

  const statusLabel =
    status === "saving" ? "Enregistrement…" : status === "saved" ? "Brouillon enregistré" : status === "error" ? "Erreur d'enregistrement" : "";

  /* ── Barre réduite ── */
  if (minimized) {
    return (
      <div className="fixed bottom-0 right-4 z-[80] flex w-[280px] items-center justify-between gap-2 rounded-t-xl border border-b-0 px-3 py-2 shadow-2xl" style={{ borderColor: "var(--border)", background: "var(--accent)" }}>
        <button type="button" onClick={() => setComposerMinimized(false)} className="min-w-0 flex-1 truncate text-left text-[13px] font-bold text-white">
          {subject.trim() || "Nouveau message"}
        </button>
        <button type="button" onClick={() => closeComposer()} aria-label="Fermer" className="text-white/90 hover:text-white"><X className="h-4 w-4" strokeWidth={2} /></button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-4 z-[80] flex max-h-[80vh] w-[440px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-t-2xl border border-b-0 bg-white shadow-2xl" style={{ borderColor: "var(--border)" }}>
      {/* En-tête */}
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: "var(--accent)" }}>
        <span className="text-[13px] font-bold text-white">{threadId ? "Répondre" : "Nouveau message"}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setComposerMinimized(true)} aria-label="Réduire" className="flex h-6 w-6 items-center justify-center rounded text-white/90 hover:bg-white/15 hover:text-white"><Minus className="h-4 w-4" strokeWidth={2} /></button>
          <button type="button" onClick={() => closeComposer()} aria-label="Fermer" className="flex h-6 w-6 items-center justify-center rounded text-white/90 hover:bg-white/15 hover:text-white"><X className="h-4 w-4" strokeWidth={2} /></button>
        </div>
      </div>

      {/* Corps */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        <Field label="Expéditeur">
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{sender ?? "Compte Gmail connecté"}</span>
        </Field>
        <Field label="À">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <RecipientInput value={recipients} onChange={(r) => { setRecipients(r); scheduleSave(); }} placeholder="Nom ou email…" />
            </div>
            <button type="button" onClick={() => setShowCc((v) => !v)} className="mt-0.5 shrink-0 text-[11px] font-bold" style={{ color: showCc ? "var(--accent)" : "var(--text-hint)" }}>Cc/Cci</button>
          </div>
        </Field>
        {showCc ? (
          <>
            <Field label="Cc">
              <input value={cc} onChange={(e) => { setCc(e.target.value); scheduleSave(); }} placeholder="cc@exemple.com" className="w-full bg-transparent text-[13px] outline-none" style={{ color: "var(--text-main)" }} />
            </Field>
            <Field label="Cci">
              <input value={bcc} onChange={(e) => { setBcc(e.target.value); scheduleSave(); }} placeholder="cci@exemple.com" className="w-full bg-transparent text-[13px] outline-none" style={{ color: "var(--text-main)" }} />
            </Field>
          </>
        ) : null}
        <Field label="Objet">
          <input value={subject} onChange={(e) => { setSubject(e.target.value); scheduleSave(); }} placeholder="Objet du message" className="w-full bg-transparent text-[13px] font-semibold outline-none" style={{ color: "var(--text-main)" }} />
        </Field>

        <RichTextEditor key={editorKey} initialHtml={bodyRef.current} onChange={onBody} placeholder="Rédigez votre message…" />

        {/* Ajout de pièces jointes : depuis la GED ou depuis l'ordinateur (importé dans la GED) */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowPicker(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <Search className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Joindre depuis la GED
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
            <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Ajouter une pièce jointe
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />

          {signatures.length > 0 ? (
            <select
              value={selectedSig}
              onChange={(e) => {
                setSelectedSig(e.target.value);
                const s = signatures.find((x) => x.id === e.target.value);
                applySignature(s ? s.html : "");
              }}
              title="Insérer une signature"
              className="h-8 rounded-lg border px-2 text-[11.5px] font-bold outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <option value="">Signature…</option>
              {signatures.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (défaut)" : ""}</option>
              ))}
            </select>
          ) : (
            <a href="/messagerie/parametres" className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              + Signature
            </a>
          )}
        </div>

        {attachments.length > 0 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Pièces jointes ({attachments.length})</p>
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li key={a.key} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)" }}>
                  <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px]" style={{ color: "var(--text-main)" }} title={a.name}>{a.name}</span>
                    <span className="block truncate text-[10px]" style={{ color: a.kind === "local" && a.gedStatus === "error" ? "var(--danger)" : "var(--text-hint)" }}>
                      {a.kind === "ged"
                        ? "Document GED"
                        : a.gedStatus === "importing"
                          ? "Importé depuis votre ordinateur · Import GED en cours…"
                          : a.gedStatus === "imported"
                            ? "Importé depuis votre ordinateur · Importé dans la GED"
                            : "Importé depuis votre ordinateur · Import GED échoué (joint au mail)"}
                    </span>
                  </span>
                  {a.kind === "local" && a.gedStatus === "importing" ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" aria-hidden="true" /> : null}
                  {a.kind === "ged" ? (
                    <a href={`/documents/${a.documentId}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-[10.5px] font-bold" style={{ color: "var(--accent)" }}>Ouvrir</a>
                  ) : null}
                  <button type="button" onClick={() => removeAttachment(a.key)} aria-label={`Retirer ${a.name}`} className="shrink-0 text-slate-400 hover:text-slate-700">
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {scheduleOpen ? (
          <div className="flex items-center gap-2 rounded-xl border p-2.5" style={{ borderColor: "var(--border)", background: "#FCFAF7" }}>
            <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
            <input type="datetime-local" min={nowLocal()} value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-8 flex-1 rounded-lg border px-2 text-[12.5px] outline-none" style={{ borderColor: "var(--border)" }} />
            <button type="button" onClick={() => void schedule()} disabled={!scheduleAt || sending} className="inline-flex h-8 items-center rounded-[20px] px-3 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Programmer</button>
          </div>
        ) : null}

        {error ? <p className="text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
        {scheduledMsg ? <p className="text-[12px] font-semibold" style={{ color: "var(--success)" }}>{scheduledMsg}</p> : null}
        {sent ? <p className="text-[12px] font-semibold" style={{ color: "var(--success)" }}>Message envoyé ✓</p> : null}
      </div>

      {/* Pied : actions */}
      <div className="flex items-center justify-between gap-2 border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => void send()} disabled={sending || !toStr} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
            {sending && !scheduleOpen ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2} />}
            Envoyer
          </button>
          <button type="button" onClick={() => setScheduleOpen((v) => !v)} title="Programmer l'envoi" aria-label="Programmer l'envoi" className="inline-flex h-9 items-center gap-1.5 rounded-[20px] border-[1.5px] px-3 text-[12.5px] font-bold transition hover:bg-[#FCFAF7]" style={{ borderColor: "#374151", color: "#374151" }}>
            <Clock className="h-4 w-4" strokeWidth={2} />
            Programmer
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} title={attachments.length ? `${attachments.length} pièce(s) jointe(s)` : "Ajouter une pièce jointe"} aria-label="Ajouter une pièce jointe" className="relative flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-[#FCFAF7]" style={{ color: attachments.length ? "var(--accent)" : "var(--text-muted)" }}>
            <Paperclip className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {attachments.length ? <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: "var(--accent)" }}>{attachments.length}</span> : null}
          </button>
        </div>
        <span className="truncate text-[11px]" style={{ color: status === "error" ? "var(--danger)" : "var(--text-hint)" }}>{statusLabel}</span>
      </div>

      {showPicker ? <MailGedPickerPanel onClose={() => setShowPicker(false)} onAdd={addGedDocs} /> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b pb-1.5" style={{ borderColor: "var(--border-soft)" }}>
      <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Fenêtre globale « Nouveau message / Répondre » (montée dans AppShell). */
export function MailComposer() {
  const { open, minimized, seq, initial } = useComposer();
  if (!open) return null;
  return <ComposerWindow key={seq} initial={initial} minimized={minimized} />;
}

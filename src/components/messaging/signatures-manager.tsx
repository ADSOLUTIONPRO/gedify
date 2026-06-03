"use client";

import { useState } from "react";
import { Check, Code2, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { RichTextEditor } from "@/components/messaging/rich-text-editor";
import type { EmailSignature } from "@/lib/messaging/email-signature-store";

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-bold transition disabled:opacity-50";

type FormState = { name: string; mailbox: string; isDefault: boolean };

export function SignaturesManager({ initial }: { initial: EmailSignature[] }) {
  const [sigs, setSigs] = useState<EmailSignature[]>(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", mailbox: "", isDefault: false });
  const [html, setHtml] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [showHtml, setShowHtml] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function openNew() {
    setEditing("new");
    setForm({ name: "", mailbox: "", isDefault: sigs.length === 0 });
    setHtml("");
    setShowHtml(false);
    setEditorKey((k) => k + 1);
  }
  function openEdit(s: EmailSignature) {
    setEditing(s.id);
    setForm({ name: s.name, mailbox: s.mailbox ?? "", isDefault: s.isDefault });
    setHtml(s.html);
    setShowHtml(false);
    setEditorKey((k) => k + 1);
  }
  function cancel() {
    setEditing(null);
    setMsg(null);
  }

  async function save() {
    if (!form.name.trim()) { setMsg("Le nom est requis."); return; }
    setBusy(true);
    setMsg(null);
    try {
      const payload = { name: form.name.trim(), mailbox: form.mailbox.trim() || null, html, isDefault: form.isDefault };
      const res =
        editing === "new"
          ? await fetch("/api/messaging/signatures", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) })
          : await fetch(`/api/messaging/signatures/${editing}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => ({}))) as { signature?: EmailSignature; error?: string };
      if (!res.ok || !data.signature) { setMsg(data.error ?? "Échec de l'enregistrement."); return; }
      await refresh();
      setEditing(null);
    } catch {
      setMsg("Échec de l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const res = await fetch("/api/messaging/signatures", { credentials: "include", cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { signatures?: EmailSignature[] };
    if (Array.isArray(data.signatures)) setSigs(data.signatures);
  }

  async function setDefault(id: string) {
    await fetch(`/api/messaging/signatures/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isDefault: true }) });
    await refresh();
  }
  async function remove(id: string) {
    await fetch(`/api/messaging/signatures/${id}`, { method: "DELETE", credentials: "include" });
    await refresh();
    if (editing === id) setEditing(null);
  }

  return (
    <div className="space-y-3">
      {/* Liste */}
      <ul className="space-y-2">
        {sigs.length === 0 ? (
          <li className="rounded-xl border px-3 py-3 text-[12.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            Aucune signature. Créez-en une pour l&apos;insérer automatiquement dans vos mails.
          </li>
        ) : (
          sigs.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--text-main)" }}>
                  {s.name}
                  {s.isDefault ? <span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>Par défaut</span> : null}
                </p>
                <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {s.mailbox ? `${s.mailbox} · ` : ""}{(s.html.replace(/<[^>]*>/g, "").trim() || "(vide)").slice(0, 70)}
                </p>
              </div>
              {!s.isDefault ? (
                <button type="button" onClick={() => void setDefault(s.id)} title="Définir par défaut" className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <Star className="h-3.5 w-3.5" strokeWidth={1.75} />
                </button>
              ) : null}
              <button type="button" onClick={() => openEdit(s)} className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Éditer
              </button>
              <button type="button" onClick={() => void remove(s.id)} title="Supprimer" className={btn} style={{ borderColor: "#FECACA", color: "#B91C1C" }}>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </li>
          ))
        )}
      </ul>

      {editing === null ? (
        <button type="button" onClick={openNew} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold text-white" style={{ background: "var(--accent)" }}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nouvelle signature
        </button>
      ) : (
        <div className="space-y-2.5 rounded-xl border p-3" style={{ borderColor: "var(--accent)", background: "#FFFDFD" }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom (ex : Pro, Perso…)" className="rounded-lg border px-2.5 py-1.5 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
            <input value={form.mailbox} onChange={(e) => setForm({ ...form, mailbox: e.target.value })} placeholder="Boîte associée (optionnel)" className="rounded-lg border px-2.5 py-1.5 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Contenu</p>
            <button type="button" onClick={() => { if (showHtml) setEditorKey((k) => k + 1); setShowHtml((v) => !v); }} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--accent)" }}>
              <Code2 className="h-3.5 w-3.5" strokeWidth={2} /> {showHtml ? "Éditeur visuel" : "Éditer le HTML"}
            </button>
          </div>

          {showHtml ? (
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={6} placeholder="<p>…</p>" className="w-full rounded-lg border px-2.5 py-2 font-mono text-[12px] outline-none" style={{ borderColor: "var(--border)" }} />
          ) : (
            <RichTextEditor key={editorKey} initialHtml={html} onChange={setHtml} placeholder="Votre signature (nom, coordonnées, lien…)" />
          )}

          {/* Aperçu */}
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Aperçu</p>
            <div className="rounded-lg border p-2.5 text-[13px]" style={{ borderColor: "var(--border)", background: "#fff", color: "var(--text-main)" }} dangerouslySetInnerHTML={{ __html: html || "<span style='color:#9ca3af'>(vide)</span>" }} />
          </div>

          <label className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
            Signature par défaut
          </label>

          {msg ? <p className="text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{msg}</p> : null}

          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] px-4 text-[13px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />} Enregistrer
            </button>
            <button type="button" onClick={cancel} className="inline-flex h-9 items-center gap-1.5 rounded-[20px] border-[1.5px] px-4 text-[13px] font-bold" style={{ borderColor: "#374151", color: "#374151" }}>
              <X className="h-4 w-4" strokeWidth={2.5} /> Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mail, Plus, Trash2, X } from "lucide-react";
import { initials } from "@/components/messaging/mail-list-utils";
import type { ContactVM } from "./contacts-workspace";

const BLUE = "#0a84ff";
const BLUE_LINK = "#0071e3";
const LINE = "#e6e6eb";
const MUTED = "#6e6e73";
const HINT = "#8e8e93";

const SOURCE_LABEL: Record<ContactVM["source"], string> = {
  google: "Contact Google",
  imap_email: "Détecté dans les emails",
  manual: "Contact manuel",
  correspondent: "Correspondant GEDify",
};

type Props = {
  contact: ContactVM | null;
  onSaved: (c: ContactVM) => void;
  onDeleted: (id: string) => void;
  /** Ouvre directement en mode édition (ex. contact tout juste créé). */
  startEditing?: boolean;
};

export function ContactDetailView({ contact, onSaved, onDeleted, startEditing = false }: Props) {
  const [editing, setEditing] = useState(startEditing && contact?.source !== "correspondent");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs éditables (initialisés depuis le contact ; le parent remonte via `key`).
  const [name, setName] = useState(contact?.name ?? "");
  const [org, setOrg] = useState(contact?.organization ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [emails, setEmails] = useState<string[]>(
    contact?.emails && contact.emails.length ? contact.emails : contact?.email ? [contact.email] : [""],
  );
  const [address, setAddress] = useState(contact?.address ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");

  if (!contact) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: HINT }}>
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "#eaf4ff", color: BLUE }}>
          <Mail className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-[15px] font-semibold" style={{ color: "#1d1d1f" }}>Aucun contact sélectionné</p>
        <p className="mt-1 text-[13px]">Choisissez un contact dans la liste pour voir sa fiche.</p>
      </div>
    );
  }

  const c = contact;
  const editable = c.source !== "correspondent";
  const subtitle = [c.organization, SOURCE_LABEL[c.source]].filter(Boolean).join(" · ");

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const cleanEmails = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resourceName: c.id,
          displayName: name.trim() || c.name,
          organization: org.trim() || null,
          phone: phone.trim() || null,
          emails: cleanEmails,
          email: cleanEmails[0] ?? null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
      onSaved({
        ...c,
        name: name.trim() || c.name,
        organization: org.trim() || null,
        phone: phone.trim() || null,
        emails: cleanEmails,
        email: cleanEmails[0] ?? null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer définitivement « ${c.name} » ?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts?resourceName=${encodeURIComponent(c.id)}`, { method: "DELETE", credentials: "include" });
      if (res.ok) onDeleted(c.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Barre d'actions */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-5" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-4">
          {editable && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-[15px] font-medium" style={{ color: BLUE }}>
              Modifier
            </button>
          )}
          {editing && (
            <>
              <button type="button" onClick={() => setEditing(false)} className="text-[15px]" style={{ color: BLUE }}>Annuler</button>
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 text-[15px] font-bold disabled:opacity-50" style={{ color: BLUE }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Enregistrer
              </button>
            </>
          )}
        </div>
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 lg:px-10">
        {/* En-tête profil */}
        <div className="mb-7 flex items-center gap-6">
          <span
            className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-full text-[32px] font-extrabold"
            style={{ background: "linear-gradient(#eaf4ff,#d7eaff)", color: BLUE }}
          >
            {initials(c.name)}
          </span>
          <div className="min-w-0">
            <h1 className="text-[32px] font-extrabold leading-tight" style={{ color: "#1d1d1f" }}>{c.name}</h1>
            {!editing && subtitle ? <p className="mt-0.5 text-[15px]" style={{ color: MUTED }}>{subtitle}</p> : null}
            {editing ? <p className="mt-0.5 text-[15px]" style={{ color: MUTED }}>Modifiez les informations du contact.</p> : null}
          </div>
        </div>

        {!editing ? (
          /* ─────────── VUE CONSULTATION ─────────── */
          <div className="max-w-[760px]">
            {/* Actions rapides */}
            <div className="mb-7 flex flex-wrap gap-2.5">
              {c.phone ? <QuickLink href={`tel:${c.phone}`}>Appeler</QuickLink> : null}
              {c.email ? <QuickLink href={`mailto:${c.email}`}>Envoyer un e-mail</QuickLink> : null}
              <QuickLink href="/rappels">Créer une tâche</QuickLink>
              {c.correspondentId ? <QuickLink href={`/documents?correspondent=${c.correspondentId}`}>Voir les documents liés</QuickLink> : null}
            </div>

            {c.phone ? (
              <InfoSection title="Téléphone">
                <ValueRow label="Mobile" value={c.phone} />
              </InfoSection>
            ) : null}

            {c.emails.length > 0 || c.email ? (
              <InfoSection title="Adresse e-mail">
                {(c.emails.length ? c.emails : [c.email!]).map((e) => (
                  <ValueRow key={e} label="Bureau" value={<span style={{ color: BLUE_LINK }}>{e}</span>} />
                ))}
              </InfoSection>
            ) : null}

            {c.address ? (
              <InfoSection title="Adresse">
                <ValueRow label="Bureau" value={<span className="whitespace-pre-line">{c.address}</span>} />
              </InfoSection>
            ) : null}

            {c.source === "correspondent" && c.documentCount != null ? (
              <InfoSection title="Documents">
                <Link href={`/documents?correspondent=${c.correspondentId}`} className="inline-flex items-center gap-1 text-[14px] font-semibold" style={{ color: BLUE_LINK }}>
                  {c.documentCount} document(s) lié(s) <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </InfoSection>
            ) : null}

            {c.notes ? (
              <InfoSection title="Notes">
                <div className="rounded-xl border p-3.5 text-[14px] leading-relaxed" style={{ borderColor: "#eee", background: "#f8f9fb", color: "#1d1d1f" }}>
                  {c.notes}
                </div>
              </InfoSection>
            ) : null}

            {!c.phone && !c.email && c.emails.length === 0 && !c.address && !c.notes ? (
              <p className="text-[14px]" style={{ color: HINT }}>Aucune coordonnée enregistrée pour ce contact.</p>
            ) : null}
          </div>
        ) : (
          /* ─────────── MODE ÉDITION ─────────── */
          <div className="max-w-[760px]">
            <EditSection>
              <Field value={name} onChange={setName} placeholder="Nom complet" />
              <Field value={org} onChange={setOrg} placeholder="Société" />
            </EditSection>

            <EditSection title="Téléphone">
              <FieldRow label="Mobile"><Field value={phone} onChange={setPhone} placeholder="+33 6 12 34 56 78" /></FieldRow>
            </EditSection>

            <EditSection
              title="Adresse e-mail"
              onAdd={() => setEmails((prev) => [...prev, ""])}
            >
              {emails.map((e, i) => (
                <FieldRow key={i} label="Bureau">
                  <div className="flex items-center gap-2">
                    <Field value={e} onChange={(v) => setEmails((prev) => prev.map((x, j) => (j === i ? v : x)))} placeholder="nom@exemple.com" />
                    {emails.length > 1 ? (
                      <button type="button" onClick={() => setEmails((prev) => prev.filter((_, j) => j !== i))} className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ color: "#ff3b30" }} aria-label="Retirer">
                        <X className="h-4 w-4" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                </FieldRow>
              ))}
            </EditSection>

            <EditSection title="Adresse">
              <textarea
                value={address}
                onChange={(ev) => setAddress(ev.target.value)}
                placeholder="Rue, code postal, ville, pays"
                className="min-h-[88px] w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none focus:border-[#0a84ff]"
                style={{ borderColor: LINE }}
              />
            </EditSection>

            <EditSection title="Notes">
              <textarea
                value={notes}
                onChange={(ev) => setNotes(ev.target.value)}
                placeholder="Notes libres…"
                className="min-h-[120px] w-full rounded-[10px] border px-3 py-2.5 text-[14px] outline-none focus:border-[#0a84ff]"
                style={{ borderColor: LINE }}
              />
            </EditSection>

            <div className="border-t py-5" style={{ borderColor: "#eee" }}>
              <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex items-center gap-1.5 text-[14px] font-semibold disabled:opacity-50" style={{ color: "#ff3b30" }}>
                <Trash2 className="h-4 w-4" strokeWidth={1.85} /> Supprimer le contact
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sous-composants ── */

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-[10px] border px-3.5 py-2 text-[14px] font-semibold transition hover:opacity-90" style={{ borderColor: "#cfe4fb", background: "#f5faff", color: BLUE_LINK }}>
      {children}
    </Link>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t py-[18px] sm:grid-cols-[150px_1fr]" style={{ borderColor: "#eee" }}>
      <h3 className="text-[15px]" style={{ color: MUTED }}>{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function ValueRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3.5 text-[15px]" style={{ color: "#1d1d1f" }}>
      <span style={{ color: HINT }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function EditSection({ title, onAdd, children }: { title?: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <div className="border-t py-[18px]" style={{ borderColor: "#eee" }}>
      {title ? (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[18px] font-bold" style={{ color: "#1d1d1f" }}>{title}</h3>
          {onAdd ? (
            <button type="button" onClick={onAdd} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ color: BLUE }} aria-label={`Ajouter ${title}`}>
              <Plus className="h-4 w-4" strokeWidth={2.25} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr] sm:items-center">
      <span className="text-[13px]" style={{ color: HINT }}>{label}</span>
      {children}
    </div>
  );
}

function Field({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-[42px] w-full rounded-[10px] border px-3 text-[14px] outline-none focus:border-[#0a84ff]"
      style={{ borderColor: LINE }}
    />
  );
}

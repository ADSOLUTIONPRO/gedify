"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ContactRound, Eye, EyeOff, Link2, Loader2, Pencil, Phone, Unlink, UserPlus, X } from "lucide-react";
import type { EmailContactRecord } from "@/lib/messaging/email-types";

type Corr = { id: number; name: string };
type Draft = { displayName: string; email: string; phone: string; organization: string };

const btn = "inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition disabled:opacity-50";

function statusPill(c: EmailContactRecord): { label: string; bg: string; color: string } {
  switch (c.status) {
    case "linked": return { label: "Lié", bg: "#DCFCE7", color: "#15803D" };
    case "suggested": return { label: `Suggestion ${Math.round((c.suggestedScore ?? 0) * 100)}%`, bg: "#F3E8FF", color: "#7E22CE" };
    case "ignored": return { label: "Ignoré", bg: "#F1F5F9", color: "#64748B" };
    default: return { label: "Nouveau", bg: "#FEF3C7", color: "#B45309" };
  }
}

/**
 * Liste de contacts Google interactive : relier / délier / créer un correspondant
 * GED (P6) + édition locale des champs (P7). L'écriture est locale à la GED.
 */
export function ContactsList({ initialContacts, correspondents }: { initialContacts: EmailContactRecord[]; correspondents: Corr[] }) {
  const [contacts, setContacts] = useState<EmailContactRecord[]>(initialContacts);
  const corrName = new Map(correspondents.map((c) => [c.id, c.name]));
  const [busy, setBusy] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ displayName: "", email: "", phone: "", organization: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(action: string, payload: Record<string, unknown>) {
    setBusy(payload.resourceName as string);
    setMsg(null);
    try {
      const res = await fetch("/api/messaging/google/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as { contact?: EmailContactRecord; correspondent?: Corr; error?: string; message?: string };
      if (res.ok && data.contact) {
        const updated = data.contact;
        if (data.correspondent) corrName.set(data.correspondent.id, data.correspondent.name);
        setContacts((prev) => prev.map((c) => (c.resourceName === updated.resourceName ? updated : c)));
        setPickerFor(null);
        setEditFor(null);
      } else {
        setMsg(data.message ?? data.error ?? "Action impossible.");
      }
    } catch {
      setMsg("Action impossible (réseau).");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(c: EmailContactRecord) {
    setEditFor(c.resourceName);
    setDraft({ displayName: c.displayName ?? "", email: c.email ?? "", phone: c.phone ?? "", organization: c.organization ?? "" });
  }

  if (contacts.length === 0) {
    return <p className="px-5 py-6 text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun contact dans cette vue.</p>;
  }

  return (
    <>
      {msg ? <p className="mb-2 rounded-lg border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}>{msg}</p> : null}
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {contacts.map((c) => {
          const pill = statusPill(c);
          const isBusy = busy === c.resourceName;
          const editing = editFor === c.resourceName;
          const suggestedName = c.suggestedCorrespondentId ? corrName.get(c.suggestedCorrespondentId) : null;
          return (
            <li key={c.resourceName} className="px-5 py-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <ContactRound className="h-4 w-4" strokeWidth={1.75} />
                </span>

                {editing ? (
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="Nom" className="w-full rounded-lg border px-2 py-1 text-[13px] outline-none" style={{ borderColor: "var(--border)" }} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="Email" className="rounded-lg border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--border)" }} />
                      <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="Téléphone" className="rounded-lg border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--border)" }} />
                    </div>
                    <input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} placeholder="Société" className="w-full rounded-lg border px-2 py-1 text-[12px] outline-none" style={{ borderColor: "var(--border)" }} />
                    <div className="flex gap-1.5">
                      <button type="button" disabled={isBusy} onClick={() => void patch("edit", { resourceName: c.resourceName, patch: { displayName: draft.displayName, email: draft.email || null, phone: draft.phone || null, organization: draft.organization || null } })} className={btn} style={{ borderColor: "var(--accent)", color: "#fff", background: "var(--accent)" }}>
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={2.5} />} Enregistrer
                      </button>
                      <button type="button" onClick={() => setEditFor(null)} className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}><X className="h-3 w-3" strokeWidth={2.5} /> Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: "var(--text-main)" }}>{c.displayName || "(sans nom)"}</p>
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {c.email ?? "(sans email)"}{c.organization ? ` · ${c.organization}` : ""}
                    </p>
                    {c.phone ? (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        <Phone className="h-3 w-3" strokeWidth={2} />{c.phone}
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: pill.bg, color: pill.color }}>{pill.label}</span>
                  {!editing ? (
                    <button type="button" onClick={() => startEdit(c)} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
                      <Pencil className="h-3 w-3" strokeWidth={2} /> Éditer
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Ligne d'actions de liaison */}
              {!editing ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12">
                  {c.status === "ignored" ? (
                    <button type="button" disabled={isBusy} onClick={() => void patch("restore", { resourceName: c.resourceName })} className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                      <Eye className="h-3 w-3" strokeWidth={2} /> Réafficher
                    </button>
                  ) : c.status === "linked" && c.correspondentId ? (
                    <>
                      <Link href={`/correspondants/${c.correspondentId}`} className={btn} style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                        <Link2 className="h-3 w-3" strokeWidth={2} /> {corrName.get(c.correspondentId) ?? "Voir le correspondant"}
                      </Link>
                      <button type="button" disabled={isBusy} onClick={() => void patch("unlink", { resourceName: c.resourceName })} className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                        <Unlink className="h-3 w-3" strokeWidth={2} /> Délier
                      </button>
                    </>
                  ) : (
                    <>
                      {suggestedName ? (
                        <button type="button" disabled={isBusy} onClick={() => void patch("link", { resourceName: c.resourceName, correspondentId: c.suggestedCorrespondentId })} className={btn} style={{ borderColor: "var(--accent)", color: "#fff", background: "var(--accent)" }}>
                          {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" strokeWidth={2.5} />} Relier à {suggestedName}
                        </button>
                      ) : null}
                      {pickerFor === c.resourceName ? (
                        <select
                          autoFocus
                          defaultValue=""
                          onChange={(e) => e.target.value && void patch("link", { resourceName: c.resourceName, correspondentId: Number(e.target.value) })}
                          className="h-7 rounded-lg border px-1.5 text-[11px] outline-none"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <option value="" disabled>Choisir un correspondant…</option>
                          {correspondents.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
                        </select>
                      ) : (
                        <button type="button" onClick={() => setPickerFor(c.resourceName)} className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                          <Link2 className="h-3 w-3" strokeWidth={2} /> Relier à…
                        </button>
                      )}
                      <button type="button" disabled={isBusy} onClick={() => void patch("create-correspondent", { resourceName: c.resourceName, name: c.displayName || c.email || "Correspondant" })} className={btn} style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                        <UserPlus className="h-3 w-3" strokeWidth={2} /> Créer le correspondant
                      </button>
                    </>
                  )}
                  {c.status !== "ignored" ? (
                    <button type="button" disabled={isBusy} onClick={() => void patch("ignore", { resourceName: c.resourceName })} title="Masquer ce correspondant" className={btn} style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                      <EyeOff className="h-3 w-3" strokeWidth={2} /> Masquer
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

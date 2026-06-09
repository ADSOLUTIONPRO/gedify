"use client";

import { useState } from "react";
import { FolderTree, Info, Loader2, Lock, Mail, PenSquare, RefreshCw, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { GmailFolderPrefs } from "@/components/mail-connector/gmail-folder-prefs";
import { ACCOUNT_COLORS, relativeTime, statusMeta, SYNC_OPTIONS, type MailAccountVM, type SignatureVM } from "./types";

type Tab = "info" | "sync" | "send" | "signature" | "folders" | "security";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "info", label: "Informations", icon: Info },
  { key: "sync", label: "Synchronisation", icon: RefreshCw },
  { key: "send", label: "Envoi", icon: Send },
  { key: "signature", label: "Signature", icon: PenSquare },
  { key: "folders", label: "Dossiers et labels", icon: FolderTree },
  { key: "security", label: "Sécurité", icon: ShieldCheck },
];

type Props = {
  account: MailAccountVM;
  signatures: SignatureVM[];
  busy: boolean;
  onClose: () => void;
  onPatch: (fields: Record<string, unknown>) => Promise<void> | void;
  onSync: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onDelete: () => void;
  onSignaturesChanged: () => void;
};

export function MailAccountDetailsPanel(props: Props) {
  const { account, onClose } = props;
  const [tab, setTab] = useState<Tab>("info");
  const sm = statusMeta(account.status);
  const color = account.color ?? "#F75C8D";

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: color }} aria-hidden="true">
            {(account.name || account.email)[0]?.toUpperCase() ?? "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{account.email}</p>
            <p className="flex items-center gap-1.5 truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
              {account.providerLabel} · {account.name}
              <span className="inline-flex items-center gap-1 rounded-full px-1.5 text-[10.5px] font-bold" style={{ color: sm.color }}>● {sm.label}</span>
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer le panneau" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100">
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Onglets (grille compacte, actif = rose clair + indicateur) */}
      <div className="grid grid-cols-3 gap-1 border-b p-2" style={{ borderColor: "var(--border-soft)" }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="relative inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition"
              style={{ background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              {active ? <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" /> : null}
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "info" ? <InfoSection {...props} /> : null}
        {tab === "sync" ? <SyncSection {...props} /> : null}
        {tab === "send" ? <SendSection {...props} /> : null}
        {tab === "signature" ? <SignatureSection {...props} /> : null}
        {tab === "folders" ? <FoldersSection account={account} /> : null}
        {tab === "security" ? <SecuritySection {...props} /> : null}
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[12px] font-semibold" style={{ color: "var(--text-main)" }}>{children}</p>;
}
const inputCls = "h-9 w-full rounded-lg border px-2.5 text-[13px] outline-none focus:border-[var(--accent)]";

function InfoSection({ account, busy, onPatch }: Props) {
  const [name, setName] = useState(account.name);
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Nom affiché</FieldLabel>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={{ borderColor: "var(--border)" }} />
          <button type="button" disabled={busy || name === account.name} onClick={() => void onPatch({ name })} className="inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>Enregistrer</button>
        </div>
      </div>
      <div>
        <FieldLabel>Adresse email</FieldLabel>
        <input value={account.email} readOnly className={`${inputCls} opacity-70`} style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel>Fournisseur</FieldLabel><p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{account.providerLabel}</p></div>
        <div><FieldLabel>Authentification</FieldLabel><p className="text-[13px]" style={{ color: "var(--text-muted)" }}>{account.authLabel}</p></div>
      </div>
      <div>
        <FieldLabel>Couleur du compte</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Couleur ${c}`} onClick={() => void onPatch({ color: c })} className="flex h-7 w-7 items-center justify-center rounded-full transition hover:scale-110" style={{ background: c, outline: (account.color ?? "#F75C8D") === c ? "2px solid var(--text-main)" : "none", outlineOffset: "2px" }}>
              {(account.color ?? "#F75C8D") === c ? <span className="text-[11px] font-bold text-white">✓</span> : null}
            </button>
          ))}
        </div>
      </div>
      <ToggleRow label="Boîte par défaut" description="Utilisée par défaut pour l'envoi de nouveaux emails." checked={account.isDefault} disabled={busy} onChange={() => void onPatch({ isDefault: !account.isDefault })} />
    </div>
  );
}

function SyncSection({ account, busy, onPatch, onSync }: Props) {
  return (
    <div className="space-y-4">
      <ToggleRow label="Synchronisation activée" description="Récupérer automatiquement les nouveaux messages." checked={account.isActive} disabled={busy} onChange={() => void onPatch({ isActive: !account.isActive })} />
      <div>
        <FieldLabel>Fréquence</FieldLabel>
        <select value={account.syncIntervalMinutes} onChange={(e) => void onPatch({ syncIntervalMinutes: Number(e.target.value) })} className={inputCls} style={{ borderColor: "var(--border)" }}>
          {SYNC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12.5px]">
        <InfoLine label="Dernière synchronisation" value={relativeTime(account.lastSyncAt)} />
        <InfoLine label="Dernier succès" value={relativeTime(account.lastSuccessAt)} />
        <InfoLine label="Messages récupérés" value={account.messages != null ? account.messages.toLocaleString("fr-FR") : "—"} />
        <InfoLine label="Dossier surveillé" value={account.watchedFolder} />
      </div>
      {account.lastError ? <p className="rounded-lg border px-2.5 py-1.5 text-[12px]" style={{ borderColor: "#FDE68A", background: "#FFF7ED", color: "#9A3412" }}>Dernière erreur : {account.lastError}</p> : null}
      <button type="button" disabled={busy} onClick={onSync} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={2} />} Synchroniser maintenant
      </button>
    </div>
  );
}

function SendSection({ account, busy, onPatch }: Props) {
  return (
    <div className="space-y-4">
      <InfoLine label="Autoriser l'envoi" value={account.canSend ? "Oui" : "Non (envoi non configuré)"} />
      <InfoLine label="Nom de l'expéditeur" value={account.name} />
      <InfoLine label="Adresse d'envoi" value={account.email} />
      <ToggleRow label="Boîte d'envoi par défaut" description="Sélectionnée par défaut dans la fenêtre de rédaction." checked={account.isDefault} disabled={busy} onChange={() => void onPatch({ isDefault: !account.isDefault })} />
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Le compte sélectionné détermine le fournisseur d&apos;envoi (OAuth / SMTP), la signature et les dossiers Envoyés / Brouillons.</p>
    </div>
  );
}

function SignatureSection({ account, signatures, busy, onSignaturesChanged }: Props) {
  const mine = signatures.filter((s) => (s.mailbox ?? "").toLowerCase() === account.email.toLowerCase());
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await fetch("/api/messaging/signatures", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), html, mailbox: account.email }) }).catch(() => {});
      setName(""); setHtml("");
      onSignaturesChanged();
    } finally { setSaving(false); }
  }
  async function remove(id: string) {
    await fetch(`/api/messaging/signatures/${id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
    onSignaturesChanged();
  }
  async function setDefault(id: string) {
    await fetch(`/api/messaging/signatures/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) }).catch(() => {});
    onSignaturesChanged();
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Signatures rattachées à <strong style={{ color: "var(--text-main)" }}>{account.email}</strong>.</p>
      {mine.length === 0 ? <p className="text-[12.5px]" style={{ color: "var(--text-hint)" }}>Aucune signature pour ce compte.</p> : (
        <ul className="space-y-1.5">
          {mine.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "var(--border)" }}>
              <span className="min-w-0 truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{s.name}{s.isDefault ? " · Par défaut" : ""}</span>
              <span className="flex shrink-0 gap-1.5">
                {!s.isDefault ? <button type="button" onClick={() => void setDefault(s.id)} className="text-[11px] font-bold" style={{ color: "var(--accent)" }}>Par défaut</button> : null}
                <button type="button" onClick={() => void remove(s.id)} aria-label="Supprimer" className="text-slate-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-1.5 rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la signature" className={inputCls} style={{ borderColor: "var(--border)" }} />
        <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={3} placeholder="Contenu (HTML autorisé)" className="w-full rounded-lg border px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
        <button type="button" disabled={saving || !name.trim() || busy} onClick={() => void create()} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-white disabled:opacity-50" style={{ background: "var(--accent)" }}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenSquare className="h-3.5 w-3.5" strokeWidth={2} />} Nouvelle signature
        </button>
      </div>
    </div>
  );
}

function FoldersSection({ account }: { account: MailAccountVM }) {
  if (!account.isGmail) {
    return <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>Dossiers IMAP gérés via les règles de synchronisation. Dossier surveillé : <strong style={{ color: "var(--text-main)" }}>{account.watchedFolder}</strong>.</p>;
  }
  return <GmailFolderPrefs accountId={account.id} />;
}

function SecuritySection({ account, busy, onReconnect, onDisconnect, onDelete }: Props) {
  return (
    <div className="space-y-3">
      <InfoLine label="Type d'authentification" value={account.authLabel} />
      <InfoLine label="État OAuth" value={account.isGmail ? (account.status === "active" ? "Connecté" : account.status === "reconnect" ? "À reconnecter" : account.status) : "—"} />
      {account.scopes.length > 0 ? <InfoLine label="Autorisations" value={`${account.scopes.length} scope(s)`} /> : null}
      <InfoLine label="Connecté le" value={account.connectedAt ? new Date(account.connectedAt).toLocaleDateString("fr-FR") : "—"} />

      <div className="space-y-1.5 pt-1">
        {account.isGmail ? (
          <ActionRow label="Reconnecter le compte" sub="Renouveler les autorisations OAuth" onClick={onReconnect} disabled={busy} />
        ) : null}
        <ActionRow label="Déconnecter le compte" sub="Suspendre la synchronisation" onClick={onDisconnect} disabled={busy} />
        <ActionRow label="Supprimer le compte" sub="Retirer définitivement ce compte" onClick={onDelete} disabled={busy} danger />
      </div>

      <div className="mt-2 flex items-start gap-2 rounded-xl p-3" style={{ background: "var(--bg-card-soft)" }}>
        <Lock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: "var(--gedify-navy)" }} aria-hidden="true" />
        <p className="text-[12px]" style={{ color: "var(--text-main)" }}><strong>Vos données sont chiffrées.</strong> GEDify n&apos;a jamais accès à vos mots de passe.</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description: string; checked: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{label}</p>
        <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange} className="relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50" style={{ background: checked ? "var(--accent)" : "var(--border-strong)" }}>
        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: checked ? "1.375rem" : "0.125rem" }} />
      </button>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}

function ActionRow({ label, sub, onClick, disabled, danger }: { label: string; sub: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
      <span className="flex items-center gap-2">
        {danger ? <Trash2 className="h-4 w-4" strokeWidth={1.85} style={{ color: "var(--danger)" }} /> : <Mail className="h-4 w-4" strokeWidth={1.85} style={{ color: "var(--text-muted)" }} />}
        <span>
          <span className="block text-[13px] font-semibold" style={{ color: danger ? "var(--danger)" : "var(--text-main)" }}>{label}</span>
          <span className="block text-[11px]" style={{ color: "var(--text-muted)" }}>{sub}</span>
        </span>
      </span>
      <span style={{ color: "var(--text-hint)" }}>›</span>
    </button>
  );
}

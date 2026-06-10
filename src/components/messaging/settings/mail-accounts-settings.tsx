"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Inbox, Loader2, Plus, RefreshCw } from "lucide-react";
import { MailAccountCard, type MenuAction } from "./mail-account-card";
import { MailAccountDetailsPanel } from "./mail-account-details-panel";
import { ConnectMailboxModal, type ConnectInitial } from "./connect-mailbox-modal";
import { relativeTime, type MailAccountVM, type SignatureVM } from "./types";

const RETURN_TO = "/messagerie/parametres-emails";

/** Reprise du parcours après un aller-retour OAuth (ou ouverture directe via
 *  ?modal=connect-mailbox), transmise par la page serveur. */
export type InitialConnect = {
  open?: boolean;
  provider?: "apple" | "custom";
  oauthProvider?: "google" | "microsoft";
  accountId?: string;
  error?: string;
};

function buildConnectInitial(ic: InitialConnect | undefined, accounts: MailAccountVM[]): ConnectInitial | undefined {
  if (!ic) return undefined;
  if (ic.oauthProvider && ic.accountId) {
    return { oauthProvider: ic.oauthProvider, oauthAccount: accounts.find((a) => a.id === ic.accountId) ?? null };
  }
  if (ic.error) return { error: ic.error };
  if (ic.provider) return { provider: ic.provider };
  return {};
}

export function MailAccountsSettings({ accounts, signatures, initialConnect, googleOAuthAvailable = false, microsoftOAuthAvailable = false }: { accounts: MailAccountVM[]; signatures: SignatureVM[]; initialConnect?: InitialConnect; googleOAuthAvailable?: boolean; microsoftOAuthAvailable?: boolean }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [addOpen, setAddOpen] = useState<boolean>(() => Boolean(initialConnect));
  const [modalInitial, setModalInitial] = useState<ConnectInitial | undefined>(() => buildConnectInitial(initialConnect, accounts));

  // Nettoie les paramètres d'URL de reprise OAuth (sans recharger la page) pour
  // qu'un rafraîchissement ultérieur ne rouvre pas la modale.
  useEffect(() => {
    if (initialConnect && typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", RETURN_TO);
    }
  }, [initialConnect]);

  function openAdd() { setModalInitial(undefined); setAddOpen(true); }

  const selected = useMemo(() => accounts.find((a) => a.id === selectedId) ?? null, [accounts, selectedId]);

  const activeCount = accounts.filter((a) => a.isActive).length;
  const errorCount = accounts.filter((a) => a.status === "error" || a.status === "reconnect").length;
  const lastSync = accounts.map((a) => a.lastSyncAt).filter(Boolean).sort().slice(-1)[0] ?? null;

  async function syncAccount(account: MailAccountVM) {
    setBusyId(account.id);
    try {
      if (account.isGmail) {
        await fetch("/api/connectors/gmail/sync", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account.id }) }).catch(() => {});
      } else {
        await fetch(`/api/mail-connector/accounts/${account.id}/sync`, { method: "POST", credentials: "include" }).catch(() => {});
      }
      router.refresh();
    } finally { setBusyId(null); }
  }

  async function syncAll() {
    setSyncingAll(true);
    try {
      await fetch("/api/mail-connector/sync-all", { method: "POST", credentials: "include" }).catch(() => {});
      await Promise.all(accounts.filter((a) => a.isGmail && a.isActive).map((a) =>
        fetch("/api/connectors/gmail/sync", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: a.id }) }).catch(() => {}),
      ));
      router.refresh();
    } finally { setSyncingAll(false); }
  }

  async function patch(account: MailAccountVM, fields: Record<string, unknown>) {
    setBusyId(account.id);
    try {
      await fetch(`/api/mail-connector/accounts/${account.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) }).catch(() => {});
      router.refresh();
    } finally { setBusyId(null); }
  }

  function reconnect(account: MailAccountVM) {
    window.location.assign(`/api/connectors/gmail/start?returnTo=${encodeURIComponent(RETURN_TO)}&accountId=${encodeURIComponent(account.id)}`);
  }

  async function disconnect(account: MailAccountVM) {
    setBusyId(account.id);
    try {
      if (account.isGmail) {
        await fetch("/api/connectors/gmail/disconnect", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account.id }) }).catch(() => {});
      } else {
        await fetch(`/api/mail-connector/accounts/${account.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }) }).catch(() => {});
      }
      router.refresh();
    } finally { setBusyId(null); }
  }

  async function removeAccount(account: MailAccountVM) {
    if (!window.confirm(`Supprimer définitivement « ${account.email} » de GEDify ?`)) return;
    setBusyId(account.id);
    try {
      if (account.isGmail) {
        await fetch("/api/connectors/gmail/disconnect", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: account.id, deleteAccount: true }) }).catch(() => {});
      } else {
        await fetch(`/api/mail-connector/accounts/${account.id}`, { method: "DELETE", credentials: "include" }).catch(() => {});
      }
      if (selectedId === account.id) setSelectedId(null);
      router.refresh();
    } finally { setBusyId(null); }
  }

  function onMenu(account: MailAccountVM, action: MenuAction) {
    switch (action) {
      case "default": void patch(account, { isDefault: true }); break;
      case "rename": { const n = window.prompt("Nom du compte", account.name); if (n && n.trim()) void patch(account, { name: n.trim() }); break; }
      case "color": setSelectedId(account.id); break;
      case "sync": void syncAccount(account); break;
      case "reconnect": reconnect(account); break;
      case "suspend": void patch(account, { isActive: !account.isActive }); break;
      case "disconnect": void disconnect(account); break;
      case "delete": void removeAccount(account); break;
    }
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>Emails &amp; boîtes connectées</h1>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>Gérez vos comptes, la synchronisation, l&apos;envoi et les signatures.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void syncAll()} disabled={syncingAll || accounts.length === 0} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-3.5 text-[13px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border-strong)", color: "var(--text-main)" }}>
            {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.85} />} Synchroniser toutes les boîtes
          </button>
          <button type="button" onClick={openAdd} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Ajouter une boîte
          </button>
        </div>
      </header>

      {/* Résumé compact */}
      {accounts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-2xl border bg-white px-4 py-2.5 text-[12.5px]" style={{ borderColor: "var(--border)" }}>
          <Summary icon={Inbox} color="#15803D">{activeCount} boîte{activeCount > 1 ? "s" : ""} active{activeCount > 1 ? "s" : ""}</Summary>
          <Summary icon={Clock} color="var(--text-muted)">Dernière synchro {relativeTime(lastSync)}</Summary>
          <Summary icon={errorCount > 0 ? AlertTriangle : CheckCircle2} color={errorCount > 0 ? "#B91C1C" : "#15803D"}>{errorCount === 0 ? "0 erreur" : `${errorCount} boîte${errorCount > 1 ? "s" : ""} en erreur`}</Summary>
        </div>
      ) : null}

      {/* Aucun compte */}
      {accounts.length === 0 ? (
        <div className="rounded-2xl border bg-white px-6 py-16 text-center" style={{ borderColor: "var(--border)" }}>
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Inbox className="h-6 w-6" strokeWidth={1.6} /></span>
          <p className="text-[15px] font-bold" style={{ color: "var(--text-main)" }}>Aucune boîte mail connectée</p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Connectez votre première boîte pour afficher et traiter vos emails dans GEDify.</p>
          <button type="button" onClick={openAdd} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--accent)" }}><Plus className="h-4 w-4" strokeWidth={2.5} /> Ajouter une boîte</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Liste */}
          <div className="space-y-3">
            {accounts.map((a) => (
              <MailAccountCard
                key={a.id}
                account={a}
                selected={selectedId === a.id}
                busy={busyId === a.id}
                onOpenSettings={() => setSelectedId(a.id)}
                onSync={() => void syncAccount(a)}
                onMenuAction={(action) => onMenu(a, action)}
              />
            ))}
            <button type="button" onClick={openAdd} className="flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--accent)" }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Plus className="h-5 w-5" strokeWidth={2} /></span>
              <span className="flex-1">
                <span className="block text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Ajouter une nouvelle boîte mail</span>
                <span className="block text-[12px]" style={{ color: "var(--text-muted)" }}>Google, Apple/iCloud, Microsoft ou autre fournisseur</span>
              </span>
              <span style={{ color: "var(--text-hint)" }}>›</span>
            </button>
          </div>

          {/* Panneau de détail (desktop : colonne ; mobile/tablette : drawer) */}
          <div className="hidden lg:block">
            {selected ? (
              <MailAccountDetailsPanel
                key={selected.id}
                account={selected}
                signatures={signatures}
                busy={busyId === selected.id}
                onClose={() => setSelectedId(null)}
                onPatch={(fields) => patch(selected, fields)}
                onSync={() => void syncAccount(selected)}
                onReconnect={() => reconnect(selected)}
                onDisconnect={() => void disconnect(selected)}
                onDelete={() => void removeAccount(selected)}
                onSignaturesChanged={() => router.refresh()}
              />
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "var(--border)" }}>
                <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Sélectionnez une boîte</p>
                <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Choisissez un compte pour afficher ses paramètres.</p>
              </div>
            )}
          </div>

          {/* Drawer mobile/tablette */}
          {selected ? (
            <div className="fixed inset-0 z-[90] lg:hidden" role="dialog" aria-modal="true">
              <button type="button" aria-label="Fermer" onClick={() => setSelectedId(null)} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
              <div className="absolute inset-y-0 right-0 w-full max-w-md p-3">
                <MailAccountDetailsPanel
                  key={selected.id}
                  account={selected}
                  signatures={signatures}
                  busy={busyId === selected.id}
                  onClose={() => setSelectedId(null)}
                  onPatch={(fields) => patch(selected, fields)}
                  onSync={() => void syncAccount(selected)}
                  onReconnect={() => reconnect(selected)}
                  onDisconnect={() => void disconnect(selected)}
                  onDelete={() => void removeAccount(selected)}
                  onSignaturesChanged={() => router.refresh()}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {addOpen ? <ConnectMailboxModal initial={modalInitial} onClose={() => setAddOpen(false)} onConnected={() => router.refresh()} googleOAuthAvailable={googleOAuthAvailable} microsoftOAuthAvailable={microsoftOAuthAvailable} /> : null}
    </div>
  );
}

function Summary({ icon: Icon, color, children }: { icon: React.ElementType; color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color }}>
      <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> {children}
    </span>
  );
}

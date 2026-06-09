"use client";

import { useState } from "react";
import { Clock, ExternalLink, Inbox, Loader2, Mail, MoreVertical, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { relativeTime, statusMeta, SYNC_OPTIONS, type MailAccountVM } from "./types";

/* Carte d'une boîte connectée (liste unifiée). Avatar coloré, statut, badges
   (OAuth/IMAP, envoi), infos de synchro, actions principales + menu ⋮. */

type Props = {
  account: MailAccountVM;
  selected: boolean;
  busy: boolean;
  onOpenSettings: () => void;
  onSync: () => void;
  onMenuAction: (action: MenuAction) => void;
};

export type MenuAction =
  | "default" | "rename" | "color" | "sync" | "reconnect" | "suspend" | "disconnect" | "delete";

function initials(s: string): string {
  return (s.trim()[0] ?? "?").toUpperCase();
}

export function MailAccountCard({ account, selected, busy, onOpenSettings, onSync, onMenuAction }: Props) {
  const [menu, setMenu] = useState(false);
  const sm = statusMeta(account.status);
  const color = account.color ?? "#F75C8D";
  const freq = SYNC_OPTIONS.find((o) => o.value === account.syncIntervalMinutes)?.label ?? `${account.syncIntervalMinutes} min`;

  return (
    <article
      className="rounded-2xl border bg-white p-4 transition"
      style={{ borderColor: selected ? "var(--accent)" : "var(--border)", boxShadow: selected ? "0 0 0 1px var(--accent)" : undefined, background: selected ? "var(--accent-soft)" : "#fff" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: color }} aria-hidden="true">
            {initials(account.name || account.email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-bold" style={{ color: "var(--text-main)" }}>{account.email || "(adresse inconnue)"}</p>
            <p className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{account.providerLabel} · {account.name}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: sm.color, background: sm.bg }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sm.color }} aria-hidden="true" /> {sm.label}
          </span>
          {account.isDefault ? <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>Défaut</span> : null}
          <div className="relative">
            <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Actions du compte" className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100">
              <MoreVertical className="h-4 w-4" strokeWidth={2} />
            </button>
            {menu ? (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-8 z-50 w-56 overflow-hidden rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: "var(--border)" }} role="menu">
                  {([
                    ["default", "Définir comme boîte par défaut"],
                    ["rename", "Renommer le compte"],
                    ["color", "Changer la couleur"],
                    ["sync", "Synchroniser"],
                    ...(account.isGmail ? [["reconnect", "Reconnecter"] as const] : []),
                    ["suspend", account.isActive ? "Suspendre la synchronisation" : "Réactiver la synchronisation"],
                    ["disconnect", "Déconnecter"],
                    ["delete", "Supprimer le compte"],
                  ] as [MenuAction, string][]).map(([action, label]) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => { setMenu(false); onMenuAction(action); }}
                      className="flex w-full items-center px-3 py-1.5 text-left text-[12.5px] transition hover:bg-slate-50"
                      style={{ color: action === "delete" ? "var(--danger)" : "var(--text-main)" }}
                      role="menuitem"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge icon={Mail}>{account.authLabel}</Badge>
        {account.canSend ? <Badge icon={ShieldCheck} tone="green">Envoi autorisé</Badge> : <Badge icon={ShieldCheck}>Envoi non configuré</Badge>}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 text-[12.5px] sm:grid-cols-2">
        <Row icon={Clock} label="Dernière synchro" value={relativeTime(account.lastSyncAt)} />
        <Row icon={RefreshCw} label="Fréquence" value={freq} />
        <Row icon={Mail} label="Messages" value={account.messages != null ? account.messages.toLocaleString("fr-FR") : "—"} />
        <Row icon={Inbox} label="Dossier" value={account.watchedFolder} />
      </div>

      {account.lastError ? <p className="mt-2 truncate text-[11.5px]" style={{ color: "var(--danger)" }} title={account.lastError}>⚠ {account.lastError}</p> : null}

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button type="button" onClick={onSync} disabled={busy} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.85} />} Synchroniser
        </button>
        <a href={`/messagerie/inbox?accountId=${encodeURIComponent(account.id)}`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.85} /> Ouvrir la boîte
        </a>
        <button type="button" onClick={onOpenSettings} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-semibold transition hover:bg-slate-50" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
          <Settings2 className="h-3.5 w-3.5" strokeWidth={1.85} /> Paramètres
        </button>
      </div>
    </article>
  );
}

function Badge({ icon: Icon, children, tone }: { icon: React.ElementType; children: React.ReactNode; tone?: "green" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: "var(--border)", color: tone === "green" ? "#15803D" : "var(--text-muted)" }}>
      <Icon className="h-3 w-3" strokeWidth={1.85} aria-hidden="true" /> {children}
    </span>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 truncate" style={{ color: "var(--text-muted)" }}>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" /> {label}
      </span>
      <span className="shrink-0 font-semibold" style={{ color: "var(--text-main)" }}>{value}</span>
    </div>
  );
}

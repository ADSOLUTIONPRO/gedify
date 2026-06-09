"use client";

import { useEffect } from "react";
import { ChevronRight, Mail, Settings2, X } from "lucide-react";

/* Modale simplifiée « Ajouter une boîte mail » : trois choix centraux, pas de
   formulaire technique d'emblée (§15). Google → OAuth ; Apple/iCloud & autre
   fournisseur → assistant /messagerie/parametres-emails/connecter-bmails. */

const RETURN_TO = "/messagerie/parametres-emails";

export function AddMailAccountModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Ajouter une boîte mail">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-3xl p-5 shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>Ajouter une boîte mail</h2>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Choisissez le fournisseur de votre adresse email.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100"><X className="h-5 w-5" strokeWidth={2} /></button>
        </div>

        <div className="mt-4 space-y-2.5">
          <Choice href={`/api/connectors/gmail/start?returnTo=${encodeURIComponent(RETURN_TO)}`} title="Continuer avec Google" sub="Gmail et Google Workspace" badge="G" badgeColor="#EA4335" />
          <Choice href={`/api/connectors/outlook/start?returnTo=${encodeURIComponent(RETURN_TO)}`} title="Continuer avec Microsoft" sub="Outlook.com, Hotmail, Live et Microsoft 365" badge="⊞" badgeColor="#0078D4" />
          <Choice href="/messagerie/parametres-emails/connecter-bmails?provider=icloud" title="Connecter un compte Apple / iCloud" sub="iCloud Mail, me.com et mac.com" icon={Mail} badgeColor="#0F172A" />
          <Choice href="/messagerie/parametres-emails/connecter-bmails" title="Configurer un autre fournisseur" sub="Yahoo, La Poste ou serveur IMAP/SMTP" icon={Settings2} badgeColor="#64748B" />
        </div>
      </div>
    </div>
  );
}

function Choice({ href, title, sub, icon: Icon, badge, badgeColor }: { href: string; title: string; sub: string; icon?: React.ElementType; badge?: string; badgeColor: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-2xl border p-3.5 transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[16px] font-extrabold text-white" style={{ background: badgeColor }} aria-hidden="true">
        {badge ?? (Icon ? <Icon className="h-5 w-5" strokeWidth={1.85} /> : "?")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{title}</span>
        <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
    </a>
  );
}

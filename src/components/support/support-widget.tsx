"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Sparkles, MessageSquarePlus, Inbox, BookOpen, X } from "lucide-react";
import { requestOpenAssistant } from "@/lib/assistant/assistant-open-store";

/* Bouton flottant « Aide & support » (multi-tenant uniquement).
   Sépare clairement l'assistant IA et le support humain (conseiller). */

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const go = (href: string) => { setOpen(false); router.push(href); };
  const openAi = () => { setOpen(false); requestOpenAssistant(); };

  const items = [
    { icon: Sparkles, label: "Assistant IA", desc: "Réponse immédiate", onClick: openAi },
    { icon: MessageSquarePlus, label: "Contacter un conseiller", desc: "Ouvrir une demande", onClick: () => go("/support/new") },
    { icon: Inbox, label: "Mes demandes", desc: "Suivi de vos échanges", onClick: () => go("/support") },
    { icon: BookOpen, label: "Centre d'aide", desc: "Guides & FAQ", onClick: () => go("/support") },
  ];

  return (
    <>
      {open ? (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-[78] cursor-default" />
          <div role="menu" className="fixed bottom-[150px] left-4 z-[79] w-72 overflow-hidden rounded-2xl border bg-white shadow-2xl md:bottom-[88px] md:left-6" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--blue-600)" }}>
              <span className="text-[14px] font-bold text-white">Aide & support</span>
              <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="py-1">
              {items.map((it) => (
                <button key={it.label} type="button" onClick={it.onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--bg-subtle, #EFF6FF)" }}>
                    <it.icon className="h-[18px] w-[18px]" style={{ color: "var(--blue-600)" }} />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{it.label}</span>
                    <span className="block text-[11px] text-slate-500">{it.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Aide & support"
        className="fixed bottom-[84px] left-4 z-[80] inline-flex h-14 items-center gap-2 rounded-full px-5 text-sm font-bold text-white shadow-xl transition hover:scale-[1.03] active:scale-95 md:bottom-6 md:left-6"
        style={{ background: "linear-gradient(135deg,#0E7490,#0891B2)" }}
      >
        <LifeBuoy className="h-5 w-5" />
        <span className="hidden sm:inline">Aide</span>
      </button>
    </>
  );
}

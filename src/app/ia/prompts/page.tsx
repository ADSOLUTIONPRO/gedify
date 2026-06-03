import type { Metadata } from "next";
import { SpaceLayout } from "@/components/layout/space-layout";
import { ShieldCheck } from "lucide-react";
import { getBusinessPromptSections, getPromptProfileLabel } from "@/lib/ai/prompts/prompt-registry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Prompts métier — Analyse IA" };

export default function IAPromptsPage() {
  const sections = getBusinessPromptSections();
  const profileLabel = getPromptProfileLabel();

  return (
    <SpaceLayout spaceId="ia">
      <div className="mb-4 flex items-start gap-2 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "rgba(124,58,237,0.05)" }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--violet)" }} strokeWidth={1.75} aria-hidden="true" />
        <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          Profil actif : <strong style={{ color: "var(--text-main)" }}>{profileLabel}</strong>. Ces règles métier
          sont injectées dans le prompt système <strong>côté serveur uniquement</strong> — aucune clé API n&apos;est
          exposée. OCR prioritaire, nom de fichier = indice faible, ancien ancien classement potentiellement faux,
          correction utilisateur prioritaire.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <details key={s.id} className="group rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0">
                <span className="block text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{s.label}</span>
                <span className="block text-[12px]" style={{ color: "var(--text-muted)" }}>{s.description}</span>
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-slate-400 group-open:hidden">Afficher</span>
              <span className="hidden shrink-0 text-[11px] font-semibold text-slate-400 group-open:inline">Masquer</span>
            </summary>
            <pre className="max-h-80 overflow-auto border-t px-4 py-3 text-[11.5px] leading-relaxed text-slate-600" style={{ borderColor: "var(--border)", whiteSpace: "pre-wrap" }}>
              {s.content.trim()}
            </pre>
          </details>
        ))}
      </div>
    </SpaceLayout>
  );
}

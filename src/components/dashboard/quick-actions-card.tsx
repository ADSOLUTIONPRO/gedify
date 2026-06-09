"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ListTodo, Mail, Mailbox, Sparkles, Upload, type LucideIcon } from "lucide-react";
import { FolderImportModal } from "@/components/projects/folder-import-modal";
import { CreateCalendarItemModal } from "@/components/calendar/create-calendar-item-modal";
import { AssistantDocumentPicker } from "@/components/ai-assistant/assistant-document-picker";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { requestOpenAssistant } from "@/lib/assistant/assistant-open-store";
import { setAssistantOverrides } from "@/components/ai-assistant/assistant-context-provider";

type ActiveModal = "import" | "rdv" | "tache" | "ia" | null;

type QuickAction = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  /** Action IA : conserve le dégradé violet/rose. Les autres → rose clair. */
  ia?: boolean;
};

/**
 * Carte « Actions rapides » : chaque tuile déclenche la vraie fonction
 * existante (import, compositeur de mail, courrier postal, RDV, tâche, analyse
 * IA) — aucun doublon de composant. Grille 2 colonnes (desktop) / 1 colonne
 * (mobile). Le rose est réservé à ces actions ; l'analyse IA garde son dégradé.
 */
export function QuickActionsCard() {
  const router = useRouter();
  const [modal, setModal] = useState<ActiveModal>(null);

  // Rafraîchit les widgets du tableau de bord après une action (compteurs,
  // documents récents, prochains RDV…).
  const closeAndRefresh = () => { setModal(null); router.refresh(); };

  function startIaAnalysis(docId: number) {
    setModal(null);
    setAssistantOverrides({ currentSpace: "documents", activeDocumentId: docId, selectedDocumentIds: [docId] });
    requestOpenAssistant();
  }

  const actions: QuickAction[] = [
    { icon: Upload, title: "Importer un fichier", subtitle: "Depuis votre ordinateur", onClick: () => setModal("import") },
    { icon: Mail, title: "Nouveau message", subtitle: "Écrire un e-mail", onClick: () => openComposer({}) },
    { icon: Mailbox, title: "Courrier postal", subtitle: "Rédiger un courrier", onClick: () => router.push("/redaction/nouveau") },
    { icon: CalendarPlus, title: "Nouveau RDV", subtitle: "Planifier un rendez-vous", onClick: () => setModal("rdv") },
    { icon: ListTodo, title: "Nouvelle tâche", subtitle: "Ajouter une tâche", onClick: () => setModal("tache") },
    { icon: Sparkles, title: "Analyse IA", subtitle: "Interroger un document", onClick: () => setModal("ia"), ia: true },
  ];

  return (
    <>
      <section className="rounded-[22px] bg-white p-4 sm:p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h2 className="text-[15px] font-extrabold" style={{ color: "var(--gedify-navy)" }}>
          Actions rapides
        </h2>

        {/* Grille 2 colonnes (1 colonne sur smartphone) */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                type="button"
                onClick={action.onClick}
                className={`flex min-w-0 flex-col items-start gap-2 rounded-2xl p-3 text-left transition ${action.ia ? "hover:brightness-105" : "hover:bg-[#FBDFEA]"}`}
                style={action.ia
                  ? { background: "linear-gradient(135deg, #F75C8D 0%, #A855F7 54%, #7C3AED 100%)", boxShadow: "0 6px 18px rgba(124,58,237,0.22)" }
                  : { background: "var(--accent-soft)" }}
              >
                <Icon className="h-5 w-5 shrink-0" style={{ color: action.ia ? "#fff" : "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
                <span className="block w-full truncate text-[13px] font-bold leading-tight" style={{ color: action.ia ? "#fff" : "var(--text-main)" }}>
                  {action.title}
                </span>
                <span className="block w-full truncate text-[11px]" style={{ color: action.ia ? "rgba(255,255,255,0.85)" : "var(--text-muted)" }}>
                  {action.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Modales / panneaux réels (réutilisés tels quels) */}
      {modal === "import" ? <FolderImportModal onClose={closeAndRefresh} /> : null}
      {modal === "rdv" ? (
        <CreateCalendarItemModal source={{ sourceType: "manual" }} defaultTab="event" onClose={() => setModal(null)} onCreated={closeAndRefresh} />
      ) : null}
      {modal === "tache" ? (
        <CreateCalendarItemModal source={{ sourceType: "manual" }} defaultTab="task" onClose={() => setModal(null)} onCreated={closeAndRefresh} />
      ) : null}
      {modal === "ia" ? <AssistantDocumentPicker onPick={startIaAnalysis} onClose={() => setModal(null)} /> : null}
    </>
  );
}

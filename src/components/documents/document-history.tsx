"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatDateTime } from "@/lib/format";

/* ── Parsing défensif des entrées d'historique Gedify ───────────────── */

type ParsedEntry = {
  key: string;
  id: number | string;
  timestamp: string;
  action: string;
  changes: Record<string, unknown>;
  actorName: string | null;
};

function parse(entry: unknown, index: number): ParsedEntry {
  const o = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  const actor = o.actor && typeof o.actor === "object" ? (o.actor as Record<string, unknown>) : null;
  const id = typeof o.id === "number" || typeof o.id === "string" ? o.id : index;
  return {
    key: `${id}-${index}`,
    id,
    timestamp: typeof o.timestamp === "string" ? o.timestamp : "",
    action: typeof o.action === "string" ? o.action : "event",
    changes: o.changes && typeof o.changes === "object" && !Array.isArray(o.changes) ? (o.changes as Record<string, unknown>) : {},
    actorName: actor && typeof actor.username === "string" ? (actor.username as string) : null,
  };
}

/* ── Libellés ──────────────────────────────────────────────────────────── */

const ACTION_META: Record<string, { label: string; bg: string; color: string }> = {
  create: { label: "Création", bg: "#DCFCE7", color: "#15803D" },
  update: { label: "Modification", bg: "#FDECF2", color: "#D93E71" },
  delete: { label: "Suppression", bg: "#FEE2E2", color: "#B91C1C" },
  event: { label: "Événement", bg: "#F1F5F9", color: "#475569" },
};

const FIELD_LABELS: Record<string, string> = {
  tags: "Tags",
  correspondent: "Correspondant",
  document_type: "Type de document",
  title: "Titre",
  created: "Date du document",
  added: "Date d'ajout",
  archive_serial_number: "N° d'archive",
  filename: "Nom de fichier",
  archive_filename: "Fichier d'archive",
  archive_checksum: "Empreinte archive",
  checksum: "Empreinte",
  storage_path: "Chemin de stockage",
  content: "Contenu OCR",
  owner: "Propriétaire",
  notes: "Notes",
};

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

function val(v: unknown) {
  if (v === null || v === undefined || v === "None") return "—";
  return String(v);
}

/** Origine de l'action, déduite de l'acteur et des champs modifiés. */
function origin(entry: ParsedEntry): { author: string; tag: string } {
  if (entry.actorName) return { author: entry.actorName, tag: "Utilisateur" };
  const keys = Object.keys(entry.changes);
  if (keys.includes("archive_checksum") || keys.includes("archive_filename")) {
    return { author: "Système", tag: "Gedify · archivage/OCR" };
  }
  if (entry.action === "create") return { author: "Système", tag: "Import" };
  return { author: "Système", tag: "Tâche automatique" };
}

/** Résumé court des changements pour la ligne compacte. */
function summarize(changes: Record<string, unknown>): string {
  const keys = Object.keys(changes);
  if (keys.length === 0) return "";
  const describe = (key: string): string => {
    const c = changes[key];
    if (c && typeof c === "object" && !Array.isArray(c) && "operation" in c) {
      const m = c as { operation?: string; objects?: unknown[] };
      const sign = m.operation === "add" ? "+" : "−";
      const objs = Array.isArray(m.objects) ? m.objects.map(String).join(", ") : "";
      return `${fieldLabel(key)} ${sign}${objs ? ` ${objs}` : ""}`;
    }
    return `${fieldLabel(key)} modifié`;
  };
  const first = describe(keys[0]);
  return keys.length > 1 ? `${first} · +${keys.length - 1}` : first;
}

/* ── Détail d'un changement (vue dépliée) ──────────────────────────────── */

function ChangeRow({ field, change }: { field: string; change: unknown }) {
  if (Array.isArray(change) && change.length === 2) {
    return (
      <div className="flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(31,41,55,0.03)" }}>
        <span className="text-[11px] font-bold" style={{ color: "var(--text-main)" }}>{fieldLabel(field)}</span>
        <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          Ancien : <span className="font-medium" style={{ color: "var(--text-main)" }}>{val(change[0])}</span>
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          Nouveau : <span className="font-medium" style={{ color: "var(--text-main)" }}>{val(change[1])}</span>
        </span>
      </div>
    );
  }
  if (change && typeof change === "object" && "operation" in change) {
    const m = change as { operation?: string; objects?: unknown[] };
    return (
      <div className="flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5" style={{ background: "rgba(31,41,55,0.03)" }}>
        <span className="text-[11px] font-bold" style={{ color: "var(--text-main)" }}>{fieldLabel(field)}</span>
        <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          {m.operation === "add" ? "Ajouté" : "Retiré"} : <span className="font-medium" style={{ color: "var(--text-main)" }}>{Array.isArray(m.objects) ? m.objects.map(String).join(", ") : "—"}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(31,41,55,0.03)" }}>
      <span className="text-[11px] font-bold" style={{ color: "var(--text-main)" }}>{fieldLabel(field)}</span>
      <span className="ml-2 text-[11.5px]" style={{ color: "var(--text-muted)" }}>{val(change)}</span>
    </div>
  );
}

/* ── Composant ─────────────────────────────────────────────────────────── */

/**
 * Historique du document : lignes compactes (date · type · auteur · résumé),
 * cliquables pour déplier le détail (ancienne/nouvelle valeur, origine, ID).
 */
export function DocumentHistory({ entries }: { entries: unknown[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const parsed = entries.map(parse).slice(0, 50);

  if (parsed.length === 0) {
    return <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Aucun événement pour ce document.</p>;
  }

  return (
    <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
      {parsed.map((entry) => {
        const meta = ACTION_META[entry.action] ?? ACTION_META.event;
        const { author, tag } = origin(entry);
        const summary = summarize(entry.changes);
        const isOpen = open === entry.key;
        const changeKeys = Object.keys(entry.changes);
        return (
          <li key={entry.key} style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : entry.key)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 py-1.5 text-left transition hover:bg-[#FCFAF7]"
            >
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
              <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                {entry.timestamp ? formatDateTime(entry.timestamp) : "—"}
              </span>
              <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--text-main)" }}>{author}</span>
              {summary ? <span className="min-w-0 flex-1 truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>· {summary}</span> : <span className="flex-1" />}
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-hint)" }} strokeWidth={2} aria-hidden="true" />
            </button>

            {isOpen ? (
              <div className="space-y-2 pb-3 pl-1 pr-1 pt-1">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  <span>Auteur : <span className="font-semibold" style={{ color: "var(--text-main)" }}>{author}</span></span>
                  <span>Origine : <span className="font-semibold" style={{ color: "var(--text-main)" }}>{tag}</span></span>
                  <span>ID : <span className="font-mono" style={{ color: "var(--text-main)" }}>{String(entry.id)}</span></span>
                </div>
                {changeKeys.length > 0 ? (
                  <div className="space-y-1.5">
                    {changeKeys.map((k) => <ChangeRow key={k} field={k} change={entry.changes[k]} />)}
                  </div>
                ) : (
                  <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>Aucun détail de modification.</p>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

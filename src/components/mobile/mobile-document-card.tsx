"use client";

import Link from "next/link";
import { Bell, FolderInput, Mail } from "lucide-react";
import { FileTypeBadge } from "@/components/ui/file-type-badge";
import { STATUS_META, formatAmount, type DocumentVM } from "@/components/documents/types";
import { DocumentStatusBadges } from "@/components/documents/document-status-badges";

/** Grande carte document mobile (cf. maquette Documents). */
export function MobileDocumentCard({ doc }: { doc: DocumentVM }) {
  const status = STATUS_META[doc.status];
  return (
    <Link
      href={doc.detailHref}
      className="flex gap-3 rounded-2xl border bg-white p-3 transition active:scale-[0.995]"
      style={{ borderColor: "var(--border)" }}
    >
      {/* Miniature */}
      <span className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-slate-50" style={{ borderColor: "var(--border)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doc.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-extrabold" style={{ color: "var(--text-main)" }}>
            {doc.displayTitle}
          </p>
          {doc.amount ? (
            <span className="shrink-0 text-[13.5px] font-extrabold" style={{ color: "var(--text-main)" }}>
              {formatAmount(doc.amount.amount, doc.amount.currency)}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-hint)" }}>{doc.dateLabel}</p>
        {doc.correspondentName ? (
          <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}>{doc.correspondentName}</p>
        ) : null}

        <DocumentStatusBadges statuses={doc.statuses} className="mt-1.5" />

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {doc.typeName ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              <FileTypeBadge fileName={doc.fileName} mimeType={null} className="!px-0 !ring-0 !bg-transparent" />
              {doc.typeName}
            </span>
          ) : null}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
            style={{
              background: status.tone === "amber" ? "#FFF4E5" : status.tone === "emerald" ? "#EAF8EF" : "#F1F5F9",
              color: status.tone === "amber" ? "#B45309" : status.tone === "emerald" ? "#15803D" : "#64748B",
            }}
          >
            {status.label}
          </span>

          {/* Icônes rapides : présence de liaisons (placeholder visuel discret) */}
          <span className="ml-auto flex items-center gap-1.5" style={{ color: "var(--text-hint)" }}>
            <Bell className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            <FolderInput className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}

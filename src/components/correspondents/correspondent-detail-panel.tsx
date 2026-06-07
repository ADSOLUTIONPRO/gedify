"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckSquare,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { avatarColor, initials } from "@/components/messaging/mail-list-utils";
import type { CorrespondentVM } from "./correspondents-workspace";

type LinkedDoc = {
  id: number;
  title?: string | null;
  original_file_name?: string | null;
  original_filename?: string | null;
  created?: string | null;
};
type DocsResp = { results: LinkedDoc[]; count: number };

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
}

export function CorrespondentDetailPanel({ correspondent }: { correspondent: CorrespondentVM | null }) {
  const id = correspondent?.id ?? null;
  const [docs, setDocs] = useState<DocsResp | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (id == null) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDocsLoading(true);
    fetch(`/api/paperless/documents?correspondent=${id}&page_size=4&ordering=-created`, { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<DocsResp>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (!cancelled) setDocs(d); })
      .catch(() => { if (!cancelled) setDocs({ results: [], count: 0 }); })
      .finally(() => { if (!cancelled) setDocsLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (!correspondent) {
    return (
      <div className="flex items-center justify-center rounded-2xl border bg-white p-10 text-center" style={{ borderColor: "var(--border)", color: "var(--text-hint)" }}>
        <div>
          <Users className="mx-auto mb-2 h-9 w-9" strokeWidth={1.25} />
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun correspondant sélectionné</p>
        </div>
      </div>
    );
  }

  const c = correspondent;
  const color = avatarColor(c.name);
  const docCount = docs?.count ?? c.documentCount;

  return (
    <div className="rounded-2xl border bg-white" style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}>
      {/* ── En-tête ── */}
      <div className="flex items-start gap-4 border-b p-5" style={{ borderColor: "var(--border-soft)" }}>
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[20px] font-bold text-white" style={{ background: color }}>
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[19px] font-extrabold" style={{ color: "var(--text-main)" }}>{c.name}</h2>
            <Star className="h-4 w-4" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} aria-hidden="true" />
            <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--gedify-green-soft)", color: "#15803D" }}>
              {c.status === "manual" ? "Manuel" : "Correspondant GED"}
            </span>
            <button type="button" aria-label="Plus d'actions" className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]" style={{ color: "var(--text-muted)" }}>
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          {c.organization ? (
            <p className="mt-0.5 text-[13px] font-bold" style={{ color: "var(--accent)" }}>{c.organization}</p>
          ) : null}
          {c.role ? (
            <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>{c.role}</p>
          ) : null}

          {/* Coordonnées */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {c.email ? <ContactChip icon={Mail} value={c.email} href={`mailto:${c.email}`} /> : null}
            {c.phone ? <ContactChip icon={Phone} value={c.phone} href={`tel:${c.phone}`} /> : null}
            {!c.email && !c.phone ? (
              <span className="text-[12px]" style={{ color: "var(--text-hint)" }}>Coordonnées à renseigner</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Corps en 2 colonnes ── */}
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {/* Adresse postale */}
        <Card icon={MapPin} title="Adresse postale">
          {c.address ? (
            <p className="whitespace-pre-line text-[13px] leading-relaxed" style={{ color: "var(--text-main)" }}>{c.address}</p>
          ) : (
            <Empty>Adresse non renseignée.</Empty>
          )}
        </Card>

        {/* Taxonomie */}
        <Card icon={Tag} title="Taxonomie">
          {c.tags && c.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{t}</span>
              ))}
            </div>
          ) : (
            <Empty>Aucune taxonomie associée.</Empty>
          )}
        </Card>

        {/* Notes */}
        <Card icon={FileText} title="Notes">
          {c.notes ? (
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-main)" }}>{c.notes}</p>
          ) : (
            <Empty>Aucune note.</Empty>
          )}
        </Card>

        {/* Documents liés (réels) */}
        <Card icon={FileText} title={`Documents liés (${docCount})`}>
          {docsLoading ? (
            <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--text-hint)" }}>
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : docs && docs.results.length > 0 ? (
            <>
              <ul className="space-y-1.5">
                {docs.results.map((d) => {
                  const label = d.title || d.original_file_name || d.original_filename || `Document #${d.id}`;
                  return (
                    <li key={d.id}>
                      <Link href={`/documents/${d.id}`} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-[var(--bg-card-soft)]">
                        <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--text-main)" }}>{label}</span>
                        <span className="shrink-0 text-[11px]" style={{ color: "var(--text-hint)" }}>{formatDate(d.created)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {docCount > docs.results.length ? (
                <Link href={`/documents?correspondent=${c.id}`} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
                  Voir tous les documents <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              ) : null}
            </>
          ) : (
            <Empty>Aucun document lié.</Empty>
          )}
        </Card>

        {/* Emails récents */}
        <Card icon={Mail} title="Emails récents">
          <Empty>Aucun email récent lié à ce correspondant.</Empty>
          <Link href="/messagerie/contacts" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
            Voir les contacts <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </Card>

        {/* Tâches liées */}
        <Card icon={CheckSquare} title="Tâches liées">
          <Empty>Aucune tâche liée.</Empty>
          <Link href="/rappels" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
            Voir les tâches <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function ContactChip({ icon: Icon, value, href }: { icon: React.ElementType; value: string; href: string }) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition hover:bg-[var(--bg-card-soft)]"
      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} strokeWidth={1.75} aria-hidden="true" />
      <span className="truncate">{value}</span>
    </a>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: "var(--text-muted)" }} strokeWidth={1.85} aria-hidden="true" />
        <h3 className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px]" style={{ color: "var(--text-hint)" }}>{children}</p>;
}

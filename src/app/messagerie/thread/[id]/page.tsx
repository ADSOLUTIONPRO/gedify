import Link from "next/link";
import {
  ExternalLink,
  FileText,
  FolderKanban,
  FolderOpen,
  Mail,
  Sparkles,
  User,
} from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { GradientPanel } from "@/components/ui/gradient-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { RightRailCard } from "@/components/ui/right-rail-card";
import { SectionCard } from "@/components/ui/section-card";
import { ThreadActionsClient } from "@/components/messaging/thread-actions-client";
import { ThreadAttachmentsCard } from "@/components/messaging/thread-attachments-card";
import { ThreadMeetingCard } from "@/components/messaging/thread-meeting-card";
import { analyzeEmail } from "@/lib/ai/analyze-email";
import { getGmailThread } from "@/lib/connectors/gmail/gmail-api";
import { resolveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { normaliseGmailMessage } from "@/lib/messaging/gmail-normalize";
import { loadThreadGedContext } from "@/lib/messaging/thread-ged-context";
import { NoGmailState } from "@/components/messaging/no-gmail-state";
import { getGmailOAuthConfig, isGmailReconnectError } from "@/lib/connectors/gmail/oauth";
import { formatMoney } from "@/lib/format-money";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function formatShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}

export default async function ThreadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { id } = await params;
  const { accountId } = await searchParams;
  // Multi-comptes : le thread appartient au compte passé (repli compte actif).
  const account = await resolveGmailAccount(accountId ?? null);

  if (!account) {
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { href: "/messagerie", label: "Messagerie" }, { label: "Thread" }]}
          backLink={{ href: "/messagerie/inbox", label: "Retour à la boîte" }}
          title="Thread"
        />
        <NoGmailState oauthConfigured={Boolean(getGmailOAuthConfig())} />
      </PageShell>
    );
  }

  try {
    const thread = await getGmailThread(account.accountId, id, "full");
    const messages = (thread.messages ?? []).map((message) =>
      normaliseGmailMessage(message, { accountId: account.accountId, accountEmail: account.email }),
    );
    const sorted = [...messages].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));
    const latest = sorted[sorted.length - 1];
    const analysis = latest ? analyzeEmail(latest) : null;

    const allAttachments = messages.flatMap((m) =>
      m.attachments.filter((a) => !a.inline).map((a) => ({ ...a, messageId: m.id })),
    );

    const participants = Array.from(
      new Map(
        messages
          .flatMap((m) => [m.from, ...m.to, ...m.cc])
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .map((a) => [a.email, a]),
      ).values(),
    ).slice(0, 12);

    const ged = await loadThreadGedContext(id, account.accountId, participants.map((p) => p.email));

    // Pièces jointes enrichies de leur état GED réel (calculé serveur).
    const enrichedAttachments = allAttachments.map((a) => {
      const info = ged.attachmentStatusByAttId[a.attachmentId] ?? ged.attachmentStatusByFilename[a.filename];
      return { attachmentId: a.attachmentId, messageId: a.messageId, filename: a.filename, mimeType: a.mimeType, size: a.size, status: info?.status ?? ("none" as const), documentId: info?.documentId ?? null };
    });

    // Liaisons GED (documents importés + liens document manuels + correspondant).
    const docLinks = ged.links.flatMap((l) => (l.target.kind === "document" ? [l.target.documentId] : []));
    const hasLiaisons = ged.importedDocs.length > 0 || docLinks.length > 0 || Boolean(ged.correspondent);

    return (
      <PageShell>
        <PageHeader
          breadcrumb={[
            { href: "/dashboard", label: "Accueil" },
            { href: "/messagerie/inbox", label: "Messagerie" },
            { label: latest?.subject ?? "(sans sujet)" },
          ]}
          backLink={{ href: "/messagerie/inbox", label: "Retour à la boîte" }}
          title={latest?.subject ?? "(sans sujet)"}
          description={`${messages.length} message(s) · ${allAttachments.length} pièce(s) jointe(s)`}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          {/* ── Centre : conversation uniquement ── */}
          <div className="space-y-4">
            {latest && <ThreadActionsClient threadId={id} latestMessage={latest} accountEmail={account.email} />}

            <SectionCard title="Conversation" description={`Compte ${account.email}`} bodyClassName="p-0">
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {sorted.map((message) => (
                  <li key={message.id} className="p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>
                          {message.from?.name ?? message.from?.email ?? "Inconnu"}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {message.from?.email ?? ""} → {message.to.map((t) => t.email).join(", ")}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>{formatDate(message.date)}</span>
                    </div>
                    <pre
                      className="mt-3 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl p-3 text-xs leading-6"
                      style={{ background: "#FCFAF7", border: "1px solid var(--border)", color: "var(--text-main)", fontFamily: "inherit" }}
                    >
                      {message.bodyText.slice(0, 8000) || "(corps vide)"}
                    </pre>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {/* ── Sidebar : contexte GED / IA ── */}
          <aside className="space-y-5">
            {analysis && (
              <GradientPanel icon={Sparkles} title="Analyse IA" subtitle={`${analysis.category} · ${analysis.importance}`}>
                <p className="text-xs leading-snug" style={{ color: "rgba(180,210,255,0.85)" }}>{analysis.summary}</p>
                {analysis.suggestedAction && (
                  <div className="mt-3 rounded-lg p-2 text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "white" }}>
                    <p className="font-bold">Action suggérée</p>
                    <p className="mt-0.5 opacity-90">{analysis.suggestedAction}</p>
                  </div>
                )}
                {analysis.detectedBudget && (
                  <div className="mt-2 rounded-lg p-2 text-xs" style={{ background: "rgba(255,255,255,0.08)", color: "white" }}>
                    <p className="font-bold">Impact budget détecté</p>
                    <p className="mt-0.5 opacity-90">{formatMoney(analysis.detectedBudget.amount ?? 0, analysis.detectedBudget.currency ?? "EUR")}</p>
                  </div>
                )}
              </GradientPanel>
            )}

            {analysis?.detectedMeeting?.date && latest && (
              <ThreadMeetingCard
                meeting={{
                  title: latest.subject ?? undefined,
                  date: analysis.detectedMeeting.date ?? undefined,
                  location: analysis.detectedMeeting.location ?? undefined,
                }}
                subject={latest.subject ?? ""}
                replyTo={latest.from?.email ?? ""}
                confidence={analysis.confidence}
              />
            )}

            <ThreadAttachmentsCard threadId={id} attachments={enrichedAttachments} />

            {/* Liaisons GED — réellement alimenté (PJ importées, docs liés, correspondant). */}
            <RightRailCard title="Liaisons GED" icon={FolderKanban} iconTone="violet">
              {!hasLiaisons ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Aucune liaison pour ce thread.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {ged.importedDocs.map((d, i) => (
                    <li key={`imp-${i}`} className="rounded-lg px-2 py-1.5" style={{ background: "var(--accent-soft)" }}>
                      <p className="font-semibold" style={{ color: "var(--text-main)" }}>Document : {d.filename}</p>
                      <p className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="font-bold" style={{ color: "#15803D" }}>Ajouté à la GED</span>
                        {d.documentId ? (
                          <Link href={`/documents/${d.documentId}`} className="font-bold" style={{ color: "var(--accent)" }}>Ouvrir le document →</Link>
                        ) : null}
                      </p>
                    </li>
                  ))}
                  {docLinks.map((docId) => (
                    <li key={`doc-${docId}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(124,58,237,0.06)" }}>
                      <span style={{ color: "var(--text-main)" }}>Document lié #{docId}</span>
                      <Link href={`/documents/${docId}`} className="font-bold" style={{ color: "var(--accent)" }}>Ouvrir →</Link>
                    </li>
                  ))}
                  {ged.correspondent && (
                    <li className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(124,58,237,0.06)" }}>
                      <span style={{ color: "var(--text-main)" }}>Correspondant : {ged.correspondent.name}</span>
                      <Link href={`/correspondants/${ged.correspondent.id}`} className="font-bold" style={{ color: "var(--accent)" }}>Voir la fiche →</Link>
                    </li>
                  )}
                </ul>
              )}
            </RightRailCard>

            {/* Documents + dossiers liés au correspondant (T2). */}
            {ged.correspondent && (ged.correspondentDocs.length > 0 || ged.folders.length > 0) && (
              <RightRailCard title={`GED · ${ged.correspondent.name}`} icon={FileText} iconTone="blue">
                {ged.correspondentDocs.length > 0 && (
                  <>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Documents liés au correspondant</p>
                    <ul className="space-y-1.5">
                      {ged.correspondentDocs.map((d) => (
                        <li key={d.id} className="flex items-start gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12px] font-semibold" style={{ color: "var(--text-main)" }} title={d.title}>{d.title}</p>
                            <p className="truncate text-[10.5px]" style={{ color: "var(--text-muted)" }}>
                              {[d.type, formatShort(d.created), ...d.tags].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                          <Link href={`/documents/${d.id}`} className="shrink-0 text-[10.5px] font-bold" style={{ color: "var(--accent)" }}>Ouvrir</Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {ged.folders.length > 0 && (
                  <>
                    <p className="mb-1.5 mt-3 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Dossiers liés au correspondant</p>
                    <ul className="space-y-1.5">
                      {ged.folders.map((f) => (
                        <li key={f.id}>
                          <Link href={`/dossiers/${f.id}`} className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition hover:bg-[#FCFAF7]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                            <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.75} />
                            <span className="truncate">{f.name}</span>
                            <ExternalLink className="ml-auto h-3 w-3 shrink-0" strokeWidth={2} style={{ color: "var(--text-hint)" }} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </RightRailCard>
            )}

            <RightRailCard title="Participants" icon={User} iconTone="blue">
              <ul className="space-y-1.5 text-xs">
                {participants.map((address) => (
                  <li key={address.email} className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                    <Mail className="h-3 w-3 shrink-0" strokeWidth={2} />
                    <span className="truncate font-semibold" style={{ color: "var(--text-main)" }}>{address.name ?? address.email}</span>
                    <span className="ml-auto shrink-0 truncate font-mono text-[11px]">{address.email}</span>
                  </li>
                ))}
              </ul>
            </RightRailCard>
          </aside>
        </div>
      </PageShell>
    );
  } catch (error) {
    return (
      <PageShell>
        <PageHeader
          breadcrumb={[{ href: "/dashboard", label: "Accueil" }, { href: "/messagerie/inbox", label: "Messagerie" }, { label: "Thread" }]}
          backLink={{ href: "/messagerie/inbox", label: "Retour" }}
          title="Thread Gmail"
        />
        {isGmailReconnectError(error) ? (
          <NoGmailState oauthConfigured needsReconnect />
        ) : (
          <ErrorState title="Thread introuvable" message={error instanceof Error ? error.message : String(error)} />
        )}
      </PageShell>
    );
  }
}

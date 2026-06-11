import { Inbox, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listQueue } from "@/lib/saas/mailing/queue";
import { processQueueAction, retryItemAction, cancelItemAction } from "../actions";

export const dynamic = "force-dynamic";

const breadcrumb = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/admin/saas", label: "Gestion clients" },
  { href: "/admin/saas/mailing", label: "Mailing" },
  { label: "File d'attente" },
];

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: "En attente", bg: "#FEF3C7", fg: "#B45309" },
  sending: { label: "En cours", bg: "#DBEAFE", fg: "#1D4ED8" },
  sent: { label: "Envoyé", bg: "#DCFCE7", fg: "#15803D" },
  failed: { label: "Échoué", bg: "#FEE2E2", fg: "#B91C1C" },
  canceled: { label: "Annulé", bg: "#F1F5F9", fg: "#475569" },
  skipped: { label: "Ignoré", bg: "#F1F5F9", fg: "#475569" },
};

function date(v: unknown): string { return v ? new Date(String(v)).toLocaleString("fr-FR") : "—"; }

export default async function MailQueuePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me?.is_superuser) {
    return <PageShell><PageHeader breadcrumb={breadcrumb} title="File d'attente" /><SectionCard icon={ShieldCheck} title="Accès refusé"><p className="text-sm text-slate-600">Réservé aux superusers.</p></SectionCard></PageShell>;
  }
  const items = await listQueue(150);

  return (
    <PageShell>
      <PageHeader
        breadcrumb={breadcrumb}
        title="File d'attente des emails"
        description="Derniers messages mis en file (envoi via worker)."
        actions={<form action={processQueueAction}><button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Traiter la file</button></form>}
      />
      {sp.disabled ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Mailing désactivé : rien n&apos;a été envoyé.</div> : null}
      {sp.sent ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{sp.sent} envoyé(s), {sp.failed ?? 0} échec(s).</div> : null}
      {sp.updated ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Mis à jour.</div> : null}

      <SectionCard icon={Inbox} title={`${items.length} message(s)`} bodyClassName="p-0">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">File vide.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead><tr className="border-b text-[11px] uppercase text-slate-500" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2">Destinataire</th><th className="px-4 py-2">Objet</th><th className="px-4 py-2">Modèle</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Planifié</th><th className="px-4 py-2"></th>
              </tr></thead>
              <tbody>
                {items.map((it) => {
                  const st = STATUS[String(it.status)] ?? STATUS.pending;
                  const id = String(it.id);
                  const status = String(it.status);
                  return (
                    <tr key={id} className="border-b last:border-0" style={{ borderColor: "var(--border-soft)" }}>
                      <td className="px-4 py-2">{String(it.to_email)}</td>
                      <td className="px-4 py-2 text-slate-600">{String(it.subject ?? "")}</td>
                      <td className="px-4 py-2"><code className="font-mono text-[11px]">{(it.template_key as string) ?? "—"}</code></td>
                      <td className="px-4 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                        {it.last_error ? <div className="mt-0.5 text-[10px] text-rose-600">{String(it.last_error).slice(0, 80)}</div> : null}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-slate-500">{date(it.scheduled_at)}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1.5">
                          {status === "failed" || status === "canceled" ? (
                            <form action={retryItemAction}><input type="hidden" name="id" value={id} /><button className="h-8 rounded-lg border px-2.5 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>Relancer</button></form>
                          ) : null}
                          {status === "pending" || status === "failed" ? (
                            <form action={cancelItemAction}><input type="hidden" name="id" value={id} /><button className="h-8 rounded-lg border px-2.5 text-[11px] font-semibold" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Annuler</button></form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageShell>
  );
}

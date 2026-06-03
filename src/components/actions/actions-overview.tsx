import Link from "next/link";
import { AlertTriangle, CheckSquare, FileText, Loader, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { ActionCard } from "@/components/actions/action-card";
import { ActionAdvicePanel, type ActionAdvice } from "@/components/actions/action-advice-panel";
import type { ActionItem } from "@/lib/actions/types";

type CardDef = { label: string; value: number; color: string; icon: LucideIcon; href: string };

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function ActionSection({ title, items, color }: { title: string; items: ActionItem[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} /> {title}
      </p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {items.slice(0, 4).map((a) => <ActionCard key={a.id} action={a} />)}
      </div>
    </section>
  );
}

/** Vue d'ensemble Actions : cartes synthèse + sections + conseils IA. */
export function ActionsOverview({ actions, tips }: { actions: ActionItem[]; tips: ActionAdvice[] }) {
  const todo = actions.filter((a) => a.status === "todo");
  const inProgress = actions.filter((a) => a.status === "in-progress");
  const overdue = actions.filter((a) => a.status === "overdue");
  const ai = actions.filter((a) => a.createdFrom === "ai");
  const finance = actions.filter((a) => a.budgetItemId);
  const docs = actions.filter((a) => a.documentIds.length > 0);
  const urgent = actions.filter((a) => a.priority === "urgent" && a.status !== "done" && a.status !== "cancelled");
  const today = actions.filter((a) => isToday(a.dueDate) && a.status !== "done");

  const cards: CardDef[] = [
    { label: "À faire", value: todo.length, color: "#0B5CFF", icon: CheckSquare, href: "/actions/a-faire" },
    { label: "En cours", value: inProgress.length, color: "#16A34A", icon: Loader, href: "/actions/en-cours" },
    { label: "En retard", value: overdue.length, color: "#EF4444", icon: AlertTriangle, href: "/actions/en-retard" },
    { label: "Créées par IA", value: ai.length, color: "#7C3AED", icon: Sparkles, href: "/actions/automatiques" },
    { label: "Liées aux finances", value: finance.length, color: "#16A34A", icon: Wallet, href: "/finances" },
    { label: "Liées aux documents", value: docs.length, color: "#0B5CFF", icon: FileText, href: "/documents" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} href={c.href} className="flex flex-col rounded-xl border bg-white p-3 transition hover:-translate-y-0.5" style={{ borderColor: "var(--border)", boxShadow: "0 1px 2px rgba(8,18,37,0.04)" }}>
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${c.color}14`, color: c.color }}>
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="mt-2 text-[17px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{c.value}</span>
              <span className="text-[11px] font-medium leading-tight" style={{ color: "var(--text-muted)" }}>{c.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {urgent.length === 0 && overdue.length === 0 && today.length === 0 && ai.length === 0 ? (
            <div className="rounded-2xl border bg-white px-6 py-14 text-center" style={{ borderColor: "var(--border)" }}>
              <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(22,163,74,0.08)", color: "#16A34A" }}>
                <CheckSquare className="h-6 w-6" strokeWidth={1.6} />
              </span>
              <p className="mt-3 text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Rien d&apos;urgent</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>Aucune action urgente, en retard ou du jour.</p>
            </div>
          ) : (
            <>
              <ActionSection title="Actions urgentes" items={urgent} color="#EF4444" />
              <ActionSection title="En retard" items={overdue} color="#EF4444" />
              <ActionSection title="À faire aujourd'hui" items={today} color="#F59E0B" />
              <ActionSection title="Proposées par IA" items={ai} color="#7C3AED" />
            </>
          )}
        </div>
        <ActionAdvicePanel tips={tips} />
      </div>
    </div>
  );
}

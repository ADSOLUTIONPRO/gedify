"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Trash2, AlertTriangle, Cpu, Clock, Activity, Settings, X } from "lucide-react";

type Notif = {
  id: string;
  type: "reminder" | "job" | "activity";
  title: string;
  detail?: string;
  at: string;
  href?: string;
  tone: "info" | "warning" | "error" | "success";
};

const TONE: Record<Notif["tone"], string> = {
  info: "#2563EB",
  warning: "#D97706",
  error: "#DC2626",
  success: "#16A34A",
};

function iconFor(t: Notif["type"]) {
  return t === "reminder" ? Clock : t === "job" ? Cpu : Activity;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread" | "important">("all");
  const [baseReadAt, setBaseReadAt] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
      const data = (await res.json()) as { items?: Notif[]; unreadCount?: number; lastReadAt?: string };
      if (res.ok) {
        setItems(data.items ?? []);
        setUnread(data.unreadCount ?? 0);
        setBaseReadAt((prev) => prev || (data.lastReadAt ?? ""));
      }
    } catch {
      /* silencieux */
    }
  }, []);

  // Chargement initial + rafraîchissement périodique (60 s).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => void load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  // Fermeture au clic extérieur / Échap.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function act(action: "read" | "clear") {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { items?: Notif[]; unreadCount?: number };
      if (res.ok) {
        setItems(data.items ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } catch {
      /* silencieux */
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) void act("read"); // ouvrir = marquer lu
  }

  const shown = items.filter((n) =>
    filter === "important"
      ? n.tone === "error" || n.tone === "warning"
      : filter === "unread"
        ? n.at > baseReadAt
        : true,
  );
  const FILTERS: { key: "all" | "unread" | "important"; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "unread", label: "Non lues" },
    { key: "important", label: "Importantes" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        title="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-slate-50"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "#E11D48" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[120%] z-50 w-[360px] max-w-[92vw] overflow-hidden rounded-2xl border bg-white shadow-2xl"
          style={{ borderColor: "var(--border)" }}
          role="dialog"
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
            <span className="text-[13px] font-extrabold" style={{ color: "var(--text-main)" }}>Notifications</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void act("read")} title="Tout marquer comme lu" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition hover:bg-slate-100" style={{ color: "var(--text-muted)" }}>
                <CheckCheck className="h-3.5 w-3.5" /> Tout lu
              </button>
              <button type="button" onClick={() => void act("clear")} title="Tout supprimer" className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50">
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
              <Link href="/parametres/notifications" onClick={() => setOpen(false)} aria-label="Paramètres des notifications" title="Paramètres des notifications" className="inline-flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100" style={{ color: "var(--accent)" }}>
                <Settings className="h-4 w-4" strokeWidth={1.85} />
              </Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-1.5 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            {FILTERS.map((f) => {
              const on = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition"
                  style={{ background: on ? "var(--accent-soft)" : "transparent", color: on ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}` }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[60vh] overflow-auto">
            {shown.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                <AlertTriangle className="h-5 w-5" style={{ color: "var(--text-hint)" }} />
                <p className="text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>Aucune notification</p>
                <p className="text-[11px]" style={{ color: "var(--text-hint)" }}>Rappels, erreurs et actions importantes apparaîtront ici.</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {shown.map((n) => {
                  const Icon = iconFor(n.type);
                  const inner = (
                    <span className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--bg-card-soft)", color: TONE[n.tone] }}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{n.title}</span>
                        {n.detail ? <span className="mt-0.5 block truncate text-[11.5px]" style={{ color: "var(--text-muted)" }}>{n.detail}</span> : null}
                        <span className="mt-0.5 block text-[10.5px]" style={{ color: "var(--text-hint)" }}>{new Date(n.at).toLocaleString("fr-FR")}</span>
                      </span>
                    </span>
                  );
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} onClick={() => setOpen(false)} className="block px-3 py-2.5 transition hover:bg-slate-50">{inner}</Link>
                      ) : (
                        <span className="block px-3 py-2.5">{inner}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

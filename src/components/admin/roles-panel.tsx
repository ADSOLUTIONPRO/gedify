"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ScrollText, ShieldCheck, TriangleAlert, UserCog } from "lucide-react";

type Role = "admin" | "manager" | "editor" | "viewer";
type AdminUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_superuser: boolean;
  role: Role;
};
type AuditEntry = {
  id: string;
  at: string;
  user: string;
  action: string;
  target: string | null;
  result: string;
  details: string | null;
};

const ROLE_OPTIONS: { value: Role; label: string; desc: string }[] = [
  { value: "admin", label: "Administrateur", desc: "Tous les droits (administration, utilisateurs)." },
  { value: "manager", label: "Gestionnaire", desc: "Documents, finances, mails, règles, sauvegardes." },
  { value: "editor", label: "Éditeur", desc: "Crée/modifie documents, IA, consulte finances." },
  { value: "viewer", label: "Lecteur", desc: "Consultation seule." },
];

export function RolesPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uRes, aRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include", cache: "no-store" }),
        fetch("/api/admin/audit?limit=100", { credentials: "include", cache: "no-store" }),
      ]);
      const uData = (await uRes.json()) as { users?: AdminUser[]; error?: string };
      if (!uRes.ok || uData.error) throw new Error(uData.error ?? `HTTP ${uRes.status}`);
      setUsers(uData.users ?? []);
      const aData = (await aRes.json()) as { entries?: AuditEntry[] };
      setAudit(aData.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setRole = useCallback(
    async (user: AdminUser, role: Role) => {
      setBusy(user.id);
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { message?: string; error?: string };
          throw new Error(d.message ?? d.error ?? `HTTP ${res.status}`);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  if (loading && users.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rose-700">
          <TriangleAlert className="h-4 w-4" /> {error}
        </p>
      ) : null}

      {/* Légende des rôles */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_OPTIONS.map((r) => (
          <div key={r.value} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--text-main)" }}>
              <ShieldCheck className="h-4 w-4 text-blue-600" /> {r.label}
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Utilisateurs + rôle */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <UserCog className="h-3.5 w-3.5" /> Utilisateurs ({users.length})
        </p>
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <span className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{u.username}</span>
                {u.is_superuser ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">superuser</span> : null}
                {!u.is_active ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">inactif</span> : null}
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{u.email || `${u.first_name} ${u.last_name}`.trim() || "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                {busy === u.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                <select
                  value={u.role}
                  onChange={(e) => void setRole(u, e.target.value as Role)}
                  disabled={busy === u.id}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Journal d'audit */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <ScrollText className="h-3.5 w-3.5" /> Journal d'audit ({audit.length})
        </p>
        {audit.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aucune action sensible enregistrée pour l&apos;instant.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Utilisateur</th>
                  <th className="px-3 py-2 font-semibold">Action</th>
                  <th className="px-3 py-2 font-semibold">Détail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-500">{new Date(e.at).toLocaleString("fr-FR")}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-700">{e.user}</td>
                    <td className="px-3 py-1.5"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{e.action}</code> {e.target ?? ""}</td>
                    <td className="px-3 py-1.5 text-slate-500">{e.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { listAccessibleTenants } from "@/lib/tenant/get-current-tenant";
import { selectTenantAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SelectTenantPage() {
  // Hors SaaS : pas de sélection — on entre directement.
  if (!isMultiTenantEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/select-tenant");

  const accessible = await listAccessibleTenants();

  // Un seul espace → entrée directe (getCurrentTenant le résout automatiquement).
  if (accessible.length === 1) redirect("/");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-[20px] font-extrabold" style={{ color: "var(--text-main)" }}>
          Choisissez votre espace
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
          Connecté en tant que <span className="font-semibold">{user.email ?? user.username}</span>.
        </p>
      </div>

      {accessible.length === 0 ? (
        <div className="rounded-2xl border bg-white p-5 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[14px]" style={{ color: "var(--text-main)" }}>
            Aucun espace ne vous est attribué.
          </p>
          {user.is_superuser ? (
            <Link
              href="/admin/saas/tenants"
              className="mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-bold text-white"
              style={{ background: "var(--blue-600)" }}
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={1.85} /> Administration SaaS
            </Link>
          ) : (
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Contactez un administrateur pour être rattaché à un espace.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {accessible.map(({ tenant, role }) => (
            <li key={tenant.id}>
              <form action={selectTenantAction.bind(null, tenant.id)}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:shadow-md"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    <Building2 className="h-5 w-5" strokeWidth={1.85} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold" style={{ color: "var(--text-main)" }}>
                      {tenant.name ?? tenant.slug}
                    </span>
                    <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {tenant.slug} · {role} · {tenant.plan ?? "—"} · {tenant.status ?? "—"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

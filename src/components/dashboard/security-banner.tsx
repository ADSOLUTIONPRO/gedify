import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";

export function SecurityBanner() {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: "rgba(11,92,255,0.04)",
        border: "1px solid rgba(11,92,255,0.15)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(11,92,255,0.1)" }}
        >
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--blue-600)" }} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-extrabold" style={{ color: "var(--text-main)" }}>
            Vos données sont sécurisées
          </p>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Vos documents sont stockés en toute sécurité avec Gedify.
            Le token reste uniquement côté serveur.
          </p>
        </div>
      </div>
      <Link
        href="/parametres"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-4 text-sm font-semibold transition hover:opacity-80"
        style={{ borderColor: "rgba(11,92,255,0.3)", color: "var(--blue-600)", background: "white" }}
      >
        En savoir plus
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}

"use client";

import { useRouter, usePathname } from "next/navigation";

const OPTIONS = [24, 48, 96, 200];

/** Sélecteur du nombre de documents affichés par page (met à jour ?taille=, reset page). */
export function PageSizeSelector({ value, currentQuery }: { value: number; currentQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const usp = new URLSearchParams(currentQuery);
    usp.set("taille", e.target.value);
    usp.delete("page"); // revenir à la 1ʳᵉ page
    router.push(`${pathname}?${usp.toString()}`);
  }

  return (
    <label
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold"
      style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
    >
      <span className="hidden sm:inline">Par page</span>
      <select
        value={OPTIONS.includes(value) ? value : 24}
        onChange={onChange}
        aria-label="Nombre de documents par page"
        className="cursor-pointer bg-transparent text-[13px] font-bold outline-none"
        style={{ color: "var(--text-main)" }}
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  );
}

import { formatAmount } from "@/components/finances/finance-labels";

/**
 * En-tête de sous-page Finances : titre clair, description, nombre d'éléments
 * et total financier (§3). Rendu côté serveur dans chaque sous-page.
 */
export function FinancePageHeader({
  title,
  description,
  count,
  countNoun,
  total,
  totalLabel = "au total",
  currency = "EUR",
}: {
  title: string;
  description: string;
  count: number;
  /** Nom au singulier de l'élément (ex. « dette », « dépense »). */
  countNoun: string;
  total: number;
  /** Libellé du total (ex. « restants dus », « à encaisser »). */
  totalLabel?: string;
  currency?: string;
}) {
  const plural = count > 1 ? "s" : "";
  return (
    <header className="mb-4">
      <h1 className="text-[20px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{title}</h1>
      <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>{description}</p>
      <p className="mt-2 inline-flex flex-wrap items-center gap-x-2 text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>
        <span className="rounded-full px-2.5 py-0.5" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          {count} {countNoun}{plural}
        </span>
        <span style={{ color: "var(--text-muted)" }}>—</span>
        <span>{formatAmount(total, currency)} <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{totalLabel}</span></span>
      </p>
    </header>
  );
}

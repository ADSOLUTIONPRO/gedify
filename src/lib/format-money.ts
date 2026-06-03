const FRENCH = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number | null | undefined, currency = "EUR"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const symbol = currency === "EUR" ? "€" : currency;
  return `${FRENCH.format(amount)} ${symbol}`;
}

export function formatMoneyShort(amount: number | null | undefined, currency = "EUR"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  const symbol = currency === "EUR" ? "€" : currency;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${symbol}`;
}

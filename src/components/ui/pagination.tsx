import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  count: number;
  page: number;
  pageSize: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
  className?: string;
  bare?: boolean;
};

function buildHref(
  basePath: string,
  searchParams: Record<string, string | undefined>,
  page: number
) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function Pagination({
  count,
  page,
  pageSize,
  basePath,
  searchParams = {},
  className = "",
  bare,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const wrapperClass = bare
    ? `flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between ${className}`
    : `flex flex-col gap-3 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between ${className}`;

  return (
    <div
      className={wrapperClass}
      style={
        bare
          ? undefined
          : { borderTop: "1px solid var(--border)", color: "var(--text-muted)" }
      }
    >
      <p style={{ color: "var(--text-muted)" }}>
        Page <span className="font-bold" style={{ color: "var(--text-main)" }}>{page}</span> sur{" "}
        <span className="font-bold" style={{ color: "var(--text-main)" }}>{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <a
          aria-disabled={page <= 1}
          href={page <= 1 ? undefined : buildHref(basePath, searchParams, page - 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-3 text-xs font-bold transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Précédent
        </a>
        <a
          aria-disabled={page >= totalPages}
          href={page >= totalPages ? undefined : buildHref(basePath, searchParams, page + 1)}
          className="inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-3 text-xs font-bold transition hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          Suivant
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

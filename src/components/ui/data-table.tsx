import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export type DataTableColumn<T> = {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headClassName?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowKey: (row: T) => string | number;
  emptyTitle?: string;
  emptyDescription?: string;
  minWidth?: number;
  rowHref?: (row: T) => string;
};

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  emptyTitle = "Aucune donnée",
  emptyDescription,
  minWidth = 820,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className={`px-4 py-2.5 font-semibold ${column.headClassName ?? column.className ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={getRowKey(row)}
              className="transition hover:bg-slate-50/60"
              style={
                rowIndex !== rows.length - 1
                  ? { borderBottom: "1px solid var(--border)" }
                  : undefined
              }
            >
              {columns.map((column, index) => (
                <td
                  key={index}
                  className={`px-4 py-2.5 align-middle ${column.className ?? ""}`}
                  style={{ color: "var(--text-main)" }}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

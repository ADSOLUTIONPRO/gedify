import type { ReactNode } from "react";
import { AdminEmptyState } from "./layout";

/* Tableau de données du design system Admin : carte blanche, header gris,
   lignes hover, toolbar (titre/sous-titre/recherche/actions), empty state. */

export type AdminColumn<T> = {
  key: string;
  header: ReactNode;
  /** Rendu d'une cellule. */
  cell: (row: T) => ReactNode;
  /** Aligner à droite (montants, actions). */
  align?: "left" | "right";
  /** Cellule non rétrécissable (dates…). */
  nowrap?: boolean;
};

export function AdminDataTable<T>({
  title, subtitle, toolbar, columns, rows, rowKey, emptyTitle = "Aucun élément", emptyHint,
}: {
  title?: string;
  subtitle?: string;
  toolbar?: ReactNode;
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  emptyTitle?: string;
  emptyHint?: ReactNode;
}) {
  return (
    <div className="au-table-wrap">
      {(title || toolbar) ? (
        <div className="au-table-toolbar">
          <div className="min-w-0">
            {title ? <div className="au-table-toolbar__title">{title}</div> : null}
            {subtitle ? <div className="au-table-toolbar__sub">{subtitle}</div> : null}
          </div>
          {toolbar ? <div className="au-toolbar" style={{ marginLeft: "auto" }}>{toolbar}</div> : null}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <AdminEmptyState title={emptyTitle}>{emptyHint}</AdminEmptyState>
      ) : (
        <div className="au-table-scroll">
          <table className="au-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.key} className={c.align === "right" ? "au-table__num" : undefined}>{c.header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={rowKey(row, i)}>
                  {columns.map((c) => (
                    <td key={c.key} className={`${c.align === "right" ? "au-table__num" : ""}`} style={c.nowrap ? { whiteSpace: "nowrap" } : undefined}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

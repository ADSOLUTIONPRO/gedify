import type { ResolvedDocumentTitle } from "@/lib/documents/document-title-utils";

type DocumentTitleProps = {
  title: ResolvedDocumentTitle;
  /** Show the original filename below the title (in muted style). */
  showFilename?: boolean;
  /** Custom className for the title text. */
  className?: string;
  /** Tag for the title node (defaults to `span`). */
  as?: "span" | "p";
};

export function DocumentTitle({
  title,
  showFilename = false,
  className = "",
  as: Component = "span",
}: DocumentTitleProps) {
  const fileNameHint =
    title.originalFilename && title.originalFilename !== title.displayTitle
      ? `Fichier : ${title.originalFilename}`
      : null;

  return (
    <span className="block min-w-0">
      <Component
        className={`block truncate ${className}`}
        title={fileNameHint ? `${title.displayTitle}\n${fileNameHint}` : title.displayTitle}
      >
        {title.displayTitle}
      </Component>
      {showFilename && fileNameHint ? (
        <span
          className="mt-0.5 block truncate text-[11px]"
          style={{ color: "var(--text-muted)" }}
          title={fileNameHint}
        >
          {fileNameHint}
        </span>
      ) : null}
    </span>
  );
}

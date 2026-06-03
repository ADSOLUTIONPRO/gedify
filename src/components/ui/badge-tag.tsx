import type { PaperlessTag } from "@/lib/paperless-types";

type BadgeTagProps = {
  tag: Pick<PaperlessTag, "name" | "color" | "text_color">;
  compact?: boolean;
};

export function BadgeTag({ tag, compact = false }: BadgeTagProps) {
  const background = tag.color || "#e2e8f0";
  const text = tag.text_color || "#0f172a";

  return (
    <span
      className={`inline-flex items-center rounded-md font-bold ring-1 ring-black/5 ${
        compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
      }`}
      style={{ backgroundColor: background, color: text }}
    >
      {tag.name}
    </span>
  );
}

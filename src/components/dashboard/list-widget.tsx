import { WidgetShell, DATE_TONE_BADGE } from "@/components/dashboard/widget-shell";
import type { AgendaItem, AdminItem } from "@/lib/spaces/dashboard-data";

type AvatarProps = { name: string };

const ADMIN_TONE: Record<AdminItem["tone"], { bg: string; color: string }> = {
  success: { bg: "#DCFCE7", color: "#15803D" },
  warning: { bg: "#FEF3C7", color: "#B45309" },
  danger: { bg: "#FEE2E2", color: "#B91C1C" },
  default: { bg: "#F1F5F9", color: "#475569" },
};

/** Mini-avatar généré avec initiales sur fond coloré. */
function AvatarCircle({ name }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const hue = (name.charCodeAt(0) * 47 + name.charCodeAt(1) * 13) % 360;
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ background: `hsl(${hue},55%,55%)` }}
      title={name}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

/**
 * Widget liste (Calendrier, Contacts, Rappels, Administration) :
 * valeur + libellé, tendance optionnelle, liste d'items, CTA coloré.
 */
export function ListWidget({
  spaceId,
  title,
  href,
  value,
  label,
  trend,
  agenda,
  adminRows,
  avatarNames,
  extraCount,
  ctaLabel,
  ctaHref,
  dragHandleProps,
}: {
  spaceId: string;
  title: string;
  href?: string;
  value: string | number;
  label: string;
  trend?: string;
  agenda?: AgendaItem[];
  adminRows?: AdminItem[];
  avatarNames?: string[];
  extraCount?: number;
  ctaLabel?: string;
  ctaHref?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  return (
    <WidgetShell spaceId={spaceId} title={title} href={href} ctaLabel={ctaLabel} ctaHref={ctaHref} dragHandleProps={dragHandleProps}>
      <p className="text-[28px] font-extrabold leading-none tabular-nums" style={{ color: "var(--text-main)" }}>
        {value}
      </p>
      <p className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      {trend ? (
        <p className="mt-1 text-[12px] font-medium" style={{ color: "var(--text-hint)" }}>
          {trend}
        </p>
      ) : null}

      <div className="mt-3 flex-1 space-y-1.5">
        {agenda && agenda.length > 0 ? (
          agenda.slice(0, 3).map((item, i) => {
            const tone = DATE_TONE_BADGE[item.tone];
            return (
              <div key={`${item.title}-${i}`} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px] font-medium" style={{ color: "var(--text-main)" }}>
                  {item.title}
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.color }}>
                  {item.badge}
                </span>
              </div>
            );
          })
        ) : adminRows && adminRows.length > 0 ? (
          adminRows.map((row) => {
            const tone = ADMIN_TONE[row.tone];
            return (
              <div key={row.label} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                  {row.label}
                </span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: tone.bg, color: tone.color }}>
                  {row.value}
                </span>
              </div>
            );
          })
        ) : !avatarNames ? (
          <p className="text-[12px]" style={{ color: "var(--text-hint)" }}>
            Aucune donnée récente
          </p>
        ) : null}
      </div>

      {/* Avatars (Contacts) */}
      {avatarNames && avatarNames.length > 0 ? (
        <div className="mt-3 flex items-center gap-1">
          {avatarNames.slice(0, 4).map((name) => (
            <AvatarCircle key={name} name={name} />
          ))}
          {typeof extraCount === "number" && extraCount > 0 ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "#F1F5F9", color: "#475569" }}>
              +{extraCount}
            </span>
          ) : null}
        </div>
      ) : null}
    </WidgetShell>
  );
}

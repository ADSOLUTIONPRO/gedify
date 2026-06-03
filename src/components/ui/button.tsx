import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "ghost"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon-sm" | "icon-md";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-xl",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-11 px-4 text-sm rounded-2xl",
  "icon-sm": "h-8 w-8 rounded-xl",
  "icon-md": "h-10 w-10 rounded-xl",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-[0_6px_16px_-6px_rgba(37,99,235,0.5)] hover:from-blue-500 hover:to-blue-600",
  secondary:
    "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
  success:
    "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] hover:from-emerald-500 hover:to-emerald-600",
  warning:
    "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  danger:
    "border border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
  ghost:
    "text-slate-700 hover:bg-slate-100",
  link:
    "text-blue-700 hover:text-blue-900 hover:underline px-0 h-auto rounded-none",
};

type InternalProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

type AsButtonProps = InternalProps &
  Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "className" | "children"
  > & {
    as?: "button";
    href?: never;
  };

type AsLinkProps = InternalProps &
  Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    "className" | "children" | "href"
  > & {
    as?: "link";
    href: string;
    external?: boolean;
  };

export type ButtonProps = AsButtonProps | AsLinkProps;

const BASE_CLASS =
  "inline-flex items-center justify-center gap-1.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button(props: ButtonProps) {
  // Extract every prop that belongs to <Button>; never spread these onto the DOM/Link.
  const {
    variant = "secondary",
    size = "md",
    icon: Icon,
    iconRight: IconRight,
    loading,
    className = "",
    children,
    ...rest
  } = props as InternalProps & Record<string, unknown>;

  const isIconOnly = size === "icon-sm" || size === "icon-md";
  const composed = `${BASE_CLASS} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim();

  const inner = (
    <>
      {loading ? (
        <Spinner />
      ) : Icon ? (
        <Icon
          className={isIconOnly ? "h-4 w-4" : "h-3.5 w-3.5"}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ) : null}
      {!isIconOnly && children}
      {IconRight && !isIconOnly && !loading ? (
        <IconRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      ) : null}
    </>
  );

  if (typeof (rest as { href?: string }).href === "string") {
    // Link branch — strip props that don't belong to <Link> / <a>.
    const {
      href,
      external,
      as: _as,
      ...anchorProps
    } = rest as unknown as {
      href: string;
      external?: boolean;
      as?: string;
    } & AnchorHTMLAttributes<HTMLAnchorElement>;
    void _as;

    if (external) {
      return (
        <a
          {...anchorProps}
          href={href}
          className={composed}
          target="_blank"
          rel="noreferrer"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link {...anchorProps} href={href} className={composed}>
        {inner}
      </Link>
    );
  }

  const {
    as: _as,
    ...buttonProps
  } = rest as { as?: string } & ButtonHTMLAttributes<HTMLButtonElement>;
  void _as;
  return (
    <button {...buttonProps} className={composed}>
      {inner}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}

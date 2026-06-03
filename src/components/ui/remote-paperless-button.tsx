import { getPaperlessPublicUrl } from "@/lib/paperless";

type RemotePaperlessButtonProps = {
  path?: string;
  label?: string;
  variant?: "outline" | "solid" | "subtle";
  className?: string;
};

const variantClasses = {
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  solid: "bg-slate-900 text-white hover:bg-slate-800",
  subtle: "text-blue-700 hover:underline",
} as const;

export function RemotePaperlessButton({
  path = "/",
  label = "Ouvrir le document",
  variant = "outline",
  className = "",
}: RemotePaperlessButtonProps) {
  const baseUrl = getPaperlessPublicUrl();

  if (!baseUrl) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseClass =
    variant === "subtle"
      ? "inline-flex items-center text-sm font-bold"
      : "inline-flex h-11 items-center rounded-lg px-4 text-sm font-bold transition";

  return (
    <a
      href={`${baseUrl}${normalizedPath}`}
      target="_blank"
      rel="noreferrer"
      className={`${baseClass} ${variantClasses[variant]} ${className}`}
    >
      {label}
    </a>
  );
}

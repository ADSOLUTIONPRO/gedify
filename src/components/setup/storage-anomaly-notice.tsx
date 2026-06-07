import { AlertOctagon, HardDrive } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

/**
 * Écran d'erreur explicite affiché À LA PLACE de l'assistant de première
 * installation lorsqu'une base GEDify existante est introuvable (volume non
 * monté / chemin de stockage modifié). But : ne JAMAIS laisser un NAS existant
 * repartir sur une installation neuve. Aucune donnée n'est touchée.
 */
export function StorageAnomalyNotice({ reason }: { reason: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: "var(--bg-page)" }}>
      <div className="w-full max-w-[520px]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <BrandLogo variant="full" className="h-12 w-auto" />
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--gedify-orange)" }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--gedify-orange-soft)", color: "#B45309" }}>
              <AlertOctagon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <h1 className="text-[17px] font-extrabold" style={{ color: "var(--text-main)" }}>
              Base GEDify existante introuvable
            </h1>
          </div>

          <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-main)" }}>
            {reason}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Par sécurité, l&apos;assistant de première installation a été
            <strong> bloqué</strong> : vos données existantes n&apos;ont pas été touchées et
            aucun compte n&apos;a été supprimé.
          </p>

          <div className="mt-4 rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
            <p className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>
              <HardDrive className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> À vérifier
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              <li>Le montage du volume : <code className="font-mono">/volume5/docker/gedify/data:/app/.data</code></li>
              <li><code className="font-mono">DATA_DIR=/app/.data</code> et <code className="font-mono">DATABASE_URL=file:/app/.data/gedify.sqlite</code></li>
              <li>Que Watchtower/Compose n&apos;a pas recréé un volume anonyme à la place du bind mount</li>
              <li>Consultez <code className="font-mono">docker logs</code> : lignes <code className="font-mono">[storage]</code> / <code className="font-mono">[auth]</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

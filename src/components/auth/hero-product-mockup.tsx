import { Cpu, ScanLine, Cloud, Lock } from "lucide-react";

/* Maquette produit (CSS pur, aucune image lourde) : panneau sombre « Mes
   documents » + liste + aperçu + badges flottants IA/OCR/Cloud/Sécurité. */

const DOCS = [
  { name: "Facture électricité.pdf", meta: "PDF · 420 Ko", tag: "Factures", tagBg: "#1E3A8A", date: "14/05/2024" },
  { name: "Assurance auto.pdf", meta: "PDF · 1,2 Mo", tag: "Assurances", tagBg: "#3730A3", date: "12/05/2024" },
  { name: "Déclaration 2025.pdf", meta: "PDF · 980 Ko", tag: "Impôts", tagBg: "#155E75", date: "10/05/2024" },
  { name: "Devis client.pdf", meta: "PDF · 310 Ko", tag: "Clients", tagBg: "#9D174D", date: "09/05/2024" },
  { name: "Urssaf.pdf", meta: "PDF · 650 Ko", tag: "Activité", tagBg: "#115E59", date: "08/05/2024" },
];

function FloatBadge({ icon: Icon, label, className }: { icon: typeof Cpu; label: string; className: string }) {
  return (
    <div className={`absolute hidden items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg backdrop-blur lg:flex ${className}`} style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)" }}>
      <Icon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} aria-hidden="true" />
      {label}
    </div>
  );
}

export function HeroProductMockup() {
  return (
    <div className="relative mt-8 w-full">
      <FloatBadge icon={Cpu} label="IA" className="-left-2 top-10" />
      <FloatBadge icon={ScanLine} label="OCR" className="-left-3 bottom-16" />
      <FloatBadge icon={Cloud} label="Cloud" className="-right-2 top-6" />
      <FloatBadge icon={Lock} label="Sécurité" className="-right-3 bottom-10" />

      <div className="overflow-hidden rounded-2xl border shadow-2xl" style={{ background: "#0B1220", borderColor: "rgba(255,255,255,0.1)" }}>
        {/* Barre supérieure */}
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 text-[13px] font-bold text-white">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> Gedify
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md px-2 py-1 text-[10px] text-slate-300" style={{ background: "rgba(255,255,255,0.06)" }}>Rechercher…</span>
            <span className="rounded-md px-2 py-1 text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>+ Nouveau</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_240px]">
          {/* Liste documents */}
          <div className="p-3">
            <div className="mb-2 text-[12px] font-bold text-white">Mes documents</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {["Tous", "Maison", "Factures", "Impôts", "Assurances", "Clients"].map((f, i) => (
                <span key={f} className="rounded-md px-2 py-0.5 text-[10px]" style={i === 0 ? { background: "var(--accent)", color: "#fff" } : { background: "rgba(255,255,255,0.06)", color: "#cbd5e1" }}>{f}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {DOCS.map((d) => (
                <div key={d.name} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold text-white">{d.name}</div>
                    <div className="text-[10px] text-slate-400">{d.meta}</div>
                  </div>
                  <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: d.tagBg }}>{d.tag}</span>
                  <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">{d.date}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Aperçu document */}
          <div className="border-t p-3 md:border-l md:border-t-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="mb-2 text-[11px] font-bold text-white">Facture électricité.pdf</div>
            <div className="mb-3 rounded-lg bg-white/95 p-3">
              <div className="mb-2 h-2 w-16 rounded bg-slate-300" />
              <div className="space-y-1">
                {[80, 60, 70, 50].map((w, i) => <div key={i} className="h-1.5 rounded bg-slate-200" style={{ width: `${w}%` }} />)}
              </div>
              <div className="mt-3 h-6 w-20 rounded" style={{ background: "var(--accent-soft)" }} />
            </div>
            <dl className="space-y-1.5 text-[10.5px]">
              {[["Catégorie", "Factures"], ["Type", "Facture"], ["Taille", "420 Ko"], ["Modifié", "14/05/2024"]].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between"><dt className="text-slate-400">{k}</dt><dd className="font-semibold text-slate-200">{v}</dd></div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

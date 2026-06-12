"use client";

import { useMemo, useState } from "react";
import type { ResponsiveVariants, DeviceKey, DeviceVariant } from "@/lib/saas/mailing/template-store";

/* Éditeur de modèle d'email : 3 variantes responsive (desktop/tablette/mobile)
   éditées SÉPARÉMENT, modes visuel (insertion de blocs) / code (HTML+CSS),
   aperçu en direct (iframe sandboxée) + variables + envoi de test.
   Architecture évolutive : variantes stockées en JSON par device. */

const DEVICES: { key: DeviceKey; label: string; width: number }[] = [
  { key: "desktop", label: "Desktop", width: 900 },
  { key: "tablet", label: "Tablette", width: 768 },
  { key: "mobile", label: "Smartphone", width: 390 },
];

const BLOCKS: { label: string; html: string }[] = [
  { label: "Titre", html: '<h1 style="font-size:22px;color:#0E7490;margin:0 0 12px">Titre</h1>' },
  { label: "Texte", html: '<p style="margin:0 0 14px;line-height:1.6">Votre texte ici.</p>' },
  { label: "Bouton", html: '<p style="margin:22px 0"><a href="{{appUrl}}" style="background:#0E7490;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;display:inline-block;font-weight:700">Action</a></p>' },
  { label: "Image", html: '<p style="margin:0 0 14px"><img src="{{appUrl}}/gedify-icon.png" alt="image" style="max-width:100%"/></p>' },
  { label: "Séparateur", html: '<hr style="border:0;border-top:1px solid #e2e8f0;margin:18px 0"/>' },
  { label: "Espaceur", html: '<div style="height:24px"></div>' },
  { label: "2 colonnes", html: '<table width="100%"><tr><td style="width:50%;vertical-align:top;padding-right:8px">Colonne A</td><td style="width:50%;vertical-align:top;padding-left:8px">Colonne B</td></tr></table>' },
  { label: "Encadré info", html: '<div style="background:#EFF6FF;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin:0 0 14px">Information</div>' },
  { label: "Encadré alerte", html: '<div style="background:#FEF2F2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:0 0 14px;color:#991b1b">Attention</div>' },
  { label: "Tableau", html: '<table width="100%" style="border-collapse:collapse;margin:0 0 14px"><tr><th style="border:1px solid #e2e8f0;padding:6px;text-align:left">Col 1</th><th style="border:1px solid #e2e8f0;padding:6px;text-align:left">Col 2</th></tr><tr><td style="border:1px solid #e2e8f0;padding:6px">A</td><td style="border:1px solid #e2e8f0;padding:6px">B</td></tr></table>' },
  { label: "Lien", html: '<p style="margin:0 0 14px"><a href="{{appUrl}}" style="color:#0E7490">Lien</a></p>' },
  { label: "Signature", html: '<p style="margin:18px 0 0;color:#64748b">L\'équipe {{appName}}</p>' },
  { label: "Pied légal", html: '<p style="margin:18px 0 0;font-size:11px;color:#94a3b8">© {{appName}} — désinscription dans le pied de page.</p>' },
];

export type VarCategory = { category: string; keys: string[] };

function substitute(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

export function MailTemplateEditor({
  templateKey, name, initialSubject, initialPreheader, initialVariants, variables, saveAction, sendTestAction,
}: {
  templateKey: string;
  name: string;
  initialSubject: string;
  initialPreheader: string;
  initialVariants: ResponsiveVariants;
  variables: VarCategory[];
  saveAction: (formData: FormData) => void;
  sendTestAction: (formData: FormData) => void;
}) {
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [mode, setMode] = useState<"visual" | "code">("visual");
  const [subject, setSubject] = useState(initialSubject);
  const [preheader, setPreheader] = useState(initialPreheader);
  const [variants, setVariants] = useState<ResponsiveVariants>(initialVariants);
  const [full, setFull] = useState(false);

  const cur = variants[device];
  const setCur = (patch: Partial<DeviceVariant>) => setVariants((v) => ({ ...v, [device]: { ...v[device], ...patch } }));
  const append = (html: string) => setCur({ html: `${cur.html}\n${html}` });

  const fakeVars = useMemo(() => {
    const out: Record<string, string> = { appName: "Gedify", appUrl: "https://staging.gedify.fr", recipientName: "Camille Martin", subject, bodyHtml: "<p>Contenu d'exemple.</p>" };
    for (const c of variables) for (const k of c.keys) if (!(k in out)) out[k] = `«${k}»`;
    return out;
  }, [variables, subject]);

  const width = DEVICES.find((d) => d.key === device)!.width;
  const srcDoc = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><style>body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:16px;background:#f1f5f9;color:#1f2937}.wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e2e8f0}${cur.css}</style></head><body><div class="wrap">${substitute(cur.html, fakeVars)}</div></body></html>`;

  const copyFrom = (from: DeviceKey) => setVariants((v) => ({ ...v, [device]: { ...v[from] } }));
  const tabBtn = (active: boolean): React.CSSProperties => ({ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", border: "1px solid var(--border)", background: active ? "var(--blue-600)" : "#fff", color: active ? "#fff" : "var(--text-main)" });

  return (
    <div className="space-y-3">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex gap-1">{DEVICES.map((d) => <button key={d.key} type="button" onClick={() => setDevice(d.key)} style={tabBtn(device === d.key)}>{d.label}</button>)}</div>
        <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} />
        <div className="flex gap-1">
          <button type="button" onClick={() => setMode("visual")} style={tabBtn(mode === "visual")}>Visuel</button>
          <button type="button" onClick={() => setMode("code")} style={tabBtn(mode === "code")}>Code</button>
        </div>
        <span className="mx-1 h-5 w-px" style={{ background: "var(--border)" }} />
        <button type="button" onClick={() => setFull((f) => !f)} className="rounded-lg border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)" }}>{full ? "Quitter plein écran" : "Aperçu plein écran"}</button>
        {device !== "desktop" ? <button type="button" onClick={() => copyFrom("desktop")} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>Copier depuis Desktop</button> : null}
        {device === "mobile" ? <button type="button" onClick={() => copyFrom("tablet")} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>Copier depuis Tablette</button> : null}
      </div>

      <div className={full ? "" : "grid gap-3 lg:grid-cols-[1fr_1fr]"}>
        {/* Édition */}
        {!full ? (
          <div className="space-y-2 rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Objet</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9 w-full rounded-lg border px-2 text-[13px]" style={{ borderColor: "var(--border)" }} /></label>
              <label className="space-y-1 text-[12px]"><span className="font-semibold">Preheader</span><input value={preheader} onChange={(e) => setPreheader(e.target.value)} className="h-9 w-full rounded-lg border px-2 text-[13px]" style={{ borderColor: "var(--border)" }} /></label>
            </div>

            {mode === "visual" ? (
              <div className="flex flex-wrap gap-1.5">
                {BLOCKS.map((b) => <button key={b.label} type="button" onClick={() => append(b.html)} className="rounded-lg border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: "var(--border)" }}>+ {b.label}</button>)}
              </div>
            ) : null}

            <label className="block space-y-1 text-[12px]">
              <span className="font-semibold">HTML — {DEVICES.find((d) => d.key === device)!.label}</span>
              <textarea value={cur.html} onChange={(e) => setCur({ html: e.target.value })} rows={mode === "code" ? 12 : 14} className="w-full rounded-lg border p-2 font-mono text-[12px]" style={{ borderColor: "var(--border)" }} />
            </label>
            {mode === "code" ? (
              <label className="block space-y-1 text-[12px]">
                <span className="font-semibold">CSS — {DEVICES.find((d) => d.key === device)!.label}</span>
                <textarea value={cur.css} onChange={(e) => setCur({ css: e.target.value })} rows={5} className="w-full rounded-lg border p-2 font-mono text-[12px]" style={{ borderColor: "var(--border)" }} placeholder="@media (max-width:600px){ ... }" />
              </label>
            ) : null}

            <div>
              <div className="mb-1 text-[11px] font-bold uppercase text-slate-500">Variables (cliquer pour insérer)</div>
              <div className="max-h-32 space-y-1.5 overflow-auto">
                {variables.map((c) => (
                  <div key={c.category}>
                    <div className="text-[10px] font-bold uppercase text-slate-400">{c.category}</div>
                    <div className="flex flex-wrap gap-1">
                      {c.keys.map((k) => <button key={k} type="button" onClick={() => append(`{{${k}}}`)} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600">{`{{${k}}}`}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Aperçu */}
        <div className="rounded-2xl border bg-slate-50 p-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-2 text-[11px] font-semibold text-slate-500">Aperçu · {DEVICES.find((d) => d.key === device)!.label} ({width}px) · objet : <span className="font-bold text-slate-700">{subject}</span></div>
          <div className="mx-auto overflow-hidden rounded-xl border bg-white" style={{ width: Math.min(width, full ? 1100 : 560), maxWidth: "100%", borderColor: "var(--border)" }}>
            <iframe title="Aperçu email" sandbox="" srcDoc={srcDoc} className="w-full" style={{ height: full ? 780 : 560, border: 0 }} />
          </div>
        </div>
      </div>

      {/* Sauvegarde + test */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
        <form action={saveAction}>
          <input type="hidden" name="key" value={templateKey} />
          <input type="hidden" name="subject" value={subject} />
          <input type="hidden" name="preheader" value={preheader} />
          <input type="hidden" name="variants" value={JSON.stringify(variants)} />
          <button className="h-9 rounded-xl px-4 text-[13px] font-bold text-white" style={{ background: "var(--blue-600)" }}>Enregistrer</button>
        </form>
        <form action={sendTestAction} className="flex items-center gap-2">
          <input type="hidden" name="key" value={templateKey} />
          <input name="to" type="email" required placeholder="email de test" className="h-9 rounded-lg border px-2 text-[13px]" style={{ borderColor: "var(--border)" }} />
          <button className="h-9 rounded-lg border px-3 text-[12px] font-bold" style={{ borderColor: "var(--border)" }}>Envoyer un test</button>
        </form>
        <span className="text-[11px] text-slate-500">Modèle <code className="font-mono">{name}</code> · HTML nettoyé à l&apos;enregistrement (aucun script).</span>
      </div>
    </div>
  );
}

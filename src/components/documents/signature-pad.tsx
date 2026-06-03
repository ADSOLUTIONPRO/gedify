"use client";

import { useRef, useState } from "react";
import { Eraser, Upload } from "lucide-react";

type Tab = "draw" | "image" | "text";

type Props = {
  /** Texte par défaut de l'onglet « Texte » (ex. initiales pour un paraphe). */
  defaultText?: string;
  /** Appelé quand une signature/paraphe PNG transparent est produit (dataURL). */
  onGenerate: (dataUrl: string) => void;
  /** Libellé du bouton de validation. */
  ctaLabel?: string;
};

/**
 * Pad de création de signature/paraphe : dessin (canvas natif), import PNG, ou
 * texte → image PNG transparente. Réutilisé par les paramètres et l'éditeur.
 */
export function SignaturePad({ defaultText = "", onGenerate, ctaLabel = "Utiliser" }: Props) {
  const [tab, setTab] = useState<Tab>("draw");
  const [text, setText] = useState(defaultText);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F172A";
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk.current = true;
  }
  function up() { drawing.current = false; }
  function clear() {
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
  }

  function useDrawn() {
    const c = canvasRef.current;
    if (!c || !hasInk.current) { setError("Dessinez d'abord."); return; }
    setError(null);
    onGenerate(c.toDataURL("image/png"));
    clear();
  }
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") onGenerate(reader.result); };
    reader.readAsDataURL(f);
  }
  function useTyped() {
    const v = text.trim();
    if (!v) { setError("Tapez un texte."); return; }
    setError(null);
    const c = document.createElement("canvas");
    c.width = 600; c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#0F172A";
    ctx.font = "italic 700 84px 'Segoe Script','Brush Script MT',cursive";
    ctx.textBaseline = "middle";
    ctx.fillText(v, 16, 110);
    onGenerate(c.toDataURL("image/png"));
  }

  return (
    <div className="rounded-2xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
      <div className="mb-2 flex gap-1">
        {(["draw", "image", "text"] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className="flex-1 rounded-lg py-1.5 text-[12px] font-bold transition"
            style={{ background: tab === t ? "var(--accent-soft)" : "transparent", color: tab === t ? "var(--accent)" : "var(--text-muted)" }}>
            {t === "draw" ? "Dessiner" : t === "image" ? "Importer" : "Texte"}
          </button>
        ))}
      </div>

      {tab === "draw" ? (
        <div>
          <canvas ref={canvasRef} width={500} height={180} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
            className="w-full touch-none rounded-lg border bg-white" style={{ borderColor: "var(--border)", aspectRatio: "500/180" }} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={clear} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[12.5px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
              <Eraser className="h-4 w-4" strokeWidth={1.85} /> Effacer
            </button>
            <button type="button" onClick={useDrawn} className="h-9 flex-1 rounded-lg text-[12.5px] font-bold text-white" style={{ background: "var(--accent)" }}>{ctaLabel}</button>
          </div>
        </div>
      ) : null}

      {tab === "image" ? (
        <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-[12.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <Upload className="h-5 w-5" strokeWidth={1.75} /> Importer une image PNG
          <input type="file" accept="image/png,image/*" onChange={onImport} className="hidden" />
        </label>
      ) : null}

      {tab === "text" ? (
        <div className="space-y-2">
          <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Texte (nom, initiales…)" className="h-10 w-full rounded-lg border px-3 text-[14px] outline-none focus:border-[var(--accent)]" style={{ borderColor: "var(--border)" }} />
          <button type="button" onClick={useTyped} className="h-9 w-full rounded-lg text-[12.5px] font-bold text-white" style={{ background: "var(--accent)" }}>{ctaLabel}</button>
        </div>
      ) : null}

      {error ? <p className="mt-1.5 text-[12px] font-semibold" style={{ color: "var(--danger)" }}>{error}</p> : null}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eraser, Save, Upload, XCircle } from "lucide-react";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const router = useRouter();
  const [name, setName] = useState("Ma signature");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0f172a";
  }, []);

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const point = pointer(event);
    lastPointRef.current = point;
  }

  function endDraw() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const current = pointer(event);
    const last = lastPointRef.current ?? current;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    lastPointRef.current = current;
  }

  function pointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/writer/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dataUrl,
          width: canvas.offsetWidth,
          height: canvas.offsetHeight,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(body.details ?? body.error ?? "Enregistrement impossible.");
      }
      setFeedback({ kind: "success", message: "Signature enregistrée." });
      clear();
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Enregistrement impossible.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setFeedback({ kind: "error", message: "Format d'image non supporté." });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result?.toString();
      if (!dataUrl) return;
      setSaving(true);
      setFeedback(null);
      try {
        const response = await fetch("/api/writer/signatures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name || file.name, dataUrl }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
          throw new Error(body.details ?? body.error ?? "Import impossible.");
        }
        setFeedback({ kind: "success", message: "Signature importée." });
        router.refresh();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Import impossible.",
        });
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nom
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <canvas
          ref={canvasRef}
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="h-48 w-full cursor-crosshair touch-none"
          aria-label="Zone de signature"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Eraser className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Effacer
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {saving ? "Enregistrement..." : "Enregistrer ce dessin"}
        </button>
        <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Upload className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Importer une image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={uploadFile}
            className="hidden"
          />
        </label>
      </div>

      {feedback ? (
        <p
          className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            feedback.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </p>
      ) : null}
    </div>
  );
}

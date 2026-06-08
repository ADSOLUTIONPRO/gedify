"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { ToastDetail, ToastTone } from "@/components/ui/toast";

type Item = { id: number; message: string; tone: ToastTone };

const TONE: Record<ToastTone, { bg: string; color: string; icon: typeof Info }> = {
  default: { bg: "var(--text-main)", color: "#fff", icon: Info },
  success: { bg: "var(--accent)", color: "#fff", icon: CheckCircle2 },
  error: { bg: "#E11D48", color: "#fff", icon: XCircle },
};

/** Conteneur de toasts (monté une fois dans le layout racine). */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail?.message) return;
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev, { id, message: detail.message, tone: detail.tone ?? "default" }]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
    };
    window.addEventListener("gedify-toast", handler);
    return () => window.removeEventListener("gedify-toast", handler);
  }, []);

  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {items.map((t) => {
        const tone = TONE[t.tone];
        const Icon = tone.icon;
        return (
          <div key={t.id} className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-semibold shadow-xl" style={{ background: tone.bg, color: tone.color }}>
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

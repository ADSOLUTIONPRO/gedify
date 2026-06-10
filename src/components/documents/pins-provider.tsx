"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/* Contexte « documents épinglés » (par utilisateur), DISTINCT des favoris.
   Charge l'ensemble des ids une fois, expose `has` + `toggle` optimiste avec
   rollback. Monté dans l'espace Documents → le bouton épingle s'y branche. */

type PinCtx = { has: (id: number) => boolean; toggle: (id: number) => void };
const Ctx = createContext<PinCtx | null>(null);

export function PinsProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/pins", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((d: { ids?: number[] }) => { if (!cancelled) setIds(new Set(d.ids ?? [])); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const has = useCallback((id: number) => ids.has(id), [ids]);

  const toggle = useCallback((id: number) => {
    const next = !ids.has(id);
    setIds((prev) => { const s = new Set(prev); if (next) s.add(id); else s.delete(id); return s; });
    void fetch(`/api/documents/${id}/pin`, { method: next ? "POST" : "DELETE", credentials: "include" })
      .then((res) => { if (!res.ok) throw new Error(); })
      .catch(() => setIds((prev) => { const s = new Set(prev); if (next) s.delete(id); else s.add(id); return s; }));
  }, [ids]);

  return <Ctx.Provider value={{ has, toggle }}>{children}</Ctx.Provider>;
}

export function usePins(): PinCtx | null {
  return useContext(Ctx);
}

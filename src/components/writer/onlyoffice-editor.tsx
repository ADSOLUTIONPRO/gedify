"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

type Props = {
  documentId: string;
};

type EditorPayload = {
  serverUrl: string;
  config: Record<string, unknown>;
};

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (elementId: string, config: Record<string, unknown>) => unknown;
    };
  }
}

export function OnlyOfficeEditor({ documentId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorElementId = `onlyoffice-editor-${documentId}`;
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;

    async function bootstrap() {
      try {
        const response = await fetch(`/api/writer/documents/${documentId}/onlyoffice-config`);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
          throw new Error(body.message ?? body.error ?? `HTTP ${response.status}`);
        }
        const payload = (await response.json()) as EditorPayload;
        if (disposed) return;

        await loadOnlyOfficeScript(`${payload.serverUrl}/web-apps/apps/api/documents/api.js`);
        if (disposed) return;
        if (!window.DocsAPI) {
          throw new Error("API ONLYOFFICE indisponible (window.DocsAPI manquant).");
        }
        new window.DocsAPI.DocEditor(editorElementId, payload.config);
        setStatus("ready");
      } catch (caught) {
        if (disposed) return;
        setError(caught instanceof Error ? caught.message : "Chargement impossible.");
        setStatus("error");
      }
    }

    bootstrap();

    return () => {
      disposed = true;
    };
  }, [documentId, editorElementId]);

  return (
    <div className="relative h-full min-h-[70vh] w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_8px_28px_-12px_rgba(15,23,42,0.10)]">
      {status === "loading" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-700">Chargement de ONLYOFFICE...</p>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 p-6 text-center backdrop-blur">
          <AlertTriangle className="h-7 w-7 text-amber-500" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm font-bold text-slate-900">Éditeur ONLYOFFICE indisponible</p>
          <p className="max-w-md text-xs leading-6 text-slate-600">{error}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            Vérifiez que <code className="rounded bg-slate-100 px-1 font-mono">ONLYOFFICE_DOCUMENT_SERVER_URL</code> pointe vers une instance accessible.
          </p>
        </div>
      ) : null}
      <div ref={containerRef} id={editorElementId} className="h-full min-h-[70vh] w-full" />
    </div>
  );
}

const scriptPromises = new Map<string, Promise<void>>();

function loadOnlyOfficeScript(src: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.DocsAPI) return Promise.resolve();
  const cached = scriptPromises.get(src);
  if (cached) return cached;
  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-onlyoffice="${src}"]`);
    if (existing) {
      if (window.DocsAPI) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Échec du chargement du script ONLYOFFICE.")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.onlyoffice = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Échec du chargement du script ONLYOFFICE."));
    document.head.appendChild(script);
  });
  scriptPromises.set(src, promise);
  return promise;
}

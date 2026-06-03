"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProcessingStatus =
  | "imported"
  | "queued"
  | "ocr_pending"
  | "ocr_running"
  | "ocr_done"
  | "indexing"
  | "classifying"
  | "ready_for_ai"
  | "ai_pending"
  | "ai_running"
  | "ai_done"
  | "error"
  | "unknown";

export type DocumentProcessingData = {
  documentId: number;
  status: ProcessingStatus;
  progressPercent: number;
  progressIsEstimated: boolean;
  progressLabel: string;
  currentStep: string;
  tasks: {
    id: string;
    humanName: string;
    status: string;
    humanStatus: string;
    createdAt: string;
    finishedAt: string | null;
    error: string | null;
  }[];
  lastUpdatedAt: string | null;
  errorMessage: string | null;
  ocrTextAvailable: boolean;
  ocrTextLength: number;
  ocrExtract: string | null;
  canRunAi: boolean;
  aiAnalysisId: string | null;
  aiAnalysisStatus: string | null;
};

export type FetchErrorType = "auth" | "not_found" | "server" | "network" | null;

const TERMINAL_STATUSES: ProcessingStatus[] = ["ready_for_ai", "ai_done", "error"];
const POLL_INTERVAL_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 4;

export function useDocumentProcessingStatus(documentId: number) {
  const [data, setData] = useState<DocumentProcessingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchErrorType, setFetchErrorType] = useState<FetchErrorType>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    consecutiveErrorsRef.current = 0;

    async function poll(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
        setFetchError(null);
        setFetchErrorType(null);
      }
      try {
        const res = await fetch(`/api/documents/${documentId}/processing-status`, {
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 401) {
          if (cancelled) return;
          setFetchError("Session expirée — veuillez vous reconnecter.");
          setFetchErrorType("auth");
          setLoading(false);
          // Stop polling immediately — no retry on auth failure
          return;
        }

        if (res.status === 404) {
          if (cancelled) return;
          setFetchError("Document introuvable.");
          setFetchErrorType("not_found");
          setLoading(false);
          // Stop polling for 404
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as DocumentProcessingData;
        if (cancelled) return;
        consecutiveErrorsRef.current = 0;
        setData(json);
        setFetchError(null);
        setFetchErrorType(null);
        setLoading(false);

        if (!TERMINAL_STATUSES.includes(json.status)) {
          timerRef.current = setTimeout(() => {
            if (!cancelled) void poll(false);
          }, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        consecutiveErrorsRef.current += 1;
        setFetchError(err instanceof Error ? err.message : "Erreur réseau");
        setFetchErrorType("network");
        setLoading(false);

        // Exponential back-off, stop after MAX_CONSECUTIVE_ERRORS
        if (consecutiveErrorsRef.current < MAX_CONSECUTIVE_ERRORS) {
          const delay = POLL_INTERVAL_MS * Math.pow(2, consecutiveErrorsRef.current - 1);
          timerRef.current = setTimeout(() => {
            if (!cancelled) void poll(false);
          }, Math.min(delay, 30_000));
        }
      }
    }

    void poll(true);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [documentId, refreshKey]);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    consecutiveErrorsRef.current = 0;
    setRefreshKey((k) => k + 1);
  }, []);

  return { data, loading, fetchError, fetchErrorType, refresh };
}

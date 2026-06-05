"use client";

import { useCallback, useRef, useState } from "react";

/* Hook de pilotage d'une action longue + sa modale de progression
   (GedifyProgressModal). Centralise l'état (étapes, X/N, réussis/erreurs, logs)
   pour brancher facilement la même UX partout. */

export type ProgressState =
  | "idle"
  | "pending"
  | "processing"
  | "success"
  | "partial_success"
  | "failed"
  | "cancelled";

export type ProgressData = {
  open: boolean;
  title: string;
  description?: string;
  state: ProgressState;
  current: number;
  total: number | null;
  step?: string;
  logs: string[];
  succeeded: number;
  failed: number;
  errorCode?: string;
  errorMessage?: string;
  startedAt: number | null;
};

const INITIAL: ProgressData = {
  open: false,
  title: "",
  description: undefined,
  state: "idle",
  current: 0,
  total: null,
  step: undefined,
  logs: [],
  succeeded: 0,
  failed: 0,
  errorCode: undefined,
  errorMessage: undefined,
  startedAt: null,
};

export function useGedifyProgress() {
  const [data, setData] = useState<ProgressData>(INITIAL);
  const retryRef = useRef<(() => void) | undefined>(undefined);

  const start = useCallback((opts: { title: string; description?: string; total?: number | null }) => {
    setData({
      ...INITIAL,
      open: true,
      state: "processing",
      title: opts.title,
      description: opts.description,
      total: opts.total ?? null,
      startedAt: Date.now(),
    });
  }, []);

  const setStep = useCallback((step: string) => {
    setData((d) => ({ ...d, step, logs: [...d.logs.slice(-19), step] }));
  }, []);

  const setProgress = useCallback((current: number, total?: number | null) => {
    setData((d) => ({ ...d, current, total: total ?? d.total }));
  }, []);

  const addLog = useCallback((line: string) => {
    setData((d) => ({ ...d, logs: [...d.logs.slice(-19), line] }));
  }, []);

  const bumpSucceeded = useCallback(() => {
    setData((d) => ({ ...d, succeeded: d.succeeded + 1, current: d.current + 1 }));
  }, []);

  const bumpFailed = useCallback((errorMessage?: string, errorCode?: string) => {
    setData((d) => ({ ...d, failed: d.failed + 1, current: d.current + 1, errorMessage: errorMessage ?? d.errorMessage, errorCode: errorCode ?? d.errorCode }));
  }, []);

  const finish = useCallback(() => {
    setData((d) => ({
      ...d,
      state: d.failed > 0 ? (d.succeeded > 0 ? "partial_success" : "failed") : "success",
    }));
  }, []);

  const fail = useCallback((errorCode?: string, errorMessage?: string) => {
    setData((d) => ({ ...d, state: "failed", errorCode: errorCode ?? d.errorCode, errorMessage: errorMessage ?? d.errorMessage }));
  }, []);

  const close = useCallback(() => setData((d) => ({ ...d, open: false })), []);

  /** Définit l'action de relance (bouton « Relancer » de la modale/hint). */
  const setRetry = useCallback((fn?: () => void) => {
    retryRef.current = fn;
  }, []);

  const retry = useCallback(() => {
    retryRef.current?.();
  }, []);

  return { data, start, setStep, setProgress, addLog, bumpSucceeded, bumpFailed, finish, fail, close, setRetry, retry };
}

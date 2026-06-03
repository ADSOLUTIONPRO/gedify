"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Retourne un wrapper `authFetch` qui redirige vers /login si le serveur
 * répond 401 (session expirée ou absente).
 *
 * Usage :
 *   const { authFetch } = useAuthGuard();
 *   const res = await authFetch("/api/...", { method: "POST", ... });
 */
export function useAuthGuard() {
  const router = useRouter();

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, {
        credentials: "include",
        ...init,
      });

      if (res.status === 401) {
        // Session expirée — rediriger vers /login en conservant l'URL actuelle
        const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      }

      return res;
    },
    [router],
  );

  return { authFetch };
}

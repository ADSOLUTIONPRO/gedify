/**
 * Test de connexion à un serveur Gedify et/ou Paperless.
 * Aucune écriture : on vérifie seulement l'accessibilité et l'authentification.
 */

export type ConnectionTestInput = {
  gedifyUrl?: string;
  paperlessUrl?: string;
  paperlessToken?: string;
};

export type ConnectionTestResult = {
  ok: boolean;
  gedify?: { ok: boolean; status?: number; message: string };
  paperless?: { ok: boolean; status?: number; documents?: number; message: string };
};

function normalize(url: string): string {
  let u = url.trim();
  if (u && !/^https?:\/\//i.test(u)) {
    const isLocal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i.test(u);
    u = (isLocal ? "http://" : "https://") + u;
  }
  return u.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function testConnection(input: ConnectionTestInput): Promise<ConnectionTestResult> {
  const result: ConnectionTestResult = { ok: true };

  if (input.gedifyUrl) {
    const base = normalize(input.gedifyUrl);
    try {
      const res = await fetchWithTimeout(base + "/login", { redirect: "manual" });
      // 200 (page login) / 3xx (redirect) / 401 → serveur Gedify joignable.
      const reachable = res.status > 0 && res.status < 500;
      result.gedify = {
        ok: reachable,
        status: res.status,
        message: reachable ? "Serveur Gedify accessible." : `Réponse inattendue (${res.status}).`,
      };
      if (!reachable) result.ok = false;
    } catch (e) {
      result.gedify = { ok: false, message: `Serveur Gedify injoignable : ${(e as Error).message}` };
      result.ok = false;
    }
  }

  if (input.paperlessUrl) {
    const base = normalize(input.paperlessUrl);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (input.paperlessToken) headers.Authorization = `Token ${input.paperlessToken}`;
      const res = await fetchWithTimeout(base + "/api/documents/?page_size=1", { headers });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { count?: number };
        result.paperless = {
          ok: true,
          status: res.status,
          documents: data.count,
          message: `Paperless accessible — ${data.count ?? "?"} document(s).`,
        };
      } else if (res.status === 401 || res.status === 403) {
        result.paperless = { ok: false, status: res.status, message: "Paperless joignable mais token invalide." };
        result.ok = false;
      } else {
        result.paperless = { ok: false, status: res.status, message: `Réponse Paperless inattendue (${res.status}).` };
        result.ok = false;
      }
    } catch (e) {
      result.paperless = { ok: false, message: `Paperless injoignable : ${(e as Error).message}` };
      result.ok = false;
    }
  }

  return result;
}

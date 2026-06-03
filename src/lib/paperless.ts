import "server-only";

import type {
  PaperlessCorrespondent,
  PaperlessDocument,
  PaperlessDocumentPatch,
  PaperlessDocumentType,
  PaperlessListResponse,
  PaperlessProfile,
  PaperlessStatistics,
  PaperlessStatus,
  PaperlessSystemStatus,
  PaperlessTag,
} from "@/lib/paperless-types";
import { handle } from "@/lib/engine/router";
import { verifyCredentials } from "@/lib/engine/users";

/* ════════════════════════════════════════════════════════════════════════
   VERSION AUTONOME (sans Paperless).
   Ce module conserve EXACTEMENT la même API publique que la surcouche
   d'origine, mais route toutes les requêtes vers le moteur documentaire local
   (src/lib/engine). Aucune autre partie de l'app n'a besoin d'être modifiée.
   ════════════════════════════════════════════════════════════════════════ */

type PaperlessBody = BodyInit | Record<string, unknown> | null | undefined;

type PaperlessRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: PaperlessBody;
  searchParams?: URLSearchParams | Record<string, string | number | boolean | null | undefined>;
  headers?: HeadersInit;
};

/** Base « publique » (liens internes) — plus de serveur Paperless distant. */
export function getPaperlessBaseUrl() {
  return process.env.GEDIFY_PUBLIC_URL?.replace(/\/+$/, "") ?? "";
}

export function getPaperlessPublicUrl() {
  return process.env.GEDIFY_PUBLIC_URL?.replace(/\/+$/, "") ?? null;
}

export type PaperlessCredentialCheck =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "unavailable"; reason: string };

/**
 * Vérifie un couple identifiant / mot de passe contre les utilisateurs LOCAUX
 * du moteur (remplace l'appel `POST /api/token/` de Paperless).
 */
export async function verifyPaperlessCredentials(
  username: string,
  password: string,
): Promise<PaperlessCredentialCheck> {
  try {
    const ok = await verifyCredentials(username, password);
    return ok ? { status: "ok" } : { status: "invalid" };
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function paperlessFetchRaw(endpoint: string, options: PaperlessRequestOptions = {}) {
  const response = await handle(endpoint, {
    method: options.method,
    body: options.body,
    searchParams: options.searchParams,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Erreur moteur ${response.status} sur ${endpoint} : ${details}`);
  }

  return response;
}

export async function paperlessFetch<T>(endpoint: string, options: PaperlessRequestOptions = {}): Promise<T> {
  const response = await paperlessFetchRaw(endpoint, options);
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export async function getDocuments(
  searchParams?: URLSearchParams | Record<string, string | number | boolean | null | undefined>,
) {
  return paperlessFetch<PaperlessListResponse<PaperlessDocument>>("/api/documents/", {
    searchParams: {
      page_size: 25,
      ...(searchParams instanceof URLSearchParams ? Object.fromEntries(searchParams) : searchParams),
    },
  });
}

export async function getDocument(id: string | number) {
  return paperlessFetch<PaperlessDocument>(`/api/documents/${id}/`);
}

export async function updateDocument(id: string | number, payload: PaperlessDocumentPatch) {
  return paperlessFetch<PaperlessDocument>(`/api/documents/${id}/`, {
    method: "PATCH",
    body: payload as Record<string, unknown>,
  });
}

export async function getCorrespondents(searchParams?: PaperlessRequestOptions["searchParams"]) {
  return paperlessFetch<PaperlessListResponse<PaperlessCorrespondent>>("/api/correspondents/", {
    searchParams: { page_size: 100, ...searchParams },
  });
}

export async function getDocumentTypes(searchParams?: PaperlessRequestOptions["searchParams"]) {
  return paperlessFetch<PaperlessListResponse<PaperlessDocumentType>>("/api/document_types/", {
    searchParams: { page_size: 100, ...searchParams },
  });
}

export async function getTags(searchParams?: PaperlessRequestOptions["searchParams"]) {
  return paperlessFetch<PaperlessListResponse<PaperlessTag>>("/api/tags/", {
    searchParams: { page_size: 100, ...searchParams },
  });
}

export async function createPaperlessObject<T>(
  endpoint: "/api/correspondents/" | "/api/document_types/" | "/api/tags/",
  payload: Record<string, unknown>,
) {
  return paperlessFetch<T>(endpoint, { method: "POST", body: payload });
}

export async function updatePaperlessObject<T>(
  endpoint: "/api/correspondents/" | "/api/document_types/" | "/api/tags/",
  id: string | number,
  payload: Record<string, unknown>,
) {
  return paperlessFetch<T>(`${endpoint}${id}/`, { method: "PATCH", body: payload });
}

export async function deletePaperlessObject(
  endpoint: "/api/correspondents/" | "/api/document_types/" | "/api/tags/",
  id: string | number,
) {
  return paperlessFetch<null>(`${endpoint}${id}/`, { method: "DELETE" });
}

export async function deleteDocument(id: string | number) {
  return paperlessFetch<null>(`/api/documents/${id}/`, { method: "DELETE" });
}

export async function getPaperlessStatus(): Promise<PaperlessStatus> {
  const url = getPaperlessPublicUrl();
  try {
    const [documentsResponse, remoteVersion, profile, statistics, system] = await Promise.allSettled([
      paperlessFetchRaw("/api/documents/", { searchParams: { page_size: 1 } }),
      paperlessFetch<{ version?: string; update_available?: boolean }>("/api/remote_version/"),
      paperlessFetch<PaperlessProfile>("/api/profile/"),
      paperlessFetch<PaperlessStatistics>("/api/statistics/"),
      paperlessFetch<PaperlessSystemStatus>("/api/status/"),
    ]);

    if (documentsResponse.status === "rejected") throw documentsResponse.reason;

    const profileValue = profile.status === "fulfilled" ? profile.value : null;
    const systemValue = system.status === "fulfilled" ? system.value : null;

    return {
      connected: true,
      url,
      apiVersion: documentsResponse.value.headers.get("x-api-version"),
      version:
        system.status === "fulfilled"
          ? systemValue?.pngx_version ?? null
          : remoteVersion.status === "fulfilled"
            ? remoteVersion.value.version ?? null
            : documentsResponse.value.headers.get("x-version"),
      updateAvailable: remoteVersion.status === "fulfilled" ? remoteVersion.value.update_available ?? null : null,
      user: profileValue
        ? {
            email: profileValue.email,
            first_name: profileValue.first_name,
            last_name: profileValue.last_name,
            has_usable_password: profileValue.has_usable_password,
            is_mfa_enabled: profileValue.is_mfa_enabled,
          }
        : null,
      statistics: statistics.status === "fulfilled" ? statistics.value : null,
      system: systemValue,
    };
  } catch (error) {
    return { connected: false, url, error: error instanceof Error ? error.message : String(error) };
  }
}

export function toPaperlessDocumentUrl(documentId: string | number) {
  const base = getPaperlessBaseUrl();
  return base ? `${base}/documents/${documentId}` : `/documents/${documentId}`;
}

export function getPaperlessInboxTag(tags: PaperlessTag[]) {
  return tags.find((tag) => tag.is_inbox_tag || /^(a traiter|à traiter|inbox)$/i.test(tag.name));
}

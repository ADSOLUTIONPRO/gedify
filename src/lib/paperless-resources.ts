import "server-only";

import type {
  NormalizedPaperlessCollection,
  PaperlessResource,
  PaperlessResult,
} from "@/lib/paperless-resource-types";
import { paperlessFetch } from "@/lib/paperless";

export function normalizePaperlessCollection(raw: unknown): NormalizedPaperlessCollection {
  if (Array.isArray(raw)) {
    return {
      count: raw.length,
      results: raw.filter((item): item is PaperlessResource => Boolean(item && typeof item === "object")),
      raw,
    };
  }

  if (raw && typeof raw === "object" && "results" in raw) {
    const value = raw as {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: unknown;
    };
    const results = Array.isArray(value.results)
      ? value.results.filter(
          (item): item is PaperlessResource => Boolean(item && typeof item === "object")
        )
      : [];

    return {
      count: typeof value.count === "number" ? value.count : results.length,
      next: value.next ?? null,
      previous: value.previous ?? null,
      results,
      raw,
    };
  }

  if (raw && typeof raw === "object") {
    return {
      count: 1,
      results: [raw as PaperlessResource],
      raw,
    };
  }

  return {
    count: 0,
    results: [],
    raw,
  };
}

export async function safePaperlessCollection(
  endpoint: string,
  searchParams?: URLSearchParams | Record<string, string | number | boolean | null | undefined>
): Promise<PaperlessResult<NormalizedPaperlessCollection>> {
  try {
    const raw = await paperlessFetch<unknown>(endpoint, {
      searchParams: {
        page_size: 50,
        ...(searchParams instanceof URLSearchParams ? Object.fromEntries(searchParams) : searchParams),
      },
    });

    return { ok: true, data: normalizePaperlessCollection(raw) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function safePaperlessObject<T = PaperlessResource>(
  endpoint: string
): Promise<PaperlessResult<T>> {
  try {
    const data = await paperlessFetch<T>(endpoint);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getResourceTitle(resource: PaperlessResource) {
  return (
    resource.name ||
    resource.title ||
    resource.email ||
    resource.slug ||
    (resource.id !== undefined ? `#${resource.id}` : "Entrée Paperless")
  );
}

export function formatPaperlessValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Non renseigné";
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "Aucun" : value.map(formatPaperlessValue).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function pickResourceSummary(resource: PaperlessResource) {
  return Object.entries(resource)
    .filter(([key, value]) => {
      if (["id", "name", "title", "slug", "password", "auth_token", "token"].includes(key)) {
        return false;
      }
      return value !== null && value !== undefined && value !== "";
    })
    .slice(0, 4);
}

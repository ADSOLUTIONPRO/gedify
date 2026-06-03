import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { paperlessFetch, paperlessFetchRaw } from "@/lib/paperless";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type EndpointOptions = {
  label: string;
};

async function readRequestBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return request.formData();
  }

  if (contentType.includes("application/json")) {
    return request.json();
  }

  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export async function proxyCollectionGet(
  request: NextRequest,
  endpoint: string,
  { label }: EndpointOptions
) {
  try {
    const data = await paperlessFetch<unknown>(endpoint, {
      searchParams: request.nextUrl.searchParams,
    });
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(`Impossible de récupérer ${label}`, error);
  }
}

export async function proxyCollectionPost(
  request: NextRequest,
  endpoint: string,
  { label }: EndpointOptions
) {
  try {
    const body = await readRequestBody(request);
    const data = await paperlessFetch<unknown>(endpoint, {
      method: "POST",
      body: body as Record<string, unknown> | FormData,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return jsonError(`Impossible de créer ${label}`, error);
  }
}

export async function proxyDetailGet(
  _request: NextRequest,
  endpoint: string,
  context: RouteContext,
  { label }: EndpointOptions
) {
  try {
    const { id } = await context.params;
    const data = await paperlessFetch<unknown>(`${endpoint}${id}/`);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(`Impossible de récupérer ${label}`, error);
  }
}

export async function proxyDetailMutation(
  request: NextRequest,
  endpoint: string,
  context: RouteContext,
  method: "PATCH" | "PUT" | "DELETE",
  { label }: EndpointOptions
) {
  try {
    const { id } = await context.params;
    const body = method === "DELETE" ? undefined : await readRequestBody(request);
    const data = await paperlessFetch<unknown>(`${endpoint}${id}/`, {
      method,
      body: body as Record<string, unknown> | undefined,
    });

    if (method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return jsonError(`Impossible de modifier ${label}`, error);
  }
}

export async function proxyDocumentJsonGet(
  _request: NextRequest,
  context: RouteContext,
  suffix: string,
  { label }: EndpointOptions
) {
  try {
    const { id } = await context.params;
    const data = await paperlessFetch<unknown>(`/api/documents/${id}/${suffix}/`);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(`Impossible de récupérer ${label}`, error);
  }
}

export async function proxyDocumentFileGet(
  _request: NextRequest,
  context: RouteContext,
  suffix: string,
  { label }: EndpointOptions
) {
  try {
    const { id } = await context.params;
    const response = await paperlessFetchRaw(`/api/documents/${id}/${suffix}/`, {
      headers: {
        Accept: "image/*,application/pdf,application/octet-stream,*/*",
      },
    });
    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    const contentDisposition = response.headers.get("content-disposition");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }

    // Pour le preview, forcer l'affichage inline (jamais de téléchargement forcé).
    // Pour le download, conserver le Content-Disposition de Paperless (attachment).
    if (suffix === "preview") {
      const fileName = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)?.[1]?.replace(/['"]/g, "") ?? `document-${id}`;
      headers.set("Content-Disposition", `inline; filename="${fileName}"`);
    } else if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    }

    headers.set("Cache-Control", "private, no-store");

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    return jsonError(`Impossible de récupérer ${label}`, error);
  }
}

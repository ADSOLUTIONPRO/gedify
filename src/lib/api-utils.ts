import { NextResponse } from "next/server";

export function jsonError(message: string, error: unknown, status = 502) {
  return NextResponse.json(
    {
      error: message,
      details: error instanceof Error ? error.message : String(error),
    },
    { status }
  );
}

/**
 * Like jsonError, but detects Paperless 401/403 inside the error message
 * and returns a 502 with a human-readable cause instead of a raw proxy error.
 * Never leaks the PAPERLESS_TOKEN value.
 */
export function paperlessProxyError(context: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  if (/Paperless 401/.test(msg)) {
    return NextResponse.json(
      {
        error: "Token Paperless invalide ou expiré",
        details:
          "La requête vers la GED a été refusée (401). Vérifiez la variable PAPERLESS_TOKEN dans votre configuration.",
        context,
      },
      { status: 502 }
    );
  }
  if (/Paperless 403/.test(msg)) {
    return NextResponse.json(
      {
        error: "Accès Paperless refusé",
        details:
          "La requête vers la GED a été refusée (403 Forbidden). Vérifiez les permissions du token.",
        context,
      },
      { status: 502 }
    );
  }
  return jsonError(context, error);
}

/**
 * En-tête Content-Disposition SÛR (en-têtes HTTP = ByteString / Latin-1 only).
 * Un nom de fichier accentué (ex. accent combinant U+0301) ferait planter
 * `new Response(headers)`. On fournit donc un fallback ASCII + filename* RFC 5987.
 */
export function contentDisposition(type: "inline" | "attachment", filename: string): string {
  const ascii =
    (filename || "document")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // accents combinants
      .replace(/[^\x20-\x7E]/g, "_") // tout caractère non-ASCII
      .replace(/["\\]/g, "_")
      .trim() || "document";
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function parseNullableNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

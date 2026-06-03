import "server-only";

import {
  getOnlyOfficeJwtSecret,
  getOnlyOfficeServerUrl,
  signOnlyOfficePayload,
} from "./onlyoffice-config";

export type ConvertResult = {
  ok: boolean;
  fileUrl: string | null;
  message: string;
};

/**
 * Calls ONLYOFFICE conversion API (/ConvertService.ashx) to convert the latest version
 * of the .docx into a PDF reachable via a temporary URL hosted by ONLYOFFICE.
 *
 * Requires:
 *  - ONLYOFFICE_DOCUMENT_SERVER_URL
 *  - JWT signing when ONLYOFFICE_JWT_SECRET is set (recommended).
 *
 * If ONLYOFFICE is unreachable, returns ok=false with a clear "à connecter" message.
 */
export async function convertDocxToPdf(args: {
  documentId: string;
  documentKey: string;
  sourceUrl: string;
  title?: string;
}): Promise<ConvertResult> {
  const baseUrl = getOnlyOfficeServerUrl();
  if (!baseUrl) {
    return {
      ok: false,
      fileUrl: null,
      message:
        "ONLYOFFICE non configuré (ONLYOFFICE_DOCUMENT_SERVER_URL manquant). Export PDF à connecter.",
    };
  }

  const payload = {
    async: false,
    filetype: "docx",
    outputtype: "pdf",
    key: args.documentKey,
    title: args.title ?? "document.docx",
    url: args.sourceUrl,
  } as Record<string, unknown>;

  let body: Record<string, unknown> = payload;
  if (getOnlyOfficeJwtSecret()) {
    const token = await signOnlyOfficePayload(payload);
    body = { ...payload, token };
  }

  try {
    const response = await fetch(`${baseUrl}/ConvertService.ashx`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        ok: false,
        fileUrl: null,
        message: `ONLYOFFICE conversion HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      error?: number;
      endConvert?: boolean;
      fileUrl?: string;
    };

    if (data.error !== undefined && data.error !== 0) {
      return {
        ok: false,
        fileUrl: null,
        message: `ONLYOFFICE a renvoyé l'erreur ${data.error}.`,
      };
    }

    if (!data.endConvert || !data.fileUrl) {
      return {
        ok: false,
        fileUrl: null,
        message: "Conversion non terminée par ONLYOFFICE.",
      };
    }

    return { ok: true, fileUrl: data.fileUrl, message: "Conversion réussie." };
  } catch (error) {
    return {
      ok: false,
      fileUrl: null,
      message: error instanceof Error ? error.message : "Erreur ONLYOFFICE inconnue.",
    };
  }
}

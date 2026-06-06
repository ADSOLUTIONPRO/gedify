import "server-only";

import { SignJWT, jwtVerify } from "jose";
import type { WriterDocument } from "./types";

export type OnlyOfficeUser = {
  id: string;
  name: string;
};

export type OnlyOfficeEditorConfig = {
  documentType: "word";
  document: {
    fileType: "docx";
    key: string;
    title: string;
    url: string;
    permissions: {
      edit: boolean;
      download: boolean;
      print: boolean;
      review: boolean;
    };
  };
  editorConfig: {
    callbackUrl: string;
    lang: string;
    user: OnlyOfficeUser;
    customization?: Record<string, unknown>;
    mode: "edit" | "view";
  };
  width?: string;
  height?: string;
  token?: string;
};

/**
 * URL du serveur ONLYOFFICE chargée par le NAVIGATEUR (script api.js + iframe
 * éditeur). C'est l'adresse joignable depuis le poste de l'utilisateur
 * (ex. https://office.azserver.fr en Coolify, http://IP_NAS:8082 en Synology).
 */
export function getOnlyOfficeServerUrl(): string | null {
  return process.env.ONLYOFFICE_DOCUMENT_SERVER_URL?.replace(/\/+$/, "") ?? null;
}

/**
 * URL du serveur ONLYOFFICE pour les appels SERVEUR → ONLYOFFICE (conversion
 * PDF…). En Docker, ONLYOFFICE_INTERNAL_URL=http://onlyoffice (réseau interne) ;
 * sinon on retombe sur l'URL publique. Évite de router des appels serveur via
 * l'IP/port publié.
 */
export function getOnlyOfficeInternalUrl(): string | null {
  const internal = process.env.ONLYOFFICE_INTERNAL_URL?.replace(/\/+$/, "");
  return internal || getOnlyOfficeServerUrl();
}

export function getOnlyOfficeJwtSecret(): string | null {
  return process.env.ONLYOFFICE_JWT_SECRET ?? null;
}

export function isOnlyOfficeConfigured(): boolean {
  return Boolean(getOnlyOfficeServerUrl());
}

/** URL PUBLIQUE de Gedify (navigateur). GEDIFY_PUBLIC_URL en priorité. */
export function getGedifyPublicBaseUrl(): string {
  const fromEnv =
    process.env.GEDIFY_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "http://localhost:3000";
}

/**
 * URL de Gedify joignable PAR ONLYOFFICE (téléchargement du document source +
 * callback de sauvegarde). En Docker, GEDIFY_INTERNAL_URL=http://gedify:3200
 * (réseau interne) ; sinon on retombe sur l'URL publique. Sur Coolify (sans
 * GEDIFY_INTERNAL_URL), ONLYOFFICE joint Gedify via l'URL publique — inchangé.
 */
export function getGedifyInternalBaseUrl(): string {
  const internal = process.env.GEDIFY_INTERNAL_URL?.replace(/\/+$/, "");
  return internal || getGedifyPublicBaseUrl();
}

export async function signOnlyOfficePayload(payload: Record<string, unknown>): Promise<string> {
  const secret = getOnlyOfficeJwtSecret();
  if (!secret) {
    throw new Error("ONLYOFFICE_JWT_SECRET non configuré.");
  }
  const encoder = new TextEncoder();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(encoder.encode(secret));
}

export async function verifyOnlyOfficeToken(token: string): Promise<Record<string, unknown>> {
  const secret = getOnlyOfficeJwtSecret();
  if (!secret) {
    throw new Error("ONLYOFFICE_JWT_SECRET non configuré.");
  }
  const encoder = new TextEncoder();
  const { payload } = await jwtVerify(token, encoder.encode(secret), {
    algorithms: ["HS256"],
  });
  return payload as Record<string, unknown>;
}

export async function buildEditorConfig(
  document: WriterDocument,
  options: { mode?: "edit" | "view" } = {},
): Promise<OnlyOfficeEditorConfig> {
  // `document.url` et `callbackUrl` sont appelées PAR le serveur ONLYOFFICE
  // (téléchargement + sauvegarde) → URL interne joignable côté serveur/Docker.
  const baseUrl = getGedifyInternalBaseUrl();
  const key = `${document.id}-v${document.version}`;
  const config: OnlyOfficeEditorConfig = {
    documentType: "word",
    document: {
      fileType: "docx",
      key,
      title: document.title || "Document",
      url: `${baseUrl}/api/writer/documents/${document.id}/file`,
      permissions: {
        edit: options.mode !== "view",
        download: true,
        print: true,
        review: false,
      },
    },
    editorConfig: {
      callbackUrl: `${baseUrl}/api/writer/documents/${document.id}/onlyoffice-callback`,
      lang: "fr",
      user: { id: "ged-azserver", name: "Utilisateur GED" },
      customization: {
        autosave: true,
        forcesave: true,
        chat: false,
        comments: false,
        compactToolbar: true,
        feedback: false,
        help: false,
        hideRightMenu: true,
        logo: { visible: false },
      },
      mode: options.mode ?? "edit",
    },
    width: "100%",
    height: "100%",
  };

  if (getOnlyOfficeJwtSecret()) {
    const token = await signOnlyOfficePayload({
      document: config.document,
      editorConfig: config.editorConfig,
    });
    config.token = token;
  }

  return config;
}

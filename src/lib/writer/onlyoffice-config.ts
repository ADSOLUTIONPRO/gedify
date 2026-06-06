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

/**
 * URL PUBLIQUE de Gedify, utilisée pour construire les URLs que le SERVEUR
 * ONLYOFFICE va appeler (téléchargement du .docx + callback de sauvegarde).
 * Elle DOIT être joignable par ONLYOFFICE : GEDIFY_PUBLIC_URL en priorité
 * (ex. https://gedify.azserver.fr en Coolify, http://IP_NAS:3210 en Synology),
 * puis APP_PUBLIC_URL / NEXT_PUBLIC_APP_URL. JAMAIS localhost/127.0.0.1/un nom
 * Docker interne en production : si rien n'est configuré, on loggue une erreur
 * claire (l'URL de repli localhost ne serait pas joignable par ONLYOFFICE).
 */
export function getGedifyPublicBaseUrl(): string {
  const fromEnv =
    process.env.GEDIFY_PUBLIC_URL ?? process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[ONLYOFFICE] GEDIFY_PUBLIC_URL non défini en production : ONLYOFFICE ne pourra " +
        "PAS télécharger/sauvegarder les documents (repli localhost injoignable). " +
        "Définissez GEDIFY_PUBLIC_URL (ex. https://gedify.azserver.fr ou http://IP_NAS:3210).",
    );
  }
  return "http://localhost:3000";
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

/* ────────────────────────────────────────────────────────────────────────
   Jeton d'accès SERVEUR (oo_token) : permet au serveur ONLYOFFICE (qui n'a PAS
   de cookie de session navigateur) de télécharger le .docx et de poster le
   callback de sauvegarde. Signé/vérifié côté Gedify, lié à un documentId + un
   « scope » (file/callback), à durée de vie bornée. AUTH_SECRET (toujours
   présent) sert de secret, sinon ONLYOFFICE_JWT_SECRET.
   ──────────────────────────────────────────────────────────────────────── */
export type DocAccessScope = "file" | "callback";

function docAccessSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET?.trim() || getOnlyOfficeJwtSecret() || "gedify-onlyoffice";
  return new TextEncoder().encode(s);
}

export async function signDocAccessToken(documentId: string, scope: DocAccessScope): Promise<string> {
  return new SignJWT({ documentId: String(documentId), scope })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d") // une session d'édition peut durer ; ré-ouvrir régénère
    .sign(docAccessSecret());
}

export async function verifyDocAccessToken(
  token: string,
  documentId: string,
  scope: DocAccessScope,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, docAccessSecret(), { algorithms: ["HS256"] });
    return payload.documentId === String(documentId) && payload.scope === scope;
  } catch {
    return false;
  }
}

/** URL publique de téléchargement du .docx pour ONLYOFFICE (avec oo_token). */
export async function buildDocumentFileUrl(documentId: string): Promise<string> {
  const token = await signDocAccessToken(documentId, "file");
  return `${getGedifyPublicBaseUrl()}/api/writer/documents/${documentId}/file?oo_token=${token}`;
}

/** URL publique de callback de sauvegarde pour ONLYOFFICE (avec oo_token). */
export async function buildDocumentCallbackUrl(documentId: string): Promise<string> {
  const token = await signDocAccessToken(documentId, "callback");
  return `${getGedifyPublicBaseUrl()}/api/writer/documents/${documentId}/onlyoffice-callback?oo_token=${token}`;
}

/** Masque la valeur d'un oo_token dans une URL pour les logs (jamais en clair). */
export function maskOoToken(url: string): string {
  return url.replace(/([?&]oo_token=)[^&]+/i, "$1***");
}

export async function buildEditorConfig(
  document: WriterDocument,
  options: { mode?: "edit" | "view" } = {},
): Promise<OnlyOfficeEditorConfig> {
  // `document.url` et `callbackUrl` sont appelées PAR le serveur ONLYOFFICE
  // (téléchargement + sauvegarde) → URL PUBLIQUE joignable par ONLYOFFICE, et
  // protégées par un oo_token signé (pas de cookie de session côté ONLYOFFICE).
  const publicBaseUrl = getGedifyPublicBaseUrl();
  const documentUrl = await buildDocumentFileUrl(document.id);
  const callbackUrl = await buildDocumentCallbackUrl(document.id);
  // Log de diagnostic (secrets masqués) : URLs réellement envoyées à ONLYOFFICE.
  console.log(
    `[ONLYOFFICE] config docId=${document.id} mode=${options.mode ?? "edit"} ` +
      `publicBaseUrl=${publicBaseUrl} documentServerUrl=${getOnlyOfficeServerUrl() ?? "(non configuré)"} ` +
      `documentUrl=${maskOoToken(documentUrl)} callbackUrl=${maskOoToken(callbackUrl)} ` +
      `jwt=${getOnlyOfficeJwtSecret() ? "on" : "off"}`,
  );
  const key = `${document.id}-v${document.version}`;
  const config: OnlyOfficeEditorConfig = {
    documentType: "word",
    document: {
      fileType: "docx",
      key,
      title: document.title || "Document",
      url: documentUrl,
      permissions: {
        edit: options.mode !== "view",
        download: true,
        print: true,
        review: false,
      },
    },
    editorConfig: {
      callbackUrl,
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

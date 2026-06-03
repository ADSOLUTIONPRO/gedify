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

export function getOnlyOfficeServerUrl(): string | null {
  return process.env.ONLYOFFICE_DOCUMENT_SERVER_URL?.replace(/\/+$/, "") ?? null;
}

export function getOnlyOfficeJwtSecret(): string | null {
  return process.env.ONLYOFFICE_JWT_SECRET ?? null;
}

export function isOnlyOfficeConfigured(): boolean {
  return Boolean(getOnlyOfficeServerUrl());
}

function getPublicBaseUrl(): string {
  const fromEnv = process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
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

export async function buildEditorConfig(
  document: WriterDocument,
  options: { mode?: "edit" | "view" } = {},
): Promise<OnlyOfficeEditorConfig> {
  const baseUrl = getPublicBaseUrl();
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

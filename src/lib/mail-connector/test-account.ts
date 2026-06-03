import "server-only";

import { withImap } from "./imap-client";
import type { MailAccount, MailTestResult } from "./types";

export async function testImapConnection(
  account: Pick<
    MailAccount,
    "imapHost" | "imapPort" | "encryption" | "username" | "watchedFolder"
  >,
  password: string | null,
): Promise<MailTestResult> {
  const started = Date.now();

  if (!password) {
    return {
      ok: false,
      code: "missing-password",
      message:
        "Aucun mot de passe disponible pour ce compte. Définissez MAIL_CONNECTOR_KEY puis enregistrez à nouveau le mot de passe.",
      durationMs: Date.now() - started,
    };
  }

  try {
    const folders = await withImap(account, password, async (client) => {
      const list = await client.list();
      return list.map((entry) => entry.path);
    });

    const folderFound = folders.includes(account.watchedFolder);

    return {
      ok: folderFound,
      code: folderFound ? "success" : "folder-not-found",
      message: folderFound
        ? `Connexion établie. ${folders.length} dossier(s) accessibles.`
        : `Connexion établie mais le dossier « ${account.watchedFolder} » est introuvable.`,
      folders,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return classifyImapError(error, Date.now() - started);
  }
}

export async function listFolders(
  account: Pick<MailAccount, "imapHost" | "imapPort" | "encryption" | "username">,
  password: string,
): Promise<string[]> {
  return withImap(account, password, async (client) => {
    const list = await client.list();
    return list.map((entry) => entry.path).sort();
  });
}

function classifyImapError(error: unknown, durationMs: number): MailTestResult {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("authentication") || lower.includes("auth") || lower.includes("login")) {
    return {
      ok: false,
      code: "auth-failed",
      message: "Identifiants incorrects ou refusés par le serveur.",
      durationMs,
    };
  }
  if (lower.includes("getaddrinfo") || lower.includes("enotfound") || lower.includes("econnrefused")) {
    return {
      ok: false,
      code: "host-unreachable",
      message: "Serveur IMAP inaccessible. Vérifiez l'hôte et le port.",
      durationMs,
    };
  }
  if (lower.includes("tls") || lower.includes("ssl") || lower.includes("certificate")) {
    return {
      ok: false,
      code: "tls-failed",
      message: "Erreur TLS/SSL. Vérifiez le mode de chiffrement (TLS / STARTTLS).",
      durationMs,
    };
  }

  return {
    ok: false,
    code: "unknown",
    message,
    durationMs,
  };
}

import "server-only";

import { ImapFlow } from "imapflow";
import { buildImapConfig, withImap } from "./imap-client";
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

  const client = new ImapFlow(buildImapConfig(account, password));

  // 1) Connexion + authentification (TLS/STARTTLS puis LOGIN). C'est le VRAI
  //    critère de validité d'un compte : si on arrive ici, l'hôte, le port, le
  //    chiffrement et les identifiants sont bons.
  try {
    await client.connect();
  } catch (error) {
    try { await client.logout(); } catch { /* ignore */ }
    return classifyImapError(error, Date.now() - started);
  }

  // 2) Inventaire des dossiers — best-effort. Certains serveurs IMAP « autres
  //    fournisseurs » refusent les options de la commande LIST (RETURN /
  //    SPECIAL-USE) et répondent « Command failed » : ce n'est PAS une erreur de
  //    connexion. On ne doit donc jamais faire échouer le test pour autant.
  let folders: string[] = [];
  let listFailed = false;
  try {
    const list = await client.list();
    folders = list.map((entry) => entry.path);
  } catch {
    listFailed = true;
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }

  const durationMs = Date.now() - started;

  if (listFailed) {
    return {
      ok: true,
      code: "success",
      message: `Connexion établie. (La liste des dossiers n'a pas pu être lue — la relève utilisera « ${account.watchedFolder} ».)`,
      folders: [],
      durationMs,
    };
  }

  const folderFound = folders.some(
    (path) => path.toLowerCase() === account.watchedFolder.toLowerCase(),
  );

  return {
    ok: true,
    code: folderFound ? "success" : "folder-not-found",
    message: folderFound
      ? `Connexion établie. ${folders.length} dossier(s) accessibles.`
      : `Connexion établie, mais le dossier surveillé « ${account.watchedFolder} » est introuvable parmi les ${folders.length} dossier(s). Choisissez le bon dossier (souvent « INBOX »).`,
    folders,
    durationMs,
  };
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

/** Champs supplémentaires exposés par les erreurs ImapFlow (au-delà de `message`). */
type ImapErrorLike = {
  code?: string;
  authenticationFailed?: boolean;
  serverResponseCode?: string;
  responseStatus?: string;
  response?: string;
  responseText?: string;
};

function classifyImapError(error: unknown, durationMs: number): MailTestResult {
  const e = (error ?? {}) as ImapErrorLike;
  const message = error instanceof Error ? error.message : String(error);
  const serverText = String(e.responseText ?? e.response ?? "").trim();
  const code = String(e.code ?? "");
  const serverCode = String(e.serverResponseCode ?? "").toUpperCase();
  const haystack = `${message} ${serverText} ${serverCode}`.toLowerCase();

  // Authentification refusée (mot de passe ou mot de passe d'application requis).
  if (
    e.authenticationFailed === true ||
    serverCode === "AUTHENTICATIONFAILED" ||
    haystack.includes("authentication") ||
    haystack.includes("invalid credentials") ||
    haystack.includes("login failed") ||
    haystack.includes("auth")
  ) {
    return {
      ok: false,
      code: "auth-failed",
      message:
        "Identifiants refusés par le serveur. Vérifiez l'identifiant et le mot de passe (un mot de passe d'application peut être requis si la double authentification est active).",
      durationMs,
    };
  }

  // Hôte ou réseau injoignable.
  if (
    ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH"].includes(code) ||
    haystack.includes("getaddrinfo") ||
    haystack.includes("enotfound") ||
    haystack.includes("econnrefused") ||
    haystack.includes("timeout") ||
    haystack.includes("timed out")
  ) {
    return {
      ok: false,
      code: "host-unreachable",
      message: "Serveur IMAP injoignable. Vérifiez l'hôte, le port et votre connexion réseau.",
      durationMs,
    };
  }

  // Chiffrement TLS / certificat.
  if (
    code.startsWith("ERR_TLS") ||
    code.startsWith("ERR_SSL") ||
    haystack.includes("certificate") ||
    haystack.includes("self-signed") ||
    haystack.includes("wrong version number") ||
    haystack.includes("ssl") ||
    haystack.includes("tls")
  ) {
    return {
      ok: false,
      code: "tls-failed",
      message:
        "Erreur de chiffrement TLS/SSL. Vérifiez le mode et le port : SSL/TLS sur 993, STARTTLS sur 143.",
      durationMs,
    };
  }

  // Inconnu : on remonte le texte réel renvoyé par le serveur plutôt qu'un
  // « Command failed » opaque, avec un indice sur la cause la plus fréquente.
  const detail = serverText || message || "Erreur inconnue.";
  return {
    ok: false,
    code: "unknown",
    message: `Le serveur a refusé la connexion : ${detail}. Vérifiez le port et le mode de chiffrement (SSL/TLS sur 993, STARTTLS sur 143).`,
    durationMs,
  };
}

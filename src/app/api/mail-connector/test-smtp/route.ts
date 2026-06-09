import { NextResponse, type NextRequest } from "next/server";
import nodemailer from "nodemailer";
import { jsonError } from "@/lib/api-utils";
import type { MailEncryption } from "@/lib/mail-connector/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

/* Test SMTP réel sans envoi de message : nodemailer `verify()` ouvre la
   connexion, négocie TLS/STARTTLS et tente l'authentification. Aucun secret
   n'est journalisé ni renvoyé au client. */

type Body = {
  smtpHost?: string;
  smtpPort?: number;
  smtpEncryption?: MailEncryption;
  smtpUsername?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const host = (body.smtpHost ?? "").trim();
    if (!host) {
      return NextResponse.json({ result: { ok: false, code: "config", message: "Serveur SMTP manquant." } });
    }
    if (!body.password) {
      return NextResponse.json({ result: { ok: false, code: "missing-password", message: "Mot de passe requis pour tester l'envoi." } });
    }
    const port = typeof body.smtpPort === "number" ? body.smtpPort : 465;
    const enc = body.smtpEncryption ?? "tls";
    const started = Date.now();

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: enc === "tls",
      requireTLS: enc === "starttls",
      auth: { user: body.smtpUsername ?? "", pass: body.password },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
    });

    try {
      await transporter.verify();
      return NextResponse.json({ result: { ok: true, code: "success", message: "Connexion SMTP validée (envoi possible).", durationMs: Date.now() - started } });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const lower = msg.toLowerCase();
      let code = "unknown";
      let friendly = `Le serveur SMTP a refusé la connexion : ${msg}`;
      if (/eauth|535|credential|password|auth/.test(lower)) {
        code = "auth-failed";
        friendly = "Identifiants SMTP refusés (un mot de passe d'application peut être requis).";
      } else if (/enotfound|econnrefused|etimedout|timeout|ehostunreach/.test(lower)) {
        code = "host-unreachable";
        friendly = "Serveur SMTP injoignable. Vérifiez l'hôte, le port et le réseau.";
      } else if (/certificate|self-signed|tls|ssl|wrong version/.test(lower)) {
        code = "tls-failed";
        friendly = "Erreur TLS/SSL SMTP. Vérifiez le mode (SSL/TLS sur 465, STARTTLS sur 587) et le port.";
      }
      return NextResponse.json({ result: { ok: false, code, message: friendly, durationMs: Date.now() - started } });
    }
  } catch (error) {
    return jsonError("Test SMTP impossible", error);
  }
}

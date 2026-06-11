import "server-only";

import { getAppBaseUrl } from "./config";
import type { MailTemplate } from "./template-store";

/* Rendu d'un email : substitution {{var}} + enrobage dans le layout par défaut
   (en-tête, pied de page, lien de désinscription pour le marketing). */

export type RenderVars = Record<string, string | number | null | undefined>;

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function substitute(template: string, vars: RenderVars): string {
  return template.replace(VAR_RE, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

function defaultLayout(content: string, opts: { appName: string; footerExtraHtml?: string }): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;background:#f1f5f9;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
      <tr><td style="background:#0E7490;padding:18px 28px"><span style="color:#fff;font-size:18px;font-weight:800">${opts.appName}</span></td></tr>
      <tr><td style="padding:28px;font-size:14px;line-height:1.6">${content}</td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;line-height:1.5">
        ${opts.footerExtraHtml ?? ""}
        <div>© ${new Date().getFullYear()} ${opts.appName}. Cet email vous est envoyé dans le cadre de votre relation avec ${opts.appName}.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export type RenderedEmail = { subject: string; html: string; text: string };

export type RenderOptions = {
  appName?: string;
  /** Token de préférence pour le lien de désinscription (marketing). */
  unsubToken?: string | null;
};

/** Rend un email à partir d'un modèle + variables. */
export function renderEmail(template: MailTemplate, vars: RenderVars, opts: RenderOptions = {}): RenderedEmail {
  const appName = opts.appName ?? "Gedify";
  const baseVars: RenderVars = { appName, appUrl: getAppBaseUrl(), ...vars };
  const subject = substitute(template.subject, baseVars);
  const innerHtml = substitute(template.htmlBody, baseVars);

  let footerExtraHtml = "";
  if (template.isMarketing && opts.unsubToken) {
    const url = `${getAppBaseUrl()}/unsubscribe?token=${encodeURIComponent(opts.unsubToken)}`;
    footerExtraHtml = `<div style="margin-bottom:8px"><a href="${url}" style="color:#94a3b8">Se désinscrire de ces emails</a></div>`;
  }

  const html = defaultLayout(innerHtml, { appName, footerExtraHtml });
  const text = template.textBody
    ? substitute(template.textBody, baseVars)
    : innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return { subject, html, text };
}

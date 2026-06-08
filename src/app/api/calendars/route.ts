import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { listCalendars } from "@/lib/connectors/google/calendar-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type CalendarOption = {
  id: string;
  name: string;
  provider: "local" | "google";
  color: string;
  readOnly: boolean;
  primary?: boolean;
};

const PALETTE = ["#7C3AED", "#2563EB", "#0EA5E9", "#16A34A", "#F59E0B", "#E11D48", "#9333EA"];

/**
 * GET /api/calendars — agendas disponibles : l'agenda local GEDify + les
 * agendas du compte Google connecté (avec couleur, lecture seule éventuelle).
 * Sert au sélecteur de cible et à l'affichage multi-agendas.
 */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const calendars: CalendarOption[] = [
      { id: "local", name: "Agenda GEDify", provider: "local", color: "var(--accent)", readOnly: false, primary: true },
    ];
    try {
      const account = await getActiveGmailAccount();
      if (account) {
        const gcals = await listCalendars(account.accountId);
        gcals.forEach((c, i) => {
          calendars.push({
            id: c.id,
            name: c.summary,
            provider: "google",
            color: PALETTE[i % PALETTE.length],
            readOnly: c.accessRole === "reader" || c.accessRole === "freeBusyReader",
            primary: c.primary,
          });
        });
      }
    } catch {
      /* scope calendar manquant / compte non connecté → seul l'agenda local. */
    }
    return NextResponse.json({ calendars });
  } catch (error) {
    return jsonError("Agendas indisponibles.", error);
  }
}

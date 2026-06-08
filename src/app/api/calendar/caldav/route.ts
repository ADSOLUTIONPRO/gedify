import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { discover, listCalendars } from "@/lib/connectors/caldav/caldav-client";
import { deleteCalDavAccount, isCalDavStoreSecure, listCalDavAccounts, saveCalDavAccount } from "@/lib/connectors/caldav/caldav-credentials-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SERVER = "https://caldav.icloud.com";

/** GET /api/calendar/caldav — comptes CalDAV connectés (sans secret). */
export async function GET(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    return NextResponse.json({ accounts: await listCalDavAccounts() });
  } catch (error) {
    return jsonError("Comptes CalDAV indisponibles.", error);
  }
}

/** POST /api/calendar/caldav — connecte un compte (Apple ID + mot de passe d'app). */
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    if (!isCalDavStoreSecure()) {
      return NextResponse.json({ error: "store_insecure", message: "Stockage sécurisé manquant : définissez CONNECTOR_SECRET_KEY (16+ caractères) avant de connecter iCloud." }, { status: 400 });
    }
    const body = (await req.json().catch(() => ({}))) as { label?: string; username?: string; password?: string; serverUrl?: string };
    const username = body.username?.trim();
    const password = body.password ?? "";
    if (!username || !password) {
      return NextResponse.json({ error: "missing_credentials", message: "Apple ID et mot de passe d'application requis." }, { status: 400 });
    }
    const serverUrl = (body.serverUrl?.trim() || DEFAULT_SERVER).replace(/\/?$/, "");
    const auth = { username, password };
    const { principalUrl, homeUrl } = await discover(serverUrl, auth);
    const calendars = await listCalendars(homeUrl, auth);
    if (calendars.length === 0) {
      return NextResponse.json({ error: "no_calendars", message: "Aucun agenda trouvé pour ce compte." }, { status: 422 });
    }
    const account = await saveCalDavAccount({ label: body.label?.trim() || username, username, password, serverUrl, principalUrl, homeUrl, calendars });
    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CALDAV_AUTH")) {
      return NextResponse.json({ error: "auth_failed", message: "Identifiants refusés. Utilisez un mot de passe d'application Apple (appleid.apple.com → Sécurité)." }, { status: 401 });
    }
    return jsonError("Connexion CalDAV impossible.", error);
  }
}

/** DELETE /api/calendar/caldav?id= — déconnecte un compte. */
export async function DELETE(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const ok = await deleteCalDavAccount(id);
    return NextResponse.json({ ok });
  } catch (error) {
    return jsonError("Déconnexion CalDAV impossible.", error);
  }
}

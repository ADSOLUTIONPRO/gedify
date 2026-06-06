import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { mergeEmailContacts } from "@/lib/messaging/email-contact-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/contacts/merge  body: { keep, drop[] } → fusionne (jamais sans confirmation UI). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { keep?: string; drop?: string[] };
    const keep = typeof body.keep === "string" ? body.keep : "";
    const drop = Array.isArray(body.drop) ? body.drop.filter((d): d is string => typeof d === "string") : [];
    if (!keep || drop.length === 0) {
      return NextResponse.json({ error: "keep + drop[] requis." }, { status: 400 });
    }
    const merged = await mergeEmailContacts(keep, drop);
    if (!merged) return NextResponse.json({ error: "Contact « gardé » introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true, contact: merged, merged: drop.length });
  } catch (error) {
    return jsonError("Fusion des contacts impossible", error);
  }
}

import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getResolvedUserPreferences,
  getRawUserPreferences,
  saveUserPreferences,
  resetUserPreferences,
  type NotificationPreferences,
} from "@/lib/notifications/notification-preferences";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → préférences résolues de l'utilisateur courant + contexte (admin, finances). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const [resolved, flags] = await Promise.all([
      getResolvedUserPreferences(String(user.id)),
      getGedifyFeatureFlags().catch(() => ({ financeSpaceEnabled: true })),
    ]);
    return NextResponse.json({
      ...resolved,
      isAdmin: Boolean(user.is_superuser),
      financeEnabled: flags.financeSpaceEnabled !== false,
      accountEmail: user.email ?? null,
    });
  } catch (error) {
    return jsonError("Lecture des préférences de notification impossible", error);
  }
}

/** PUT → enregistre les préférences (général + surcharges par type). */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<NotificationPreferences>;
    const current = await getRawUserPreferences(String(user.id));
    const next: NotificationPreferences = {
      ...current,
      ...body,
      quietHours: { ...current.quietHours, ...(body.quietHours ?? {}) },
      digest: { ...current.digest, ...(body.digest ?? {}) },
      events: body.events ?? current.events,
    };
    await saveUserPreferences(String(user.id), next);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Enregistrement des préférences impossible", error);
  }
}

/** DELETE → réinitialise aux valeurs par défaut. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    await resetUserPreferences(String(user.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Réinitialisation impossible", error);
  }
}

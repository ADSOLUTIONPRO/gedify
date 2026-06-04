import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/current-user";
import { jsonError } from "@/lib/api-utils";
import { updateUser, publicUser } from "@/lib/engine/users";
import { recordAudit } from "@/lib/audit/audit-store";
import { ROLES, type Role } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES = new Set<string>(ROLES.map((r) => r.value));

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const deny = await requirePermission(request, "users.manage");
  if (deny) return deny;
  try {
    const { id } = await context.params;
    const numId = Number(id);
    const body = (await request.json()) as { role?: string; is_active?: boolean };

    const patch: { role?: Role; is_active?: boolean } = {};
    if (body.role !== undefined) {
      if (!VALID_ROLES.has(body.role)) {
        return jsonError("Rôle invalide", `Rôle inconnu : ${body.role}`, 400);
      }
      patch.role = body.role as Role;
    }
    if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

    const updated = await updateUser(numId, patch);
    if (!updated) return jsonError("Utilisateur introuvable", `Aucun utilisateur #${id}`, 404);

    await recordAudit({
      action: "user.role.update",
      target: `user#${id} (${updated.username})`,
      details: patch.role ? `rôle → ${patch.role}` : patch.is_active != null ? `actif → ${patch.is_active}` : null,
    });

    return NextResponse.json(publicUser(updated));
  } catch (error) {
    return jsonError("Impossible de mettre à jour l'utilisateur", error);
  }
}

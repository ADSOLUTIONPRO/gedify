import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { signSession, cookieOpts } from "@/lib/auth/session";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";
import { getSaasSettings } from "@/lib/saas/settings";
import { listUsers } from "@/lib/engine/users";
import { createTenantWithOwner } from "@/lib/tenant/tenant-admin";
import { getTenantBySlug } from "@/lib/tenant/tenant-store";
import { TENANT_PLANS } from "@/lib/tenant/tenant-admin";
import { logSecurityEvent } from "@/lib/saas/security/security-events";

export const runtime = "nodejs";

/* Inscription publique SaaS — wrapper sur le flux EXISTANT (createTenantWithOwner).
   Strictement gated : refuse si l'inscription publique n'est pas ouverte. */

function slugify(s: string): string {
  const base = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28);
  return base.length >= 2 ? base : "espace";
}
function reqMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return { ipAddress: ip, userAgent: req.headers.get("user-agent") };
}

export async function POST(req: NextRequest) {
  try {
    if (!isMultiTenantEnabled()) {
      return NextResponse.json({ error: "Inscription non disponible." }, { status: 403 });
    }
    const settings = await getSaasSettings();
    const open = settings.features.publicSignup && settings.signup.publicSignupEnabled;
    if (!open) {
      return NextResponse.json({ error: "L'inscription publique est fermée. L'accès se fait sur invitation." }, { status: 403 });
    }
    if (!process.env.AUTH_SECRET?.trim()) {
      return NextResponse.json({ error: "Authentification non configurée." }, { status: 503 });
    }

    const body = (await req.json()) as { name?: string; email?: string; password?: string };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    if (!name || !email || !email.includes("@")) return NextResponse.json({ error: "Nom et e-mail valides requis." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });

    // E-mail déjà utilisé → refus (on n'attache jamais un nouvel espace à un compte existant sans authentification).
    const exists = (await listUsers()).some((u) => (u.email ?? "").trim().toLowerCase() === email);
    if (exists) return NextResponse.json({ error: "Un compte existe déjà avec cet e-mail. Connectez-vous." }, { status: 409 });

    // Slug unique.
    let slug = slugify(name) || slugify(email.split("@")[0]);
    if (await getTenantBySlug(slug).catch(() => null)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 34);

    const plan = (TENANT_PLANS as readonly string[]).includes(settings.signup.defaultPlan) ? settings.signup.defaultPlan : "free";

    await createTenantWithOwner({
      name: name.length >= 2 ? name : "Mon espace",
      slug,
      ownerEmail: email,
      ownerUsername: email,
      ownerPassword: password,
      plan,
      status: "active",
      aiEnabled: true,
      ocrEnabled: true,
      emailImportEnabled: true,
      onlyofficeEnabled: true,
    });

    await logSecurityEvent({ eventType: "account_created", category: "auth", severity: "info", message: `Inscription publique : ${email} (espace ${slug})`, ...reqMeta(req) });

    const token = await signSession({ username: email });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieOpts(token));
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Inscription impossible." }, { status: 400 });
  }
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listUsers } from "@/lib/engine/users";
import { getTenantById } from "@/lib/tenant/tenant-store";
import { getInvitationByToken } from "@/lib/saas/invitations";
import { acceptInviteAction } from "./actions";

export const dynamic = "force-dynamic";

const ROLE: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", member: "Membre", viewer: "Lecteur" };

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const inv = await getInvitationByToken(token).catch(() => null);
  const card: React.CSSProperties = { maxWidth: 460, width: "100%", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 28 };
  const btn: React.CSSProperties = { width: "100%", height: 44, borderRadius: 10, border: "none", background: "#0E7490", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 };
  const input: React.CSSProperties = { width: "100%", height: 42, borderRadius: 10, border: "1px solid #e2e8f0", padding: "0 12px", fontSize: 14 };

  const valid = inv && inv.status === "pending" && (!inv.expiresAt || new Date(inv.expiresAt) >= new Date());
  const tenant = valid ? await getTenantById(inv!.tenantId).catch(() => null) : null;
  const me = await getCurrentUser().catch(() => null);
  const existing = valid && !me ? (await listUsers()).some((u) => (u.email ?? "").toLowerCase() === inv!.email.toLowerCase()) : false;

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={card}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>Invitation</h1>
        {error ? <p style={{ color: "#B91C1C", fontSize: 13, marginBottom: 12 }}>{error}</p> : null}

        {!valid ? (
          <p style={{ color: "#B91C1C", fontSize: 14 }}>Cette invitation est invalide, expirée ou déjà utilisée.</p>
        ) : (
          <>
            <p style={{ color: "#475569", fontSize: 14, margin: "0 0 16px" }}>
              Vous êtes invité(e) à rejoindre <strong>{tenant?.name ?? inv!.tenantId}</strong> en tant que <strong>{ROLE[inv!.role] ?? inv!.role}</strong>
              {" "}(<span>{inv!.email}</span>).
            </p>

            {me ? (
              ((me.email ?? "").toLowerCase() === inv!.email.toLowerCase() || me.is_superuser) ? (
                <form action={acceptInviteAction}>
                  <input type="hidden" name="token" value={token} />
                  <button style={btn}>Accepter l&apos;invitation</button>
                </form>
              ) : (
                <p style={{ fontSize: 13, color: "#475569" }}>
                  Vous êtes connecté(e) avec un autre compte. <Link href="/api/auth/logout" style={{ color: "#0E7490" }}>Déconnectez-vous</Link> puis connectez-vous avec <strong>{inv!.email}</strong>.
                </p>
              )
            ) : existing ? (
              <p style={{ fontSize: 13, color: "#475569" }}>
                Un compte existe déjà pour cet email. <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} style={{ color: "#0E7490", fontWeight: 600 }}>Connectez-vous</Link> pour accepter.
              </p>
            ) : (
              <form action={acceptInviteAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="hidden" name="token" value={token} />
                <label style={{ fontSize: 12, fontWeight: 600 }}>Définir un mot de passe (8+ caractères)
                  <input name="password" type="password" required minLength={8} style={{ ...input, marginTop: 4 }} />
                </label>
                <button style={btn}>Créer mon compte et rejoindre</button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}

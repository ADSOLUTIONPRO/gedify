import { getPreferenceByToken } from "@/lib/saas/mailing/preferences";
import { unsubscribeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; status?: string }> }) {
  const { token, status } = await searchParams;
  const pref = token ? await getPreferenceByToken(token).catch(() => null) : null;

  const card: React.CSSProperties = {
    maxWidth: 460, width: "100%", background: "var(--bg-card, #fff)", borderRadius: 16,
    border: "1px solid var(--border, #e2e8f0)", padding: 28,
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={card}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Préférences d&apos;email</h1>

        {status === "done" ? (
          <p style={{ color: "#15803D", fontSize: 14 }}>✓ Vos préférences ont été enregistrées. Vous ne recevrez plus ces emails.</p>
        ) : !token || !pref ? (
          <p style={{ color: "#B91C1C", fontSize: 14 }}>Lien invalide ou expiré.</p>
        ) : (
          <>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 18px" }}>
              Gérez les emails reçus à l&apos;adresse <strong>{pref.email}</strong>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <form action={unsubscribeAction}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="scope" value="marketing" />
                <button style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid var(--border,#e2e8f0)", background: "#fff", fontWeight: 600, cursor: "pointer" }}>
                  Ne plus recevoir d&apos;emails marketing
                </button>
              </form>
              <form action={unsubscribeAction}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="scope" value="all" />
                <button style={{ width: "100%", height: 42, borderRadius: 10, border: "none", background: "#0E7490", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                  Me désinscrire de tous les emails
                </button>
              </form>
            </div>
            <p style={{ color: "#94a3b8", fontSize: 11, margin: "16px 0 0" }}>
              Les emails essentiels liés à la sécurité et à la facturation restent envoyés tant que votre compte est actif.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

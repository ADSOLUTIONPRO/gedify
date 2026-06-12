"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";

/* Gestion MFA/TOTP côté compte (/account/security). Appelle les routes
   /api/auth/mfa/*. N'affiche jamais le secret stocké : seul le secret du QR en
   cours d'enrôlement est montré (saisie manuelle). */

type Props = { initialEnabled: boolean; backupRemaining: number; mandatory: boolean; canDisable: boolean };

export function MfaSettings({ initialEnabled, backupRemaining, mandatory, canDisable }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<"idle" | "enroll">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startEnroll() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setQr(data.qrSvg); setSecret(data.secret); setStep("enroll");
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }
  async function confirmEnroll() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/enable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Code invalide");
      setBackupCodes(data.backupCodes); setEnabled(true); setStep("idle"); setQr(null); setSecret(null); setCode("");
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }
  async function regen() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/backup-codes", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setBackupCodes(data.backupCodes);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }
  async function disable() {
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/disable", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: disableCode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setEnabled(false); setDisableCode(""); setBackupCodes(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); } finally { setLoading(false); }
  }

  const inp = "h-11 w-40 rounded-xl border px-3 text-center text-[18px] tracking-[0.3em] font-bold";
  const bd = { borderColor: "var(--border)" };

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-[13px] text-rose-900" role="alert">{error}</div> : null}

      {backupCodes ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold text-amber-900"><KeyRound className="h-4 w-4" /> Codes de secours — notez-les maintenant</div>
          <p className="mt-1 text-[12px] text-amber-800">Chaque code n&apos;est utilisable qu&apos;une seule fois. Ils ne seront plus affichés.</p>
          <div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[13px] sm:grid-cols-5">
            {backupCodes.map((c) => <code key={c} className="rounded bg-white px-2 py-1 text-center">{c}</code>)}
          </div>
        </div>
      ) : null}

      {enabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: "#15803D" }}>
            <ShieldCheck className="h-5 w-5" /> Double authentification activée
          </div>
          <p className="text-[13px] text-slate-600">Une application d&apos;authentification (Google/Microsoft Authenticator, Authy, 1Password…) est requise à chaque connexion. Codes de secours restants : <strong>{backupRemaining}</strong>.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={regen} disabled={loading} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold disabled:opacity-60" style={bd}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Régénérer les codes de secours</button>
          </div>
          {canDisable ? (
            <div className="flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: "var(--border-soft)" }}>
              <label className="text-[12px]"><span className="block font-semibold">Désactiver (code requis)</span><input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} inputMode="numeric" placeholder="000000" className="mt-1 h-9 w-32 rounded-lg border px-2 text-center font-mono text-[14px]" style={bd} /></label>
              <button onClick={disable} disabled={loading || disableCode.length < 6} className="h-9 rounded-lg border px-3 text-[12px] font-semibold disabled:opacity-60" style={{ borderColor: "#FCA5A5", color: "#B91C1C" }}>Désactiver</button>
            </div>
          ) : (
            <p className="text-[12px] text-slate-500">La MFA est obligatoire pour votre rôle et ne peut pas être désactivée.</p>
          )}
        </div>
      ) : step === "idle" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: mandatory ? "#B45309" : "var(--text-main)" }}>
            {mandatory ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            {mandatory ? "Double authentification requise" : "Double authentification (recommandée)"}
          </div>
          <p className="text-[13px] text-slate-600">Protégez votre compte avec un code temporaire généré par une application d&apos;authentification.</p>
          <button onClick={startEnroll} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl px-5 text-[13px] font-bold text-white disabled:opacity-70" style={{ background: "var(--accent)" }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Activer la MFA</button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-slate-600">1. Scannez ce QR code dans votre application d&apos;authentification :</p>
          {qr ? <div className="inline-block rounded-xl border bg-white p-2" style={bd} dangerouslySetInnerHTML={{ __html: qr }} /> : null}
          <p className="text-[12px] text-slate-500">Ou saisie manuelle : <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">{secret}</code></p>
          <p className="text-[13px] text-slate-600">2. Entrez le code à 6 chiffres affiché :</p>
          <div className="flex items-center gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="000000" className={inp} style={bd} />
            <button onClick={confirmEnroll} disabled={loading || code.length < 6} className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-bold text-white disabled:opacity-70" style={{ background: "var(--accent)" }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Vérifier & activer</button>
            <button onClick={() => { setStep("idle"); setQr(null); }} className="h-11 rounded-xl border px-4 text-[13px] font-semibold" style={bd}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Eye, EyeOff, Inbox,
  Loader2, Mail, Send, Settings2, ShieldCheck, Sparkles, X, XCircle,
} from "lucide-react";
import type { MailAccountVM } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   ConnectMailboxModal — parcours complet d'ajout d'une boîte mail, ENTIÈREMENT
   dans une seule fenêtre modale (aucune redirection vers une page interne).

   • Google / Microsoft → OAuth (redirection contrôlée vers le fournisseur puis
     retour automatique : la modale se rouvre à l'étape « options » avec le
     compte connecté, via les paramètres d'URL gmail|outlook=connected&accountId).
   • Apple / iCloud → mot de passe d'application + serveurs iCloud préremplis.
   • Autre fournisseur → autodétection IMAP/SMTP depuis le domaine, champs
     éditables, test réel de réception et d'envoi.
   Réutilise les services existants : /api/connectors/{gmail,outlook}/start,
   /api/mail-connector/{autodetect,test-config,test-smtp,accounts}.
   ──────────────────────────────────────────────────────────────────────── */

const RETURN_TO = "/messagerie/parametres-emails";

type ProviderKey = "google" | "gmail" | "apple" | "microsoft" | "custom";
type Security = "tls" | "starttls" | "none";
type Step = "provider" | "gmail" | "apple" | "custom" | "test" | "options" | "summary" | "success";

type TestResult = { ok: boolean; code: string; message: string; folders?: string[] };

export type ConnectInitial = {
  /** Préselection d'un fournisseur (ex. ancienne URL ?provider=icloud). */
  provider?: ProviderKey;
  /** Reprise après OAuth : compte déjà créé par le callback. */
  oauthAccount?: MailAccountVM | null;
  oauthProvider?: "google" | "microsoft";
  /** Message d'erreur OAuth à afficher au 1er écran. */
  error?: string | null;
};

type Draft = {
  provider: ProviderKey;
  name: string;
  email: string;
  displayName: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: Security;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: Security;
  sameSmtpCreds: boolean;
  watchedFolder: string;
  syncIntervalMinutes: number;
  syncEnabled: boolean;
  sendEnabled: boolean;
  importAttachments: boolean;
  defaultAccount: boolean;
};

function emptyDraft(provider: ProviderKey = "custom"): Draft {
  return {
    provider,
    name: "",
    email: "",
    displayName: "",
    password: "",
    imapHost: "",
    imapPort: 993,
    imapSecurity: "tls",
    smtpHost: "",
    smtpPort: 587,
    smtpSecurity: "starttls",
    sameSmtpCreds: true,
    watchedFolder: "INBOX",
    syncIntervalMinutes: 30,
    syncEnabled: true,
    sendEnabled: true,
    importAttachments: true,
    defaultAccount: false,
  };
}

const inputCls =
  "h-10 w-full rounded-xl border px-3 text-[13.5px] outline-none transition focus:border-[var(--accent)]";

export function ConnectMailboxModal({
  initial,
  onClose,
  onConnected,
  googleOAuthAvailable = false,
  microsoftOAuthAvailable = false,
}: {
  initial?: ConnectInitial;
  onClose: () => void;
  onConnected?: () => void;
  /** L'OAuth Google est-il configuré côté serveur (GOOGLE_CLIENT_ID…) ? Si non,
   *  on n'affiche que le chemin « mot de passe d'application » (IMAP). */
  googleOAuthAvailable?: boolean;
  /** L'OAuth Microsoft est-il configuré (MICROSOFT_CLIENT_ID…) ? */
  microsoftOAuthAvailable?: boolean;
}) {
  const router = useRouter();
  const oauthAccount = initial?.oauthAccount ?? null;

  const [step, setStep] = useState<Step>(() => {
    if (oauthAccount) return "options";
    if (initial?.provider === "apple") return "apple";
    if (initial?.provider === "custom") return "custom";
    return "provider";
  });
  const [draft, setDraft] = useState<Draft>(() => {
    if (oauthAccount) {
      const d = emptyDraft(initial?.oauthProvider === "microsoft" ? "microsoft" : "google");
      d.name = oauthAccount.name;
      d.email = oauthAccount.email;
      d.displayName = oauthAccount.name;
      d.watchedFolder = oauthAccount.watchedFolder || "INBOX";
      d.syncIntervalMinutes = oauthAccount.syncIntervalMinutes || 30;
      d.defaultAccount = oauthAccount.isDefault;
      return d;
    }
    if (initial?.provider === "apple") return applyApple(emptyDraft("apple"));
    return emptyDraft(initial?.provider ?? "custom");
  });

  const [accountId, setAccountId] = useState<string | null>(oauthAccount?.id ?? null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initial?.error ?? null);
  const [imapTest, setImapTest] = useState<TestResult | null>(null);
  const [smtpTest, setSmtpTest] = useState<TestResult | null>(null);
  const [detectMsg, setDetectMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isOAuth = draft.provider === "google" || draft.provider === "microsoft";
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // Verrou de scroll + Échap (sauf opération critique en cours).
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose, busy]);

  /* ── Sélection du fournisseur ─────────────────────────────────────────── */
  function selectProvider(p: ProviderKey) {
    setError(null);
    // Google → on privilégie le « mot de passe d'application » (IMAP), sans aucune
    // configuration serveur. L'OAuth Google reste proposé en option si configuré.
    if (p === "google" || p === "gmail") { setDraft(applyGmail(emptyDraft("gmail"))); setStep("gmail"); return; }
    // Microsoft (Outlook/Hotmail) : l'auth basique étant désactivée, OAuth est
    // obligatoire → redirection contrôlée.
    if (p === "microsoft") { startOAuth("microsoft"); return; }
    if (p === "apple") { setDraft(applyApple(emptyDraft("apple"))); setStep("apple"); return; }
    setDraft(emptyDraft("custom")); setStep("custom");
  }

  /** Lance le flux OAuth (redirection contrôlée). Au retour, la modale se rouvre
   *  à l'étape « options » (cf. page paramètres → initialConnect). */
  function startOAuth(provider: "google" | "microsoft") {
    setError(null);
    setBusy(true);
    setProgress(provider === "google" ? "Ouverture de Google…" : "Ouverture de Microsoft…");
    const start = provider === "google" ? "/api/connectors/gmail/start" : "/api/connectors/outlook/start";
    window.location.assign(`${start}?returnTo=${encodeURIComponent(RETURN_TO)}`);
  }

  /* ── Autodétection (autre fournisseur) ────────────────────────────────── */
  async function autodetect(email: string) {
    if (!email.includes("@") || !email.split("@")[1]?.includes(".")) return;
    setDetectMsg(null);
    try {
      const res = await fetch(`/api/mail-connector/autodetect?email=${encodeURIComponent(email.trim())}`, { credentials: "include", cache: "no-store" });
      const body = (await res.json()) as { detect?: { imapHost: string; imapPort: number; encryption: Security; smtpHost?: string; smtpPort?: number; smtpEncryption?: Security; source: string } };
      if (res.ok && body.detect) {
        patch({
          imapHost: body.detect.imapHost,
          imapPort: body.detect.imapPort,
          imapSecurity: body.detect.encryption,
          smtpHost: body.detect.smtpHost ?? draft.smtpHost,
          smtpPort: body.detect.smtpPort ?? draft.smtpPort,
          smtpSecurity: body.detect.smtpEncryption ?? draft.smtpSecurity,
        });
        setDetectMsg(body.detect.source === "guess" ? "Réglages estimés — vérifiez puis testez." : "Serveurs détectés automatiquement.");
      }
    } catch { /* saisie manuelle possible */ }
  }

  /* ── Tests réels (réception IMAP + envoi SMTP) ────────────────────────── */
  async function runTests(): Promise<boolean> {
    setBusy(true); setError(null); setImapTest(null); setSmtpTest(null);
    const username = draft.email;
    const smtpUser = draft.sameSmtpCreds ? draft.email : draft.email;
    try {
      setProgress("Vérification de la réception (IMAP)…");
      const imapRes = await fetch("/api/mail-connector/test-config", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ imapHost: draft.imapHost, imapPort: draft.imapPort, encryption: draft.imapSecurity, username, watchedFolder: draft.watchedFolder, password: draft.password }),
      });
      const imapBody = (await imapRes.json()) as { result?: TestResult; error?: string };
      const imap = imapBody.result ?? { ok: false, code: "unknown", message: imapBody.error ?? "Test impossible." };
      setImapTest(imap);

      let smtp: TestResult | null = null;
      if (draft.sendEnabled && draft.smtpHost) {
        setProgress("Test de l'envoi (SMTP)…");
        const smtpRes = await fetch("/api/mail-connector/test-smtp", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ smtpHost: draft.smtpHost, smtpPort: draft.smtpPort, smtpEncryption: draft.smtpSecurity, smtpUsername: smtpUser, password: draft.password }),
        });
        const smtpBody = (await smtpRes.json()) as { result?: TestResult; error?: string };
        smtp = smtpBody.result ?? { ok: false, code: "unknown", message: smtpBody.error ?? "Test impossible." };
        setSmtpTest(smtp);
      }
      return imap.ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test impossible.");
      return false;
    } finally { setBusy(false); setProgress(null); }
  }

  /* ── Création / mise à jour du compte + 1re synchro ───────────────────── */
  async function finish() {
    setBusy(true); setError(null);
    try {
      if (isOAuth && accountId) {
        // Compte déjà créé par le callback OAuth → on applique les options.
        setProgress("Enregistrement des options…");
        await fetch(`/api/mail-connector/accounts/${accountId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ name: draft.name, watchedFolder: draft.watchedFolder, syncIntervalMinutes: draft.syncIntervalMinutes, isActive: draft.syncEnabled, isDefault: draft.defaultAccount, attachmentFilter: draft.importAttachments ? "all-compatible" : "pdf-only" }),
        });
        setProgress("Lancement de la première synchronisation…");
        if (draft.provider === "google") {
          await fetch("/api/connectors/gmail/sync", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId }) }).catch(() => {});
        } else {
          await fetch(`/api/mail-connector/accounts/${accountId}/sync`, { method: "POST", credentials: "include" }).catch(() => {});
        }
      } else {
        // Compte manuel (Apple / Autre) → création complète.
        setProgress("Enregistrement du compte…");
        const res = await fetch("/api/mail-connector/accounts", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            name: draft.name || draft.email,
            email: draft.email,
            provider: draft.provider === "apple" ? "custom-imap" : "custom-imap",
            authType: "imap-password",
            connector: "imap",
            imapHost: draft.imapHost, imapPort: draft.imapPort, encryption: draft.imapSecurity,
            username: draft.email,
            smtpHost: draft.sendEnabled ? draft.smtpHost : null,
            smtpPort: draft.sendEnabled ? draft.smtpPort : null,
            smtpEncryption: draft.sendEnabled ? draft.smtpSecurity : null,
            smtpUsername: draft.email,
            password: draft.password,
            watchedFolder: draft.watchedFolder,
            isActive: draft.syncEnabled,
            isDefault: draft.defaultAccount,
            syncIntervalMinutes: draft.syncIntervalMinutes,
            attachmentFilter: draft.importAttachments ? "all-compatible" : "pdf-only",
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { account?: { id: string }; error?: string; details?: string };
        if (!res.ok || !body.account) throw new Error(body.details ?? body.error ?? "Création impossible.");
        setAccountId(body.account.id);
        // La création déclenche déjà une relève de fond ; on n'attend pas.
      }
      setStep("success");
      router.refresh(); // actualise la liste des boîtes + compteurs sans rechargement.
      onConnected?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally { setBusy(false); setProgress(null); }
  }

  /* ── Progression visuelle (étapes) ────────────────────────────────────── */
  const flowSteps: Step[] = isOAuth
    ? ["options", "summary", "success"]
    : draft.provider === "gmail"
      ? ["gmail", "test", "options", "summary", "success"]
      : draft.provider === "apple"
        ? ["apple", "test", "options", "summary", "success"]
        : draft.provider === "custom"
          ? ["custom", "test", "options", "summary", "success"]
          : ["provider"];
  const stepIndex = Math.max(0, flowSteps.indexOf(step));

  const canTest = Boolean(draft.email && draft.imapHost && draft.password);
  const receptionState = imapTest?.ok ? "Réception opérationnelle" : imapTest ? "Réception en échec" : "Non testée";
  const sendState = !draft.sendEnabled ? "Désactivé" : smtpTest?.ok ? "Envoi opérationnel" : smtpTest ? "Envoi en échec" : "Non testé";

  return (
    <div className="fixed inset-0 z-[95] flex items-stretch justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Ajouter une boîte mail">
      <button type="button" aria-label="Fermer" onClick={() => { if (!busy) onClose(); }} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div ref={dialogRef} className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-[var(--surface)] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:rounded-3xl" style={{ border: "1px solid var(--border)" }}>
        {/* En-tête : retour + titre + fermer */}
        <div className="flex items-center gap-2 border-b px-4 py-3.5 sm:px-5" style={{ borderColor: "var(--border-soft)" }}>
          {step !== "provider" && step !== "success" && !isOAuth ? (
            <button type="button" onClick={() => goBack()} disabled={busy} aria-label="Retour" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)] disabled:opacity-40" style={{ color: "var(--text-muted)" }}>
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15.5px] font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>{stepTitle(step, draft.provider)}</h2>
            {flowSteps.length > 1 && step !== "success" ? (
              <div className="mt-1 flex items-center gap-1" aria-hidden="true">
                {flowSteps.filter((s) => s !== "success").map((s, i) => (
                  <span key={s} className="h-1.5 rounded-full transition-all" style={{ width: i === stepIndex ? 22 : 10, background: i <= stepIndex ? "var(--accent)" : "var(--border-strong)" }} />
                ))}
              </div>
            ) : null}
          </div>
          <button type="button" onClick={() => { if (!busy) onClose(); }} disabled={busy} aria-label="Fermer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-muted)] disabled:opacity-40" style={{ color: "var(--text-muted)" }}>
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Corps défilant */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {error ? (
            <p className="mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-semibold" style={{ borderColor: "#FECACA", background: "var(--gedify-red-soft)", color: "#B91C1C" }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} /> {error}
            </p>
          ) : null}

          {step === "provider" ? <ProviderStep onSelect={selectProvider} busy={busy} progress={progress} microsoftOAuthAvailable={microsoftOAuthAvailable} /> : null}
          {step === "gmail" ? <GmailStep draft={draft} patch={patch} showPassword={showPassword} setShowPassword={setShowPassword} oauthAvailable={googleOAuthAvailable} onUseOAuth={() => startOAuth("google")} busy={busy} /> : null}
          {step === "apple" ? <AppleStep draft={draft} patch={patch} showPassword={showPassword} setShowPassword={setShowPassword} /> : null}
          {step === "custom" ? <CustomStep draft={draft} patch={patch} showPassword={showPassword} setShowPassword={setShowPassword} autodetect={autodetect} detectMsg={detectMsg} /> : null}
          {step === "test" ? <TestStep imapTest={imapTest} smtpTest={smtpTest} sendEnabled={draft.sendEnabled} busy={busy} progress={progress} /> : null}
          {step === "options" ? <OptionsStep draft={draft} patch={patch} folders={imapTest?.folders ?? []} oauthEmail={isOAuth ? draft.email : null} /> : null}
          {step === "summary" ? <SummaryStep draft={draft} reception={receptionState} send={sendState} progress={progress} /> : null}
          {step === "success" ? <SuccessStep email={draft.email} /> : null}
        </div>

        {/* Pied : navigation (sticky en mobile) */}
        {step !== "provider" ? (
          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t bg-[var(--surface)] px-4 py-3 sm:px-5" style={{ borderColor: "var(--border-soft)" }}>
            {step === "success" ? (
              <>
                <button type="button" onClick={() => router.push("/messagerie")} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
                  <Inbox className="h-4 w-4" strokeWidth={2} /> Ouvrir la boîte
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={resetForAnother} className="inline-flex h-10 items-center rounded-xl border px-3.5 text-[13px] font-semibold transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Ajouter une autre</button>
                  <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-xl border px-3.5 text-[13px] font-semibold transition hover:bg-[var(--surface-muted)]" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>Fermer</button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={goBack} disabled={busy || isOAuth} className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-[13px] font-semibold transition hover:bg-[var(--surface-muted)] disabled:opacity-40" style={{ borderColor: "var(--border)", color: "var(--text-main)" }}>
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Retour
                </button>
                <PrimaryButton step={step} busy={busy} canTest={canTest} sendEnabled={draft.sendEnabled} onNext={goNext} />
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );

  /* ── Navigation entre étapes ──────────────────────────────────────────── */
  function goBack() {
    if (step === "gmail" || step === "apple" || step === "custom") { setStep("provider"); return; }
    if (step === "test") { setStep(draft.provider === "gmail" ? "gmail" : draft.provider === "apple" ? "apple" : "custom"); return; }
    if (step === "options") { setStep(isOAuth ? "options" : "test"); return; }
    if (step === "summary") { setStep("options"); return; }
  }

  async function goNext() {
    if (step === "gmail" || step === "apple" || step === "custom") {
      if (!draft.email || !draft.password || !draft.imapHost) { setError("Renseignez l'adresse, le mot de passe et le serveur IMAP."); return; }
      setStep("test");
      await runTests();
      return;
    }
    if (step === "test") {
      if (!imapTest?.ok) { const ok = await runTests(); if (!ok) return; }
      setStep("options");
      return;
    }
    if (step === "options") { setStep("summary"); return; }
    if (step === "summary") { await finish(); return; }
  }

  function resetForAnother() {
    setStep("provider"); setDraft(emptyDraft("custom")); setAccountId(null);
    setImapTest(null); setSmtpTest(null); setError(null); setDetectMsg(null);
  }
}

/* ── Préréglage Apple / iCloud ──────────────────────────────────────────── */
function applyApple(d: Draft): Draft {
  return { ...d, provider: "apple", name: "iCloud", imapHost: "imap.mail.me.com", imapPort: 993, imapSecurity: "tls", smtpHost: "smtp.mail.me.com", smtpPort: 587, smtpSecurity: "starttls" };
}

/* ── Préréglage Gmail (mot de passe d'application, IMAP) ─────────────────── */
function applyGmail(d: Draft): Draft {
  return { ...d, provider: "gmail", name: "Gmail", imapHost: "imap.gmail.com", imapPort: 993, imapSecurity: "tls", smtpHost: "smtp.gmail.com", smtpPort: 587, smtpSecurity: "starttls" };
}

function stepTitle(step: Step, provider: ProviderKey): string {
  if (step === "provider") return "Ajouter une boîte mail";
  if (step === "gmail") return "Connexion Gmail";
  if (step === "apple") return "Connexion Apple / iCloud";
  if (step === "custom") return "Configurer un fournisseur";
  if (step === "test") return "Vérification de la connexion";
  if (step === "options") return "Options de la boîte";
  if (step === "summary") return "Confirmation";
  if (step === "success") return "Boîte connectée";
  return provider;
}

function PrimaryButton({ step, busy, canTest, sendEnabled, onNext }: { step: Step; busy: boolean; canTest: boolean; sendEnabled: boolean; onNext: () => void }) {
  const label = step === "summary" ? "Connecter la boîte" : step === "test" ? "Continuer" : step === "gmail" || step === "apple" || step === "custom" ? "Tester et continuer" : "Continuer";
  const disabled = busy || ((step === "gmail" || step === "apple" || step === "custom") && !canTest);
  void sendEnabled;
  return (
    <button type="button" onClick={onNext} disabled={disabled} className="inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: "var(--accent)" }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
      {!busy ? <ChevronRight className="h-4 w-4" strokeWidth={2.5} /> : null}
    </button>
  );
}

/* ── Étape 1 : choix du fournisseur ─────────────────────────────────────── */
function ProviderStep({ onSelect, busy, progress, microsoftOAuthAvailable }: { onSelect: (p: ProviderKey) => void; busy: boolean; progress: string | null; microsoftOAuthAvailable: boolean }) {
  return (
    <div>
      <p className="mb-4 text-[12.5px]" style={{ color: "var(--text-muted)" }}>Choisissez le fournisseur de votre adresse email.</p>
      {busy && progress ? (
        <p className="mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> {progress}
        </p>
      ) : null}
      <div className="space-y-2.5">
        <ProviderChoice onClick={() => onSelect("gmail")} disabled={busy} title="Continuer avec Google" sub="Gmail et Google Workspace · mot de passe d'application" badge="G" badgeColor="#EA4335" />
        <ProviderChoice onClick={() => onSelect("apple")} disabled={busy} title="Continuer avec Apple / iCloud" sub="iCloud Mail, me.com et mac.com" icon={Mail} badgeColor="#0F172A" />
        <ProviderChoice onClick={() => onSelect("microsoft")} disabled={busy} title="Continuer avec Microsoft" sub={microsoftOAuthAvailable ? "Outlook, Hotmail, Live et Microsoft 365" : "Outlook, Hotmail, Live — connexion sécurisée (OAuth)"} badge="⊞" badgeColor="#0078D4" />
        <ProviderChoice onClick={() => onSelect("custom")} disabled={busy} title="Configurer un autre fournisseur" sub="Yahoo, La Poste ou serveur IMAP / SMTP" icon={Settings2} badgeColor="#64748B" />
      </div>
    </div>
  );
}

function ProviderChoice({ onClick, disabled, title, sub, icon: Icon, badge, badgeColor }: { onClick: () => void; disabled?: boolean; title: string; sub: string; icon?: React.ElementType; badge?: string; badgeColor: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition hover:bg-[var(--bg-card-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50" style={{ borderColor: "var(--border)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[16px] font-extrabold text-white" style={{ background: badgeColor }} aria-hidden="true">
        {badge ?? (Icon ? <Icon className="h-5 w-5" strokeWidth={1.85} /> : "?")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{title}</span>
        <span className="block truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} style={{ color: "var(--text-hint)" }} aria-hidden="true" />
    </button>
  );
}

/* ── Étape Gmail (mot de passe d'application, IMAP) ──────────────────────── */
function GmailStep({ draft, patch, showPassword, setShowPassword, oauthAvailable, onUseOAuth, busy }: { draft: Draft; patch: (p: Partial<Draft>) => void; showPassword: boolean; setShowPassword: (v: boolean) => void; oauthAvailable: boolean; onUseOAuth: () => void; busy: boolean }) {
  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.85} />
        <p className="text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
          Google demande un <strong>mot de passe d&apos;application</strong> (et non votre mot de passe Gmail). Activez d&apos;abord la validation en 2&nbsp;étapes, puis créez-en un sur <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--accent)" }}>myaccount.google.com/apppasswords</a>. Aucune configuration serveur n&apos;est nécessaire.
        </p>
      </div>
      <Field label="Adresse Gmail" required>
        <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value, name: draft.name || "Gmail" })} placeholder="prenom@gmail.com" className={inputCls} style={{ borderColor: "var(--border-strong)" }} autoFocus />
      </Field>
      <Field label="Mot de passe d'application" required>
        <PasswordInput value={draft.password} onChange={(v) => patch({ password: v })} show={showPassword} toggle={() => setShowPassword(!showPassword)} placeholder="xxxx xxxx xxxx xxxx" />
      </Field>
      <Field label="Nom affiché de l'expéditeur">
        <input value={draft.displayName} onChange={(e) => patch({ displayName: e.target.value })} placeholder="Votre nom" className={inputCls} style={{ borderColor: "var(--border-strong)" }} />
      </Field>
      <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>
        Serveurs préremplis : IMAP imap.gmail.com:993 (SSL/TLS) · SMTP smtp.gmail.com:587 (STARTTLS).
      </p>
      {oauthAvailable ? (
        <button type="button" onClick={onUseOAuth} disabled={busy} className="inline-flex items-center gap-1.5 text-[12px] font-semibold underline disabled:opacity-50" style={{ color: "var(--accent)" }}>
          Préférez-vous l&apos;authentification Google (OAuth) ? Se connecter avec Google
        </button>
      ) : null}
    </div>
  );
}

/* ── Étape Apple / iCloud ───────────────────────────────────────────────── */
function AppleStep({ draft, patch, showPassword, setShowPassword }: { draft: Draft; patch: (p: Partial<Draft>) => void; showPassword: boolean; setShowPassword: (v: boolean) => void }) {
  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--bg-card-soft)" }}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={1.85} />
        <p className="text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
          Pour connecter iCloud Mail, Apple demande un <strong>mot de passe spécifique à l&apos;application</strong> (et non votre mot de passe Apple principal). Créez-le sur <a href="https://account.apple.com" target="_blank" rel="noreferrer" className="font-semibold underline" style={{ color: "var(--accent)" }}>account.apple.com</a> → Sécurité.
        </p>
      </div>
      <Field label="Adresse iCloud" required>
        <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value, name: draft.name || "iCloud" })} placeholder="prenom@icloud.com" className={inputCls} style={{ borderColor: "var(--border-strong)" }} autoFocus />
      </Field>
      <Field label="Mot de passe d'application" required>
        <PasswordInput value={draft.password} onChange={(v) => patch({ password: v })} show={showPassword} toggle={() => setShowPassword(!showPassword)} placeholder="xxxx-xxxx-xxxx-xxxx" />
      </Field>
      <Field label="Nom affiché de l'expéditeur">
        <input value={draft.displayName} onChange={(e) => patch({ displayName: e.target.value })} placeholder="Votre nom" className={inputCls} style={{ borderColor: "var(--border-strong)" }} />
      </Field>
      <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>
        Serveurs préremplis : IMAP imap.mail.me.com:993 (SSL/TLS) · SMTP smtp.mail.me.com:587 (STARTTLS).
      </p>
    </div>
  );
}

/* ── Étape Autre fournisseur ────────────────────────────────────────────── */
function CustomStep({ draft, patch, showPassword, setShowPassword, autodetect, detectMsg }: { draft: Draft; patch: (p: Partial<Draft>) => void; showPassword: boolean; setShowPassword: (v: boolean) => void; autodetect: (email: string) => void; detectMsg: string | null }) {
  return (
    <div className="space-y-3.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom du compte">
          <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Pro, Perso…" className={inputCls} style={{ borderColor: "var(--border-strong)" }} />
        </Field>
        <Field label="Nom affiché de l'expéditeur">
          <input value={draft.displayName} onChange={(e) => patch({ displayName: e.target.value })} placeholder="Votre nom" className={inputCls} style={{ borderColor: "var(--border-strong)" }} />
        </Field>
      </div>
      <Field label="Adresse email" required hint="À la sortie du champ, les serveurs sont détectés automatiquement.">
        <input type="email" value={draft.email} onChange={(e) => patch({ email: e.target.value })} onBlur={(e) => autodetect(e.target.value)} placeholder="vous@exemple.fr" className={inputCls} style={{ borderColor: "var(--border-strong)" }} autoFocus />
      </Field>
      <Field label="Mot de passe ou mot de passe d'application" required>
        <PasswordInput value={draft.password} onChange={(v) => patch({ password: v })} show={showPassword} toggle={() => setShowPassword(!showPassword)} />
      </Field>
      {detectMsg ? <p className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "#15803D" }}><Sparkles className="h-3.5 w-3.5" strokeWidth={2} /> {detectMsg}</p> : null}

      <details className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }}>Paramètres avancés (IMAP / SMTP)</summary>
        <div className="space-y-3 border-t px-3 py-3" style={{ borderColor: "var(--border-soft)" }}>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Réception (IMAP)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Serveur"><input value={draft.imapHost} onChange={(e) => patch({ imapHost: e.target.value })} className={inputCls} style={{ borderColor: "var(--border-strong)" }} /></Field>
            <Field label="Port"><input type="number" value={draft.imapPort} onChange={(e) => patch({ imapPort: Number(e.target.value) })} className={inputCls} style={{ borderColor: "var(--border-strong)" }} /></Field>
            <Field label="Sécurité"><SecuritySelect value={draft.imapSecurity} onChange={(v) => patch({ imapSecurity: v })} /></Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px]" style={{ color: "var(--text-main)" }}>
            <input type="checkbox" checked={draft.sameSmtpCreds} onChange={(e) => patch({ sameSmtpCreds: e.target.checked })} className="h-4 w-4 rounded" /> Utiliser les mêmes identifiants pour l&apos;envoi (SMTP)
          </label>
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Envoi (SMTP)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Serveur"><input value={draft.smtpHost} onChange={(e) => patch({ smtpHost: e.target.value })} className={inputCls} style={{ borderColor: "var(--border-strong)" }} /></Field>
            <Field label="Port"><input type="number" value={draft.smtpPort} onChange={(e) => patch({ smtpPort: Number(e.target.value) })} className={inputCls} style={{ borderColor: "var(--border-strong)" }} /></Field>
            <Field label="Sécurité"><SecuritySelect value={draft.smtpSecurity} onChange={(v) => patch({ smtpSecurity: v })} /></Field>
          </div>
        </div>
      </details>
    </div>
  );
}

/* ── Étape Vérification ─────────────────────────────────────────────────── */
function TestStep({ imapTest, smtpTest, sendEnabled, busy, progress }: { imapTest: TestResult | null; smtpTest: TestResult | null; sendEnabled: boolean; busy: boolean; progress: string | null }) {
  return (
    <div className="space-y-3">
      {busy ? (
        <p className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" /> {progress ?? "Test en cours…"}
        </p>
      ) : null}
      <TestRow icon={Inbox} label="Réception (IMAP)" result={imapTest} />
      {sendEnabled ? <TestRow icon={Send} label="Envoi (SMTP)" result={smtpTest} /> : null}
      {imapTest && imapTest.folders && imapTest.folders.length > 0 ? (
        <p className="text-[11.5px]" style={{ color: "var(--text-hint)" }}>{imapTest.folders.length} dossier(s) détecté(s).</p>
      ) : null}
      {imapTest && !imapTest.ok ? (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Vous pouvez revenir en arrière pour corriger les paramètres, ou réessayer.</p>
      ) : null}
    </div>
  );
}

function TestRow({ icon: Icon, label, result }: { icon: React.ElementType; label: string; result: TestResult | null }) {
  const ok = result?.ok;
  return (
    <div className="flex items-start gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} strokeWidth={1.85} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{label}</p>
        <p className="text-[12px]" style={{ color: ok ? "#15803D" : result ? "#B91C1C" : "var(--text-muted)" }}>{result?.message ?? "En attente du test…"}</p>
      </div>
      {result ? (ok ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#15803D" }} strokeWidth={2} /> : <XCircle className="h-5 w-5 shrink-0" style={{ color: "#B91C1C" }} strokeWidth={2} />) : null}
    </div>
  );
}

/* ── Étape Options ──────────────────────────────────────────────────────── */
function OptionsStep({ draft, patch, folders, oauthEmail }: { draft: Draft; patch: (p: Partial<Draft>) => void; folders: string[]; oauthEmail: string | null }) {
  return (
    <div className="space-y-4">
      {oauthEmail ? (
        <div className="flex items-center gap-2.5 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--gedify-green-soft)", background: "var(--gedify-green-soft)" }}>
          <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#15803D" }} strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>Compte {draft.provider === "microsoft" ? "Microsoft" : "Google"} connecté</p>
            <p className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{oauthEmail}</p>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>Fonctions à activer</p>
        <div className="space-y-1.5">
          <Toggle checked={draft.syncEnabled} onChange={(v) => patch({ syncEnabled: v })} label="Synchroniser les courriels" />
          <Toggle checked={draft.sendEnabled} onChange={(v) => patch({ sendEnabled: v })} label="Autoriser l'envoi" />
          <Toggle checked={draft.importAttachments} onChange={(v) => patch({ importAttachments: v })} label="Importer les pièces jointes dans GEDify" />
          <Toggle checked={draft.defaultAccount} onChange={(v) => patch({ defaultAccount: v })} label="Utiliser ce compte par défaut" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fréquence de synchronisation">
          <select value={draft.syncIntervalMinutes} onChange={(e) => patch({ syncIntervalMinutes: Number(e.target.value) })} className={inputCls} style={{ borderColor: "var(--border-strong)" }}>
            <option value={5}>Toutes les 5 minutes</option>
            <option value={15}>Toutes les 15 minutes</option>
            <option value={30}>Toutes les 30 minutes</option>
            <option value={60}>Toutes les heures</option>
            <option value={0}>Manuellement</option>
          </select>
        </Field>
        <Field label="Dossier surveillé">
          {folders.length > 0 ? (
            <select value={draft.watchedFolder} onChange={(e) => patch({ watchedFolder: e.target.value })} className={inputCls} style={{ borderColor: "var(--border-strong)" }}>
              {folders.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          ) : (
            <input value={draft.watchedFolder} onChange={(e) => patch({ watchedFolder: e.target.value })} className={inputCls} style={{ borderColor: "var(--border-strong)" }} />
          )}
        </Field>
      </div>
    </div>
  );
}

/* ── Étape Résumé ───────────────────────────────────────────────────────── */
function SummaryStep({ draft, reception, send, progress }: { draft: Draft; reception: string; send: string; progress: string | null }) {
  const providerLabel = draft.provider === "google" ? "Google" : draft.provider === "gmail" ? "Gmail (mot de passe d'application)" : draft.provider === "microsoft" ? "Microsoft" : draft.provider === "apple" ? "Apple / iCloud" : "Autre fournisseur";
  const freq = draft.syncIntervalMinutes === 0 ? "Manuelle" : `Toutes les ${draft.syncIntervalMinutes} min`;
  return (
    <div className="space-y-2.5">
      <dl className="grid grid-cols-2 gap-2.5">
        <Recap label="Compte" value={draft.email} />
        <Recap label="Fournisseur" value={providerLabel} />
        <Recap label="Réception" value={reception} />
        <Recap label="Envoi" value={send} />
        <Recap label="Synchronisation" value={freq} />
        <Recap label="Pièces jointes GED" value={draft.importAttachments ? "Activées" : "Désactivées"} />
        <Recap label="Compte par défaut" value={draft.defaultAccount ? "Oui" : "Non"} />
        <Recap label="Dossier" value={draft.watchedFolder} />
      </dl>
      {progress ? <p className="flex items-center gap-2 pt-1 text-[12.5px] font-semibold" style={{ color: "var(--text-muted)" }}><Loader2 className="h-4 w-4 animate-spin" /> {progress}</p> : null}
    </div>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: "var(--border-soft)", background: "var(--bg-card-soft)" }}>
      <dt className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{value || "—"}</dd>
    </div>
  );
}

/* ── Étape Succès ───────────────────────────────────────────────────────── */
function SuccessStep({ email }: { email: string }) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--gedify-green-soft)", color: "#15803D" }}>
        <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
      </span>
      <p className="text-[16px] font-extrabold" style={{ color: "var(--text-main)" }}>Boîte mail connectée avec succès</p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>{email}</p>
      <p className="mt-2 text-[12px]" style={{ color: "var(--text-hint)" }}>La première synchronisation démarre en arrière-plan.</p>
    </div>
  );
}

/* ── Champs réutilisables ───────────────────────────────────────────────── */
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold" style={{ color: "var(--text-main)" }}>{label}{required ? <span style={{ color: "var(--accent)" }}> *</span> : null}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px]" style={{ color: "var(--text-hint)" }}>{hint}</span> : null}
    </label>
  );
}

function PasswordInput({ value, onChange, show, toggle, placeholder }: { value: string; onChange: (v: string) => void; show: boolean; toggle: () => void; placeholder?: string }) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="new-password" placeholder={placeholder} className={`${inputCls} pr-11`} style={{ borderColor: "var(--border-strong)" }} />
      <button type="button" onClick={toggle} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition hover:bg-[var(--surface-muted)]" style={{ color: "var(--text-muted)" }}>
        {show ? <EyeOff className="h-4 w-4" strokeWidth={1.85} /> : <Eye className="h-4 w-4" strokeWidth={1.85} />}
      </button>
    </div>
  );
}

function SecuritySelect({ value, onChange }: { value: Security; onChange: (v: Security) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Security)} className={inputCls} style={{ borderColor: "var(--border-strong)" }}>
      <option value="tls">SSL / TLS</option>
      <option value="starttls">STARTTLS</option>
      <option value="none">Aucune — à éviter</option>
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition hover:bg-[var(--bg-card-soft)]" style={{ borderColor: "var(--border)" }}>
      <span className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" style={{ accentColor: "var(--accent)" }} />
    </label>
  );
}
